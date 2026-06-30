// glyph.ts - Out Of Sight eye mark helpers.
// Kept as a small SVG-string API for older call sites and ad hoc asset work.

export const COLORS = {
  /** Iris / accent gold. */
  A: "#f6c431",
  /** Logo background. */
  D: "#000000",
  /** Foreground / wordmark text default. */
  FG: "#ffffff",
} as const;

export function markPaths(color: string = COLORS.A): string {
  return `
    <path d="M 8 32
             C 14 21 23 16 32 16
             C 41 16 50 21 56 32
             C 50 43 41 48 32 48
             C 23 48 14 43 8 32 Z"
          fill="#ffffff"/>
    <circle cx="32" cy="32" r="9.5" fill="${color}"/>
    <circle cx="32" cy="32" r="4.1" fill="#000000"/>
  `;
}

export function markPathsCompact(color: string = COLORS.A): string {
  return markPaths(color);
}

function monoEyePath(color: string = "#000000"): string {
  return `
    <path d="M 8 32
             C 14 21 23 16 32 16
             C 41 16 50 21 56 32
             C 50 43 41 48 32 48
             C 23 48 14 43 8 32 Z"
          fill="${color}"/>
    <circle cx="32" cy="32" r="5.2" fill="${color}"/>
  `;
}

export function svg64(
  color: string = COLORS.A,
  bg: string | null = COLORS.D,
  opts: { compact?: boolean } = {},
): string {
  const paths = opts.compact ? markPathsCompact(color) : markPaths(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    ${bg ? `<rect width="64" height="64" fill="${bg}"/>` : ""}
    ${paths}
  </svg>`;
}

export function wordmark(
  color: string = COLORS.FG,
  accent: string = COLORS.A,
  scale: number = 1,
): string {
  const s = scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 64" width="${360 * s}" height="${64 * s}" style="display:block">
    <rect width="64" height="64" fill="${COLORS.D}"/>
    ${markPaths(accent)}
    <text x="80" y="42"
      font-family="Inter, Arial, sans-serif"
      font-weight="800"
      font-size="30"
      letter-spacing="0"
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
  const radius = opts.radius != null ? opts.radius : Math.round(size * 0.16);
  const bg = opts.bg ?? COLORS.D;
  const accent = opts.accent ?? COLORS.A;
  const inset = opts.inset != null ? opts.inset : size * 0.12;
  const inner = size - inset * 2;
  const paths = opts.compact ? markPathsCompact(accent) : markPaths(accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
    <g transform="translate(${inset} ${inset}) scale(${inner / 64})">
      ${paths}
    </g>
  </svg>`;
}

export function maskable(size: number = 512): string {
  const inner = size * 0.76;
  const inset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${COLORS.D}"/>
    <g transform="translate(${inset} ${inset}) scale(${inner / 64})">
      ${markPaths(COLORS.A)}
    </g>
  </svg>`;
}

export function mono(size: number = 64, compact: boolean = false): string {
  const paths = compact ? monoEyePath("#000000") : monoEyePath("#000000");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <g transform="scale(${size / 64})">${paths}</g>
  </svg>`;
}

export function favicon(size: number = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
    <rect width="64" height="64" fill="${COLORS.D}"/>
    ${markPathsCompact(COLORS.A)}
  </svg>`;
}
