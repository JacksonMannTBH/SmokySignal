// QA dashboard. Operator-facing, admin-passcode-gated. Reads
// docs/qa-dashboard.md from the deployed bundle for the static body
// + KV for the live heartbeat. Render is intentionally minimal —
// this is operator info, not a rider surface.

import { redirect } from "next/navigation";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { cacheGet } from "@/lib/cache";
import { SS_TOKENS } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Out Of Sight · QA dashboard",
  robots: { index: false, follow: false },
};

async function loadBody(): Promise<string> {
  try {
    const p = path.resolve(process.cwd(), "docs/qa-dashboard.md");
    return await fs.readFile(p, "utf8");
  } catch {
    return "_docs/qa-dashboard.md not deployed in this build._";
  }
}

function formatHeartbeat(ts: number | null): {
  iso: string;
  age: string;
  color: string;
} {
  if (ts == null) {
    return { iso: "never", age: "—", color: SS_TOKENS.fg2 };
  }
  const ageS = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  const ageMin = Math.floor(ageS / 60);
  const stale = ageS > 5400;
  const ageStr =
    ageMin < 1
      ? "just now"
      : ageMin < 60
        ? `${ageMin}m ago`
        : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;
  return {
    iso: new Date(ts * 1000).toISOString(),
    age: ageStr,
    color: stale ? SS_TOKENS.alert : SS_TOKENS.clear,
  };
}

export default async function QADashboardPage() {
  if (!isAdminPasscodeConfigured()) {
    return (
      <main style={{ padding: 32, maxWidth: 720, margin: "0 auto", color: SS_TOKENS.fg0 }}>
        <h1 style={{ marginTop: 0 }}>QA dashboard</h1>
        <p style={{ color: SS_TOKENS.fg1 }}>
          <code className="ss-mono">ADMIN_PASSCODE</code> isn&rsquo;t set in
          this environment. Configure the env var to enable the dashboard.
        </p>
      </main>
    );
  }
  if (!isAdminAuthed()) {
    redirect("/admin?next=qa");
  }

  const [body, lastHeartbeatTs] = await Promise.all([
    loadBody(),
    cacheGet<number>("meta:last_heartbeat"),
  ]);
  const hb = formatHeartbeat(lastHeartbeatTs ?? null);

  return (
    <main
      style={{
        padding: 32,
        maxWidth: 900,
        margin: "0 auto",
        color: SS_TOKENS.fg0,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>QA dashboard</h1>
        <a
          href="/"
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg2, textDecoration: "none" }}
        >
          ← Home
        </a>
      </header>

      <section
        style={{
          background: SS_TOKENS.bg1,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div className="ss-eyebrow" style={{ color: SS_TOKENS.fg2 }}>
          Mac Mini heartbeat
        </div>
        <div className="ss-mono" style={{ fontSize: 14, color: hb.color }}>
          {hb.age}
          {lastHeartbeatTs != null ? ` · ${hb.iso}` : ""}
        </div>
        <div style={{ fontSize: 11, color: SS_TOKENS.fg2 }}>
          Threshold for infra-alert: &gt; 90 min stale.
        </div>
      </section>

      <pre
        style={{
          background: SS_TOKENS.bg1,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 12,
          padding: "16px 20px",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: SS_TOKENS.fg0,
          whiteSpace: "pre-wrap",
          overflowX: "auto",
        }}
      >
        {body}
      </pre>
    </main>
  );
}
