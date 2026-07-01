#!/usr/bin/env node
// Boot-time env check. Runs before `npm run dev` and `npm run build`.
// Reads .env.local (if present) and complains about missing optional keys
// that matter for local dev. Stays silent when everything is fine.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const ENV_LOCAL = path.join(REPO_ROOT, ".env.local");

// Keys we WARN about (dev/build still proceeds — fallbacks exist).
const WARN = [
  [
    "KV_REST_API_URL",
    "Without it: in-memory cache fallback. Fine for UI work; track-history persistence won't survive a dev-server restart.",
  ],
  ["KV_REST_API_TOKEN", "Without it: in-memory cache fallback."],
  [
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "Without it: browser push subscriptions cannot be created.",
  ],
  ["VAPID_PRIVATE_KEY", "Without it: server push sends are disabled."],
  ["VAPID_SUBJECT", "Without it: push sender identity falls back to feedback email."],
  [
    "OPENSKY_CLIENT_ID",
    "Without it: anonymous OpenSky fallback (heavily rate-limited).",
  ],
  ["OPENSKY_CLIENT_SECRET", "Without it: anonymous OpenSky fallback."],
];

// Keys we BLOCK on (dev/build aborts with a clear error).
const BLOCK = [];

function readEnvFile(p) {
  try {
    const text = fs.readFileSync(p, "utf8");
    const out = {};
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return null;
  }
}

// On Vercel / CI there is no .env.local — env vars are injected directly
// into process.env. Source from there and skip the file-missing nag.
const isCI = process.env.VERCEL === "1" || process.env.CI === "true";
const env = isCI ? { ...process.env } : (readEnvFile(ENV_LOCAL) ?? {});

if (!isCI && !fs.existsSync(ENV_LOCAL) && !process.env.SS_QUIET_ENV_CHECK) {
  console.warn(
    [
      "",
      "─── SmokySignal: .env.local missing ─────────────────────────────",
      "",
      "Local dev will run with fallbacks. To sync production-like values:",
      "",
      "    npm run env:pull",
      "",
      "That writes .env.local (gitignored) from Vercel's Development scope.",
      "",
      "Prerequisite: `npx vercel link` against the SmokySignal project.",
      "─────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

const missingBlocking = BLOCK.filter(([k]) => !env[k] || env[k].trim() === "");
const missingWarn = WARN.filter(([k]) => !env[k] || env[k].trim() === "");

// Detect the "Vercel pulled OIDC only" failure mode: .env.local exists but
// is essentially empty (only has VERCEL_OIDC_TOKEN or similar auto-injected
// keys). This means env:pull ran but Development scope has nothing of
// substance ticked.
const meaningfulKeys = Object.keys(env).filter(
  (k) =>
    !["VERCEL_OIDC_TOKEN", "VERCEL", "VERCEL_ENV"].includes(k) &&
    !k.startsWith("VERCEL_"),
);
const looksUnpopulated = meaningfulKeys.length === 0;

if (missingBlocking.length) {
  console.error("");
  console.error(
    "─── SmokySignal: missing required env vars ────────────────────",
  );
  console.error("");
  for (const [k, why] of missingBlocking) {
    console.error(`    ${k}`);
    console.error(`        ${why}`);
    console.error("");
  }
  if (looksUnpopulated) {
    console.error("Detected: .env.local has only Vercel auto-injected keys.");
    console.error(
      "Your Vercel project likely has these env vars set for",
    );
    console.error("Production/Preview but not Development.");
    console.error("");
    console.error("Fix:");
    console.error(
      "  1. Open Vercel → your project → Settings → Environment Variables",
    );
    console.error("  2. For each missing key above, click the row, tick the");
    console.error('     "Development" checkbox, save.');
    console.error(
      "  3. Skip KV_REST_API_* — those are integration-managed.",
    );
    console.error("  4. Re-run `npm run env:pull` and `npm run dev`.");
  } else {
    console.error("Fix: `npm run env:pull` (or edit .env.local manually).");
  }
  console.error(
    "───────────────────────────────────────────────────────────────",
  );
  console.error("");
  process.exit(1);
}

if (missingWarn.length && !process.env.SS_QUIET_ENV_CHECK) {
  console.warn("");
  console.warn("SmokySignal: optional env vars missing — using fallbacks:");
  for (const [k, why] of missingWarn) console.warn(`    ${k} — ${why}`);
  console.warn("Set SS_QUIET_ENV_CHECK=1 to silence this warning.");
  console.warn("");
}
