"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { APP_STATES, APP_REGIONS_BY_ID } from "@/lib/app-regions";
import { type RegionId } from "@/lib/regions";
import {
  REGION_CHANGE_EVENT,
  getRegion,
  setRegion,
} from "@/lib/region-pref";
import { SS_TOKENS } from "@/lib/tokens";

type Props = {
  className?: string;
  style?: CSSProperties;
};

export function RegionSelector({ className, style }: Props) {
  const [current, setCurrent] = useState<RegionId>(() => getRegion());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: RegionId }>).detail;
      setCurrent(detail?.id ?? getRegion());
    };
    window.addEventListener(REGION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(REGION_CHANGE_EVENT, onChange);
  }, []);

  return (
    <select
      value={current}
      onChange={(e) => setRegion(e.target.value as RegionId)}
      aria-label="Region"
      className={className ?? ""}
      style={{
        fontSize: 12,
        fontWeight: 700,
        background: "rgba(255,255,255,0.84)",
        color: SS_TOKENS.fg0,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        borderRadius: 999,
        padding: "7px 11px",
        boxShadow: SS_TOKENS.shadowSm,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        cursor: "pointer",
        ...style,
      }}
    >
      {APP_STATES.map((state) => (
        <optgroup key={state.id} label={state.label}>
          {state.regions.map((tuple) => {
            const id = tuple[0];
            const region = APP_REGIONS_BY_ID[id];
            return (
              <option key={id} value={id}>
                {region.label}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
