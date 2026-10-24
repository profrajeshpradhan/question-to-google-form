"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (avoids stale caches during development). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installation is optional; the site works without it.
    });
  }, []);
  return null;
}
