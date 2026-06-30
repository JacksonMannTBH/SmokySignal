export default async function refreshSnapshot() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "missing NEXT_PUBLIC_BASE_URL/URL or CRON_SECRET",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const url = new URL("/.netlify/functions/snapshot-sampler", baseUrl);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  });

  return new Response(
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      sampler: "snapshot-sampler",
    }),
    {
      status: res.status,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}

export const config = {
  schedule: "* * * * *",
};
