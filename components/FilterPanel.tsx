"use client";

// Radar filter panel.
// Lives in its own file so other surfaces (future weather toggle,
// time-scrubber settings) can mount alongside the existing radar
// filters without bloating the heatmap layer module.
//
// Four rows post-P19.5:
//   Categories — Smokey / Search & Rescue / Transport buckets
//   Operators  — multi-select chips per registry operator
//   Tails      — typeahead + chip set, follow a single tail
//   Layers     — Flight paths toggle inside the panel
//
// The pre-P19 Quick filter row (All / Smokey / Operator) duplicated
// the rider buckets in Categories and the multi-select chips in
// Operators, so it retired. Persisted state migrates forward in
// readRadarFilter() — a saved showMode === "smoky" auto-selects the
// Smokey bucket; showMode === "operator" + operator value seeds the
// operator chip set.
//
// Filter shape: see lib/radar-filter.ts. The chevron exposes three
// rider-facing categories (Smokey / Search & Rescue / Transport) that
// map onto the granular FleetRole taxonomy in lib/types.ts. Empty
// bucket selection means "show all categories" — same back-compat
// semantics as the prior empty `roles` array.

import { useEffect, useMemo, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  OPERATORS,
  RIDER_BUCKETS,
  getRegistryTails,
  searchRegistryTails,
  type RadarFilter as Filter,
  type RegistryTail,
  type RiderBucketId,
} from "@/lib/radar-filter";

type Props = {
  /** Final CSS bottom value — accepts a number (px) or a string
   *  (e.g. a calc expression that includes the iOS install-prompt
   *  height var so the panel clears that overlay). */
  bottom: number | string;
  filter: Filter;
  onChange: (f: Filter) => void;
  onClose: () => void;
  flightPathsEnabled: boolean;
  onToggleFlightPaths: () => void;
};

export function FilterPanel({
  bottom,
  filter,
  onChange,
  onClose,
  flightPathsEnabled,
  onToggleFlightPaths,
}: Props) {
  const toggleBucket = (id: RiderBucketId) => {
    const set = new Set(filter.buckets);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...filter, buckets: [...set] as RiderBucketId[] });
  };

  const toggleOperator = (op: string) => {
    const set = new Set(filter.operatorSet);
    if (set.has(op)) set.delete(op);
    else set.add(op);
    onChange({ ...filter, operatorSet: [...set] });
  };

  const removeTail = (tail: string) => {
    onChange({
      ...filter,
      tailSet: filter.tailSet.filter((t) => t !== tail),
    });
  };

  const addTail = (tail: string) => {
    if (filter.tailSet.includes(tail)) return;
    onChange({ ...filter, tailSet: [...filter.tailSet, tail] });
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom,
        zIndex: 13,
        width: 280,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "60vh",
        overflowY: "auto",
        padding: "14px",
        borderRadius: 24,
        background: "rgba(255,255,255,0.9)",
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        boxShadow: SS_TOKENS.shadowLg,
        backdropFilter: "blur(24px) saturate(1.12)",
        WebkitBackdropFilter: "blur(24px) saturate(1.12)",
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
          style={{ fontSize: 13, fontWeight: 800, color: SS_TOKENS.fg0 }}
        >
          FILTERS
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filter panel"
          style={{
            background: "rgba(245,247,246,0.76)",
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

      <Group label="Operators">
        {OPERATORS.map((op) => (
          <Pill
            key={op}
            active={filter.operatorSet.includes(op)}
            onClick={() => toggleOperator(op)}
          >
            {op}
          </Pill>
        ))}
      </Group>

      <TailGroup
        selected={filter.tailSet}
        onAdd={addTail}
        onRemove={removeTail}
      />

      <Group label="Layers">
        <Pill active={flightPathsEnabled} onClick={onToggleFlightPaths}>
          Flight paths
        </Pill>
      </Group>
    </div>
  );
}

function TailGroup({
  selected,
  onAdd,
  onRemove,
}: {
  selected: string[];
  onAdd: (tail: string) => void;
  onRemove: (tail: string) => void;
}) {
  const [registry, setRegistry] = useState<RegistryTail[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getRegistryTails().then((r) => {
      if (!cancelled) setRegistry(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(
    () =>
      query.trim()
        ? searchRegistryTails(registry, query, 8).filter(
            (r) => !selected.includes(r.tail),
          )
        : [],
    [registry, query, selected],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="ss-mono"
        style={{ fontSize: 9.5, color: SS_TOKENS.fg2, letterSpacing: ".1em" }}
      >
        Tails
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tail or nickname"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="ss-mono"
        style={{
          background: "rgba(245,247,246,0.92)",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          color: SS_TOKENS.fg0,
          fontSize: 12,
          padding: "6px 8px",
          borderRadius: 14,
          outline: "none",
        }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {suggestions.map((s) => (
            <button
              key={s.tail}
              type="button"
              onClick={() => {
                onAdd(s.tail);
                setQuery("");
              }}
              className="ss-mono"
              style={{
                textAlign: "left",
                background: "rgba(255,255,255,0.82)",
                border: `.5px solid ${SS_TOKENS.hairline2}`,
                borderRadius: 12,
                padding: "5px 8px",
                color: SS_TOKENS.fg1,
                fontSize: 11,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {s.tail}
              {s.nickname ? ` · ${s.nickname}` : ""}
              <span style={{ color: SS_TOKENS.fg2, marginLeft: 6 }}>
                {s.operator}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selected.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onRemove(t)}
              aria-label={`Remove ${t} from tail filter`}
              className="ss-mono"
              style={{
                padding: "5px 8px 5px 10px",
                borderRadius: 999,
                background: SS_TOKENS.alertDim,
                border: `.5px solid rgba(244,196,48,0.42)`,
                color: SS_TOKENS.alert,
                fontSize: 10.5,
                letterSpacing: ".04em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {t}
              <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
                ×
              </span>
            </button>
          ))}
        </div>
      )}
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
        style={{ fontSize: 11, color: SS_TOKENS.fg2, fontWeight: 700 }}
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
      style={{
        padding: "7px 11px",
        borderRadius: 999,
        background: active ? SS_TOKENS.skyDim : "rgba(245,247,246,0.84)",
        border: `.5px solid ${active ? "rgba(244,196,48,0.42)" : SS_TOKENS.hairline2}`,
        color: active ? SS_TOKENS.sky : SS_TOKENS.fg1,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}
