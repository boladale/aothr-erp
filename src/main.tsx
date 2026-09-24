import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// If a page file changed after the app loaded (new update), the old link to it breaks.
// Reload once to pick up the latest version instead of showing a blank screen.
const reloadOnce = () => {
  const key = "chunk-reload-at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
};
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
const isChunkError = (m: unknown) => /Failed to fetch dynamically imported module|Importing a module script failed/i.test(String(m));
window.addEventListener("error", (e) => { if (isChunkError(e.message)) reloadOnce(); });
window.addEventListener("unhandledrejection", (e) => { if (isChunkError((e.reason as any)?.message ?? e.reason)) reloadOnce(); });

createRoot(document.getElementById("root")!).render(<App />);
