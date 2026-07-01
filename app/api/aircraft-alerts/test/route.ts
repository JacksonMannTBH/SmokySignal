import { NextResponse } from "next/server";
import {
  deleteAircraftAlertSubscriber,
  getAircraftAlertSubscriber,
} from "@/lib/aircraft-alerts/store";
import { sendAircraftAlertPush } from "@/lib/aircraft-alerts/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId || !/^[a-f0-9-]{20,80}$/i.test(userId)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const subscriber = await getAircraftAlertSubscriber(userId);
  if (!subscriber?.enabled) {
    return NextResponse.json({ error: "not_subscribed" }, { status: 404 });
  }

  const result = await sendAircraftAlertPush(subscriber.subscription, {
    title: "Aircraft nearby",
    body: "Notification test. Aircraft proximity alerts are armed.",
    url: "/radar",
    tag: "aircraft-alert-test",
  });

  if (!result.ok) {
    if (result.reason === "expired") {
      await deleteAircraftAlertSubscriber(userId);
    }
    return NextResponse.json(
      { error: result.reason, statusCode: result.statusCode },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
