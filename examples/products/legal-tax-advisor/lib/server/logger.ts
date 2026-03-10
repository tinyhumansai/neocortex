const pad = (n: number) => String(n).padStart(2, "0");

function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function format(level: string, ...args: unknown[]): string {
  const ts = timestamp();
  const msg = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
    .join(" ");
  return `[${ts}] [${level}] ${msg}`;
}

export const logger = {
  info(...args: unknown[]) {
    console.log(format("INFO", ...args));
  },
  warn(...args: unknown[]) {
    console.warn(format("WARN", ...args));
  },
  error(...args: unknown[]) {
    console.error(format("ERROR", ...args));
  },
  debug(...args: unknown[]) {
    if (process.env.DEBUG) {
      console.log(format("DEBUG", ...args));
    }
  },
};
