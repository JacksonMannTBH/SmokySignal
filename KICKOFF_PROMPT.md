# SmokySignal — Claude Code Kickoff Prompt

> Paste this entire file as your first message to Claude Code, working in the `smokysignal-app/` directory.

---

I'm building **SmokySignal**, a real-time web app + PWA that tells motorcyclists in the Puget Sound region whether the WSP traffic-enforcement plane "Smoky" (and its sibling aircraft) is airborne and where it's circling. The app also warns riders when they're speeding inside one of Smoky's known patrol zones.

A complete design + spec bundle is in `./design_handoff/`. Your task is to implement it as a deployable Next.js app on Vercel.

## What to do first — in this exact order

1. **Read `design_handoff/README.md` end to end.** It is the source of truth. It contains the stack, the data sources, the screens, the API routes, and the design tokens. Do not skip any section.

2. **Open `design_handoff/design/SmokySignal.html` in your head** by reading `design/screens.jsx`, `design/ui.jsx`, `design/data.jsx`, and `design/map.jsx`. These are the design references. They are NOT production code — recreate them in Next.js + React + Tailwind, do not copy-paste them.

3. **Briefly summarize back to me**: the stack you'll use, the first milestone you intend to ship, and any open questions. Then stop and wait for my answer. Do not write code yet.

## Constraints

- **Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, deployed to Vercel. Vercel KV for state. MapLibre GL JS for the map. Web Push for notifications.
- **Fidelity:** the designs are high-fidelity. Match the colors, typography, spacing, and component composition exactly. Tokens are listed in the README.
- **Data:** primary source is `adsb.fi`, fallback is OpenSky. Both anonymous. Implement caching (10s) so 100 riders = 1 upstream call.
- **Tail registry:** there's a photo at `design_handoff/design/tail-numbers-source-photo.jpg`. **Do not OCR it.** I will transcribe N-numbers by hand and paste them in. Use the seed list in `data.jsx` as your starting point.
- **Geolocation:** foreground only via `navigator.geolocation.watchPosition`. Background tracking is explicitly out of scope for v1.
- **Legal framing:** never word UI copy as "avoid getting caught." Always frame as situational awareness.

## First milestone (MVP)

Ship just the **Glanceable home** (variant A in the designs):

1. Next.js scaffold with the design tokens wired into Tailwind config + globals.css.
2. `/api/aircraft` route that polls adsb.fi for the seeded tails, falls back to OpenSky on error, caches in KV with 10s TTL.
3. `/api/aircraft/stream` SSE endpoint that pushes updates.
4. Home page subscribes to SSE, shows the giant SMOKY UP / SMOKY DOWN headline with the cross-fade transition described in the README.
5. Deployed to Vercel with the env vars set.

Do not build the radar, dashboard, hot zones, admin, or push notifications in this milestone. Get the MVP rendering and deployed first. We'll iterate.

## How I want you to work

- **Show me running output as early as possible.** I'd rather see `npm run dev` rendering an ugly version of the home page in 20 minutes than a beautiful one in 4 hours.
- **Ask before installing anything I didn't authorize in the README.** No surprise dependencies.
- **When you finish a milestone, stop and check in.** Don't roll into the next one without me.
- **Match the README's design tokens precisely.** If a value isn't in the README or the design files, ask me — don't invent.

## Open questions you should ask me up front

The README mentions a few things I haven't fully decided. Ask me about:

- The exact ICAO24 hexes for each tail (or whether you should compute them from the N-number using the FAA algorithm — that's fine).
- Admin passcode for the tail editor (a single env var is fine for v1).
- Optional `NEXT_PUBLIC_MAP_STYLE_URL` only if we need to test a self-hosted OpenFreeMap style.
- Whether to include any tails beyond the seed list before v1 launch.

Go.
