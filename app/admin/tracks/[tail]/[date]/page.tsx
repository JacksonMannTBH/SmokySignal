import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { getRegistry } from "@/lib/registry";
import { getTracksForDay } from "@/lib/tracks";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "../../../LoginForm";
import { AdminHeader } from "../../AdminHeader";
import {
  humanDate,
  fmtPtTime,
  fmtDuration,
  fmtPtDateTime,
  ktToMph,
} from "../../fmt";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Admin · Tracks · Day",
  robots: { index: false, follow: false },
};

const TracksMap = nextDynamic(() => import("@/components/TracksMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: SS_TOKENS.bg0,
      }}
    />
  ),
});

type Props = {
  params: { tail: string; date: string };
  searchParams: { error?: string };
};

export default async function DayMapPage({ params, searchParams }: Props) {
  if (!isAdminPasscodeConfigured()) return <Missing />;
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next="tracks" />;
  }

  const tail = params.tail.toUpperCase();
  if (!/^\d{8}$/.test(params.date)) notFound();

  const [fleet, samples] = await Promise.all([
    getRegistry(),
    getTracksForDay(tail, params.date),
  ]);
  const entry = fleet.find((f) => f.tail === tail);
  if (!entry) notFound();

  const first = samples[0];
  const last = samples[samples.length - 1];
  const duration =
    first && last ? fmtDuration(last.ts - first.ts) : "—";

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: SS_TOKENS.bg0,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `.5px solid ${SS_TOKENS.hairline}`,
          background: "rgba(11,13,16,.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 5,
        }}
      >
        <AdminHeader active="flights" subtitle="Flights" />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <Link
            href={`/admin/tracks/${entry.tail}`}
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg1,
              textDecoration: "none",
              letterSpacing: ".06em",
            }}
          >
            ‹ Back
          </Link>
          <span
            className="ss-mono"
            style={{ fontSize: 16, fontWeight: 700 }}
          >
            {entry.tail}
          </span>
          <span style={{ fontSize: 13, color: SS_TOKENS.fg1 }}>
            {humanDate(params.date)}
          </span>
          <span
            className="ss-mono"
            style={{ fontSize: 11, color: SS_TOKENS.fg2, letterSpacing: ".06em" }}
          >
            {samples.length} samples · {duration}
          </span>
        </div>
      </div>

      <div style={{ position: "relative", flex: 1 }}>
        {samples.length >= 2 ? (
          <TracksMap samples={samples} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: SS_TOKENS.fg2,
              fontSize: 13,
            }}
          >
            Need at least 2 samples to draw a path. Got {samples.length}.
          </div>
        )}
      </div>
    </main>
  );
}

function Missing() {
  return (
    <main style={{ padding: 32, color: SS_TOKENS.fg1 }}>
      <code>ADMIN_PASSCODE</code> isn&rsquo;t set in this environment.
    </main>
  );
}
