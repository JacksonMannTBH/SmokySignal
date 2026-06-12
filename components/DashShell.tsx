"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { SS_TOKENS } from "@/lib/tokens";
import { SMOKY_TAIL } from "@/lib/seed";
import { DEFAULT_SPEED_LIMIT_MPH, haversineNm } from "@/lib/geo";
import { evaluateWarning } from "@/lib/speed-warning";
import { proximityBandForDistance } from "@/lib/proximity-alert";
import { fmtAgoTs } from "@/lib/time";
import type { HotZone } from "@/lib/hotzones";
import { StatusPill } from "./StatusPill";
import { Card } from "./Card";
import { AlertsOptInCard } from "./AlertsOptInCard";
import { ProximityFlash } from "./ProximityFlash";
import { TakeOffButton } from "./TakeOffButton";
import type { Aircraft, Snapshot } from "@/lib/types";
import type { ActivityEntry } from "@/lib/activity";

const TABBAR_HEIGHT = 66;
const NEAR_NM = 5;
// Top-N airborne planes to surface in the watcher list. Three is enough
// to convey crowdedness without dominating the screen.
const NEAREST_LIST_LIMIT = 3;
type WatcherEntry = { plane: Aircraft; distanceNm: number | null };

type Props = {
  initial: Snapshot;
  initialActivity: ActivityEntry[];
  mockOn?: boolean;
};

export function DashShell({ initial, initialActivity, mockOn = false }: Props) {
  const snap = useAircraft(initial, mockOn);
  const { pos } = useRiderPos();
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);

  const airborne = useMemo(
    () => snap.aircraft.filter((a) => a.airborne),
    [snap.aircraft],
  );
  const smoky = snap.aircraft.find((a) => a.tail === SMOKY_TAIL);
  const smokyUp = Boolean(smoky?.airborne);
  const up = airborne.length > 0;

  // Top-N airborne planes by Haversine distance — sorted ascending so
  // nearestList[0] is the single closest. Drives both the watcher list
  // and the proximity-flash trigger.
  const watcherList = useMemo<WatcherEntry[]>(() => {
    if (!pos) {
      return airborne.slice(0, NEAREST_LIST_LIMIT).map((plane) => ({
        plane,
        distanceNm: null,
      }));
    }
    const ranked: Array<{ plane: Aircraft; distanceNm: number }> = [];
    for (const a of airborne) {
      if (a.lat == null || a.lon == null) continue;
      ranked.push({
        plane: a,
        distanceNm: haversineNm(pos.lat, pos.lon, a.lat, a.lon),
      });
    }
    ranked.sort((x, y) => x.distanceNm - y.distanceNm);
    return ranked.slice(0, NEAREST_LIST_LIMIT);
  }, [pos, airborne]);
  const nearest = watcherList.find((entry) => entry.distanceNm != null) ?? null;
  const nearestBand = nearest?.distanceNm != null
    ? proximityBandForDistance(nearest.distanceNm)
    : null;

  // N1a dry-run logging: fetch hot zones once on mount, then on each
  // rider geolocation tick + airborne refresh, evaluate the warning
  // condition and POST positives to /api/dryrun-warnings. No UI surface
  // — that's N1b, gated on this data accumulating.
  const [hotZones, setHotZones] = useState<HotZone[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hotzones")
      .then((r) => (r.ok ? r.json() : { zones: [] }))
      .then((data) => {
        if (cancelled) return;
        const zones = Array.isArray(data?.zones) ? data.zones : [];
        setHotZones(zones as HotZone[]);
      })
      .catch(() => {
        // best-effort; absent zones just means evaluateWarning returns
        // wouldFire=false (no zone match)
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // m/s → mph
  const MPS_TO_MPH = 2.236936;
  useEffect(() => {
    if (!pos) return;
    if (pos.speedMps == null || pos.speedMps < 0) return;
    if (hotZones.length === 0 && airborne.length === 0) return;
    const result = evaluateWarning({
      riderLat: pos.lat,
      riderLon: pos.lon,
      riderSpeedMph: pos.speedMps * MPS_TO_MPH,
      postedLimitMph: DEFAULT_SPEED_LIMIT_MPH,
      hotZones,
      airborneAircraft: airborne,
    });
    if (!result.wouldFire) return;
    const nearestTail = nearest?.plane.tail ?? null;
    console.log("[dryrun]", result.reason);
    void fetch("/api/dryrun-warnings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ts: Date.now(),
        riderLat: pos.lat,
        riderLon: pos.lon,
        riderSpeedMph: pos.speedMps * MPS_TO_MPH,
        postedLimitMph: DEFAULT_SPEED_LIMIT_MPH,
        riderOverLimitBy: result.riderOverLimitBy,
        nearestZoneMi: result.nearestZoneMi,
        nearestBirdMi: result.nearestBirdMi,
        nearestTail,
        reason: result.reason,
      }),
    }).catch(() => {
      // best-effort; transient network errors don't matter for dry-run
    });
  }, [pos, hotZones, airborne, nearest]);

  // Poll /api/activity every 10s.
  useEffect(() => {
    let cancelled = false;
    const fetchActivity = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/activity?limit=10", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { entries: ActivityEntry[] };
        if (!cancelled) setActivity(data.entries);
      } catch {
        // transient — try again next tick
      }
    };
    const id = setInterval(fetchActivity, 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchActivity();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        // Bottom padding = tab bar (66) + iOS install prompt overlay
        // (~80) + breathing room. Without this the last dash card
        // hides behind the fixed-position prompt on iOS Safari.
        padding: `12px 18px ${TABBAR_HEIGHT + 110}px`,
        maxWidth: 460,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <span className="ss-eyebrow">Out Of Sight · Dash</span>
        <StatusPill
          kind={up ? "alert" : "clear"}
          label={up ? "BIRD UP" : "ALL CLEAR"}
          sub={`${airborne.length}/${snap.aircraft.length}`}
        />
      </header>

      <TakeOffButton variant="compact" />

      <NearestCard
        watcherList={watcherList}
        riderHasFix={Boolean(pos)}
        smokyUp={smokyUp}
        airborneCount={airborne.length}
      />

      <ContextLine
        airborneCount={airborne.length}
        nearest={nearest}
      />

      <ActivityFeed entries={activity} />

      <AlertsOptInCard />

      <ProximityFlash
        active={
          nearest != null &&
          nearest.distanceNm != null &&
          nearest.distanceNm <= NEAR_NM &&
          (nearest.plane.role === "smokey" || nearest.plane.role === "patrol")
        }
        color={nearestBand?.color}
      />
    </main>
  );
}

function NearestCard({
  watcherList,
  riderHasFix,
  smokyUp,
  airborneCount,
}: {
  watcherList: WatcherEntry[];
  riderHasFix: boolean;
  smokyUp: boolean;
  airborneCount: number;
}) {
  return (
    <Card padded={false}>
      <div style={{ padding: "12px 14px 8px" }}>
        <span className="ss-eyebrow">
          {riderHasFix ? "Nearest watchers" : "Airborne now"}
        </span>
      </div>
      {watcherList.length > 0 ? (
        watcherList.map((entry, i) => (
          <NearestRow key={entry.plane.tail} entry={entry} primary={i === 0} />
        ))
      ) : (
        <NearestEmpty
          riderHasFix={riderHasFix}
          smokyUp={smokyUp}
          airborneCount={airborneCount}
        />
      )}
    </Card>
  );
}

function NearestRow({
  entry,
  primary,
}: {
  entry: WatcherEntry;
  primary: boolean;
}) {
  const inRange = entry.distanceNm != null && entry.distanceNm <= NEAR_NM;
  return (
    <Link
      href={`/plane/${entry.plane.tail}`}
      prefetch={false}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="ss-mono"
            style={{
              fontSize: primary ? 15 : 13,
              fontWeight: 700,
              color: SS_TOKENS.fg0,
            }}
          >
            {entry.plane.tail}
          </span>
          {entry.plane.nickname && (
            <span
              style={{
                fontSize: 11.5,
                color: SS_TOKENS.fg2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.plane.nickname}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 1 }}>
          {entry.plane.operator} · {entry.plane.model}
        </div>
      </div>
      <span
        className="ss-mono"
        style={{
          fontSize: primary ? 18 : 14,
          fontWeight: 700,
          color: inRange ? SS_TOKENS.alert : SS_TOKENS.fg1,
        }}
      >
        {entry.distanceNm == null ? "LIVE" : `${entry.distanceNm.toFixed(1)} nm`}
      </span>
    </Link>
  );
}

function NearestEmpty({
  riderHasFix,
  smokyUp,
  airborneCount,
}: {
  riderHasFix: boolean;
  smokyUp: boolean;
  airborneCount: number;
}) {
  const baseStyle: React.CSSProperties = {
    padding: "12px 14px 16px",
    borderTop: `.5px solid ${SS_TOKENS.hairline}`,
  };
  if (!riderHasFix && airborneCount > 0) {
    return (
      <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
        Aircraft are live. Grant location to sort them by distance.
      </div>
    );
  }
  if (!riderHasFix) {
    return (
      <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
        Need your location to compute distance — accept the prompt above to enable.
      </div>
    );
  }
  if (!smokyUp) {
    return (
      <div
        style={{ ...baseStyle, display: "flex", alignItems: "center", gap: 10 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: SS_TOKENS.clear,
            boxShadow: `0 0 8px ${SS_TOKENS.clear}`,
          }}
        />
        <span style={{ fontSize: 14, color: SS_TOKENS.fg1 }}>
          All clear · Smokey&rsquo;s down
        </span>
      </div>
    );
  }
  return (
    <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
      A plane is up but we don&rsquo;t have its position yet.
    </div>
  );
}

function ContextLine({
  airborneCount,
  nearest,
}: {
  airborneCount: number;
  nearest: WatcherEntry | null;
}) {
  let text: string;
  let color: string;
  if (nearest?.distanceNm != null && nearest.distanceNm <= NEAR_NM) {
    const display = nearest.plane.nickname || nearest.plane.tail;
    text = `Heads up · ${display} ${nearest.distanceNm.toFixed(1)}nm away`;
    color = SS_TOKENS.warn;
  } else if (airborneCount > 0) {
    text = "Bird up but not nearby";
    color = SS_TOKENS.fg1;
  } else {
    text = "Clear skies";
    color = SS_TOKENS.clear;
  }
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        fontSize: 13,
        color,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card padded={false}>
      <div style={{ padding: "12px 14px 8px" }}>
        <span className="ss-eyebrow">Recent activity</span>
      </div>
      {entries.length === 0 ? (
        <div
          style={{
            padding: "16px 14px",
            fontSize: 12.5,
            color: SS_TOKENS.fg2,
            borderTop: `.5px solid ${SS_TOKENS.hairline}`,
          }}
        >
          Nothing notable — feed populates as planes take off, land, or change altitude.
        </div>
      ) : (
        entries.map((e, i) => <ActivityRow key={i} entry={e} />)
      )}
    </Card>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <Link
      href={`/plane/${entry.tail}`}
      prefetch={false}
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 14px",
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        alignItems: "flex-start",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        className="ss-mono"
        style={{
          fontSize: 10,
          color: SS_TOKENS.fg2,
          minWidth: 56,
          marginTop: 2,
        }}
      >
        {fmtAgoTs(entry.ts)}
      </span>
      <span style={{ flex: 1, fontSize: 12.5, color: SS_TOKENS.fg1, lineHeight: 1.4 }}>
        {entry.description}
      </span>
    </Link>
  );
}

