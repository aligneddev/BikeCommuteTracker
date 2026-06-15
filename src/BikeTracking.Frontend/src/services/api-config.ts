declare global {
  interface Window {
    __BIKE_API_URL__?: string;
  }
}

/**
 * Returns the API base URL, resolved lazily at call time so that the
 * Tauri runtime injection (`window.__BIKE_API_URL__`) is always visible
 * regardless of when this module was first imported.
 *
 * Priority:
 *  1. window.__BIKE_API_URL__  — injected by Tauri at startup from app.conf.json
 *  2. import.meta.env.VITE_API_BASE_URL — Vite build-time override (dev/CI)
 *  3. http://localhost:5436   — local dev fallback
 */
export function getApiBaseUrl(): string {
  return (
    window.__BIKE_API_URL__?.replace(/\/$/, "") ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) ??
    "http://localhost:5436"
  );
}
