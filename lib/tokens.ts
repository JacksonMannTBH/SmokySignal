// Canonical design tokens. Mirror in app/globals.css and tailwind.config.ts
// when Tailwind utilities need the same semantic color.
export const SS_TOKENS = {
  bg0: "#ffffff",
  bg1: "rgba(255,255,255,0.94)",
  bg2: "rgba(244,196,48,0.12)",
  bg3: "rgba(244,196,48,0.20)",
  fg0: "#050505",
  fg1: "#2a2a2a",
  fg2: "#5c5642",
  fg3: "#8b846b",
  alert: "#f4c430",
  alertDim: "rgba(244,196,48,0.18)",
  warn: "#d79b00",
  warnDim: "rgba(215,155,0,0.16)",
  danger: "#050505",
  clear: "#050505",
  clearDim: "rgba(5,5,5,0.10)",
  sky: "#050505",
  skyDim: "rgba(5,5,5,0.10)",
  hairline: "rgba(5,5,5,0.12)",
  hairline2: "rgba(5,5,5,0.22)",
  surface: "rgba(255,255,255,0.96)",
  surfaceTranslucent: "rgba(255,255,255,0.82)",
  shadowSm: "0 4px 14px rgba(5,5,5,0.08)",
  shadowMd: "0 12px 34px rgba(5,5,5,0.13)",
  shadowLg: "0 22px 60px rgba(5,5,5,0.18)",
  radiusSm: "10px",
  radiusMd: "16px",
  radiusLg: "22px",
  radiusXl: "28px",
} as const;

export type SSToken = keyof typeof SS_TOKENS;
