"use client";

import { useEffect } from "react";

/** Registers the service worker (push + offline page fallback). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[sw-register]", err);
      });
    }
  }, []);
  return null;
}
