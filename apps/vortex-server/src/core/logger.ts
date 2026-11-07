type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  child(scope: string): Logger;
}

/** Minimal structured logger — zero dependencies, ISO timestamps, scopes. */
export function createLogger(scope: string, minLevel: Level = 'info'): Logger {
  const emit = (level: Level, message: string, meta?: unknown): void => {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;
    const stamp = new Date().toISOString();
    const line = `${stamp} ${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET} [${scope}] ${message}`;
    if (meta !== undefined) {
      const detail =
        meta instanceof Error ? `${meta.message}\n${meta.stack ?? ''}` : JSON.stringify(meta);
      console.log(`${line} ${detail}`);
    } else {
      console.log(line);
    }
  };
  const logger: Logger = {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
    child: (childScope: string) => createLogger(`${scope}:${childScope}`, minLevel),
  };
  return logger;
}
