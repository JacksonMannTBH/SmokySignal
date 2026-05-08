"use client";

// Card-style region picker for /settings/alerts. Wraps the same
// RegionSelector dropdown that lives in /radar's top bar so the
// underlying state model is identical — localStorage `ss_region_pref`
// + REGION_CHANGE_EVENT broadcast. Riders can change region from
// either surface; the other one updates live via the event listener.

import { SS_TOKENS } from "@/lib/tokens";
import { RegionSelector } from "./RegionSelector";

export function RegionSetting() {
  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
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
          Region
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: SS_TOKENS.fg0,
            margin: 0,
            letterSpacing: "-.01em",
          }}
        >
          Where you ride
        </h2>
        <p
          style={{
            fontSize: 13,
            color: SS_TOKENS.fg1,
            lineHeight: 1.5,
            marginTop: 6,
            marginBottom: 0,
          }}
        >
          Default radar viewport. On first visit with location granted
          we auto-pick the matching bbox; this control lets you override.
        </p>
      </div>

      <RegionSelector
        style={{
          fontSize: 14,
          padding: "10px 12px",
          minHeight: 44,
          width: "100%",
        }}
      />
    </section>
  );
}
