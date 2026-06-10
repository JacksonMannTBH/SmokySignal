// Admin-only: send a one-off test notification to a specific subscription
// (when `id` is provided) or to every active subscription (when omitted).
// Use the broadcast variant sparingly — it pings every opted-in rider.
//
// Riders verifying their own subscription should use the local-only test
// button on /settings/alerts (showLocalTestNotification) — that path does
// NOT require admin and doesn't go through the Push service.

import webpush from "web-push";
import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  getSubscription,
  listSubscriptions,
  removeSubscription,
} from "@/lib/push/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_PAYLOAD = {
  title: "Out Of Sight · test",
  body: "Channel 19. Test ping. 10-4.",
  tag: "smokey-test",
  data: { url: "/settings/alerts" },
};

function ensureVapidConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  return true;
}

export async function POST(req: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ensureVapidConfigured()) {
    return NextResponse.json(
      { error: "vapid_not_configured" },
      { status: 500 },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body — broadcast mode */
  }
  const id = (body as { id?: string }).id;

  const targets = id
    ? await (async () => {
        const s = await getSubscription(id);
        return s ? [s] : [];
      })()
    : await listSubscriptions();

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, removed: 0 });
  }

  console.log(`[push/test] sending test to ${targets.length} subscription(s)`);

  let sent = 0;
  let removed = 0;
  for (const t of targets) {
    try {
      await webpush.sendNotification(
        t.sub as webpush.PushSubscription,
        JSON.stringify(TEST_PAYLOAD),
        { TTL: 60 },
      );
      sent++;
    } catch (e: unknown) {
      const status =
        typeof e === "object" && e !== null && "statusCode" in e
          ? Number((e as { statusCode: unknown }).statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await removeSubscription(t.id).catch(() => {});
        removed++;
      } else {
        console.warn("[push/test] send failed:", e);
      }
    }
  }
  return NextResponse.json({ ok: true, sent, removed });
}
