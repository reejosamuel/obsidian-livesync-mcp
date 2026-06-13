import { describe, it, expect, beforeEach } from "vitest";

const ORIG_ENV = { ...process.env };

describe("Config loading", () => {
  beforeEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("loads config from env vars", async () => {
    process.env.hostname = "https://test.example.com";
    process.env.dbname = "testdb";
    process.env.username = "user";
    process.env.password = "pass";
    process.env.PASSPHRASE = "secret";
    process.env.MCP_API_KEY = "apikey123";
    process.env.MCP_TRANSPORT = "sse";
    process.env.MCP_PORT = "9999";
    process.env.LOG_LEVEL = "debug";
    process.env.CACHE_TTL = "120";
    process.env.REQUEST_TIMEOUT = "60000";
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    expect(config.hostname).toBe("https://test.example.com");
    expect(config.dbname).toBe("testdb");
    expect(config.passphrase).toBe("secret");
    expect(config.mcpApiKey).toBe("apikey123");
    expect(config.mcpTransport).toBe("sse");
    expect(config.mcpPort).toBe(9999);
    expect(config.cacheTtl).toBe(120);
  });

  it("falls back to PASSPHRASE", async () => {
    process.env.hostname = "https://test.example.com";
    process.env.dbname = "testdb";
    process.env.PASSPHRASE = "secret";
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    expect(config.passphrase).toBe("secret");
  });

  it("uses defaults for optional fields", async () => {
    process.env.hostname = "https://test.example.com";
    process.env.dbname = "testdb";
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    expect(config.mcpTransport).toBe("stdio");
    expect(config.mcpPort).toBe(3100);
    expect(config.logLevel).toBe("info");
    expect(config.cacheTtl).toBe(60);
    expect(config.requestTimeout).toBe(30000);
  });

  it("throws on missing required fields", async () => {
    delete process.env.hostname;
    delete process.env.dbname;
    await expect(async () => {
      const { loadConfig } = await import("./config.js");
      loadConfig();
    }).rejects.toThrow();
  });
});
