// glyph.ts — SmokySignal mark, Smokey-Bear-via-CB-radio edition.
// Vendored 1:1 from design/brand/glyph.js, converted from
// window.SS_GLYPH globals to a TypeScript module. Geometry and the
// `A` amber MUST stay byte-identical to the original — every icon
// file in design/ was generated from this source.
//
// CONCEPT
// The trooper's campaign hat — the icon that earned WSP its "Smokey"
// nickname — viewed head-on. Wide flat brim, pinched crown, hat band
// with buckle. A small orbit blip + arc sits above the crown, reading
// as both (a) the aircraft circling overhead, and (b) a CB-radio signal.
//
// Two treatments:
//   markPaths()        — full mark, hat + orbit blip (use ≥ 32 px)
//   markPathsCompact() — hat only, simplified (use < 32 px favicon-class)

export const COLORS = {
  /** Signal amber — must match the icon files. Don't change. */
  A: "#f4c430",
  /** Deep / page background. */
  D: "#050505",
  /** Foreground / wordmark text default. */
  FG: "#050505",
} as const;

// 64×64 grid. Full mark: hat + orbit blip + arc.
export function markPaths(color: string = COLORS.A): string {
  return `
    <!-- ORBIT BLIP above the peak (CB whip + circling aircraft) -->
    <circle cx="32" cy="9" r="2.6" fill="${color}"/>
    <!-- SIGNAL ARC: short curve under the blip, anchoring it to the crown -->
    <path d="M 26.5 13 Q 32 16 37.5 13"
          fill="none" stroke="${color}" stroke-width="1.8"
          stroke-linecap="round" opacity="0.7"/>

    <!-- CROWN: pinched campaign hat, drawn as one solid silhouette. -->
    <path d="M 19 44
             L 19 28
             Q 19 19.5 24 18
             Q 28.5 17 30 19.5
             Q 32 17 34 19.5
             Q 35.5 17 40 18
             Q 45 19.5 45 28
             L 45 44 Z"
          fill="${color}"/>

    <!-- CROWN DENT: subtle pinch detail across the top (large sizes only) -->
    <path d="M 24 22 Q 32 25 40 22"
          fill="none" stroke="${COLORS.D}" stroke-width="1.4"
          stroke-linecap="round" opacity="0.32"/>

    <!-- HAT BAND: dark stripe across the base of the crown -->
    <rect x="19" y="38" width="26" height="3.6" fill="${COLORS.D}" opacity="0.92"/>
    <!-- Band buckle dot -->
    <circle cx="41" cy="39.8" r="1" fill="${color}" opacity="0.95"/>

    <!-- BRIM: wide flat campaign-hat brim, gentle gull-wing curve -->
    <path d="M 3 46
             Q 17 42 32 43
             Q 47 42 61 46
             L 61 50
             Q 47 47 32 48
             Q 17 47 3 50 Z"
          fill="${color}"/>
  `;
}

// Compact variant for favicon-size (<32 px). Hat only, no orbit blip,
// simpler crown silhouette so the form reads at 16 px.
export function markPathsCompact(color: string = COLORS.A): string {
  return `
    <!-- CROWN: simplified single-pinch, taller to fill the absent blip space -->
    <path d="M 18 42
             L 18 22
             Q 18 13 26 11
             Q 32 9 38 11
             Q 46 13 46 22
             L 46 42 Z"
          fill="${color}"/>
    <!-- HAT BAND -->
    <rect x="18" y="36" width="28" height="4" fill="${COLORS.D}" opacity="0.92"/>
    <!-- Band buckle -->
    <circle cx="41.5" cy="38" r="1.1" fill="${color}" opacity="0.95"/>
    <!-- BRIM: wider at compact size to keep the silhouette obvious -->
    <path d="M 2 44
             Q 17 39 32 40
             Q 47 39 62 44
             L 62 49
             Q 47 45 32 46
             Q 17 45 2 49 Z"
          fill="${color}"/>
  `;
}

export function svg64(
  color: string = COLORS.A,
  bg: string | null = null,
  opts: { compact?: boolean } = {},
): string {
  const paths = opts.compact ? markPathsCompact(color) : markPaths(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    ${bg ? `<rect width="64" height="64" rx="14" fill="${bg}"/>` : ""}
    ${paths}
  </svg>`;
}

/** Wordmark — campaign-hat mark + "SmokySignal" lockup. */
export function wordmark(
  color: string = COLORS.FG,
  accent: string = COLORS.A,
  scale: number = 1,
): string {
  const s = scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 64" width="${360 * s}" height="${64 * s}" style="display:block">
    ${markPaths(accent)}
    <text x="80" y="42"
      font-family="Math Bold, Cambria Math, STIX Two Math, serif"
      font-weight="800"
      font-size="30"
      letter-spacing="-0.02em"
      fill="${color}">Out Of Sight</text>
  </svg>`;
}

export function tile(
  size: number,
  opts: {
    radius?: number;
    bg?: string;
    accent?: string;
    inset?: number;
    compact?: boolean;
  } = {},
): string {
  const radius = opts.radius != null ? opts.radius : Math.round(size * 0.22);
  const bg = opts.bg ?? COLORS.D;
  const accent = opts.accent ?? COLORS.A;
  const inset = opts.inset != null ? opts.inset : size * 0.16;
  const inner = size - inset * 2;
  const compact = !!opts.compact;
  const paths = compact ? markPathsCompact(accent) : markPaths(accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="ssg-${size}" cx="50%" cy="0%" r="120%">
        <stop offset="0%" stop-color="#1c1f26"/>
        <stop offset="100%" stop-color="${bg}"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#ssg-${size})"/>
    <g transform="translate(${inset} ${inset}) scale(${inner / 64})">
      ${paths}
    </g>
  </svg>`;
}

/** Maskable (Android adaptive) — 80% safe zone, full-bleed bg. */
export function maskable(size: number = 512): string {
  const inner = size * 0.62;
  const inset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${COLORS.D}"/>
    <g transform="translate(${inset} ${inset}) scale(${inner / 64})">
      ${markPaths(COLORS.A)}
    </g>
  </svg>`;
}

/** Monochrome (Apple safari pinned tab, status-bar friendly). */
export function mono(size: number = 64, compact: boolean = false): string {
  const paths = compact ? markPathsCompact("#000") : markPaths("#000");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <g transform="scale(${size / 64})">${paths}</g>
  </svg>`;
}

/** Favicon: compact mark, on dark bg, in a circle. */
export function favicon(size: number = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
    <circle cx="32" cy="32" r="32" fill="${COLORS.D}"/>
    ${markPathsCompact(COLORS.A)}
  </svg>`;
}
