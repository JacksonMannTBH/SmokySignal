# SmokySignal — Claude Code Guidance

Real-time tracker for Washington State Patrol speed-enforcement aircraft.
Audience: Puget Sound motorcyclists. Brand voice: dark theme, mono numerics,
24-hour clock, no exclamation marks, "Smokey" with E.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass before push)
- `npx tsc --noEmit` — type check
- `cd tests/visual && npx playwright test` — visual + coherence specs

## Verification habits

- **"Shipped" means observable on https://smokysignal.app, not green CI.**
  Build-pass + tests-pass is necessary but not sufficient. Conditional
  renders, async race conditions, and feature-flag gates have shipped
  green and stayed dead in prod (e.g. ArmAlertsCallout PR #39 returned
  null while waiting on a SW promise that never resolved on first
  visit). Before claiming a PR ships a feature, capture screenshot or
  DOM evidence from prod after the Vercel auto-deploy completes.
- `npm run verify-prod` runs the canonical live-prod audit
  (`tests/visual/specs/p14-live-prod-audit.spec.ts`) against
  smokysignal.app and writes findings + screenshots to
  `/tmp/p14-audit/`. Add new claims to that spec when you ship a
  user-visible feature, so the next audit catches regressions
  automatically.
- Run `npm run build` before pushing — CI mirrors it.
- Type-check via `npx tsc --noEmit` for fast feedback during edits.
- For UI changes, manually exercise the page in dev — type checks don't
  catch behavioral regressions.
- For radar / map changes, verify on `/radar` with the dev tools console
  open — MapLibre layer errors only show up at render time.
- When generating code that calls a third-party library (Next.js, React,
  MapLibre, web-push, @vercel/kv, @axe-core/playwright, etc.) or
  referencing API surfaces that change across versions, append
  `use context7` to the prompt. Context7 fetches current docs into the
  model's context — beats relying on training-cutoff knowledge.

### Continuous testing surfaces (P20 wired)

Four GitHub Actions / spec layers run in addition to `npm run verify-prod`:

- **Voice gate** (`.github/workflows/voice-gate.yml`) — every PR. Pure
  regex/wordlist (no LLM, no auth) checking rider-facing copy against
  `design/BRAND.md` §3+§8. Fails on banned vocab, emoji, exclamation
  marks. Posts P1 nudges as a comment. Source of truth: the rule lists
  in `.github/scripts/voice-gate.mjs`.
- **PR persona walks** (`.github/workflows/persona-walk-pr.yml`) —
  every PR with rider-facing changes. Walks 3 personas (sport-bike-rider,
  skeptic, lurker) × routes inferred from the diff against the Vercel
  preview URL. Posts a single PR comment with the consensus. Requires
  `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` secrets and one of
  `CLAUDE_CODE_OAUTH_TOKEN` (subscription, preferred) /
  `ANTHROPIC_API_KEY`. Auto-skips with a warning when secrets missing.
- **Nightly persona sweep** (`.github/workflows/persona-walk-nightly.yml`)
  — cron 04:00 PT. Full 8-personas × 8-routes sweep against prod,
  uploads 90-day artifact with `consensus.md` + `findings.json`.
- **Findings → issues** (`.github/scripts/findings-to-issues.mjs`,
  invoked at the end of the nightly workflow) — opens one GitHub issue
  per high-signal finding (≥3 personas, no matching open issue).
  Auto-labels by category.

Behavioral persona walks (`tests/visual/personas/behavioral-walks.spec.ts`)
exercise act-and-observe goals (tap, scroll, navigate) and emit a
JSON action log per (persona, route). Run alongside the static specs.

### Mock state machine

`?mock=<state>` query param drives reproducible UI states for QA and
persona walks. States: `up`, `down`, `eyes-up`, `multiple`, `stale`.
Source: `lib/mock-state.ts`. Use these to validate copy/UX without
waiting for a live event.

## Architecture quick-reference

- `lib/snapshot.ts` — fleet snapshot from adsb.fi (primary) + OpenSky (fallback)
- `lib/tracks.ts` — per-tail position history, KV-backed, 35-day TTL
- `lib/aircraft-alerts/*` — Web Push proximity alerts (subscribe / dispatcher / dedupe)
- `lib/user-zones.ts` — rider-defined geofences (localStorage); managed at `/settings/zones`
- `lib/user-prefs.ts` — cookie-backed display prefs (12/24-hour, normal/high contrast)
- `lib/voice-mode.ts` — speechSynthesis readback toggle (foreground only)
- `lib/storage-keys.ts` — canonical KV key formatter (NX7 foundation; route all `tracks:*`/`spots:*`/`flights:*` through this)
- `app/(tabs)/` — main app routes (home, radar, dash, plane, settings, etc.)
- `app/api/cron/` — scheduled refreshes (snapshot, predictor)
- `public/sw.js` — service worker for PWA install/update + alert notification display/click handling

## Privacy posture

- No accounts. Rider-side state lives in localStorage (zones, dismissals,
  region pref, proximity threshold, voice mode) or cookies (time-format
  pref, contrast pref).
- The only server-side rider identifier is the anonymous aircraft-alert
  subscription record — required by Web Push, treated as PII-equivalent.
- Geolocation is browser-only, never persisted server-side.
- Speed data: device reports it, we do not display or store it.

## Operational notes

- OpenSky historical backfill (`scripts/backfill.ts`) is **deprecated**
  as of 2026-05-02 — the rate-limit window is exhausted on this cred
  and adsb.fi has no historical equivalent. The 30-day track tank fills
  forward via the live cron only. OpenSky is still used as a live
  states-snapshot fallback in `lib/snapshot.ts`.
- VAPID env vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`) are required for aircraft-alert delivery. Preview
  deploys need their own values if you want alerts to work outside prod.
- KV key construction: route through `lib/storage-keys.ts` (`trackKey()`,
  `spotKey()`, `flightsRecentCacheKey()`, etc.) instead of inlining
  string literals like `\`tracks:\${tail}:\${date}\``. The default-region
  shape is byte-for-byte identical to the prior literals; the
  formatter is the only knob for future regional namespacing.
- iOS Web Push still requires an installed home-screen PWA and a granted
  notification permission. Regular Safari tabs can show the UI, but
  cannot receive closed-app alerts.

## Brand voice

See `lib/brand/` for tokens; see roadmap "Tradeoff conversations" section in
`docs/ROADMAP.md` for the dark-mode-only, no-light-mode, no-emoji decisions.
