// Admin viewer for the speed-warning DRY-RUN log (N1a). Reads the
// dryrun-warnings:{YYYYMMDD} list for the current UTC day and renders
// a compact table. Used to tune the trigger threshold before shipping
// any rider-facing warning surface (N1b).

import { getRedis } from "@/lib/cache";
import { isAdminAuthed, isAdminPasscodeConfigured } from "@/lib/admin-auth";
import { LoginForm } from "../LoginForm";
import { SS_TOKENS } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Admin · Dry-run warnings",
  robots: { index: false, follow: false },
};

type DryRunRecord = {
  ts: number;
  riderLat: number;
  riderLon: number;
  riderSpeedMph: number;
  postedLimitMph: number;
  riderOverLimitBy: number;
  nearestZoneMi: number | null;
  nearestBirdMi: number | null;
  nearestTail: string | null;
  reason: string;
};

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parse(raw: unknown): DryRunRecord | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as DryRunRecord;
    } catch {
      return null;
    }
  }
  return raw as DryRunRecord;
}

async function fetchToday(): Promise<DryRunRecord[]> {
  const redis = await getRedis();
  if (!redis) return [];
  const key = `dryrun-warnings:${utcDateKey(new Date())}`;
  try {
    const raw = (await redis.lrange(key, 0, -1)) as unknown[];
    return raw.map(parse).filter((r): r is DryRunRecord => r !== null);
  } catch {
    return [];
  }
}

export default async function DryRunPage() {
  if (!isAdminPasscodeConfigured()) {
    return <Missing />;
  }
  if (!isAdminAuthed()) {
    return <LoginForm next="/admin/dryrun-warnings" />;
  }

  const records = await fetchToday();
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "24px 18px 80px",
      }}
    >
      <header style={{ marginBottom: 18 }}>
        <div className="ss-eyebrow" style={{ marginBottom: 6 }}>
          Admin · N1a dry-run
        </div>
        <h1
          className="ss-mono"
          style={{
            fontSize: 18,
            color: SS_TOKENS.fg0,
            letterSpacing: ".04em",
            margin: 0,
          }}
        >
          Speed-warning candidates · today (UTC)
        </h1>
        <p style={{ color: SS_TOKENS.fg1, fontSize: 13, marginTop: 8 }}>
          Logged when a rider was over the limit, in a hot zone, and a
          tracked bird was within 5 nm. No rider-facing surface yet —
          this is the data we&rsquo;ll tune the threshold against.
        </p>
      </header>

      {records.length === 0 ? (
        <div
          style={{
            padding: "40px 18px",
            background: SS_TOKENS.bg1,
            border: `.5px solid ${SS_TOKENS.hairline}`,
            borderRadius: 12,
            textAlign: "center",
            color: SS_TOKENS.fg2,
            fontSize: 13,
          }}
        >
          No dry-run candidates today yet.
        </div>
      ) : (
        <Table records={records} />
      )}
    </main>
  );
}

function Table({ records }: { records: DryRunRecord[] }) {
  return (
    <div
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <table
        className="ss-mono"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: SS_TOKENS.fg1,
        }}
      >
        <thead style={{ background: SS_TOKENS.bg2 }}>
          <tr>
            <Th>UTC time</Th>
            <Th align="right">Speed</Th>
            <Th align="right">Limit</Th>
            <Th align="right">Over by</Th>
            <Th align="right">Zone nm</Th>
            <Th align="right">Bird nm</Th>
            <Th>Tail</Th>
          </tr>
        </thead>
        <tbody>
          {records
            .slice()
            .reverse()
            .map((r, i) => (
              <tr
                key={i}
                style={{ borderTop: `.5px solid ${SS_TOKENS.hairline}` }}
              >
                <Td>
                  {new Date(r.ts)
                    .toISOString()
                    .slice(11, 19)}
                </Td>
                <Td align="right">{r.riderSpeedMph.toFixed(0)}</Td>
                <Td align="right">{r.postedLimitMph.toFixed(0)}</Td>
                <Td align="right">{r.riderOverLimitBy.toFixed(0)}</Td>
                <Td align="right">
                  {r.nearestZoneMi == null ? "—" : r.nearestZoneMi.toFixed(2)}
                </Td>
                <Td align="right">
                  {r.nearestBirdMi == null ? "—" : r.nearestBirdMi.toFixed(2)}
                </Td>
                <Td>{r.nearestTail ?? "—"}</Td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: align ?? "left",
        color: SS_TOKENS.fg2,
        fontWeight: 600,
        letterSpacing: ".04em",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      style={{
        padding: "8px 12px",
        textAlign: align ?? "left",
        color: SS_TOKENS.fg0,
      }}
    >
      {children}
    </td>
  );
}

function Missing() {
  return (
    <div style={{ padding: 24, color: SS_TOKENS.fg1 }}>
      ADMIN_PASSCODE not set in this environment.
    </div>
  );
}
