"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeDeg } from "@/lib/ride-mode";

export type HeadingSource = "device" | "geolocation" | "none";
export type HeadingPermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "unsupported";

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CompassOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

export type DeviceHeadingState = {
  headingDeg: number | null;
  source: HeadingSource;
  permissionState: HeadingPermissionState;
  requestPermission: () => Promise<boolean>;
};

function finiteHeading(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return normalizeDeg(n);
}

function headingFromOrientationEvent(
  event: CompassOrientationEvent,
): number | null {
  const webkitHeading = finiteHeading(event.webkitCompassHeading);
  if (webkitHeading != null) return webkitHeading;

  const alpha = finiteHeading(event.alpha);
  if (alpha == null) return null;

  // On browsers that report absolute orientation, alpha rotates clockwise
  // from the device frame; invert it into a north-clockwise compass heading.
  if (event.absolute === true) return normalizeDeg(360 - alpha);
  return null;
}

export function useDeviceHeading(
  geolocationHeadingDeg: number | null | undefined = null,
): DeviceHeadingState {
  const [deviceHeadingDeg, setDeviceHeadingDeg] = useState<number | null>(null);
  const [permissionState, setPermissionState] =
    useState<HeadingPermissionState>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setPermissionState("unsupported");
      return;
    }

    const onOrientation = (event: Event) => {
      const heading = headingFromOrientationEvent(
        event as CompassOrientationEvent,
      );
      if (heading == null) return;
      setDeviceHeadingDeg(heading);
      setPermissionState("granted");
    };

    window.addEventListener("deviceorientation", onOrientation, true);
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation, true);
      window.removeEventListener(
        "deviceorientationabsolute",
        onOrientation,
        true,
      );
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (!("DeviceOrientationEvent" in window)) {
      setPermissionState("unsupported");
      return false;
    }
    const orientation =
      window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
    if (typeof orientation.requestPermission === "function") {
      try {
        const result = await orientation.requestPermission();
        setPermissionState(result);
        return result === "granted";
      } catch {
        setPermissionState("denied");
        return false;
      }
    }
    setPermissionState("granted");
    return true;
  }, []);

  return useMemo(() => {
    if (deviceHeadingDeg != null) {
      return {
        headingDeg: deviceHeadingDeg,
        source: "device" as const,
        permissionState,
        requestPermission,
      };
    }
    const geoHeading = finiteHeading(geolocationHeadingDeg);
    if (geoHeading != null) {
      return {
        headingDeg: geoHeading,
        source: "geolocation" as const,
        permissionState,
        requestPermission,
      };
    }
    return {
      headingDeg: null,
      source: "none" as const,
      permissionState,
      requestPermission,
    };
  }, [
    deviceHeadingDeg,
    geolocationHeadingDeg,
    permissionState,
    requestPermission,
  ]);
}
