"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  getCurrentSubscriptionId,
  getPushPermission,
  isPushSupported,
  pushAvailableInThisContext,
  showLocalTestNotification,
  subscribePush,
  unsubscribePush,
  updatePushPrefs,
} from "@/lib/push/client";
import { DEFAULT_PREFS, type AlertPrefs, type UserZoneSpec } from "@/lib/push/types";
import {
  DEFAULT_PROXIMITY_NM,
  getProximityThresholdNm,
  isProximityEnabled,
  setProximityEnabled,
  setProximityThresholdNm,
} from "@/lib/proximity-alert";
import {
  REGION_PROXIMITY_MAX_MI,
  REGION_PROXIMITY_MIN_MI,
  clampRegionProximityMiles,
  clampRegionProximityNm,
  nmToStatuteMiles,
  statuteMilesToNm,
} from "@/lib/proximity-limits";
import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  normalizeRideStatusThresholds,
  rideStatusLabel,
  type RideStatus,
  type RideStatusThresholds,
} from "@/lib/ride-mode";
import {
  DEFAULT_RIDE_STATUS_NOTIFICATIONS,
  getRideStatusNotificationPrefs,
  getRideStatusThresholds,
  setRideStatusNotificationPrefs,
  setRideStatusThresholds,
  type RideStatusNotificationPrefs,
} from "@/lib/ride-settings";
import {
  APP_REGIONS_BY_ID,
  APP_STATES,
  firstRegionForState,
  stateForRegion,
  type AppRegionId,
  type AppStateId,
} from "@/lib/app-regions";
import {
  REGION_CHANGE_EVENT,
  getRegion,
  setRegion,
} from "@/lib/region-pref";
import {
  readStoredWakeLockEnabled,
  WAKE_LOCK_CHANGE_EVENT,
  writeStoredWakeLockEnabled,
} from "@/lib/wake-lock";

type LoadState = "loading" | "ready";

export function AlertsSettings() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [supported, setSupported] = useState(true);
  const [contextOk, setContextOk] = useState<{
    available: boolean;
    reason?: "ios-not-pwa" | "ios-too-old";
  }>({ available: true });
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subId, setSubId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wakeMode, setWakeMode] = useState(true);
  const [wakeSupported, setWakeSupported] = useState(true);
  const [proximityOn, setProximityOn] = useState<boolean>(false);
  const [proximityNm, setProximityNm] = useState<number>(DEFAULT_PROXIMITY_NM);
  const [proximityInput, setProximityInput] = useState<string>(
    formatProximityMiles(DEFAULT_PROXIMITY_NM),
  );
  const [selectedRegionId, setSelectedRegionId] = useState<AppRegionId>(
    () => getRegion(),
  );
  const [rideThresholds, setRideThresholds] =
    useState<RideStatusThresholds>(DEFAULT_RIDE_STATUS_THRESHOLDS);
  const [rideInputs, setRideInputs] = useState<Record<keyof RideStatusThresholds, string>>({
    watchNm: String(DEFAULT_RIDE_STATUS_THRESHOLDS.watchNm),
    warningNm: String(DEFAULT_RIDE_STATUS_THRESHOLDS.warningNm),
    stopNm: String(DEFAULT_RIDE_STATUS_THRESHOLDS.stopNm),
  });
  const [rideNotifications, setRideNotifications] =
    useState<RideStatusNotificationPrefs>(DEFAULT_RIDE_STATUS_NOTIFICATIONS);

  useEffect(() => {
    const storedProximityNm = getProximityThresholdNm();
    const storedRideThresholds = getRideStatusThresholds();
    setWakeMode(readStoredWakeLockEnabled());
    setWakeSupported("wakeLock" in navigator);
    setProximityOn(isProximityEnabled());
    setProximityNm(storedProximityNm);
    setProximityInput(formatProximityMiles(storedProximityNm));
    setSelectedRegionId(getRegion());
    setRideThresholds(storedRideThresholds);
    setRideInputs({
      watchNm: String(storedRideThresholds.watchNm),
      warningNm: String(storedRideThresholds.warningNm),
      stopNm: String(storedRideThresholds.stopNm),
    });
    setRideNotifications(getRideStatusNotificationPrefs());
  }, []);

  useEffect(() => {
    const onWakeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setWakeMode(detail?.enabled ?? readStoredWakeLockEnabled());
    };
    window.addEventListener(WAKE_LOCK_CHANGE_EVENT, onWakeChange);
    const onRegionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: AppRegionId }>).detail;
      setSelectedRegionId(detail?.id ?? getRegion());
    };
    window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
    return () => {
      window.removeEventListener(WAKE_LOCK_CHANGE_EVENT, onWakeChange);
      window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sup = isPushSupported();
        setSupported(sup);
        setContextOk(pushAvailableInThisContext());
        setPermission(getPushPermission());
        if (sup) {
          const id = await withTimeout(getCurrentSubscriptionId(), 1500, null);
          if (!cancelled && id) setSubId(id);
        }
      } finally {
        if (!cancelled) setLoadState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fixedPrefs = useMemo<AlertPrefs>(
    () => ({
      ...prefs,
      tier: "all",
      zones: "any",
      tails: undefined,
      userZones: buildRegionZones(selectedRegionId, proximityOn, proximityNm),
      region_id: selectedRegionId,
      proximity_enabled: proximityOn,
      proximity_nm: proximityNm,
    }),
    [prefs, proximityNm, proximityOn, selectedRegionId],
  );

  const proximityMi = useMemo(
    () => clampRegionProximityMiles(nmToStatuteMiles(proximityNm)),
    [proximityNm],
  );

  useEffect(() => {
    if (!subId) return;
    void updatePushPrefs(subId, {
      userZones: buildRegionZones(selectedRegionId, proximityOn, proximityNm),
      region_id: selectedRegionId,
      proximity_enabled: proximityOn,
      proximity_nm: proximityNm,
    });
  }, [proximityNm, proximityOn, selectedRegionId, subId]);

  const onArm = useCallback(async () => {
    setBusy(true);
    const r = await subscribePush(fixedPrefs);
    setBusy(false);
    setPermission(getPushPermission());
    if (r.ok) {
      setSubId(r.id);
      flash("10-4. We'll keep you posted.");
    } else if (r.reason === "denied") {
      flash("Browser blocked alerts. Update permission in your settings.");
    } else if (r.reason === "vapid_missing") {
      flash("Push isn't configured on this build. Try the live site.");
    } else if (r.reason === "unsupported") {
      flash("This browser doesn't support push.");
    } else {
      flash("Couldn't subscribe. Try again in a moment.");
    }
  }, [fixedPrefs, flash]);

  const onDisarm = useCallback(async () => {
    setBusy(true);
    await unsubscribePush();
    setBusy(false);
    setSubId(null);
    flash("Off the air. Channel 19 still open if you change your mind.");
  }, [flash]);

  const persistPrefs = useCallback(
    async (next: Partial<AlertPrefs>) => {
      const merged: AlertPrefs = { ...prefs, ...next };
      setPrefs(merged);
      if (!subId) return;
      const ok = await updatePushPrefs(subId, next);
      if (!ok) flash("Couldn't save preference. Try again.");
    },
    [prefs, subId, flash],
  );

  const onTest = useCallback(async () => {
    if (permission !== "granted") {
      flash("Arm alerts first to receive the test ping.");
      return;
    }
    const ok = await showLocalTestNotification();
    if (!ok) flash("Couldn't send the test ping.");
  }, [permission, flash]);

  const onWakeToggle = useCallback((checked: boolean) => {
    setWakeMode(checked);
    writeStoredWakeLockEnabled(checked);
  }, []);

  const commitProximityMiles = useCallback((miles: number) => {
    if (!Number.isFinite(miles)) return;
    const clampedMiles = clampRegionProximityMiles(miles);
    const clampedNm = clampRegionProximityNm(statuteMilesToNm(clampedMiles));
    setProximityNm(clampedNm);
    setProximityInput(formatMiles(clampedMiles));
    setProximityThresholdNm(clampedNm);
  }, []);

  const onProximityInputBlur = useCallback(() => {
    const n = Number(proximityInput);
    if (Number.isFinite(n) && n > 0) {
      commitProximityMiles(n);
      return;
    }
    setProximityInput(formatProximityMiles(proximityNm));
  }, [commitProximityMiles, proximityInput, proximityNm]);

  const nudgeProximityMiles = useCallback(
    (delta: number) => {
      commitProximityMiles(proximityMi + delta);
    },
    [commitProximityMiles, proximityMi],
  );

  const commitRideThreshold = useCallback(
    (key: keyof RideStatusThresholds, value: number) => {
      if (!Number.isFinite(value)) return;
      const next = setRideStatusThresholds({ ...rideThresholds, [key]: value });
      setRideThresholds(next);
      setRideInputs({
        watchNm: String(next.watchNm),
        warningNm: String(next.warningNm),
        stopNm: String(next.stopNm),
      });
    },
    [rideThresholds],
  );

  const onRideInputBlur = useCallback(
    (key: keyof RideStatusThresholds) => {
      const n = Number(rideInputs[key]);
      if (Number.isFinite(n) && n > 0) {
        commitRideThreshold(key, n);
        return;
      }
      setRideInputs({
        watchNm: String(rideThresholds.watchNm),
        warningNm: String(rideThresholds.warningNm),
        stopNm: String(rideThresholds.stopNm),
      });
    },
    [commitRideThreshold, rideInputs, rideThresholds],
  );

  const onRideNotifyChange = useCallback(
    (status: RideStatus, checked: boolean) => {
      const next = setRideStatusNotificationPrefs({
        ...rideNotifications,
        [status]: checked,
      });
      setRideNotifications(next);
    },
    [rideNotifications],
  );

  const rideBands = useMemo(
    () => buildRideBands(rideThresholds, rideNotifications),
    [rideNotifications, rideThresholds],
  );

  const statusBadge = useMemo<{ label: string; color: string; bg: string }>(
    () =>
      subId
        ? { label: "ARMED", color: SS_TOKENS.alert, bg: SS_TOKENS.alertDim }
        : { label: "OFF", color: SS_TOKENS.fg2, bg: SS_TOKENS.bg2 },
    [subId],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "22px 20px 170px",
        maxWidth: 430,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1.1,
          color: SS_TOKENS.fg0,
          margin: 0,
        }}
      >
        Settings
      </h1>

      <Section eyebrow="Device">
        <PreferenceToggleRow
          label="Wake mode"
          checked={wakeMode}
          onChange={onWakeToggle}
          disabled={!wakeSupported}
          stateText={wakeSupported ? undefined : "Unavailable"}
        />
      </Section>

      {loadState === "loading" ? (
        <Card>
          <p style={{ color: SS_TOKENS.fg2, fontSize: 13 }}>Checking...</p>
        </Card>
      ) : !supported ? (
        <UnsupportedCard />
      ) : !contextOk.available ? (
        <IosNotPwaCard reason={contextOk.reason} />
      ) : (
        <>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  className="ss-mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: 0,
                    color: SS_TOKENS.fg2,
                  }}
                >
                  STATUS
                </div>
                <div
                  className="ss-mono"
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0,
                    color: statusBadge.color,
                    background: statusBadge.bg,
                    border: `.5px solid ${statusBadge.color}55`,
                  }}
                >
                  {statusBadge.label}
                </div>
                {!subId && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: SS_TOKENS.fg2,
                      lineHeight: 1.45,
                    }}
                  >
                    Alerts are off. Arm once to allow proximity and ride-mode
                    notifications.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={subId ? onDisarm : onArm}
                disabled={busy || permission === "denied"}
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: 0,
                  background: subId ? SS_TOKENS.bg2 : SS_TOKENS.alert,
                  color: subId ? SS_TOKENS.fg1 : SS_TOKENS.bg0,
                  fontFamily: "var(--font-brand)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0,
                  cursor:
                    busy || permission === "denied" ? "default" : "pointer",
                  opacity: busy || permission === "denied" ? 0.6 : 1,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {subId ? "Disarm" : "Arm alerts"}
              </button>
            </div>

            {permission === "denied" && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 12.5,
                  color: SS_TOKENS.danger,
                  lineHeight: 1.45,
                }}
              >
                Your browser blocked alerts. Open Safari settings for Out Of
                Sight to fix.
              </p>
            )}
          </Card>

          <Section eyebrow="Region">
            <p
              style={{
                fontSize: 13,
                color: SS_TOKENS.fg1,
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Background proximity alerts use the selected region center ZIP,
              not your active location.
            </p>
            <RegionChoice
              regionId={selectedRegionId}
              onStateChange={(stateId) => {
                const next = firstRegionForState(stateId).id;
                setSelectedRegionId(next);
                setRegion(next);
              }}
              onRegionChange={(regionId) => {
                setSelectedRegionId(regionId);
                setRegion(regionId);
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={proximityOn}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setProximityOn(next);
                    setProximityEnabled(next);
                  }}
                />
                <span
                  className="ss-mono"
                  style={{ fontSize: 12, letterSpacing: 0 }}
                >
                  ENABLED
                </span>
              </label>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => nudgeProximityMiles(-1)}
                disabled={!proximityOn || proximityMi <= REGION_PROXIMITY_MIN_MI}
                aria-label="Decrease proximity range"
                style={stepButtonStyle(
                  !proximityOn || proximityMi <= REGION_PROXIMITY_MIN_MI,
                )}
              >
                -
              </button>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                min={REGION_PROXIMITY_MIN_MI}
                max={REGION_PROXIMITY_MAX_MI}
                value={proximityInput}
                onChange={(e) => {
                  setProximityInput(e.target.value);
                }}
                onBlur={onProximityInputBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                disabled={!proximityOn}
                aria-label="Proximity threshold in miles"
                style={{
                  width: 72,
                  minHeight: 40,
                  padding: "6px 10px",
                  background: SS_TOKENS.bg2,
                  border: `.5px solid ${SS_TOKENS.hairline2}`,
                  borderRadius: 8,
                  color: SS_TOKENS.fg0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  textAlign: "center",
                  opacity: proximityOn ? 1 : 0.5,
                }}
              />
              <button
                type="button"
                onClick={() => nudgeProximityMiles(1)}
                disabled={!proximityOn || proximityMi >= REGION_PROXIMITY_MAX_MI}
                aria-label="Increase proximity range"
                style={stepButtonStyle(
                  !proximityOn || proximityMi >= REGION_PROXIMITY_MAX_MI,
                )}
              >
                +
              </button>
              <span
                className="ss-mono"
                style={{ fontSize: 11, color: SS_TOKENS.fg2 }}
              >
                MI
              </span>
            </div>
          </Section>

          <Section eyebrow="Ride mode">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <RideThresholdInput
                label="Clear above"
                value={rideInputs.watchNm}
                onChange={(value) =>
                  setRideInputs((current) => ({ ...current, watchNm: value }))
                }
                onCommit={() => onRideInputBlur("watchNm")}
              />
              <RideThresholdInput
                label="Warning within"
                value={rideInputs.warningNm}
                onChange={(value) =>
                  setRideInputs((current) => ({
                    ...current,
                    warningNm: value,
                  }))
                }
                onCommit={() => onRideInputBlur("warningNm")}
              />
              <RideThresholdInput
                label="Stop within"
                value={rideInputs.stopNm}
                onChange={(value) =>
                  setRideInputs((current) => ({ ...current, stopNm: value }))
                }
                onCommit={() => onRideInputBlur("stopNm")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rideBands.map((band) => (
                <RideBandRow
                  key={band.status}
                  label={band.label}
                  range={band.range}
                  color={band.color}
                  checked={band.notify}
                  onChange={(checked) =>
                    onRideNotifyChange(band.status, checked)
                  }
                />
              ))}
            </div>
          </Section>

          <Section eyebrow="Quiet hours">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HourInput
                value={prefs.quiet_start_h}
                onChange={(h) => persistPrefs({ quiet_start_h: h })}
              />
              <span
                className="ss-mono"
                style={{ color: SS_TOKENS.fg2, fontSize: 12 }}
              >
                to
              </span>
              <HourInput
                value={prefs.quiet_end_h}
                onChange={(h) => persistPrefs({ quiet_end_h: h })}
              />
              <span
                className="ss-mono"
                style={{ color: SS_TOKENS.fg2, fontSize: 11 }}
              >
                {prefs.tz}
              </span>
            </div>
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: SS_TOKENS.fg2,
                lineHeight: 1.45,
              }}
            >
              Channel 19 stays quiet between these hours.
            </p>
          </Section>

          <Section eyebrow="Test">
            <button
              type="button"
              onClick={onTest}
              disabled={permission !== "granted"}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: `.5px solid ${SS_TOKENS.hairline2}`,
                background: SS_TOKENS.bg2,
                color: SS_TOKENS.fg0,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: 0,
                cursor: permission === "granted" ? "pointer" : "default",
                opacity: permission === "granted" ? 1 : 0.5,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Send me a test ping
            </button>
          </Section>
        </>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 84,
            padding: "10px 14px",
            borderRadius: 999,
            background: SS_TOKENS.surface,
            color: SS_TOKENS.fg0,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            boxShadow: SS_TOKENS.shadowMd,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            fontFamily: "inherit",
            fontSize: 12,
            letterSpacing: 0,
            zIndex: 30,
            maxWidth: "calc(100% - 32px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

const RIDE_STATUS_COLORS: Record<RideStatus, string> = {
  clear: SS_TOKENS.clear,
  watch: SS_TOKENS.sky,
  warning: SS_TOKENS.warn,
  danger: SS_TOKENS.danger,
};

type RideBand = {
  status: RideStatus;
  label: string;
  range: string;
  color: string;
  notify: boolean;
};

function normalizeProximityNm(nm: number): number {
  return clampRegionProximityNm(nm);
}

function formatMiles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatProximityMiles(nm: number): string {
  return formatMiles(clampRegionProximityMiles(nmToStatuteMiles(nm)));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function buildRideBands(
  thresholds: RideStatusThresholds,
  notifications: RideStatusNotificationPrefs,
): RideBand[] {
  const t = normalizeRideStatusThresholds(thresholds);
  return [
    {
      status: "clear",
      label: rideStatusLabel("clear"),
      range: `>${formatNm(t.watchNm)} nm`,
      color: RIDE_STATUS_COLORS.clear,
      notify: notifications.clear,
    },
    {
      status: "watch",
      label: rideStatusLabel("watch"),
      range: `${formatNm(t.warningNm)}-${formatNm(t.watchNm)} nm`,
      color: RIDE_STATUS_COLORS.watch,
      notify: notifications.watch,
    },
    {
      status: "warning",
      label: rideStatusLabel("warning"),
      range: `${formatNm(t.stopNm)}-${formatNm(t.warningNm)} nm`,
      color: RIDE_STATUS_COLORS.warning,
      notify: notifications.warning,
    },
    {
      status: "danger",
      label: rideStatusLabel("danger"),
      range: `<=${formatNm(t.stopNm)} nm`,
      color: RIDE_STATUS_COLORS.danger,
      notify: notifications.danger,
    },
  ];
}

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildRegionZones(
  regionId: AppRegionId,
  enabled: boolean,
  radiusNm: number,
): UserZoneSpec[] {
  if (!enabled) return [];
  const region = APP_REGIONS_BY_ID[regionId];
  return [
    {
      lat: region.centerLat,
      lon: region.centerLon,
      radiusNm: normalizeProximityNm(radiusNm),
      label: `${region.label} ${region.zip}`,
    },
  ];
}

function RegionChoice({
  regionId,
  onStateChange,
  onRegionChange,
}: {
  regionId: AppRegionId;
  onStateChange: (stateId: AppStateId) => void;
  onRegionChange: (regionId: AppRegionId) => void;
}) {
  const state = stateForRegion(regionId);
  const region = APP_REGIONS_BY_ID[regionId];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <label style={selectLabelStyle}>
        <span className="ss-mono" style={selectCaptionStyle}>
          State
        </span>
        <select
          value={state.id}
          onChange={(event) => onStateChange(event.target.value as AppStateId)}
          style={selectStyle}
          aria-label="State"
        >
          {APP_STATES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label style={selectLabelStyle}>
        <span className="ss-mono" style={selectCaptionStyle}>
          Region
        </span>
        <select
          value={region.id}
          onChange={(event) => onRegionChange(event.target.value as AppRegionId)}
          style={selectStyle}
          aria-label="Region"
        >
          {state.regions.map((r) => (
            <option key={r[0]} value={r[0]}>
              {r[1]}
            </option>
          ))}
        </select>
      </label>
      <div
        className="ss-mono"
        style={{
          gridColumn: "1 / -1",
          color: SS_TOKENS.fg2,
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        ZIP {region.zip} - {region.city}
      </div>
    </div>
  );
}

function stepButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `.5px solid ${SS_TOKENS.hairline2}`,
    background: SS_TOKENS.bg2,
    color: SS_TOKENS.fg0,
    fontFamily: "var(--font-mono)",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  };
}

const selectLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
};

const selectCaptionStyle: CSSProperties = {
  color: SS_TOKENS.fg2,
  fontSize: 10,
};

const selectStyle: CSSProperties = {
  minHeight: 42,
  width: "100%",
  borderRadius: 10,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg0,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 10px",
};

function PreferenceToggleRow({
  label,
  checked,
  disabled = false,
  stateText,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  stateText?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        minHeight: 46,
        padding: "8px 10px",
        borderRadius: 10,
        background: SS_TOKENS.bg2,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            color: SS_TOKENS.fg0,
            fontSize: 14,
            fontWeight: 750,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span
          className="ss-mono"
          style={{ color: SS_TOKENS.fg2, fontSize: 10, marginTop: 3 }}
        >
          {stateText ?? (checked ? "ON" : "OFF")}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

function RideThresholdInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        minWidth: 0,
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        className="ss-mono"
        style={{ color: SS_TOKENS.fg2, fontSize: 9.5, letterSpacing: 0 }}
      >
        {label}
      </span>
      <span
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 6,
          minHeight: 40,
          padding: "0 8px",
          borderRadius: 8,
          background: SS_TOKENS.bg2,
          border: `.5px solid ${SS_TOKENS.hairline2}`,
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label={`${label} nautical miles`}
          style={{
            width: "100%",
            minWidth: 0,
            border: 0,
            outline: "none",
            background: "transparent",
            color: SS_TOKENS.fg0,
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            textAlign: "center",
          }}
        />
        <span className="ss-mono" style={{ color: SS_TOKENS.fg2, fontSize: 10 }}>
          NM
        </span>
      </span>
    </label>
  );
}

function RideBandRow({
  label,
  range,
  color,
  checked,
  onChange,
}: {
  label: string;
  range: string;
  color: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 10,
        background: SS_TOKENS.bg2,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="ss-mono"
          style={{
            color,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          className="ss-mono"
          style={{ color: SS_TOKENS.fg2, fontSize: 11, marginTop: 3 }}
        >
          {range}
        </div>
      </div>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 40,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={`${label} ride notification`}
        />
        <span className="ss-mono" style={{ color: SS_TOKENS.fg1, fontSize: 11 }}>
          Notify
        </span>
      </label>
    </div>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: 0,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 22,
        boxShadow: SS_TOKENS.shadowSm,
        padding: "14px 16px",
      }}
    >
      {children}
    </section>
  );
}

function HourInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (h: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={23}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(0, Math.min(23, Math.trunc(n)));
        onChange(clamped);
      }}
      className="ss-mono"
      style={{
        width: 56,
        padding: "6px 8px",
        borderRadius: 8,
        background: SS_TOKENS.bg2,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        color: SS_TOKENS.fg0,
        fontSize: 14,
        textAlign: "center",
      }}
    />
  );
}

function UnsupportedCard() {
  return (
    <Card>
      <p
        style={{
          fontSize: 13.5,
          color: SS_TOKENS.fg1,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        This browser doesn't support push notifications. Try Chrome, Firefox,
        or Safari on iOS 16.4+ after Add to Home Screen.
      </p>
    </Card>
  );
}

function IosNotPwaCard({
  reason,
}: {
  reason?: "ios-not-pwa" | "ios-too-old";
}) {
  return (
    <Card>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: 0,
          marginBottom: 8,
        }}
      >
        ON IPHONE
      </div>
      <p
        style={{
          fontSize: 14,
          color: SS_TOKENS.fg0,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {reason === "ios-too-old"
          ? "iOS 16.4 or later is required for browser-based push. Update iOS to enable alerts."
          : "Alerts only work after you Add to Home Screen. Tap Share, then Add to Home Screen, then open the app icon."}
      </p>
    </Card>
  );
}
