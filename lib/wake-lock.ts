export const WAKE_LOCK_STORAGE_KEY = "ss_wake_lock";
export const WAKE_LOCK_CHANGE_EVENT = "ss-wake-lock-change";

const PREF_ON = "on";
const PREF_OFF = "off";

export function readStoredWakeLockEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WAKE_LOCK_STORAGE_KEY) !== PREF_OFF;
  } catch {
    return true;
  }
}

export function writeStoredWakeLockEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        WAKE_LOCK_STORAGE_KEY,
        enabled ? PREF_ON : PREF_OFF,
      );
    } catch {
      /* localStorage may be unavailable in private browsing */
    }
    window.dispatchEvent(
      new CustomEvent(WAKE_LOCK_CHANGE_EVENT, { detail: { enabled } }),
    );
  }
}
