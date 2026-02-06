export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[max-depth]";

  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, depth + 1));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/(token|secret|password|authorization|cookie|set-cookie)/i.test(k)) {
        out[k] = "***";
      } else {
        out[k] = redactSecrets(v, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function safeStringify(extra: unknown): string {
  try {
    return JSON.stringify(redactSecrets(extra));
  } catch {
    return "[unserializable]";
  }
}

export class Logger {
  private readonly levelNum: number;

  constructor(level: LogLevel) {
    this.levelNum = LEVELS[level] ?? LEVELS.info;
  }

  error(message: string, extra?: unknown): void {
    this.write("ERROR", message, extra, LEVELS.error);
  }

  warn(message: string, extra?: unknown): void {
    this.write("WARN", message, extra, LEVELS.warn);
  }

  info(message: string, extra?: unknown): void {
    this.write("INFO", message, extra, LEVELS.info);
  }

  debug(message: string, extra?: unknown): void {
    this.write("DEBUG", message, extra, LEVELS.debug);
  }

  private write(
    prefix: string,
    message: string,
    extra: unknown,
    needed: number
  ): void {
    if (this.levelNum < needed || needed === LEVELS.silent) return;

    const ts = new Date().toISOString();
    const suffix = extra === undefined ? "" : ` ${safeStringify(extra)}`;
    process.stderr.write(`[mcp-reader ${ts}] ${prefix}: ${message}${suffix}\n`);
  }
}
