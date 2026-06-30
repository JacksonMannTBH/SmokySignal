const DEFAULT_SAMPLE_COUNT = 2;
const DEFAULT_INTERVAL_MS = 30_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readIntEnv(name, fallback, min, max) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(raw)));
}

async function sampleOnce(baseUrl, secret, index) {
  const url = new URL("/api/cron/refresh-snapshot", baseUrl);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const body = await res.text().catch(() => "");
  return {
    index,
    ok: res.ok,
    status: res.status,
    body: body.slice(0, 500),
  };
}

export default async function snapshotSampler(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.URL;
  if (!baseUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing_base_url" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const samples = readIntEnv(
    "SNAPSHOT_SAMPLES_PER_TICK",
    DEFAULT_SAMPLE_COUNT,
    1,
    10,
  );
  const intervalMs = readIntEnv(
    "SNAPSHOT_SAMPLE_INTERVAL_MS",
    DEFAULT_INTERVAL_MS,
    5_000,
    120_000,
  );
  const results = [];
  const startedAt = Date.now();

  for (let i = 0; i < samples; i++) {
    if (i > 0) {
      await sleep(Math.max(0, startedAt + i * intervalMs - Date.now()));
    }
    results.push(await sampleOnce(baseUrl, secret, i + 1));
  }

  return new Response(
    JSON.stringify({
      ok: results.every((result) => result.ok),
      samples,
      interval_ms: intervalMs,
      results,
    }),
    {
      status: results.every((result) => result.ok) ? 200 : 502,
      headers: { "content-type": "application/json" },
    },
  );
}

export const config = {
  background: true,
};
