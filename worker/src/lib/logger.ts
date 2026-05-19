const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = "debug";

function format(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const extra = data ? ` ${JSON.stringify(data)}` : "";
  return `[${ts}] [${level.toUpperCase()}] ${msg}${extra}`;
}

export const logger = {
  debug(msg: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) console.log(format("debug", msg, data));
  },
  info(msg: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) console.log(format("info", msg, data));
  },
  warn(msg: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) console.warn(format("warn", msg, data));
  },
  error(msg: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) console.error(format("error", msg, data));
  },
};
