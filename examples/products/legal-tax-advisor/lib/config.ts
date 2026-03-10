/**
 * Config values from environment variables (.env.local).
 * Single Next.js app: API is same-origin, so use "" for relative /api/* URLs.
 */
export const config = {
  /** Empty string = same origin (e.g. /api/...). Set only if you need a separate backend URL. */
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "",
};

/** Headers required for ngrok free tier when using external backend URL. */
export function getBackendHeaders(): HeadersInit {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  if (url.includes("ngrok")) {
    return { "ngrok-skip-browser-warning": "1" };
  }
  return {};
}
