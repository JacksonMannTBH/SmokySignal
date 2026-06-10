"use client";

// Compact dropdown that lets the rider pivot the radar viewport
// between Puget Sound (default) / Pierce / Snohomish / Spokane / All
// Washington. Persists to localStorage; other components subscribe to
// the same CustomEvent so the map flies on change.

import { useEffect, useState } from "react";
import { REGIONS, type RegionId } from "@/lib/regions";
import {
  REGION_CHANGE_EVENT,
  getRegion,
  setRegion,
} from "@/lib/region-pref";
import { SS_TOKENS } from "@/lib/tokens";

type Props = {
  className?: string;
  style?: React.CSSProperties;
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
      {Object.values(REGIONS).map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
