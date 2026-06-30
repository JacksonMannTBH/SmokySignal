// Polling hook for /api/aircraft. Used by Glanceable home + RadarShell.
//
// - Polls every 10s
// - Pauses while document.visibilityState === "hidden"
// - Refetches immediately on visibilitychange → visible (catch up after backgrounding)
// - Forces one fresh server snapshot when the rider changes region
// - Honors `mockOn` so /?mock=up and /radar?mock=up share the demo state

import { useEffect, useState } from "react";
import { REGION_CHANGE_EVENT, getRegion } from "@/lib/region-pref";
import type { RegionId } from "@/lib/regions";
import type { Snapshot } from "@/lib/types";

const POLL_INTERVAL_MS = 10_000;

function aircraftUrl(
  mockOn: boolean,
  regionId: RegionId,
  forceFresh = false,
): string {
  const base = `/api/aircraft?region_id=${encodeURIComponent(regionId)}`;
  const sep = base.includes("?") ? "&" : "?";
  const withFresh = forceFresh ? `${base}${sep}fresh=${Date.now()}` : base;
  if (!mockOn) return withFresh;
  if (typeof window !== "undefined") {
    const mock = new URLSearchParams(window.location.search).get("mock");
    if (mock) return `${withFresh}&mock=${encodeURIComponent(mock)}`;
  }
  return `${withFresh}&mock=up`;
}

export function useAircraft(initial: Snapshot, mockOn = false): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const [regionId, setRegionId] = useState<RegionId>(() => getRegion());
  const [regionRefreshSeq, setRegionRefreshSeq] = useState(0);

  useEffect(() => {
    const onRegionChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: RegionId }>).detail;
      setRegionId(detail?.id ?? getRegion());
      setRegionRefreshSeq((seq) => seq + 1);
    };
    window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
    return () => window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const normalUrl = aircraftUrl(mockOn, regionId);
    const freshUrl = aircraftUrl(mockOn, regionId, regionRefreshSeq > 0);

    const fetchSnap = async (forceFresh = false) => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(forceFresh ? freshUrl : normalUrl, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const data = (await r.json()) as Snapshot;
        if (!cancelled) setSnap(data);
      } catch {
        // transient — next tick retries
      }
    };

    void fetchSnap(regionRefreshSeq > 0);
    const id = setInterval(() => void fetchSnap(false), POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchSnap(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mockOn, regionId, regionRefreshSeq]);

  return snap;
}
