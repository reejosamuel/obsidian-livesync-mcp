const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let globalLevel: number = 1;

export function setLogLevel(level: string) {
  globalLevel = LOG_LEVELS[level as LogLevel] ?? 1;
}

export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  private log(level: LogLevel, msg: string, attrs?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < globalLevel) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      logger: this.name,
      msg,
      ...attrs,
    };
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + "\n");
  }

  debug(msg: string, attrs?: Record<string, unknown>) {
    this.log("debug", msg, attrs);
  }
  info(msg: string, attrs?: Record<string, unknown>) {
    this.log("info", msg, attrs);
  }
  warn(msg: string, attrs?: Record<string, unknown>) {
    this.log("warn", msg, attrs);
  }
  error(msg: string, attrs?: Record<string, unknown>) {
    this.log("error", msg, attrs);
  }

  child(name: string): Logger {
    const l = new Logger(`${this.name}:${name}`);
    return l;
  }
}
