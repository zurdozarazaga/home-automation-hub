"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** S9: the Server Component tree is re-fetched at this interval. */
const REFRESH_INTERVAL_MS = 20_000;

/**
 * Re-renders the dashboard on a timer so telemetry and liveness stay fresh
 * without a client-side data layer.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
