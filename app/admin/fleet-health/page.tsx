// /admin/fleet-health — per-tail capture audit. Cross-references the
// registry against the tracks aggregate and the hot-zones cache so an
// admin can see at a glance which tails are silent, which are flying
// but their points aren't reaching the heatmap, and which are healthy.
//
// Read-only. No writes, no API. Same auth gate as /admin/tracks.

import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { getRegistry } from "@/lib/registry";
import { getTrackSummary } from "@/lib/tracks";
import { getHotZonesCached } from "@/lib/hotzones";
import { getLearningState } from "@/lib/learning";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "../LoginForm";
import { fmtAgoFromTs } from "../tracks/fmt";
import { AdminHeader } from "../tracks/AdminHeader";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SmokySignal · Admin · Fleet health",
  robots: { index: false, follow: false },
};

type SP = { error?: string };

type Row = {
  tail: string;
  operator: string;
  nickname: string | null;
  role: string;
  totalSamples: number;
  daysWithData: number;
  firstSampleTs: number | null;
  lastSampleTs: number | null;
  hotZoneCells: number;
  flag: "silent" | "dropped" | "ok";
};

const SYSTEM_FIRST_SAMPLE_30D_THRESHOLD_MS = 30 * 86_400_000;

export default async function FleetHealthPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  if (!isAdminPasscodeConfigured()) {
    return <PasscodeMissing />;
  }
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next="fleet-health" />;
  }

  const [fleet, hotZones, learning] = await Promise.all([
    getRegistry(),
    getHotZonesCached(),
    getLearningState(),
  ]);

  // Pre-compute hot-zone contribution per tail in a single pass — cheaper
  // than O(fleet × zones) inside the per-tail map below.
  const cellsByTail = new Map<string, number>();
  for (const z of hotZones) {
    for (const t of z.tails) {
      cellsByTail.set(t, (cellsByTail.get(t) ?? 0) + 1);
    }
  }

  const systemFirstSampleMs = learning.firstSampleIso
    ? new Date(learning.firstSampleIso).getTime()
    : null;
  const systemAge30DPlus =
    systemFirstSampleMs != null &&
    Date.now() - systemFirstSampleMs >= SYSTEM_FIRST_SAMPLE_30D_THRESHOLD_MS;

  const rows: Row[] = await Promise.all(
    fleet.map(async (f): Promise<Row> => {
      const summary = await getTrackSummary(f.tail);
      const hotZoneCells = cellsByTail.get(f.tail) ?? 0;
      // Two flags worth surfacing in the admin view:
      //   "dropped"  — points exist but never made it into the aggregate
      //   "silent"   — system has been running 30+ days yet zero sightings
      let flag: Row["flag"] = "ok";
      if (summary.totalSamples > 0 && hotZoneCells === 0) flag = "dropped";
      else if (summary.totalSamples === 0 && systemAge30DPlus) flag = "silent";
      return {
        tail: f.tail,
        operator: f.operator,
        nickname: f.nickname ?? null,
        role: f.role,
        totalSamples: summary.totalSamples,
        daysWithData: summary.daysWithData,
        firstSampleTs: summary.firstSampleTs,
        lastSampleTs: summary.lastSampleTs,
        hotZoneCells,
        flag,
      };
    }),
  );

  // Sort: flagged rows surface first (silent then dropped), then healthy
  // rows by last-seen descending.
  const flagOrder: Record<Row["flag"], number> = {
    silent: 0,
    dropped: 1,
    ok: 2,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return flagOrder[a.flag] - flagOrder[b.flag];
    const aTs = a.lastSampleTs ?? 0;
    const bTs = b.lastSampleTs ?? 0;
    if (aTs !== bTs) return bTs - aTs;
    return a.tail.localeCompare(b.tail);
  });

  const counts = {
    total: rows.length,
    silent: rows.filter((r) => r.flag === "silent").length,
    dropped: rows.filter((r) => r.flag === "dropped").length,
    ok: rows.filter((r) => r.flag === "ok").length,
  };

  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "16px 18px 60px",
        maxWidth: 980,
        margin: "0 auto",
        color: SS_TOKENS.fg0,
      }}
    >
      <AdminHeader active="health" subtitle="Fleet health" />

      <p
        style={{
          fontSize: 12,
          color: SS_TOKENS.fg2,
          lineHeight: 1.5,
          marginBottom: 8,
        }}
      >
        Per-tail capture audit — cross-references the registry against the
        tracks aggregate and the hot-zones cache. Flagged rows surface at
        the top.
      </p>
      <p
        className="ss-mono"
        style={{
          fontSize: 11,
          color: SS_TOKENS.fg1,
          letterSpacing: ".04em",
          marginBottom: 16,
        }}
      >
        {counts.total} TAILS · {counts.silent} SILENT · {counts.dropped} DROPPED ·{" "}
        {counts.ok} OK · SYSTEM AGE{" "}
        {systemFirstSampleMs != null
          ? `${Math.floor(
              (Date.now() - systemFirstSampleMs) / 86_400_000,
            )} d`
          : "—"}
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>FLAG</Th>
              <Th>TAIL</Th>
              <Th>OPERATOR</Th>
              <Th>ROLE</Th>
              <Th>NICKNAME</Th>
              <Th align="right">30D POINTS</Th>
              <Th align="right">DAYS</Th>
              <Th align="right">HOT-ZONE CELLS</Th>
              <Th>LAST SEEN</Th>
              <Th align="right">DAYS SINCE FIRST</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const daysSinceFirst =
                r.firstSampleTs != null
                  ? Math.floor((nowSec - r.firstSampleTs) / 86_400)
                  : null;
              return (
                <tr
                  key={r.tail}
                  style={{
                    borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                  }}
                >
                  <Td mono>
                    <FlagPill flag={r.flag} />
                  </Td>
                  <Td mono bold>
                    {r.tail}
                  </Td>
                  <Td>{r.operator}</Td>
                  <Td mono>{r.role}</Td>
                  <Td>{r.nickname ?? "—"}</Td>
                  <Td mono dim={r.totalSamples === 0} align="right">
                    {r.totalSamples}
                  </Td>
                  <Td mono dim={r.daysWithData === 0} align="right">
                    {r.daysWithData}
                  </Td>
                  <Td mono dim={r.hotZoneCells === 0} align="right">
                    {r.hotZoneCells}
                  </Td>
                  <Td mono dim={r.lastSampleTs == null}>
                    {fmtAgoFromTs(r.lastSampleTs) ?? "never"}
                  </Td>
                  <Td mono dim={daysSinceFirst == null} align="right">
                    {daysSinceFirst != null ? daysSinceFirst : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FlagPill({ flag }: { flag: Row["flag"] }) {
  if (flag === "ok") {
    return <span style={{ color: SS_TOKENS.fg2 }}>—</span>;
  }
  const color = flag === "silent" ? SS_TOKENS.alert : SS_TOKENS.warn;
  return (
    <span
      className="ss-mono"
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 999,
        background: "transparent",
        border: `.5px solid ${color}`,
        color,
        fontSize: 9.5,
        letterSpacing: ".08em",
      }}
    >
      {flag.toUpperCase()}
    </span>
  );
}

function PasscodeMissing() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 32,
        maxWidth: 520,
        margin: "0 auto",
        color: SS_TOKENS.fg1,
        fontSize: 14,
      }}
    >
      <code>ADMIN_PASSCODE</code> isn&rsquo;t set in this environment.
    </main>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="ss-mono"
      style={{
        textAlign: align,
        padding: "10px 8px 8px",
        fontSize: 9.5,
        letterSpacing: ".1em",
        color: SS_TOKENS.fg2,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  bold,
  dim,
  align = "left",
}: {
  children: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
  dim?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "10px 8px",
        fontSize: 12,
        textAlign: align,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-inter)",
        fontWeight: bold ? 600 : undefined,
        color: dim ? SS_TOKENS.fg2 : SS_TOKENS.fg0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
