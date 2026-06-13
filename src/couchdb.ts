import PouchDB from "pouchdb";
import PouchHttp from "pouchdb-adapter-http";
PouchDB.plugin(PouchHttp);

import { IDPrefixes, SALT_OF_PASSPHRASE } from "@lib/common/models/shared.const.behabiour";
import { EntryTypes } from "@lib/common/models/db.const";
import type { DocumentID } from "@lib/common/models/db.type";
import { path2id_base } from "@lib/string_and_binary/path";
import { decrypt as decryptV1 } from "octagonal-wheels/encryption/encryption";
import { decrypt as decryptHKDF, encrypt as encryptHKDF } from "octagonal-wheels/encryption/hkdf";
import crypto from "node:crypto";

export interface FileInfo {
  path: string;
  type: string;
  size: number;
  mtime: number;
  ctime: number;
}

export interface SearchResult {
  path: string;
  content: string;
}

export interface CouchDBOptions {
  cacheTtl?: number;
  requestTimeout?: number;
}

const ENCRYPTED_META_PREFIX = "/\\:";
const ENCRYPT_HKDF_HEADER = "%=";
const ENCRYPT_OLD_HEADER = "%";

function simpleContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isEncryptedChunkId(id: string): boolean {
  return id.startsWith(IDPrefixes.EncryptedChunk);
}

function isEncryptedMetaPath(path: string): boolean {
  return path.startsWith(ENCRYPTED_META_PREFIX);
}

export class CouchDBClient {
  private db: PouchDB.Database;
  private passphrase: string | undefined;
  private cacheTtl: number;
  private requestTimeout: number;

  constructor(url: string, passphrase?: string, options?: CouchDBOptions) {
    this.db = new PouchDB(url, { adapter: "http" });
    this.passphrase = passphrase;
    this.cacheTtl = options?.cacheTtl ?? 60;
    this.requestTimeout = options?.requestTimeout ?? 30000;
  }

  async listFiles(prefix?: string): Promise<FileInfo[]> {
    const result = await this.retry(() =>
      this.db.allDocs<any>({
        include_docs: true,
        startkey: prefix ? prefix.toLowerCase() : undefined,
        endkey: prefix ? prefix.toLowerCase() + "\uffff" : undefined,
      }),
    );

    const files: FileInfo[] = [];
    for (const row of result.rows) {
      if (!("doc" in row) || !row.doc || row.doc._deleted || row.doc.deleted) continue;
      const doc = row.doc;
      if (doc.type !== EntryTypes.NOTE_PLAIN && doc.type !== EntryTypes.NOTE_BINARY) continue;

      const filePath = await this.resolvePath(doc);
      if (!filePath) continue;

      files.push({
        path: filePath,
        type: doc.type,
        size: doc.size || 0,
        mtime: doc.mtime || 0,
        ctime: doc.ctime || 0,
      });
    }
    return files;
  }

  async getFileContent(path: string): Promise<string | null> {
    const docId = await this.pathToId(path);
    try {
      const meta = await this.retry(() => this.db.get<any>(docId));
      if (meta.deleted || meta._deleted) return null;

      if (!meta.children || meta.children.length === 0) return "";

      const chunks = await this.retry(() =>
        this.db.allDocs<any>({
          keys: meta.children,
          include_docs: true,
        }),
      );

      let content = "";
      for (const row of chunks.rows) {
        if (!("doc" in row) || !row.doc) continue;
        if (row.doc.type !== EntryTypes.CHUNK) continue;

        let data = row.doc.data || "";
        if (this.passphrase) {
          data = await this.decryptData(data, row.doc._id);
        }
        content += data;
      }
      return content;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async storeContent(path: string, content: string): Promise<boolean> {
    try {
      const docId = await this.pathToId(path);
      const chunkHash = simpleContentHash(content);

      let chunkId: string;
      if (this.passphrase) {
        chunkId = `${IDPrefixes.EncryptedChunk}${chunkHash}`;
      } else {
        chunkId = `${IDPrefixes.Chunk}${chunkHash}`;
      }

      let existingMeta: any = null;
      let oldChunkIds: string[] = [];
      try {
        existingMeta = await this.retry(() => this.db.get(docId));
        oldChunkIds = existingMeta.children || [];
      } catch {
        // new file
      }

      let chunkData = content;
      if (this.passphrase) {
        chunkData = await this.encryptData(content);
      }

      try {
        await this.retry(() => this.db.get(chunkId));
      } catch {
        await this.retry(() =>
          this.db.put({
            _id: chunkId,
            type: EntryTypes.CHUNK,
            data: chunkData,
          }),
        );
      }

      let storeCtime = Date.now();
      if (existingMeta) {
        storeCtime = existingMeta.ctime || storeCtime;
      }

      const entry: any = {
        _id: docId,
        type: EntryTypes.NOTE_PLAIN,
        path: path,
        children: [chunkId],
        ctime: storeCtime,
        mtime: Date.now(),
        size: content.length,
      };

      if (existingMeta) {
        entry._rev = existingMeta._rev;
      }

      await this.retry(() => this.db.put(entry));

      for (const oldChunkId of oldChunkIds) {
        if (oldChunkId !== chunkId) {
          try {
            const oldChunk = await this.retry(() => this.db.get(oldChunkId));
            await this.retry(() => this.db.put({ ...oldChunk, _deleted: true }));
          } catch {
            // ignore
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      const docId = await this.pathToId(path);
      const meta = await this.retry(() => this.db.get<any>(docId));
      if (meta._deleted || meta.deleted) return false;

      const children = meta.children || [];
      for (const childId of children) {
        try {
          const chunk = await this.retry(() => this.db.get(childId));
          await this.retry(() => this.db.put({ ...chunk, _deleted: true }));
        } catch {
          // chunk may already be deleted
        }
      }

      await this.retry(() => this.db.put({ ...meta, _deleted: true }));
      return true;
    } catch (err: any) {
      if (err.status === 404) return false;
      throw err;
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const allDocs = await this.retry(() => this.db.allDocs<any>({ include_docs: true }));

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const row of allDocs.rows) {
      if (!("doc" in row) || !row.doc || row.doc._deleted || row.doc.deleted) continue;
      const doc = row.doc;
      if (doc.type !== EntryTypes.NOTE_PLAIN && doc.type !== EntryTypes.NOTE_BINARY) continue;

      const filePath = await this.resolvePath(doc);
      if (!filePath) continue;

      if (!filePath.toLowerCase().includes(lowerQuery)) continue;

      const content = await this.getFileContent(filePath);
      if (content !== null) {
        results.push({ path: filePath, content });
      }
    }
    return results;
  }

  private get pbkdf2Salt(): Uint8Array<ArrayBuffer> {
    const hash = crypto
      .createHash("sha256")
      .update(this.passphrase || "")
      .digest();
    return new Uint8Array(hash.buffer, hash.byteOffset, hash.byteLength) as Uint8Array<ArrayBuffer>;
  }

  private async decryptData(data: string, docId: string): Promise<string> {
    if (!this.passphrase) return data;

    if (isEncryptedChunkId(docId) || data.startsWith(ENCRYPT_HKDF_HEADER)) {
      try {
        return await decryptHKDF(data, this.passphrase, this.pbkdf2Salt);
      } catch {
        // fallback to V1
      }
    }

    if (data.startsWith(ENCRYPT_OLD_HEADER)) {
      try {
        return await decryptV1(data, this.passphrase, true);
      } catch {
        return await decryptV1(data, this.passphrase, false);
      }
    }

    return data;
  }

  private async encryptData(data: string): Promise<string> {
    return await encryptHKDF(data, this.passphrase!, this.pbkdf2Salt);
  }

  private async resolvePath(doc: any): Promise<string | null> {
    let filePath = doc.path;
    if (isEncryptedMetaPath(filePath) && this.passphrase) {
      try {
        const encrypted = filePath.slice(ENCRYPTED_META_PREFIX.length);
        const decrypted = await decryptHKDF(encrypted, this.passphrase + SALT_OF_PASSPHRASE, this.pbkdf2Salt);
        const parsed = JSON.parse(decrypted);
        filePath = parsed.path;
      } catch {
        return null;
      }
    }
    return filePath;
  }

  private async pathToId(rawPath: string): Promise<DocumentID> {
    const caseInsensitive = true;
    if (this.passphrase) {
      const obfuscatedId = await path2id_base(rawPath as any, this.passphrase, caseInsensitive);
      try {
        await this.db.get(obfuscatedId);
        return obfuscatedId;
      } catch {
        // fall through
      }
    }
    return await path2id_base(rawPath as any, false, caseInsensitive);
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (err.status === 404 || err.status === 409 || i === attempts - 1) throw err;
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 100));
      }
    }
    throw lastErr;
  }
}
