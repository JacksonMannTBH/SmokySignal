import webpush, { type PushSubscription } from "web-push";
import type { AircraftAlertPushSubscription } from "./types";

const DEFAULT_SUBJECT = "mailto:feedback@smokysignal.app";

let configured = false;

export type AircraftAlertPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  aircraftTail?: string;
};

export type AircraftAlertPushResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "expired" | "failed"; statusCode?: number };

export function isAircraftAlertPushConfigured(): boolean {
  return Boolean(getPublicKey() && getPrivateKey());
}

export function getAircraftAlertPublicKey(): string {
  return getPublicKey();
}

export async function sendAircraftAlertPush(
  subscription: AircraftAlertPushSubscription,
  payload: AircraftAlertPushPayload,
): Promise<AircraftAlertPushResult> {
  if (!configureWebPush()) return { ok: false, reason: "not_configured" };

  try {
    await webpush.sendNotification(
      subscription as PushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 30,
        urgency: "high",
      },
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : undefined;
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, reason: "expired", statusCode };
    }
    console.warn("[aircraft-alerts] send failed:", error);
    return { ok: false, reason: "failed", statusCode };
  }
}

function configureWebPush(): boolean {
  if (configured) return true;
  const publicKey = getPublicKey();
  const privateKey = getPrivateKey();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || DEFAULT_SUBJECT,
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

function getPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

function getPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY ?? "";
}
