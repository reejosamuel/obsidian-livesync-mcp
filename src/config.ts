import { z } from "zod";

const ConfigSchema = z.object({
  hostname: z.string().url(),
  dbname: z.string().min(1),
  username: z.string().optional().default(""),
  password: z.string().optional().default(""),
  passphrase: z.string().optional().default(""),
  mcpApiKey: z.string().optional().default(""),
  mcpTransport: z.enum(["stdio", "sse", "http"]).default("stdio"),
  mcpPort: z.coerce.number().int().positive().default(3100),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  cacheTtl: z.coerce.number().int().nonnegative().default(60),
  requestTimeout: z.coerce.number().int().positive().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env file, use process.env as-is
  }

  const parsed = ConfigSchema.safeParse({
    hostname: getEnv("hostname"),
    dbname: getEnv("dbname"),
    username: getEnv("username"),
    password: getEnv("password"),
    passphrase: getEnv("passphrase") || getEnv("PASSPHRASE"),
    mcpApiKey: getEnv("MCP_API_KEY"),
    mcpTransport: getEnv("MCP_TRANSPORT") || "stdio",
    mcpPort: getEnv("MCP_PORT") || "3100",
    logLevel: getEnv("LOG_LEVEL") || "info",
    cacheTtl: getEnv("CACHE_TTL") || "60",
    requestTimeout: getEnv("REQUEST_TIMEOUT") || "30000",
  });

  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Config validation failed:\n${msgs}`);
  }

  return parsed.data;
}

function getEnv(key: string): string {
  return process.env[key] || "";
}
