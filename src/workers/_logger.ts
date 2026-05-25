/**
 * Logger simples com cor por nível.
 * Sprint 9 trocamos por pino/winston, por enquanto console.log basta.
 */
const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

type Level = 'info' | 'ok' | 'warn' | 'error' | 'progress';

const LEVEL_COLOR: Record<Level, string> = {
  info: COLORS.cyan,
  ok: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  progress: COLORS.magenta,
};

export function log(worker: string, level: Level, message: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const color = LEVEL_COLOR[level];
  console.log(
    `${COLORS.gray}${ts}${COLORS.reset} ${color}[${worker}/${level}]${COLORS.reset} ${message}`,
  );
}
