"use client";

import { useEffect, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  FLIGHT_PATHS_VISIBLE_KEY,
  LAYER_VISIBILITY_CHANGE_EVENT,
} from "@/lib/radar-layer-events";
import { Tooltip } from "./Tooltip";

const TABBAR_HEIGHT = 66;

type Props = {
  /** Extra px above the tab bar; pass when the airborne carousel is on. */
  bottomBoost?: number;
};

export function RadarLayerControls({ bottomBoost = 0 }: Props) {
  const [flightPathsEnabled, setFlightPathsEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fp = window.localStorage.getItem(FLIGHT_PATHS_VISIBLE_KEY);
    if (fp === "0") setFlightPathsEnabled(false);
    else if (fp === "1") setFlightPathsEnabled(true);
    const onLayerVisChange = (e: Event) => {
      const detail = (
        e as CustomEvent<{ key: string; enabled: boolean }>
      ).detail;
      if (detail?.key === FLIGHT_PATHS_VISIBLE_KEY) {
        setFlightPathsEnabled(detail.enabled);
      }
    };

    window.addEventListener(LAYER_VISIBILITY_CHANGE_EVENT, onLayerVisChange);
    return () => {
      window.removeEventListener(
        LAYER_VISIBILITY_CHANGE_EVENT,
        onLayerVisChange,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FLIGHT_PATHS_VISIBLE_KEY,
      flightPathsEnabled ? "1" : "0",
    );
  }, [flightPathsEnabled]);

  const toggleFlightPaths = () => {
    const next = !flightPathsEnabled;
    setFlightPathsEnabled(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(LAYER_VISIBILITY_CHANGE_EVENT, {
          detail: { key: FLIGHT_PATHS_VISIBLE_KEY, enabled: next },
        }),
      );
    }
  };

  const bottom = TABBAR_HEIGHT + 16 + bottomBoost;
  const offsetCss = (extra: number) =>
    `calc(${bottom + extra}px + var(--ss-install-prompt-h, 0px))`;

  return (
    <div
      style={{
        position: "absolute",
        left: 136,
        bottom: offsetCss(0),
        zIndex: 12,
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        maxWidth: "calc(100vw - 148px)",
      }}
    >
      <Tooltip
        side="top"
        align="start"
        content="30-day flight-path threads. Each line is one tail-day."
      >
        <button
          type="button"
          onClick={toggleFlightPaths}
          aria-pressed={flightPathsEnabled}
          className="ss-mono"
          style={pillStyle(
            flightPathsEnabled ? SS_TOKENS.alert : SS_TOKENS.fg1,
          )}
        >
          {flightPathsEnabled ? "Flight paths on" : "Flight paths"}
        </button>
      </Tooltip>
    </div>
  );
}

function pillStyle(color: string): React.CSSProperties {
  return {
    width: 116,
    height: 46,
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.9)",
    border: `.5px solid ${SS_TOKENS.hairline2}`,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    boxShadow: SS_TOKENS.shadowMd,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
