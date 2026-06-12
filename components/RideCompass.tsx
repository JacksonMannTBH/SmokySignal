"use client";

import type { RideContact, RideStatus } from "@/lib/ride-mode";

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f4c430",
  danger: "#ff4d4f",
};

type Props = {
  status: RideStatus;
  contact: RideContact | null;
  displayBearingDeg: number | null;
  modeLabel: "Relative" | "North-up";
};

export function RideCompass({
  status,
  contact,
  displayBearingDeg,
  modeLabel,
}: Props) {
  const color = STATUS_COLORS[status];
  const hasMarker = contact != null && displayBearingDeg != null;
  const marker = hasMarker ? markerPosition(displayBearingDeg) : null;
  const name = contact ? contact.plane.nickname ?? contact.plane.tail : null;
  const ariaLabel = contact
    ? `${modeLabel} compass. ${name} is ${contact.cardinal}, ${contact.distanceNm.toFixed(1)} nautical miles away.`
    : `${modeLabel} compass. No watched aircraft within five nautical miles.`;

  return (
    <section
      role="img"
      aria-label={ariaLabel}
      style={{
        width: "min(72vw, 340px, 48dvh)",
        aspectRatio: "1",
        position: "relative",
        borderRadius: "50%",
        border: `2px solid color-mix(in srgb, ${color} 56%, #25251e)`,
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0 3px, transparent 4px 100%), radial-gradient(circle, #171712 0%, #080808 58%, #020202 100%)",
        boxShadow:
          status === "danger"
            ? `0 0 0 6px rgba(255,77,79,0.18), 0 0 44px rgba(255,77,79,0.42)`
            : `0 0 0 1px rgba(255,255,255,0.06), 0 24px 70px rgba(0,0,0,0.64)`,
        overflow: "hidden",
      }}
    >
      <style>
        {`@keyframes ss-ride-danger-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .82; }
          50% { transform: translate(-50%, -50%) scale(1.22); opacity: .36; }
        }`}
      </style>
      <CompassRing color={color} />
      <Cardinal label="N" top="7%" left="50%" />
      <Cardinal label="E" top="50%" left="93%" />
      <Cardinal label="S" top="93%" left="50%" />
      <Cardinal label="W" top="50%" left="7%" />

      {hasMarker && marker && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "35%",
              height: 4,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${color}, transparent)`,
              transformOrigin: "left center",
              transform: `rotate(${displayBearingDeg - 90}deg)`,
              opacity: 0.7,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              width: status === "danger" ? 70 : 60,
              height: status === "danger" ? 70 : 60,
              borderRadius: "50%",
              background: color,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 0 8px color-mix(in srgb, ${color} 18%, transparent), 0 0 28px color-mix(in srgb, ${color} 56%, transparent)`,
              display: "grid",
              placeItems: "center",
            }}
          >
            {status === "danger" && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -18,
                  borderRadius: "50%",
                  border: `3px solid ${color}`,
                  animation: "ss-ride-danger-pulse 1.2s ease-in-out infinite",
                }}
              />
            )}
            <span
              aria-hidden
              style={{
                width: 0,
                height: 0,
                borderLeft: "11px solid transparent",
                borderRight: "11px solid transparent",
                borderBottom: "25px solid #050505",
                transform: `rotate(${displayBearingDeg}deg)`,
              }}
            />
          </div>
        </>
      )}

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "#f5f2e8",
          color: "#050505",
          border: "6px solid #050505",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          fontWeight: 900,
          boxShadow: "0 0 0 1px rgba(255,255,255,.18)",
        }}
      >
        YOU
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "12%",
          transform: "translateX(-50%)",
          padding: "5px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.62)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#f5f2e8",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {modeLabel}
      </div>
    </section>
  );
}

function markerPosition(degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180;
  const radius = 34;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function Cardinal({
  label,
  top,
  left,
}: {
  label: string;
  top: string;
  left: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top,
        left,
        transform: "translate(-50%, -50%)",
        color: "#f5f2e8",
        fontSize: 18,
        fontWeight: 900,
      }}
    >
      {label}
    </span>
  );
}

function CompassRing({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "11%",
        borderRadius: "50%",
        border: `1px solid color-mix(in srgb, ${color} 34%, rgba(255,255,255,0.16))`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    />
  );
}
