// Browser-side push subscribe/unsubscribe helpers. Pure ESM, no React.
// Server-side imports (lib/push/store, lib/push/dispatcher) MUST NOT pull
// from this file — keep the SW + Push API surface client-only.

import type { AlertPrefs } from "./types";

export type SubscribeResult =
  | { ok: true; id: string; sub: PushSubscription }
  | {
      ok: false;
      reason: "unsupported" | "denied" | "vapid_missing" | "error";
      error?: unknown;
    };

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermission(): NotificationPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "default";
  }
  return Notification.permission;
}

/**
 * iOS Safari only allows push from a PWA installed to the home screen, and
 * only on iOS 16.4+. Everywhere else this returns true (i.e. push works in
 * the regular browser context).
 */
export function pushAvailableInThisContext(): {
  available: boolean;
  reason?: "ios-not-pwa" | "ios-too-old";
} {
  if (typeof window === "undefined") return { available: false };
  if (!isPushSupported()) return { available: false };
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  if (!isIos) return { available: true };
  // iOS PWA detection: standalone display-mode
  const standalone =
    (window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    // legacy iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return { available: false, reason: "ios-not-pwa" };
  return { available: true };
}

/** Decode a base64url-encoded VAPID public key into the Uint8Array Push wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  // SwRegistrar mounts on every page so this should be a no-op in practice;
  // do it again here as belt-and-suspenders for direct calls before mount.
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribePush(
  prefsPartial?: Partial<AlertPrefs>,
): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "vapid_missing" };

  try {
    const reg = await ensureRegistration();
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // The Push API typing on this DOM lib version wants a strict
      // BufferSource; the fresh-allocated Uint8Array satisfies that
      // structurally but trips TS's variance check. Cast is safe.
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    });

    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sub: sub.toJSON(),
        prefs: { ...prefsPartial, tz: detectTz(prefsPartial?.tz) },
      }),
    });
    if (!r.ok) {
      // Rollback the browser-side subscription so we don't leave a dangling
      // endpoint the server doesn't know about.
      try {
        await sub.unsubscribe();
      } catch {
        /* best-effort */
      }
      return { ok: false, reason: "error", error: await safeText(r) };
    }
    const { id } = (await r.json()) as { id: string };
    return { ok: true, id, sub };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    await sub.unsubscribe().catch(() => {
      /* tolerate browser quirk */
    });
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: json }),
    }).catch(() => {
      /* best-effort */
    });
  } catch {
    /* silent — UI will reflect from getSubscription() polling */
  }
}

export async function getCurrentSubscriptionId(): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    // The id is a sha256 hash of the endpoint — duplicate the hashing logic
    // from store.ts client-side so we don't need a roundtrip just to know
    // who we are. crypto.subtle is the only way to compute a hash in the
    // browser.
    const enc = new TextEncoder().encode(sub.endpoint);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);
    return hex;
  } catch {
    return null;
  }
}

export async function updatePushPrefs(
  id: string,
  prefs: Partial<AlertPrefs>,
): Promise<boolean> {
  try {
    const r = await fetch("/api/push/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, prefs: { ...prefs, tz: detectTz(prefs.tz) } }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a local-only test notification through the registered SW — used by
 * the user-facing test button on /settings/alerts. Doesn't go through the
 * server / Push service, so no admin auth needed.
 */
export async function showLocalTestNotification(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    if (Notification.permission !== "granted") return false;
    await reg.showNotification("Out Of Sight · test", {
      body: "",
      icon: "/icons/out-of-sight-icon-192.png",
      badge: "/icons/out-of-sight-favicon-96.png",
      tag: "smokey-test",
      data: { url: "/settings/alerts" },
    });
    return true;
  } catch {
    return false;
  }
}

function detectTz(prefer?: string): string {
  if (prefer) return prefer;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return `${r.status}`;
  }
}
