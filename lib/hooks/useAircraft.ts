// Polling hook for /api/aircraft. Used by Glanceable home + RadarShell.
//
// - Polls every 10s
// - Pauses while document.visibilityState === "hidden"
// - Refetches immediately on visibilitychange → visible (catch up after backgrounding)
// - Honors `mockOn` so /?mock=up and /radar?mock=up share the demo state

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";

const POLL_INTERVAL_MS = 10_000;

function aircraftUrl(mockOn: boolean): string {
  if (!mockOn) return "/api/aircraft";
  if (typeof window !== "undefined") {
    const mock = new URLSearchParams(window.location.search).get("mock");
    if (mock) return `/api/aircraft?mock=${encodeURIComponent(mock)}`;
  }
  return "/api/aircraft?mock=up";
}

export function useAircraft(initial: Snapshot, mockOn = false): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(initial);

  useEffect(() => {
    let cancelled = false;
    const url = aircraftUrl(mockOn);

    const fetchSnap = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as Snapshot;
        if (!cancelled) setSnap(data);
      } catch {
        // transient — next tick retries
      }
    };

    void fetchSnap();
    const id = setInterval(fetchSnap, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchSnap();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mockOn]);

  return snap;
}
