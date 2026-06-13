import { loadConfig } from "./config.js";
import { Logger, setLogLevel } from "./logger.js";
import { CouchDBClient } from "./couchdb.js";
import { MCPServer } from "./mcp-server.js";

let config;
try {
  config = loadConfig();
} catch (err: any) {
  console.error(err.message);
  process.exit(1);
}

setLogLevel(config.logLevel);
const log = new Logger("main");

const protocol = config.hostname.startsWith("https://") ? "https" : "http";
const baseHost = config.hostname.replace(/^https?:\/\//, "");
const credentials = config.username
  ? `${config.username}:${encodeURIComponent(config.password)}@`
  : "";
const url = `${protocol}://${credentials}${baseHost}/${config.dbname}`;
const healthCouchdbUrl = `${protocol}://${baseHost}`;

const client = new CouchDBClient(url, config.passphrase, {
  cacheTtl: config.cacheTtl,
  requestTimeout: config.requestTimeout,
});
const server = new MCPServer(client, {
  apiKey: config.mcpApiKey,
  port: config.mcpPort,
  couchdbUrl: healthCouchdbUrl,
  logger: log.child("mcp"),
});

async function shutdown(signal: string) {
  log.info("Shutting down", { signal });
  await server.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.start(config.mcpTransport).catch((err) => {
  log.error("Failed to start server", { error: err.message });
  process.exit(1);
});
