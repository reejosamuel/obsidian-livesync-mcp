import { describe, it, expect, vi } from "vitest";
import { checkHealth } from "./health.js";

describe("checkHealth", () => {
  const mockLogger = { error: vi.fn() } as any;

  it("returns ok when CouchDB responds", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const result = await checkHealth("http://localhost:5984", mockLogger);
    expect(result.status).toBe("ok");
    expect(result.couchdb).toBe("connected");
  });

  it("returns error on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const result = await checkHealth("http://localhost:5984", mockLogger);
    expect(result.status).toBe("error");
    expect(result.couchdb).toBe("error");
    expect(result.error).toBe("Connection refused");
  });

  it("returns degraded on non-200", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const result = await checkHealth("http://localhost:5984", mockLogger);
    expect(result.status).toBe("degraded");
  });
});
