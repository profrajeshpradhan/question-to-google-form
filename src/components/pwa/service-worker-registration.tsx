"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production builds only. In development it
 * removes any worker (and its caches) left by an earlier production run on the
 * same origin, which would otherwise keep serving stale CSS and scripts.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) return;
        void Promise.all(registrations.map((r) => r.unregister()))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qgf-")).map((k) => caches.delete(k))))
          // Reload once so this page is no longer served by the old worker.
          .then(() => window.location.reload());
      });
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installation is optional; the site works without it.
    });
  }, []);
  return null;
}
