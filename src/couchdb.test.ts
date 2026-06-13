import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPlugin = vi.fn();
const mockDbInstance: any = {};

vi.mock("pouchdb", () => ({
  default: Object.assign(
    vi.fn(() => mockDbInstance),
    { plugin: mockPlugin },
  ),
  __esModule: true,
}));

vi.mock("pouchdb-adapter-http", () => ({ default: {}, __esModule: true }));

describe("CouchDBClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("constructs with URL and passphrase", async () => {
    const { CouchDBClient } = await import("./couchdb.js");
    const client = new CouchDBClient("http://localhost:5984/db", "testphrase");
    expect(client).toBeInstanceOf(CouchDBClient);
    expect(mockPlugin).toHaveBeenCalled();
  });

  it("constructs without passphrase", async () => {
    const { CouchDBClient } = await import("./couchdb.js");
    const client = new CouchDBClient("http://localhost:5984/db");
    expect(client).toBeInstanceOf(CouchDBClient);
  });

  it("accepts options", async () => {
    const { CouchDBClient } = await import("./couchdb.js");
    const client = new CouchDBClient("http://localhost:5984/db", "phrase", {
      cacheTtl: 120,
      requestTimeout: 60000,
    });
    expect(client).toBeInstanceOf(CouchDBClient);
  });
});
