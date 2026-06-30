"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import {
  addUserZone,
  readUserZones,
  removeUserZone,
  updateUserZone,
  USER_ZONES_CHANGE_EVENT,
  type UserZone,
} from "@/lib/user-zones";
import { DEFAULT_REGION, REGIONS } from "@/lib/regions";

const DEFAULT_RADIUS_NM = 5;
const MIN_RADIUS_NM = 1;
const MAX_RADIUS_NM = 25;

export function UserZonesManager({ embedded = false }: { embedded?: boolean }) {
  const [zones, setZones] = useState<UserZone[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const HeadingTag = embedded ? "h2" : "h1";

  useEffect(() => {
    setZones(readUserZones());
    const onChange = () => setZones(readUserZones());
    window.addEventListener(USER_ZONES_CHANGE_EVENT, onChange);
    return () =>
      window.removeEventListener(USER_ZONES_CHANGE_EVENT, onChange);
  }, []);

  const onAdd = () => {
    if (!("geolocation" in navigator)) {
      addAtPugetSound();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        addUserZone({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          radiusNm: DEFAULT_RADIUS_NM,
          label: nextLabel(zones),
        });
      },
      () => addAtPugetSound(),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 },
    );
  };

  return (
    <div
      style={{
        maxWidth: 460,
        // Bottom margin clears tab bar (66) + iOS install prompt
        // overlay (~80) + breathing room. Was 80; bumped so the last
        // zone card isn't hidden behind the prompt.
        margin: "16px auto 180px",
        padding: "0 18px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header>
        <div
          className="ss-mono"
          style={{
            fontSize: 9.5,
            color: SS_TOKENS.fg2,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Settings / Zones
        </div>
        <HeadingTag
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: SS_TOKENS.fg0,
            margin: 0,
            letterSpacing: "-.01em",
          }}
        >
          Your zones
        </HeadingTag>
        <p
          style={{
            fontSize: 13,
            color: SS_TOKENS.fg1,
            lineHeight: 1.5,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Push alerts route through these. A Bird takes off near a zone, you
          get pinged. Zones live on this device only — no account needed.
        </p>
      </header>

      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: `.5px solid ${SS_TOKENS.alert}`,
          background: SS_TOKENS.alertDim,
          color: SS_TOKENS.alert,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "-.005em",
        }}
      >
        Add zone at my location
      </button>

      {zones.length === 0 && (
        <div
          style={{
            background: SS_TOKENS.bg1,
            border: `.5px solid ${SS_TOKENS.hairline}`,
            borderRadius: 14,
            padding: "20px 18px",
            color: SS_TOKENS.fg1,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          No zones yet. Tap the button above to drop a 5nm circle at your
          current location, or visit /radar to drop one with a long-press.
        </div>
      )}

      {zones.map((z) => (
        <ZoneCard
          key={z.id}
          zone={z}
          editing={editingId === z.id}
          onEdit={() => setEditingId(z.id)}
          onSave={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      ))}

      {!embedded && (
        <Link
          href="/settings/alerts"
          style={{
            color: SS_TOKENS.fg1,
            fontSize: 13,
            textDecoration: "none",
            padding: "8px 0",
          }}
        >
          Back to settings
        </Link>
      )}
    </div>
  );
}

function ZoneCard({
  zone,
  editing,
  onEdit,
  onSave,
  onCancel,
}: {
  zone: UserZone;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(zone.label);
  const [radius, setRadius] = useState(zone.radiusNm);
  const [radiusInput, setRadiusInput] = useState(formatNm(zone.radiusNm));

  useEffect(() => {
    if (editing) {
      setLabel(zone.label);
      setRadius(zone.radiusNm);
      setRadiusInput(formatNm(zone.radiusNm));
    }
  }, [editing, zone.label, zone.radiusNm]);

  const commitRadiusInput = () => {
    const n = Number(radiusInput);
    if (!Number.isFinite(n) || n <= 0) {
      setRadiusInput(formatNm(radius));
      return;
    }
    const next = normalizeRadiusNm(n);
    setRadius(next);
    setRadiusInput(formatNm(next));
  };

  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {editing ? (
        <>
          <label
            className="ss-mono"
            style={{
              fontSize: 9.5,
              color: SS_TOKENS.fg2,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Label
          </label>
          <input
            type="text"
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              background: SS_TOKENS.bg2,
              color: SS_TOKENS.fg0,
              fontSize: 14,
            }}
          />
          <label
            className="ss-mono"
            style={{
              fontSize: 9.5,
              color: SS_TOKENS.fg2,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Radius {formatNm(radius)}nm
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 86px",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              type="range"
              min={MIN_RADIUS_NM}
              max={MAX_RADIUS_NM}
              step={0.1}
              value={radius}
              onChange={(e) => {
                const next = normalizeRadiusNm(Number(e.target.value));
                setRadius(next);
                setRadiusInput(formatNm(next));
              }}
              style={{ accentColor: SS_TOKENS.alert }}
            />
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              value={radiusInput}
              onChange={(e) => setRadiusInput(e.target.value)}
              onBlur={commitRadiusInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Zone radius in nautical miles"
              style={{
                minHeight: 38,
                padding: "6px 8px",
                borderRadius: 8,
                background: SS_TOKENS.bg2,
                border: `.5px solid ${SS_TOKENS.hairline2}`,
                color: SS_TOKENS.fg0,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                textAlign: "center",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                const parsed = Number(radiusInput);
                const nextRadius =
                  Number.isFinite(parsed) && parsed > 0
                    ? normalizeRadiusNm(parsed)
                    : radius;
                updateUserZone(zone.id, {
                  label: label.trim() || zone.label,
                  radiusNm: nextRadius,
                });
                onSave();
              }}
              style={primaryBtn}
            >
              Save
            </button>
            <button type="button" onClick={onCancel} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: SS_TOKENS.fg0,
              }}
            >
              {zone.label}
            </div>
            <div
              className="ss-mono"
              style={{
                fontSize: 12,
                color: SS_TOKENS.fg1,
              }}
            >
              {formatNm(zone.radiusNm)}nm
            </div>
          </div>
          <div
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg2,
              letterSpacing: ".04em",
            }}
          >
            {zone.lat.toFixed(3)}, {zone.lon.toFixed(3)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onEdit} style={ghostBtn}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove "${zone.label}"?`)) removeUserZone(zone.id);
              }}
              style={dangerBtn}
            >
              Remove
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function addAtPugetSound() {
  const ps = REGIONS[DEFAULT_REGION];
  addUserZone({
    lat: ps.centerLat,
    lon: ps.centerLon,
    radiusNm: DEFAULT_RADIUS_NM,
    label: nextLabel(readUserZones()),
  });
}

function nextLabel(existing: UserZone[]): string {
  const n = existing.length + 1;
  return `Zone ${n}`;
}

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: `.5px solid ${SS_TOKENS.alert}`,
  background: SS_TOKENS.alertDim,
  color: SS_TOKENS.alert,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg0,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  color: SS_TOKENS.danger,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
};

function normalizeRadiusNm(value: number): number {
  return Math.round(Math.max(MIN_RADIUS_NM, Math.min(MAX_RADIUS_NM, value)) * 10) / 10;
}

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
