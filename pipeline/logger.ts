/**
 * Lightweight pipeline logger.
 *
 * Prints timestamped, colour-coded lines to stdout so you can follow the
 * graph execution in the Next.js terminal without any external logger dep.
 *
 * Colour codes are stripped automatically when stdout is not a TTY
 * (e.g. when piped to a file).
 */

const isTTY = typeof process !== "undefined" && process.stdout ? (process.stdout.isTTY ?? false) : false;

const C = {
  reset:  isTTY ? "\x1b[0m"  : "",
  bold:   isTTY ? "\x1b[1m"  : "",
  dim:    isTTY ? "\x1b[2m"  : "",
  cyan:   isTTY ? "\x1b[36m" : "",
  green:  isTTY ? "\x1b[32m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  red:    isTTY ? "\x1b[31m" : "",
  magenta:isTTY ? "\x1b[35m" : "",
  blue:   isTTY ? "\x1b[34m" : "",
  white:  isTTY ? "\x1b[37m" : "",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

function prefix(level: string, color: string): string {
  return `${C.dim}[${timestamp()}]${C.reset} ${color}${C.bold}${level}${C.reset}`;
}

export const log = {
  /** Generic informational message */
  info(node: string, message: string, data?: unknown): void {
    const extra = data !== undefined ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.log(`${prefix("INFO ", C.cyan)} ${C.white}[${node}]${C.reset} ${message}${extra}`);
  },

  /** Step started / completed markers */
  step(node: string, message: string, data?: unknown): void {
    const extra = data !== undefined ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.log(`${prefix("STEP ", C.green)} ${C.green}[${node}]${C.reset} ${message}${extra}`);
  },

  /** Non-fatal warnings (fallbacks, skipped zones, etc.) */
  warn(node: string, message: string, data?: unknown): void {
    const extra = data !== undefined ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.warn(`${prefix("WARN ", C.yellow)} ${C.yellow}[${node}]${C.reset} ${message}${extra}`);
  },

  /** Fatal errors just before a throw */
  error(node: string, message: string, data?: unknown): void {
    const extra = data !== undefined ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.error(`${prefix("ERROR", C.red)} ${C.red}[${node}]${C.reset} ${message}${extra}`);
  },

  /** Graph-level separator / section header */
  graph(message: string): void {
    console.log(
      `\n${C.magenta}${C.bold}${"─".repeat(60)}${C.reset}\n` +
      `${prefix("GRAPH", C.magenta)} ${C.bold}${message}${C.reset}\n` +
      `${C.magenta}${C.bold}${"─".repeat(60)}${C.reset}`
    );
  },
};

/** Returns an elapsed-ms string since `start` (from Date.now()). */
export function elapsed(start: number): string {
  return `${Date.now() - start}ms`;
}
