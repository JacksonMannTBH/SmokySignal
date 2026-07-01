"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SS_TOKENS } from "@/lib/tokens";
import { DEFAULT_PROXIMITY_NM } from "@/lib/proximity-display";
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
  getRideStatusThresholds,
  setRideStatusThresholds,
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
  disableAircraftProximityAlerts,
  enableAircraftProximityAlerts,
  getStoredAircraftAlertRangeNm,
  readAircraftAlertStatus,
  sendAircraftAlertTest,
  syncAircraftAlertPreferences,
} from "@/lib/aircraft-alerts/client";
import type { AircraftAlertStatus } from "@/lib/aircraft-alerts/types";
import {
  readStoredWakeLockEnabled,
  WAKE_LOCK_CHANGE_EVENT,
  writeStoredWakeLockEnabled,
} from "@/lib/wake-lock";

const SOON_MESSAGE = "Ride-mode notifications are not part of this rebuild yet.";

type DeliveryState = "checking" | "off" | "on" | "unsupported" | "not_configured" | "denied";

type QuietHours = {
  quietStartH: number;
  quietEndH: number;
  tz: string;
};

type RideStatusNotificationPrefs = Record<RideStatus, boolean>;

const DEFAULT_QUIET_HOURS: QuietHours = {
  quietStartH: 23,
  quietEndH: 6,
  tz: "America/Los_Angeles",
};

const DEFAULT_RIDE_STATUS_NOTIFICATIONS: RideStatusNotificationPrefs = {
  clear: true,
  watch: true,
  warning: true,
  danger: true,
};

export function AlertsSettings() {
  const [toast, setToast] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState<DeliveryState>("checking");
  const [deliveryBusy, setDeliveryBusy] = useState(false);
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
  const [quietHours, setQuietHours] = useState<QuietHours>(DEFAULT_QUIET_HOURS);
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
    let cancelled = false;
    const storedRideThresholds = getRideStatusThresholds();
    const storedRange = getStoredAircraftAlertRangeNm();
    setWakeMode(readStoredWakeLockEnabled());
    setWakeSupported("wakeLock" in navigator);
    setSelectedRegionId(getRegion());
    setProximityNm(storedRange);
    setProximityInput(formatProximityMiles(storedRange));
    setRideThresholds(storedRideThresholds);
    setRideInputs({
      watchNm: String(storedRideThresholds.watchNm),
      warningNm: String(storedRideThresholds.warningNm),
      stopNm: String(storedRideThresholds.stopNm),
    });
    readAircraftAlertStatus()
      .then((status) => {
        if (cancelled) return;
        setProximityOn(status.enabled);
        if (status.regionId) setSelectedRegionId(status.regionId);
        if (status.proximityRangeNm) {
          setProximityNm(status.proximityRangeNm);
          setProximityInput(formatProximityMiles(status.proximityRangeNm));
        }
        setDeliveryState(deliveryStateFromStatus(status));
      })
      .catch(() => {
        if (!cancelled) setDeliveryState("off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onWakeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setWakeMode(detail?.enabled ?? readStoredWakeLockEnabled());
    };
    const onRegionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: AppRegionId }>).detail;
      setSelectedRegionId(detail?.id ?? getRegion());
    };
    window.addEventListener(WAKE_LOCK_CHANGE_EVENT, onWakeChange);
    window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
    return () => {
      window.removeEventListener(WAKE_LOCK_CHANGE_EVENT, onWakeChange);
      window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const proximityMi = useMemo(
    () => clampRegionProximityMiles(nmToStatuteMiles(proximityNm)),
    [proximityNm],
  );

  const onArm = useCallback(async () => {
    setDeliveryBusy(true);
    try {
      const status = await enableAircraftProximityAlerts({
        regionId: selectedRegionId,
        stateId: stateForRegion(selectedRegionId).id,
        proximityRangeNm: proximityNm,
      });
      setProximityOn(true);
      setDeliveryState(deliveryStateFromStatus(status));
      flash("Aircraft proximity alerts armed.");
    } catch (error) {
      const next = deliveryStateFromError(error);
      setDeliveryState(next);
      flash(messageForDeliveryState(next));
    } finally {
      setDeliveryBusy(false);
    }
  }, [flash, proximityNm, selectedRegionId]);

  const onDisarm = useCallback(async () => {
    setDeliveryBusy(true);
    try {
      await disableAircraftProximityAlerts();
      setProximityOn(false);
      setDeliveryState("off");
      flash("Aircraft proximity alerts disarmed.");
    } catch {
      flash("Could not disarm alerts. Try again.");
    } finally {
      setDeliveryBusy(false);
    }
  }, [flash]);

  const syncDeliveryPrefs = useCallback(
    async (regionId: AppRegionId, rangeNm: number) => {
      try {
        const status = await syncAircraftAlertPreferences({
          regionId,
          stateId: stateForRegion(regionId).id,
          proximityRangeNm: rangeNm,
        });
        if (status) {
          setProximityOn(status.enabled);
          setDeliveryState(deliveryStateFromStatus(status));
        }
      } catch {
        flash("Could not sync alert settings.");
      }
    },
    [flash],
  );

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
    void syncDeliveryPrefs(selectedRegionId, clampedNm);
  }, [selectedRegionId, syncDeliveryPrefs]);

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
      setRideNotifications((current) => ({ ...current, [status]: checked }));
      flash(SOON_MESSAGE);
    },
    [flash],
  );

  const rideBands = useMemo(
    () => buildRideBands(rideThresholds, rideNotifications),
    [rideNotifications, rideThresholds],
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
                color: deliveryState === "on" ? SS_TOKENS.alert : SS_TOKENS.fg2,
                background: SS_TOKENS.bg2,
                border: `.5px solid ${deliveryState === "on" ? SS_TOKENS.alert : `${SS_TOKENS.fg2}55`}`,
              }}
            >
              {deliveryStatusLabel(deliveryState)}
            </div>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: SS_TOKENS.fg2,
                lineHeight: 1.45,
              }}
            >
              {deliveryStatusCopy(deliveryState)}
            </p>
          </div>
          <button
            type="button"
            onClick={deliveryState === "on" ? onDisarm : onArm}
            disabled={deliveryBusy || deliveryState === "unsupported" || deliveryState === "not_configured"}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: 0,
              background: deliveryState === "on" ? SS_TOKENS.bg2 : SS_TOKENS.alert,
              color: deliveryState === "on" ? SS_TOKENS.fg0 : SS_TOKENS.bg0,
              fontFamily: "var(--font-brand)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0,
              cursor:
                deliveryBusy ||
                deliveryState === "unsupported" ||
                deliveryState === "not_configured"
                  ? "default"
                  : "pointer",
              opacity:
                deliveryBusy ||
                deliveryState === "unsupported" ||
                deliveryState === "not_configured"
                  ? 0.62
                  : 1,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {deliveryBusy
              ? "Working"
              : deliveryState === "on"
                ? "Disarm"
                : "Arm alerts"}
          </button>
        </div>
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
          Aircraft proximity alerts use this region center and your selected
          range when checking live aircraft server-side.
        </p>
        <RegionChoice
          regionId={selectedRegionId}
          onStateChange={(stateId) => {
            const next = firstRegionForState(stateId).id;
            setSelectedRegionId(next);
            setRegion(next);
            void syncDeliveryPrefs(next, proximityNm);
          }}
          onRegionChange={(regionId) => {
            setSelectedRegionId(regionId);
            setRegion(regionId);
            void syncDeliveryPrefs(regionId, proximityNm);
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
                if (e.target.checked) void onArm();
                else void onDisarm();
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
              setRideInputs((current) => ({ ...current, warningNm: value }))
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
              onChange={(checked) => onRideNotifyChange(band.status, checked)}
            />
          ))}
        </div>
      </Section>

      <Section eyebrow="Quiet hours">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HourInput
            value={quietHours.quietStartH}
            onChange={(h) =>
              setQuietHours((current) => ({ ...current, quietStartH: h }))
            }
          />
          <span
            className="ss-mono"
            style={{ color: SS_TOKENS.fg2, fontSize: 12 }}
          >
            to
          </span>
          <HourInput
            value={quietHours.quietEndH}
            onChange={(h) =>
              setQuietHours((current) => ({ ...current, quietEndH: h }))
            }
          />
          <span
            className="ss-mono"
            style={{ color: SS_TOKENS.fg2, fontSize: 11 }}
          >
            {quietHours.tz}
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
          Quiet-hour controls remain visible for the UI. The new proximity
          delivery path does not apply quiet-hour filtering yet.
        </p>
      </Section>

      <Section eyebrow="Test">
        <button
          type="button"
          onClick={async () => {
            if (!proximityOn) {
              flash("Arm alerts first.");
              return;
            }
            try {
              await sendAircraftAlertTest();
              flash("Test ping sent.");
            } catch {
              flash("Could not send test ping.");
            }
          }}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            background: SS_TOKENS.bg2,
            color: SS_TOKENS.fg0,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: 0,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Send me a test ping
        </button>
      </Section>

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

function deliveryStateFromStatus(status: AircraftAlertStatus): DeliveryState {
  if (!status.supported) return "unsupported";
  if (!status.configured) return "not_configured";
  if (status.permission === "denied") return "denied";
  return status.enabled ? "on" : "off";
}

function deliveryStateFromError(error: unknown): DeliveryState {
  const message = error instanceof Error ? error.message : "";
  if (message === "unsupported") return "unsupported";
  if (message === "not_configured") return "not_configured";
  if (message === "permission_denied") return "denied";
  return "off";
}

function deliveryStatusLabel(state: DeliveryState): string {
  switch (state) {
    case "checking":
      return "CHECKING";
    case "on":
      return "ON";
    case "unsupported":
      return "UNSUPPORTED";
    case "not_configured":
      return "NEEDS KEYS";
    case "denied":
      return "BLOCKED";
    default:
      return "OFF";
  }
}

function deliveryStatusCopy(state: DeliveryState): string {
  switch (state) {
    case "checking":
      return "Checking this browser and saved alert subscription.";
    case "on":
      return "Aircraft proximity alerts are armed for your selected region and range.";
    case "unsupported":
      return "This browser cannot receive web notifications.";
    case "not_configured":
      return "Web Push keys are not configured for this deployment.";
    case "denied":
      return "Notifications are blocked in this browser. Update browser settings to arm alerts.";
    default:
      return "Alerts are off. Arm once to save this browser for server-side proximity checks.";
  }
}

function messageForDeliveryState(state: DeliveryState): string {
  switch (state) {
    case "unsupported":
      return "This browser cannot receive web notifications.";
    case "not_configured":
      return "Notification keys are not configured yet.";
    case "denied":
      return "Notification permission was not granted.";
    default:
      return "Could not arm alerts. Try again.";
  }
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

function formatMiles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatProximityMiles(nm: number): string {
  return formatMiles(clampRegionProximityMiles(nmToStatuteMiles(nm)));
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
  children: ReactNode;
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

function Card({ children }: { children: ReactNode }) {
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
