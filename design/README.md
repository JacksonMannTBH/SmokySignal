# Handoff: SmokySignal

A web app + PWA that helps motorcyclists in the Puget Sound region know in real time whether **Smoky** (WSP airplane N907SP) or one of its sibling traffic-enforcement aircraft is airborne, where it's circling, and whether the rider is currently speeding inside one of its known patrol zones.

This bundle contains **design references** — interactive HTML prototypes that show intended look, behavior, and information architecture. **They are not production code to copy directly.** Recreate them in a real codebase using the stack described below.

---

## What's in this bundle

```
design_handoff_smokysignal/
├── README.md                ← you are here
├── BRAND.md                 ← voice, vocabulary, color tokens, name origin
├── brand/
│   ├── BrandKit.html        ← open in browser → download every icon (favicon, PWA, OG) as PNG/SVG
│   └── glyph.js             ← source of truth for the mark; every icon is generated from this
└── design/
    ├── SmokySignal.html     ← entry point — open this in a browser
    ├── data.jsx             ← mock aircraft + tail registry + activity feed
    ├── ui.jsx               ← shared primitives (StatusPill, PhoneFrame, Speedometer…)
    ├── map.jsx              ← stylized SVG radar
    ├── screens.jsx          ← all screens (3 home variants + 4 supporting)
    └── tail-numbers-source-photo.jpg  ← rider's printed tail-number list (scan this)
```

Open `design/SmokySignal.html` in any modern browser. Use the **Tweaks** toggle in the toolbar to flip Smoky airborne/grounded and adjust rider speed/limit live.

Open `brand/BrandKit.html` in any modern browser. Section 08 has a one-click "Download all icons" button that produces favicon/PWA/Apple-touch/OG-image PNGs and SVGs ready to drop into `public/icons/` in the Next.js app.

---

## Fidelity

**High-fidelity** for visuals, layout, copy, and interaction logic. Final colors, typography, spacing, component composition, and state behavior are all locked. Pixel-match the designs.

The production map uses MapLibre GL JS with the OpenFreeMap dark vector basemap. All other screens are production-ready visually.

---

## The product in one paragraph

WSP runs a small fleet of traffic-enforcement Cessnas. The most famous is **Smoky** (N907SP), which orbits I-5 and SR-167 corridors clocking riders from above. The fleet's tail numbers are public and trackable on ADS-B Exchange / adsb.fi / OpenSky. SmokySignal polls those feeds every 10–15s, filters to the registered tails, and surfaces three things to riders: **(1)** is any patrol plane airborne right now, **(2)** where exactly is it orbiting, and **(3)** am I currently speeding inside its likely zone. It also learns hot zones from 30 days of rolling history so it can predict *where* Smoky will probably be tomorrow at 4pm.

---

## Stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 App Router** | Vercel-native, RSC for the fleet status, edge for `/api/aircraft` |
| Hosting | **Vercel** | User explicitly wants this |
| Storage | **Vercel KV** (Upstash Redis) | 30-day rolling track history, hot-zone heatmap cache |
| Map | **MapLibre GL JS** + OpenFreeMap dark | Free, no Mapbox or tile-key gates |
| Realtime | **Server-Sent Events** from `/api/aircraft/stream` | Simpler than WebSocket, perfect for one-way push |
| Push | **Web Push API** + service worker | "Smoky just went up" alerts; PWA, no app store |
| Geolocation | **`navigator.geolocation.watchPosition`** | Foreground-reliable; background needs native shell |
| Styling | **Tailwind CSS** + CSS variables for theme tokens | Matches the inline styles in the prototype |
| Type | **TypeScript** strict | |
| Auth (optional) | **Clerk** or **NextAuth** w/ magic link | Only if you add per-rider tail registries; v1 can be public |

---

## Data sources

Primary and fallback **must both** be implemented; primary fails ~hourly during peak load.

**Primary — adsb.fi**
- `https://opendata.adsb.fi/api/v2/icao/<icao24>` — single aircraft by ICAO hex
- `https://opendata.adsb.fi/api/v2/lat/<lat>/lon/<lon>/dist/<nm>` — bbox query
- Free, no key, ~5s refresh upstream, CORS-friendly. Be a good citizen: cache 10s, max 1 req/s.

**Fallback — OpenSky Network**
- `https://opensky-network.org/api/states/all?icao24=<hex>,<hex>,...`
- Free anonymous tier (rate-limited), authenticated tier higher. Returns flat array — see their states-vector schema.

**Tail → ICAO hex mapping**
- Tail numbers come from the registry (see "Tail registry" below)
- Convert N-number → ICAO24 hex via the FAA algorithm (deterministic, no lookup needed). Reference implementation: https://github.com/guillaumemichel/icao-nnumber_converter — port to TS, keep it client-side too.

**Recommended polling cadence**
- When at least one tracked tail is airborne: **10s**
- When all tails are grounded: **60s** (cheap "any of them up?" ping against adsb.fi by ICAO list)
- Always serve from KV cache with a 10s TTL so 100 riders hitting `/api/aircraft` = 1 upstream call.

---

## Tail registry

The rider supplied a printed list (`tail-numbers-source-photo.jpg`). **Do not OCR this in production** — manually transcribe it once into a `seed.ts` and check it in. The photo is in the bundle for reference. Hard-coded fleet from the prototype (`data.jsx`):

```ts
export const FLEET = [
  { tail: "N907SP", nickname: "Smoky",   model: "Cessna 182", primary: true  },
  { tail: "N917SP", nickname: "Smoky 2", model: "Cessna 182", primary: false },
  { tail: "N936SP", nickname: "Smoky 3", model: "Cessna 206", primary: false },
  // …transcribe the rest from the photo
];
```

Build the **admin tail editor** (designed; see "Admin" screen) so ops can add/remove tails without a deploy. Persist to KV at `tails:registry` as JSON. The editor is admin-only behind a simple env-var passcode for v1.

---

## Screens

All screens are designed in `design/screens.jsx`. Names match the artboard labels in the canvas.

### 1. Home — Glanceable (variant A)
**Purpose:** one-second status check at a stoplight.
**Layout:** full-bleed colored background that flips with status. Giant headline ("SMOKY UP" / "SMOKY DOWN"), single subhead, last-seen timestamp, one tap target ("Where?").
**Tokens:** background `#0EA5E9` when up, `#1E293B` when down. Headline `font-size: clamp(72px, 18vw, 144px)`, weight 900, letter-spacing -0.04em.
**State:** subscribes to SSE; transitions are 400ms ease-out cross-fade on the bg color.

### 2. Home — Radar (variant B)
**Purpose:** map-forward; rider sees their position and the plane's orbit at a glance.
**Layout:** full-screen MapLibre canvas, rider as sky-blue dot in the center, plane(s) as orange chevrons rotated by `track`, hot zones as warm radial halos at 30% opacity.
**Behavior:** auto-recenters on rider every 5s unless user has panned; chevrons animate position with 1s linear interp between samples; tap a chevron → plane detail.

### 3. Home — Dashboard (variant C)
**Purpose:** info-dense for riders who want everything at once.
**Layout:** vertical stack — status pill, **arc speedometer** (current speed vs. limit, color shifts at 1.0× and 1.15× limit), nearest-bird distance card, contextual warning copy, activity feed (last 10 events).
**Speedometer:** SVG arc, 240° sweep, see `Speedometer` in `ui.jsx`.

### 4. Plane detail
Header: tail + nickname + status pill. Live data block (alt, speed, heading, last update). **Orbit glyph** (small SVG showing recent track loop). "Typical haunts" — top 3 hot zones this tail visits, ranked by frequency. Sourced from KV history.

### 5. Hot zones
Map view of all learned zones with intensity. List below: zone name (auto-generated from nearest highway exit), confidence %, typical time windows (e.g. "Tue–Thu, 3–6 PM, 78%"). Confidence requires ≥30 days of history; show "Learning…" state until then.

### 6. Admin — tail editor
Table of registered tails. Add row, delete row, edit nickname. Validates N-number format (`^N\d{1,5}[A-Z]{0,2}$`). On save → POST `/api/tails` → KV write → broadcast SSE invalidation.

### 7. Speed warning (fullscreen)
Triggered when rider speed > limit AND inside an active hot zone AND a tracked plane is airborne within 5nm. Full-screen red, current speed huge, limit below it, "SLOW DOWN" hed. Auto-dismisses 3s after speed drops back under limit.

---

## API routes

```
GET  /api/aircraft           → current snapshot of all tracked tails (cached 10s)
GET  /api/aircraft/stream    → SSE; emits {tail, lat, lon, alt, speed, track, ts} on each poll
GET  /api/zones              → learned hot zones with confidence
GET  /api/tails              → registry
POST /api/tails              → admin: replace registry (passcode-gated)
POST /api/push/subscribe     → store push subscription in KV
POST /api/push/test          → admin: send test push
```

Background work runs as a **Vercel Cron** hitting `/api/cron/poll` every minute when fleet is grounded, and a long-lived edge function with `setInterval` while at least one tail is up (or use Upstash QStash for the active-poll loop — cleaner).

---

## Brand assets

**`BRAND.md`** is the voice + visual-identity reference. Read it before writing copy. It covers:
- The name origin (campaign hat → CB-radio "Smokey" → WSP aviation callsign → the product)
- Voice & tone (laconic 70s-trucker-meets-aviator; do/don't list; vocabulary table)
- The mark (trooper's campaign hat + signal blip/arc; full vs compact cuts)
- Color tokens (these supersede the legacy tokens further down in this README)

**`brand/BrandKit.html`** is a one-page asset generator. Open it in a browser, click "Download all icons" in section 08, and it produces the full PWA + favicon + Apple-touch + Open Graph asset set. Drop the downloaded files into `public/icons/` and `public/manifest.json`. The page also contains a copy-pasteable `app/layout.tsx` `metadata` block (section 07) — lift it directly.

**`brand/glyph.js`** is the source of truth for the mark. If you ever need a new icon size or a custom render of the glyph, import this script rather than re-tracing the SVG. The exported `window.SS_GLYPH` API: `markPaths()`, `markPathsCompact()`, `svg64()`, `tile()`, `maskable()`, `mono()`, `wordmark()`, `favicon()`. **Compact** is the favicon-scale cut (≤32px) — hat only, no orbit blip.

---

## Design tokens

Pulled from the prototype's inline styles. Promote these to CSS variables / Tailwind theme.

```css
:root {
  /* status */
  --ss-up: #0EA5E9;          /* sky-500 — Smoky airborne */
  --ss-up-deep: #0369A1;     /* sky-700 */
  --ss-down: #1E293B;        /* slate-800 — grounded */
  --ss-warn: #F59E0B;        /* amber-500 — caution */
  --ss-danger: #DC2626;      /* red-600 — speed warning */

  /* surface */
  --ss-bg: #0B1220;
  --ss-surface: #111827;
  --ss-surface-2: #1F2937;
  --ss-border: rgba(255,255,255,0.08);

  /* text */
  --ss-text: #F8FAFC;
  --ss-text-dim: #94A3B8;

  /* radii */
  --ss-r-sm: 8px;
  --ss-r-md: 14px;
  --ss-r-lg: 20px;
  --ss-r-xl: 28px;
}
```

**Type:** Inter Tight for UI, JetBrains Mono for tail numbers and numeric readouts.
**Spacing:** 4px base. Use Tailwind defaults.

---

## Caveats — read before building

1. **Background geolocation on iOS Safari is foreground-only.** The speed warning works while the app is open. For background ("phone in pocket while riding"), you need a native wrapper — Capacitor is the lightest path; quote the user a v2.
2. **adsb.fi/OpenSky terms** are permissive but require attribution. Add a footer credit on the about page.
3. **Hot-zone learning needs ~30 days** of logged data before confidence numbers are meaningful. Ship with a "Learning your sky" state for the first month.
4. **Tail registry from the photo** — the rider's printed list may be partial or stale. Verify each N-number on FAA registry (`registry.faa.gov`) before launch; some Cessnas in the photo may have been sold.
5. **Public tile services can change.** OpenFreeMap has no API key or view cap, but keep `NEXT_PUBLIC_MAP_STYLE_URL` ready for a self-hosted style if the public endpoint ever becomes unreliable.
6. **Push notifications are aggressive.** Default off, opt-in per zone. Quiet hours by default 11pm–6am.
7. **Legal posture:** the app *informs*, it does not *evade*. Never word UI copy as "avoid getting caught" — frame it as situational awareness. The rider gets this.

---

## Files to reference (in `design/`)

- **`SmokySignal.html`** — open this first. Wraps everything in the design canvas.
- **`data.jsx`** — exact mock shapes you should match in `/api/aircraft` responses.
- **`ui.jsx`** — `StatusPill`, `PhoneFrame`, `Speedometer`, `OrbitGlyph`, `ActivityRow` — port these to React components 1:1.
- **`map.jsx`** — radar layout reference. Replace the SVG with MapLibre but keep the same chevron + halo language.
- **`screens.jsx`** — every screen, in order. Read top-to-bottom.

---

## Suggested implementation order

1. Scaffold Next.js app, drop in design tokens and Inter Tight / JetBrains Mono.
2. Hard-code the fleet registry; build `/api/aircraft` against adsb.fi with KV cache.
3. Ship the **Glanceable** home as the MVP. Subscribe to SSE. Done = it works.
4. Add MapLibre + the **Radar** home.
5. Add geolocation + the **Dashboard** home + speed warning.
6. Add KV-backed track history; cron job to roll it up nightly into hot zones.
7. Add Web Push + service worker.
8. Add the admin tail editor behind a passcode.
9. PWA manifest + icons; ship to TestFlight-equivalent (just have rider add to home screen).
