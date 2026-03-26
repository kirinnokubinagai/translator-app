type LogLevel = "debug" | "info" | "warn" | "error";

/** 現在のログレベル */
const CURRENT_LOG_LEVEL: LogLevel = __DEV__ ? "debug" : "warn";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
}

/** アプリケーションロガー */
export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("debug")) return;
    console.debug(`[DEBUG] ${message}`, data ?? "");
  },

  info(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("info")) return;
    console.info(`[INFO] ${message}`, data ?? "");
  },

  warn(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("warn")) return;
    console.warn(`[WARN] ${message}`, data ?? "");
  },

  error(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("error")) return;
    console.error(`[ERROR] ${message}`, data ?? "");
  },
};
