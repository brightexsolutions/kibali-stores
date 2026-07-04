"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Keeps every screen's data current for whoever has it open: re-fetches
 * the current route's server data once a minute, and immediately when the
 * tab/app comes back into view (e.g. phone was locked). Uses Next's
 * router.refresh(), which re-runs server queries without losing any
 * in-progress client-side form state or a full page reload.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const id = setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
