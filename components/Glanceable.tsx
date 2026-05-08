"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";
import type { ActivityEntry } from "@/lib/activity";
import type { LearningState } from "@/lib/learning";
import { SS_TOKENS } from "@/lib/tokens";
import { fmtAgoTs, fmtAloft } from "@/lib/time";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { computeStatus, type StatusState } from "@/lib/status";
import { StatusPill } from "./StatusPill";
import { Card } from "./Card";
import { PlaneIcon } from "./PlaneIcon";
import { PredictionCard } from "./PredictionCard";
import { HelpIcon } from "./HelpIcon";
import { Tooltip } from "./Tooltip";
import { Logo } from "./brand/Logo";
import { FreshnessLabel } from "./FreshnessLabel";
import { ArmAlertsCallout } from "./ArmAlertsCallout";
import { AlertsStateChip } from "./AlertsStateChip";

// Hide the activity strip when the most recent event is older than this —
// a stale "Guardian One up · 8 hours ago" looks more like a bug than a
// feature on the home screen.
const ACTIVITY_STRIP_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  initialActivity?: ActivityEntry[];
  learning?: LearningState;
  hour12?: boolean;
  /** Optional historical-context phrase rendered under the Hero
   *  ("usually up at this hour. 67% of weeks."). Server computes,
   *  passes the string in. null = hide. */
  contextLine?: string | null;
  /** ms-since-epoch of the most recent track sample. null = no
   *  meta:last_sample_ts in KV yet (renders "UNKNOWN"). */
  lastSampleMs?: number | null;
};

export function Glanceable({
  initial,
  mockOn = false,
  initialActivity = [],
  learning,
  hour12 = false,
  contextLine = null,
  lastSampleMs = null,
}: Props) {
  const snap = useAircraft(initial, mockOn);
  const [updatedAgo, setUpdatedAgo] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);

  // Poll /api/activity every 30s so the strip stays current without
  // forcing a full snapshot regen.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/activity?limit=1", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { entries: ActivityEntry[] };
        if (!cancelled) setActivity(d.entries);
      } catch {
        /* transient */
      }
    };
    const id = setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // "Updated Xs" label.
  useEffect(() => {
    setUpdatedAgo(0);
    const id = setInterval(() => {
      setUpdatedAgo(Math.floor((Date.now() - snap.fetched_at) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [snap.fetched_at]);

  const fleetMap = useMemo(
    () => new Map<string, FleetEntry>(snap.aircraft.map((a) => [a.tail, a])),
    [snap.aircraft],
  );
  const status = useMemo(() => computeStatus(snap, fleetMap), [snap, fleetMap]);
  // Drop the headline plane from the also-up list. Without this filter
  // the lead appears twice — once as the hero, once at the top of the
  // also-up card — and the count in the also-up header disagrees with
  // the "X other watchers up." footnote in lib/status.ts which already
  // excludes the lead.
  const leadTail = status.lead?.aircraft.tail ?? null;
  const others = snap.aircraft.filter(
    (a) => a.airborne && a.tail !== leadTail,
  );
  const latestActivity =
    activity.length > 0 &&
    Date.now() - activity[0]!.ts < ACTIVITY_STRIP_MAX_AGE_MS
      ? activity[0]!
      : null;

  return (
    <main
      className="ss-hero-bg ss-page-narrow"
      style={{
        minHeight: "100dvh",
        padding: "12px 18px 100px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <HelpIcon />
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
          // Reserve room for the fixed wake-lock + help buttons (right:6
          // and right:50 each 44px hit area) so the source line never
          // tucks under either icon.
          paddingRight: 96,
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <Logo size={32} wordmark />
          <span
            className="ss-mono"
            style={{
              fontSize: 9.5,
              color: SS_TOKENS.fg2,
              letterSpacing: ".12em",
              padding: "2px 6px",
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              borderRadius: 4,
            }}
          >
            LIVE
          </span>
          <AlertsStateChip />
        </div>
        <Tooltip
          side="bottom"
          align="end"
          content={`Time since last successful data pull. ${snap.source === "adsbfi" ? "ADSBFI = adsb.fi (primary feed)." : snap.source === "opensky" ? "OPENSKY = OpenSky Network (fallback)." : "MOCK = synthetic data."}`}
        >
          <span
            className="ss-mono"
            tabIndex={0}
            style={{
              fontSize: 10.5,
              color: SS_TOKENS.fg2,
              whiteSpace: "nowrap",
              cursor: "help",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: SS_TOKENS.clear,
                marginRight: 6,
                verticalAlign: "middle",
                animation: "ss-blink 1.6s infinite",
              }}
            />
            UPDATED {updatedAgo}s · {snap.source.toUpperCase()}
          </span>
        </Tooltip>
      </header>

      <Hero status={status} />

      {contextLine && (
        <p
          className="ss-mono"
          style={{
            fontSize: 12,
            color: SS_TOKENS.fg2,
            margin: "-4px 4px 0",
            letterSpacing: ".02em",
            lineHeight: 1.4,
          }}
        >
          {contextLine}
        </p>
      )}

      {latestActivity && <ActivityStrip latest={latestActivity} />}

      <ArmAlertsCallout />

      {others.length > 0 && <Others others={others} />}

      <PredictionCard learning={learning} hour12={hour12} />

      <div style={{ marginTop: 4, paddingLeft: 4 }}>
        <FreshnessLabel lastSampleMs={lastSampleMs} />
      </div>

      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer
      className="ss-mono"
      style={{
        marginTop: 8,
        padding: "16px 4px 0",
        fontSize: 10.5,
        color: SS_TOKENS.fg2,
        letterSpacing: ".04em",
        lineHeight: 1.5,
      }}
    >
      Aircraft data from{" "}
      <a
        href="https://adsb.fi"
        target="_blank"
        rel="noopener noreferrer"
        style={FOOTER_LINK}
      >
        adsb.fi
      </a>{" "}
      ·{" "}
      <a
        href="https://opensky-network.org"
        target="_blank"
        rel="noopener noreferrer"
        style={FOOTER_LINK}
      >
        OpenSky Network
      </a>
      <br />
      <Link href="/about" style={FOOTER_LINK}>
        About
      </Link>
      {" · "}
      <Link href="/legal" style={FOOTER_LINK}>
        Legal
      </Link>
    </footer>
  );
}

// Footer link style — inline-block + vertical padding so the tap area
// reaches WCAG-AA's 44 px minimum without changing visible layout.
// Negative vertical margin keeps the line-height of the surrounding
// flow text unchanged.
const FOOTER_LINK: React.CSSProperties = {
  color: SS_TOKENS.fg1,
  textDecoration: "underline",
  display: "inline-block",
  padding: "12px 4px",
  margin: "-12px -4px",
  lineHeight: 1,
}

function ActivityStrip({ latest }: { latest: ActivityEntry }) {
  return (
    <Link
      href="/activity"
      prefetch={false}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        textDecoration: "none",
        color: SS_TOKENS.fg1,
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: SS_TOKENS.alert,
          boxShadow: `0 0 8px ${SS_TOKENS.alert}`,
          flexShrink: 0,
          animation: "ss-blink 1.6s infinite",
        }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {latest.description}
      </span>
      <span
        className="ss-mono"
        style={{ fontSize: 11, color: SS_TOKENS.fg2, flexShrink: 0 }}
      >
        {fmtAgoTs(latest.ts)}
      </span>
    </Link>
  );
}

function Hero({ status }: { status: StatusState }) {
  const isAlert = status.kind === "alert";
  const accentColor = isAlert ? SS_TOKENS.alert : SS_TOKENS.clear;
  const halo = isAlert ? SS_TOKENS.alertDim : SS_TOKENS.clearDim;
  return (
    <section
      className="ss-hero-bg"
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${halo}, transparent 70%), ${SS_TOKENS.bg1}`,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 22,
        padding: "32px 22px 26px",
      }}
    >
      <div
        className="ss-eyebrow"
        style={{ color: accentColor, animation: "ss-fade 400ms ease-out" }}
      >
        {status.pill}
      </div>
      <h1
        style={{
          fontSize: "clamp(40px, 12vw, 64px)",
          fontWeight: 800,
          letterSpacing: "-.04em",
          lineHeight: 1.05,
          marginTop: 10,
          color: accentColor,
        }}
      >
        {status.headline}
      </h1>
      <p
        style={{
          marginTop: 14,
          fontSize: 15,
          color: SS_TOKENS.fg1,
          lineHeight: 1.5,
        }}
      >
        {status.body}
      </p>
      {status.footnote && (
        <p
          style={{
            marginTop: 8,
            fontSize: 12.5,
            fontStyle: "italic",
            color: SS_TOKENS.fg2,
            lineHeight: 1.45,
          }}
        >
          {status.footnote}
        </p>
      )}
      {status.lead && status.kind === "alert" && (
        <>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {status.lead.aircraft.time_aloft_min != null && (
              <StatusPill
                kind="alert"
                label={fmtAloft(status.lead.aircraft.time_aloft_min)}
              />
            )}
            {status.lead.aircraft.ground_speed_kt != null && (
              <StatusPill
                kind="alert"
                label={`${status.lead.aircraft.ground_speed_kt} kt`}
              />
            )}
          </div>
          <LeadIdentity
            tail={status.lead.aircraft.tail}
            nickname={status.lead.entry.nickname}
            operator={status.lead.entry.operator}
          />
        </>
      )}
    </section>
  );
}

function LeadIdentity({
  tail,
  nickname,
  operator,
}: {
  tail: string;
  nickname: string | null;
  operator: string;
}) {
  // Lead-identity line under the stat chips so a rider knows whether
  // the smokey at 4m aloft is the WSP Cessna near Olympia or the CBP
  // B300C at FL190. Tappable — drills into /plane/[tail] for live
  // map + history.
  const middle = nickname ? ` · "${nickname}" · ` : " · ";
  return (
    <Link
      href={`/plane/${tail}`}
      prefetch={false}
      aria-label={`View ${nickname ?? tail} details`}
      className="ss-mono"
      style={{
        display: "inline-block",
        marginTop: 6,
        fontSize: 11.5,
        color: SS_TOKENS.fg2,
        letterSpacing: ".04em",
        textDecoration: "none",
      }}
    >
      {tail}
      {middle}
      {operator}
    </Link>
  );
}

function Others({ others }: { others: Aircraft[] }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 4px 8px",
        }}
      >
        <span className="ss-eyebrow">Also up</span>
        <span
          className="ss-mono"
          style={{ fontSize: 10.5, color: SS_TOKENS.fg2 }}
        >
          {others.length} UP
        </span>
      </div>
      <Card padded={false}>
        {others.map((p, i) => (
          <Link
            key={p.tail}
            href={`/plane/${p.tail}`}
            prefetch={false}
            aria-label={`View ${p.nickname ?? p.tail} details`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderBottom:
                i === others.length - 1
                  ? 0
                  : `.5px solid ${SS_TOKENS.hairline}`,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <PlaneIcon size={18} role={p.role} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="ss-mono"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {p.tail}
                {p.nickname && (
                  <span
                    style={{
                      color: SS_TOKENS.fg1,
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    &ldquo;{p.nickname}&rdquo;
                  </span>
                )}
              </div>
              <div
                style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 1 }}
              >
                {p.operator} · {p.model}
              </div>
            </div>
            <div
              className="ss-mono"
              style={{ fontSize: 12, color: SS_TOKENS.fg1 }}
            >
              {p.altitude_ft != null
                ? `${p.altitude_ft.toLocaleString()}′`
                : "—"}
            </div>
            <ChevronRight />
          </Link>
        ))}
      </Card>
    </div>
  );
}

// Right-pointing chevron icon used as the visual "tappable" affordance
// on Also-up rows. Inline SVG so it ships in the initial HTML.
function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={SS_TOKENS.fg2}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
