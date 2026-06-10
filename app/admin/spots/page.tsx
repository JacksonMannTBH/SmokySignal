import nextDynamic from "next/dynamic";
import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { listRecentSpots, type StoredSpot } from "@/lib/spots";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "../LoginForm";
import { AdminHeader } from "../tracks/AdminHeader";
import { formatTs } from "@/lib/time";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Admin · Spots",
  robots: { index: false, follow: false },
};

const SpotsMap = nextDynamic(() => import("@/components/SpotsMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 300,
        background: SS_TOKENS.bg0,
        borderRadius: 12,
      }}
    />
  ),
});

type SP = { error?: string };

export default async function AdminSpotsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  if (!isAdminPasscodeConfigured()) return <Missing />;
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next="spots" />;
  }

  const spots = await listRecentSpots(100);
  const hour12 = isHour12(getTimeFormatPref());

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "16px 18px 60px",
        maxWidth: 880,
        margin: "0 auto",
        color: SS_TOKENS.fg0,
      }}
    >
      <AdminHeader active="spots" subtitle="Spots" />

      <div style={{ marginBottom: 16 }}>
        <h2
          className="ss-mono"
          style={{
            fontSize: 11,
            letterSpacing: ".12em",
            color: SS_TOKENS.fg2,
            textTransform: "uppercase",
            margin: 0,
            marginBottom: 10,
          }}
        >
          Spots — last 7 days
        </h2>
        {spots.length === 0 ? (
          <Empty />
        ) : (
          <>
            <div
              style={{
                position: "relative",
                height: 300,
                borderRadius: 12,
                overflow: "hidden",
                border: `.5px solid ${SS_TOKENS.hairline}`,
              }}
            >
              <SpotsMap spots={spots} />
            </div>

            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>TIME</Th>
                    <Th>LAT</Th>
                    <Th>LON</Th>
                    <Th>AIRBORNE AT SPOT</Th>
                  </tr>
                </thead>
                <tbody>
                  {spots.map((s) => (
                    <tr
                      key={s.id}
                      style={{
                        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                      }}
                    >
                      <Td mono>{formatTs(s.ts, "datetime", { hour12 })}</Td>
                      <Td mono>{s.lat.toFixed(4)}</Td>
                      <Td mono>{s.lon.toFixed(4)}</Td>
                      <Td>
                        {s.airborne_tails.length === 0 ? (
                          <span style={{ color: SS_TOKENS.fg3 }}>
                            (none reported)
                          </span>
                        ) : (
                          formatAirborne(s)
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function formatAirborne(spot: StoredSpot): string {
  return spot.airborne_tails
    .map((t) =>
      t.distance_nm != null
        ? `${t.tail} (${t.distance_nm.toFixed(1)} nm)`
        : t.tail,
    )
    .join(", ");
}

function Empty() {
  return (
    <div
      style={{
        padding: "32px 16px",
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        textAlign: "center",
        color: SS_TOKENS.fg2,
        fontSize: 13,
      }}
    >
      No spots logged yet.
    </div>
  );
}

function Missing() {
  return (
    <main style={{ padding: 32, color: SS_TOKENS.fg1 }}>
      <code>ADMIN_PASSCODE</code> isn&rsquo;t set in this environment.
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="ss-mono"
      style={{
        textAlign: "left",
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
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "8px 8px",
        fontSize: 12,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-brand)",
        color: SS_TOKENS.fg1,
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
