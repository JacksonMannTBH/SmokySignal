"use client";

// Radar filter panel — extracted from HotZoneLayer.tsx in P16 Phase 3.
// Lives in its own file so other surfaces (future weather toggle,
// time-scrubber settings) can mount alongside the existing radar
// filters without bloating the heatmap layer module.
//
// Filter shape: see lib/radar-filter.ts. The chevron exposes three
// rider-facing categories (Smokey / Search & Rescue / Transport) that
// map onto the granular FleetRole taxonomy in lib/types.ts. Empty
// bucket selection means "show all categories" — same back-compat
// semantics as the prior empty `roles` array.

import { SS_TOKENS } from "@/lib/tokens";
import {
  OPERATORS,
  RIDER_BUCKETS,
  type RadarFilter as Filter,
  type RiderBucketId,
} from "@/lib/radar-filter";

type Props = {
  bottom: number;
  filter: Filter;
  onChange: (f: Filter) => void;
  onClose: () => void;
};

export function FilterPanel({ bottom, filter, onChange, onClose }: Props) {
  const toggleBucket = (id: RiderBucketId) => {
    const set = new Set(filter.buckets);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({
      ...filter,
      buckets: [...set] as RiderBucketId[],
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom,
        zIndex: 13,
        width: 240,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(11,13,16,0.92)",
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: SS_TOKENS.fg0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg2, letterSpacing: ".1em" }}
        >
          HOT ZONES
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filter panel"
          style={{
            background: "transparent",
            border: 0,
            color: SS_TOKENS.fg2,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
            touchAction: "manipulation",
          }}
        >
          ×
        </button>
      </div>

      <Group label="Quick filter">
        <Pill
          active={filter.showMode === "all"}
          onClick={() => onChange({ ...filter, showMode: "all" })}
        >
          All
        </Pill>
        <Pill
          active={filter.showMode === "smoky"}
          onClick={() => onChange({ ...filter, showMode: "smoky" })}
        >
          Smokey
        </Pill>
        <Pill
          active={filter.showMode === "operator"}
          onClick={() => onChange({ ...filter, showMode: "operator" })}
        >
          Operator
        </Pill>
      </Group>

      {filter.showMode === "operator" && (
        <select
          value={filter.operator ?? "WSP"}
          onChange={(e) => onChange({ ...filter, operator: e.target.value })}
          className="ss-mono"
          style={{
            background: SS_TOKENS.bg2,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            color: SS_TOKENS.fg0,
            fontSize: 12,
            padding: "6px 8px",
            borderRadius: 8,
          }}
        >
          {OPERATORS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      <Group label="Categories">
        {RIDER_BUCKETS.map((b) => (
          <Pill
            key={b.id}
            active={filter.buckets.includes(b.id)}
            onClick={() => toggleBucket(b.id)}
          >
            {b.label}
          </Pill>
        ))}
      </Group>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="ss-mono"
        style={{ fontSize: 9.5, color: SS_TOKENS.fg2, letterSpacing: ".1em" }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="ss-mono"
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: active ? SS_TOKENS.alert : "transparent",
        border: `.5px solid ${active ? SS_TOKENS.alert : SS_TOKENS.hairline2}`,
        color: active ? SS_TOKENS.bg0 : SS_TOKENS.fg1,
        fontSize: 10.5,
        letterSpacing: ".04em",
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}
