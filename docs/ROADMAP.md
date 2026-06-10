# SmokySignal — Roadmap

> Strategic roadmap, generated 2026-05-02. Updated whenever Alex decides
> what to ship next. The roadmap is opinionated: every item carries a
> stance, including the explicit "Maybe-Never" tier at the bottom.

## Lens

Three principles drive every prioritization call:

1. **Brand voice over feature breadth.** SmokySignal is laconic, dark,
   glance-able. Items that fight `design/BRAND.md` are tradeoffs to surface,
   not slam-dunks. We name the tension, propose a path, and ship — or
   deliberately don't.
2. **Side-project ambit.** Alex stated this could be "basically finished in
   a month or less." The Now tier respects that. Later / Maybe-Never tiers
   are honest about ambition without committing.
3. **Truth over polish.** The product wins by being right (the bird is up
   when we say it is) more than by being beautiful. Coherence + performance
   beat decorative work.

## Where we are right now

**P15 sweep (2026-05-02):** Shipped /zones (N20), high-contrast mode
(NX1), voice readback (NX4), and deprecated the OpenSky historical
backfill (N2 → not viable on adsb.fi). One PR (#59, /about tail
registry 2-col grid) left open for aesthetic review of the
multi-column desktop direction.

**P16 sweep (2026-05-02):** Fixed the Arm-alerts CTA first-visit
regression (PR #61 — render synchronously instead of waiting on SW),
shipped N1a speed-warning DRY-RUN logging (#63), shipped NX7
federation namespace prep (#62 — `lib/storage-keys.ts`), shipped
FilterPanel multi-select Roles section (#64). NX2 (weather overlay)
and NX8 (time-scrubber) deferred to focused prompts (substantial
work, design decisions needed). Verify-prod assertion #9 fixed to
recognize iOS Safari's correct null-render path (component hides
because Notification API is absent — IOSInstallPrompt covers riders
in that context).



Built and shipped: home glanceable, radar with hot-zone heatmap, weekly
forecast grid, activity feed, plane-detail with flight playback, public
flight-share pages with OG images, learning-state UI for the 30-day
window, push notifications via VAPID, admin tail editor with audit log
and backups, brand voice + role-aware aircraft glyphs, Channel-19 voice
across `/about` `/legal` `/help`, time-format toggle (24h ↔ 12h, PT
hard-coded), GitHub Actions CI mirroring Vercel, two rounds of QA pass
infrastructure including state-coherence assertions.

Not yet shipped: speed-warning UI (the `warn` token is reserved but unused),
adsb.fi historical backfill (OpenSky's historical endpoint is broken),
geographic expansion, native shell.

The product has the bones. The roadmap is about which next moves move the
needle vs which ones risk pulling it off-brand or out of scope.

## Tier 1 — Now (next 30 days)

Side-project-sized work. Effort XS or S, no major brand tension, concrete
user value visible at first paint.

### N1a. Speed-warning DRY-RUN logging ✓ SHIPPED (P16 #63)
- **Description:** `lib/speed-warning.ts` exposes `evaluateWarning()`,
  a pure function that returns `wouldFire` + the three distance/over-
  limit metrics. DashShell runs it on every rider geolocation tick
  and POSTs positives to `/api/dryrun-warnings`. Admin viewer at
  `/admin/dryrun-warnings`.
- **Trigger condition:** all three of (a) over the limit by > 2 mph,
  (b) inside a hot zone (≤ 0.5 nm from cell center), (c) tracked
  alert-tier plane airborne ≤ 5 nm of the rider.
- **Storage:** `dryrun-warnings:{YYYYMMDD}` Redis list, 7-day TTL.
- **Status:** Live. Data accumulation begins now; N1b unblocks after
  5–7 days of samples.

### N1b. Speed-warning UI surface
- **Description:** Once N1a's data confirms the trigger threshold is
  sane, surface the canonical warning (`EASE OFF — bird Xmi out, you're
  Y over.`) full-screen with the reserved `--warn` token (`#FF7A1A`).
- **Why it matters:** This is the headline feature; once the threshold
  is data-validated, it's safe to ship.
- **Effort:** S
- **Risk:** med — brand-critical UX.
- **Brand tension:** none — `warn` is reserved.
- **Dependencies:** N1a (need 5–7 days of dry-run data to set the
  threshold). N1a SHIPPED 2026-05-02 — eligible to ship around 2026-05-09.
- **Status:** ready to write a prompt once N1a data accumulates.

### N2. adsb.fi historical backfill ✗ DEPRECATED (P15 #58)
- **Investigation result:** adsb.fi is a real-time ADS-B aggregator and
  does **not** expose a historical equivalent of OpenSky's
  `/flights/aircraft` or `/tracks/all`. Path A (port the script) was
  not viable.
- **Decision:** Deprecate `scripts/backfill.ts` with a banner gate
  (`--force-opensky` to bypass). The 30-day track tank now fills
  forward via the live cron (`/api/cron/refresh-snapshot` @ 60s, 35-day
  TTL on `tracks:{tail}:{YYYYMMDD}`).
- **Acceptable consequence:** New tails added to the registry get a
  deploy-day "first sample" instead of their actual history. Hot zones
  for new tails take ~30 days to fully populate. Existing tails are
  unaffected (they have ~30 days of cron-built history already).
- **Future option:** If a paid historical provider becomes acceptable
  (FlightAware, ADSBexchange paid tier), revisit by writing a new
  fetcher. The deprecation banner doesn't block re-enabling OpenSky
  if the rate-limit window resets.

### N3. FAA registration deep-link on `/plane/[tail]` ✓ SHIPPED (P9 #16)
- **Description:** Add a small "FAA registry →" mono link next to the
  existing `ICAO24` line on the plane detail page that points at
  `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt={tail}`.
  Single line of JSX in an already-rendered footer.
- **Why it matters:** Riders curious about "what is this plane really?"
  currently have to copy the tail number and paste into Google. One click
  on the FAA page gives them owner, model history, expiration. Free
  legitimacy.
- **Effort:** XS
- **Risk:** low.
- **Brand tension:** none.
- **Dependencies:** none.
- **Status:** ready to write a prompt.

### N4. Vercel deploy-failure cron + email alert ✓ SHIPPED (P9 #18)
- **Description:** Small GitHub Action (or Vercel Cron) that hits
  `vercel deployments list` hourly, surfaces any failed prod deploys to
  the commit author by email. We discussed this when Vercel kept biting us
  in the P3-P5 window. CI from PR #10 catches build failures before deploy
  but not env-var rot or runtime failures.
- **Why it matters:** Three deploy failures in one session caught us by
  surprise. A 20-minute setup buys persistent confidence.
- **Effort:** XS
- **Risk:** low.
- **Brand tension:** none (infra, no UI).
- **Dependencies:** GitHub Action runs free; email is built-in.
- **Status:** ready to write a prompt.

### N5. Color-contrast cleanup pass ✓ SHIPPED (P9 #21)
- **Description:** PR #9 fixed `--ss-fg2`. PR #13 fixed `SS_TOKENS.fg3`
  on the plane page. Audit the rest of the codebase for hardcoded greys
  or further `fg3` usage that fails AA. Single-PR sweep.
- **Why it matters:** We've already done two one-off fixes. A focused
  audit gets us to AA-clean across every surface in one sweep — and lets
  the QA pipeline run with `axe` on chromium-desktop staying green.
- **Effort:** S
- **Risk:** low.
- **Brand tension:** minor — pushing greys lighter trades a touch of the
  dark-aesthetic for accessibility. We've already made this trade twice
  with no visible degradation.
- **Dependencies:** none.
- **Status:** ready to write a prompt.

### N6. README + README-style HOW_TO_HAND_OFF cleanup ✓ SHIPPED (P9 #15)
- **Description:** The repo's `README.md` is the design-handoff doc from
  pre-build. It's accurate but reads as a spec, not as a "how to run this
  project" doc. Add a short "Working with this codebase" section that
  points at `tests/visual`, the cron jobs, the env vars, and the prompt
  pipeline.
- **Why it matters:** When someone (Alex 6 months from now, or another
  contributor) opens the repo, the first 100 lines should orient them. Right
  now they orient them to the spec, not the running system.
- **Effort:** XS
- **Risk:** low.
- **Brand tension:** none.
- **Dependencies:** none.
- **Status:** ready to write a prompt.

### N7. Data freshness indicator ✓ SHIPPED (P9 #22)
- **Description:** `LAST SAMPLE — Xm AGO` mono label on `/` and
  `/radar`. Flips amber after 15 min stale. Catches silent-cron-death
  failure mode before riders see hours-stale state as current.
- **Status:** Live. Reads `meta:last_sample_ts`; `lib/tracks.ts`
  writes it on every snapshot.

### N8. Region selector (Puget Sound / counties / All WA) ✓ SHIPPED (P10 #28)
- **Description:** Dropdown in `/radar` header letting riders pivot
  the map between Puget Sound (default), Pierce / Snohomish / Spokane
  counties, or All Washington. Localstorage-backed pref, no accounts.
  Map flies to the chosen region; heat-map data per-region filter is
  follow-up (needs `lib/hotzones.ts` extension).
- **Status:** Live. Spokane riders open to Spokane.

### N9. Auto-zoom radar to rider's location ✓ SHIPPED (P10 #25)
- **Description:** First time geolocation resolves on `/radar`,
  `flyTo` rider position at zoom 11 (street-level). One-shot — the
  existing 5s recenter loop maintains center after that without
  changing zoom. Skipped if user already manually panned/zoomed.
- **Status:** Live. Tacoma riders open to Tacoma instead of the
  regional Puget Sound overview.

### N10. /about hero branding ✓ SHIPPED (P10 #24)
- **Description:** `<Logo wordmark size={80}>` centered above the
  "Truckers called them Smokey" headline. The campaign hat + wordmark
  is the first thing a curious visitor sees.
- **Status:** Live.

### N11. Heat-map mobile readability ✓ SHIPPED (P10 #26)
- **Description:** Three reinforcing fixes for "solid red chunk
  Edmonds to Eatonville": log-scale weight (was linear capped at 20),
  zoom-aware radius (14→28px across zoom 7→11), zoom-aware intensity
  (0.6 at zoom 7), top-stop opacity dropped to 0.65 (was 0.78), layer
  opacity to 0.7 (was 0.85). Audit details:
  `/tmp/prompt10-heatmap-tuning.md`.
- **Status:** Live.

### N12. PWA install reliability ✓ SHIPPED (P10 #23)
- **Description:** `appleWebApp.{capable, title, statusBarStyle}`
  added to Next.js Metadata so iOS A2HS launches in a proper
  standalone shell (matched-color status bar, enforced app name).
  Also tabIndex=0 + aria-label on the /about embed `<pre>` block
  (P1 a11y in the audit). Manifest itself was already valid.
- **Status:** Live.

### N13. Nashville geo-fence (hot-zones aggregator) ✓ SHIPPED (P10 #27)
- **Description:** Tighten `inRegion()` bounding box from "whole-state"
  (45–49.5°N, -125 to -116°W) to Puget-Sound-tight (default 47.6,
  -122.3, 80nm). Envvar-overridable: `SS_REGION_LAT/LON/NM`. Audit
  found WSP Smokey 3 (N2446X) had ~1028 eastern-WA samples polluting
  the heatmap. Details: `/tmp/prompt10-nashville-investigation.json`.
- **Status:** Live. Tri-Cities deployments no longer leak into the
  Puget Sound heatmap.

### N14. Historical context line on home ✓ SHIPPED (P9 #20)
- **Description:** Mono caption under the Hero pill telling the
  rider how the current hour-of-week reads historically: "usually up
  at this hour. 67% of weeks." / "unusual hour. up only 12% of
  weeks." / "usually up by now. running late tonight." / "quiet hour.
  usually clear."
- **Status:** Live. Hides cleanly when predictor is still learning.

### N15. Per-plane patrol heatmap on `/plane/[tail]` ✓ SHIPPED (P11 #33, #34)
- **Description:** New "Where this plane patrols" card on the plane
  detail page showing a 30-day heatmap of just that tail's recorded
  positions. Auto-fits bounds to the plane's actual envelope (cap
  zoom 11) so a Tri-Cities-deployed Smokey opens centered on
  Tri-Cities, not Puget Sound. Server-side aggregator at
  `lib/per-plane-heatmap.ts` + API at `/api/plane/[tail]/heatmap`
  with 6h KV cache, lazy-filled.
- **Status:** Live.

### N16. Click-to-follow plane on `/radar` ✓ SHIPPED (P11 #30)
- **Description:** Click an aircraft chevron and the map flies to
  it + re-centers as the plane moves. 200 px screen-center threshold
  prevents jitter on small orbit deltas. Popup shows tail/nickname
  + "View detail" link to `/plane/[tail]`. Click empty map (or
  manual pan/zoom) exits follow mode.
- **Status:** Live.

### N17. Unified operator/tail filter on `/radar` ✓ SHIPPED (P11 #36)
- **Description:** Lifted the existing heat-zone filter (operator,
  tail-set, region) into `lib/radar-filter.ts` and made it apply to
  aircraft markers too — flipping "Smokey only" or "WSP only" in
  the chevron now hides non-matching markers as well as non-matching
  heat zones. CustomEvent fan-out keeps both layers in sync. Region
  filter intentionally stays server-side (heat-aggregation only)
  because rider-local marker visibility shouldn't depend on the
  aggregation envelope.
- **Status:** Live.

### N18. Dashboard restoration + ProximityFlash ✓ SHIPPED (P11 #31, #32, #35)
- **Description:** `/dash` is back in the tab bar (gauge icon,
  between Radar and Activity). Speedometer card removed per the no-
  speed-collection stance. NearestCard expanded to a top-3 list of
  closest airborne planes (each row links to `/plane/[tail]`). New
  ProximityFlash component renders an ambient amber radial pulse
  whenever a smokey- or patrol-role bird is within 5 nm; transport
  planes don't trigger it.
- **Status:** Live.

### N19. Rider-defined geofences (foundation) ✓ SHIPPED (P11 #37)
- **Description:** New "+" button on `/radar` drops a 5 nm circular
  geofence at the rider's current position (label prompt). Zones
  render as dashed sky-tinted circles under the aircraft layer; tap
  inside a zone (where no aircraft is) to remove it after a confirm
  prompt. localStorage-only (`ss_user_zones`) — no accounts. Push-
  notification integration (zone-entry alerts) deliberately deferred:
  it requires server-side state and lands in a follow-up PR.
- **Status:** Live for local rendering + manage. Push wiring queued.

### N20. /zones management page ✓ SHIPPED (P15 #55)
- **Description:** `/settings/zones` — list, edit (label + radius
  slider), remove, and "Add zone at my location" button. Falls back to
  Puget Sound center if GPS denied. Linked from `/settings/alerts`
  Zones section.
- **Status:** Live.

## Tier 2 — Next (Q3 2026)

Bigger pieces. Effort up to M. Acceptable brand tension after explicit
tradeoff conversation. New infra OK if it's commodity.

### NX1. High-contrast accessibility mode (NOT light mode) ✓ SHIPPED (P15 #56)
- **Description:** Toggle on `/settings/alerts` — Normal | High. Stays
  dark either way. High lifts `--ss-fg1/2/3` and `--ss-hairline/-2`
  opacity so meta-lines and dividers stay legible in glare or low-vision
  conditions. Brand semantic colors (alert/clear/sky/warn) NOT changed.
- **Implementation:** Cookie-backed (`ss_contrast`) via the same pattern
  as `ss_time_format`. `app/layout.tsx` reads the cookie server-side
  and sets `<body data-contrast="high">`. CSS overrides in
  `app/globals.css`. No client JS. Default `normal` (no behavior change
  for existing riders).

### NX2. Wind / cloud-cover overlay on `/radar`
- **Description:** A toggleable layer on the radar map showing current
  wind direction + cloud cover. Pulled from NOAA or OpenWeather. Relevant
  because FLIR planes need clear visibility — heavy cloud means "Smokey
  is up but probably not seeing much."
- **Why it matters:** A rider seeing "Smokey 4 airborne, Skykomish at
  100% cloud cover" makes a different decision than seeing "Smokey 4
  airborne, clear visibility." We can surface that without speculating.
- **Effort:** M — adding a map layer is mechanically straightforward;
  picking a free provider that doesn't require an API key with usage limits
  is the harder part.
- **Risk:** med — third-party provider dependency, cost ceiling unclear at
  scale.
- **Brand tension:** none.
- **Dependencies:** decide provider (NOAA NWS API is free but US-gov
  reliability is what it is; OpenWeather has a free tier; OpenFreeMap
  does not include weather tiles).
- **Status:** ready to design.

### NX3. Apple Wallet "Smokey status" pass
- **Description:** Generate a Wallet pass per rider that updates via push
  whenever the bird state changes. Add to Wallet → glanceable lock-screen
  card showing UP / DOWN. Existing push pipeline already has the rider's
  subscription; adding a Wallet Pass kit is well-trodden ground.
- **Why it matters:** A rider on a bike isn't unlocking their phone to
  open the app. Lock-screen card via Wallet is the most ambient possible
  surface — perfect for "is the bird up?"
- **Effort:** M — Wallet pass generation is ~200 lines; the push integration
  follows the existing pattern.
- **Risk:** med — Apple requires a paid developer cert ($99/yr) to sign
  passes. Brand-wise this is a meaningful integration with the iOS world.
- **Brand tension:** minor — "Apple Wallet" is a third-party container; we'd
  need to design the pass face carefully to stay on-brand inside Apple's
  template constraints.
- **Dependencies:** Apple developer cert; pass-signing service (or Vercel
  function with the cert).
- **Status:** depends on Alex's appetite for the cert + cost.

### NX4. Voice readback (Web Speech API) ✓ SHIPPED (P15 #57)
- **Description:** Toggle in `/settings/alerts` — when on, alerts speak
  via `speechSynthesis` while the page is open. Foreground proximity
  alerts speak directly; background pushes (tab open) speak via SW
  → page postMessage bridge.
- **Limitation:** Closed-tab background pushes do **not** speak —
  `speechSynthesis` requires an open page. Acknowledged in copy + code.
  Realistic helmet-audio use case keeps `/radar` or `/dash` visible.
- **iOS gesture priming:** First opt-in calls `speakAlert("Voice
  readback on.")` to satisfy iOS Safari's user-gesture requirement
  before subsequent `speak()` calls work.
- **Brand voice:** push dispatcher already produces laconic +
  mono-numerical copy (no exclamation marks); `speakAlert` does NOT
  transform.

### NX5. Embeddable status badge for third-party sites ✓ SHIPPED (P9 #17)
- **Description:** Same `/api/badge.svg` we already serve, but documented +
  packaged + with a public "embed code" snippet on `/about`. Local moto
  blogs and rider forums could embed "is Smokey up right now?" on their
  own pages.
- **Why it matters:** Distribution at zero marginal cost. Each embed is a
  free pageview impression plus brand awareness in the rider community.
- **Effort:** XS — the badge endpoint exists, just needs docs + an embed
  snippet on `/about`.
- **Risk:** low.
- **Brand tension:** none.
- **Dependencies:** none.
- **Status:** ready to write a prompt.

### NX6. Distance rings on radar ✓ SHIPPED (P9 #19)
- **Description:** Optional toggleable concentric rings around the rider's
  current location at 5/10/15 mile increments. Helps riders read at a
  glance how close the bird actually is.
- **Why it matters:** The current radar shows the bird's location but not
  the rider's relative distance. Mental math is friction; rings remove it.
- **Effort:** S
- **Risk:** low.
- **Brand tension:** minor — additional ink on the map. Needs to stay
  hairline-thin and dim or it competes with the heatmap.
- **Dependencies:** none.
- **Status:** ready to write a prompt.

### NX7. Federation-ready namespace prep ✓ FOUNDATION SHIPPED (P16 #62)
- **Description:** `lib/storage-keys.ts` is now the canonical KV key
  formatter. `tracks:*`, `spots:*`, `hotzones:*`, `flights:*` keys all
  route through it. For `DEFAULT_REGION = 'puget-sound'` the formatter
  returns byte-for-byte identical key shapes to the prior literals —
  zero migration of existing data. For non-default regions a
  `{region}:` prefix is prepended.
- **What's left for actual Bay Area expansion:** per-region runtime
  selection (currently hardcoded to default), cron-config per region,
  per-region env vars (`SS_REGION_LAT/LON/NM` set today is single-
  region). L6 Bay Area expansion is now ~3 days of config work
  instead of ~3 weeks of refactoring.
- **Status:** Foundation live; expansion remains an L6 decision.

### NX8. Time-scrubber for historical playback on `/radar`
- **Description:** Promoted from L7 → NX. A scrub bar at the bottom
  of `/radar` letting the rider drag through the last 24 hours of
  fleet positions. "Where was Smokey at 3pm yesterday?"
- **Why it matters:** Most-requested feature in similar projects;
  data already exists in `tracks:*` keys. Promoting from Later → Next
  because the lift is mostly UI on data we already have.
- **Effort:** L — UI-heavy, careful state management for the map
  layer + smooth scrub interaction.
- **Risk:** med — performance on mobile with large polylines.
- **Brand tension:** none.
- **Dependencies:** none.
- **Status:** ready to design.

### NX9. Mobile-specific heat-map paint strategy
- **Description:** N11 tuned the heatmap globally for readability.
  NX9 considers a *different* paint config at small viewports — e.g.
  smaller radius below 480px, lighter opacity stops on Retina-scale
  pixel-density. Distinct from N11 because that change applies
  everywhere, not just mobile.
- **Why it matters:** The Edmonds-to-Eatonville saturation that
  prompted N11 was specifically a mobile complaint. If N11's global
  tuning over-corrects for desktop, NX9 lets us split the
  difference.
- **Effort:** S
- **Risk:** low.
- **Brand tension:** none.
- **Dependencies:** observe N11 in the wild for a week first.
- **Status:** ship-and-iterate; only build if N11 needs more work.

### NX10. Premium tier without accounts
- **Description:** Stripe Checkout for either (a) one-time tip
  donation or (b) recurring "Smokey Plus" tier with a single benefit
  (custom corridor alerts, longer flight-history retention, or
  early access to new regions). NO ACCOUNTS — Stripe Customer ID
  in localStorage; rider can restore by entering their email.
- **Why it matters:** Cost ceiling rising as data + Vercel + push
  usage grows. Even token monetization changes the math from "Alex
  eating cost forever" to "self-sustaining."
- **Effort:** M — Stripe integration well-trodden; the harder
  question is the brand-voice copy for an upsell.
- **Risk:** med — introduces customer-support burden.
- **Brand tension:** meaningful — the brand has zero pretension
  and zero upsell language. Copy must match existing voice ("Buy
  us a coffee, we'll keep listening." not "Upgrade for premium
  features.")
- **Dependencies:** Alex's monetization-stance decision (see Open
  Questions).
- **Status:** worth a focused tradeoff prompt; defer until
  cost becomes a real constraint.

### NX11. Ground-patrol awareness
- **Description:** Surface awareness of marked WSP cars / sheriff
  patrol cars on a separate alert layer. Possible data sources:
  Waze API (proprietary), public scanner integrations (legally
  fraught), user-spotted reports via a community Spot button
  (slow but trustable).
- **Why it matters:** The "Smoky AND coppers" idea — riders care
  about ground patrol as much as air patrol. The product brand
  ("the bird") is air-only; expanding to ground is a meaningful
  scope change.
- **Effort:** L — mostly research-first (data source viability),
  then UI integration.
- **Risk:** high — privacy + legal questions around scanner data;
  brand-scope creep.
- **Brand tension:** major — "the bird is up" is the entire
  product positioning. Ground-patrol awareness is a different
  product wearing the same brand.
- **Dependencies:** data-source research.
- **Status:** research-first, decide after.

### NX12. Predictor algorithm tuning
- **Description:** `lib/predictor.ts` could use historical-pattern
  weighting (recent weeks count more than 30-day-old) and tighter
  hour buckets (15-min instead of 60-min). Confidence model could
  factor weather, day-of-week clustering, and seasonal patterns.
- **Why it matters:** The current predictor works ("3pm Friday
  is usually busy"). Tuning makes it sharper ("3:15pm Fridays are
  particularly busy in summer rush").
- **Effort:** L — algorithm work; needs clear evaluation criteria
  before tuning.
- **Risk:** low — the existing model still works; this is
  refinement.
- **Brand tension:** none.
- **Dependencies:** evaluation harness (synthetic test against
  known-good predictions).
- **Status:** focused-session topic, not a tactical fix.

## Tier 3 — Later (Q4 2026 onward)

Ambitious work. Effort up to L. Major brand tension allowed if the
tradeoff is worth surfacing. Native shells, federation, paid tiers.

### L1. Native shell (Capacitor) for background geolocation
- **Description:** Wrap the existing PWA in Capacitor or a similar
  shell. Unlocks background geolocation, which means the speed-warning UI
  (N1) can fire when the app is closed but riding. Currently iOS PWAs
  cannot background-geolocate, full stop.
- **Why it matters:** The speed warning is the headline feature; making
  it foreground-only limits its value. A native shell unlocks the
  ambient surface.
- **Effort:** XL — App Store review, certificate management, ongoing
  maintenance burden of a second shipping target.
- **Risk:** high — App Store review is unpredictable. Ongoing build
  pipeline complexity.
- **Brand tension:** meaningful — the brand is web-native and dev-friendly.
  Going native introduces a second discipline.
- **Dependencies:** N1 must ship first (don't build a shell without the
  feature it unlocks).
- **Status:** consider only after N1 has shipped and we have data on how
  many riders actually want background warnings.

### L2. Apple Watch / WearOS companion
- **Description:** Watch face complication showing "bird up: yes/no"
  + last-seen time. No interactivity, just glance.
- **Why it matters:** Even more ambient than Wallet. The closest
  surface to "rider doesn't have to do anything to know."
- **Effort:** XL — both watch ecosystems require their own SDK and
  certificate flows.
- **Risk:** high.
- **Brand tension:** minor — the surface is small enough that brand voice
  fits naturally.
- **Dependencies:** native shell (L1) is a prerequisite for the iOS side.
- **Status:** dependent on L1.

### L3. Federation: SmokySignal as a template, not a single deployment
- **Description:** Open-source the codebase as `smokysignal-template` so
  any region's rider community can stand up their own instance. Document
  the registry-curation process. Maintain a directory of sister sites.
- **Why it matters:** The pattern (laconic dark UI + role-aware copy +
  PT-anchored forecasting) generalizes anywhere with public ADS-B and
  enforcement aircraft. We could turn this from one site into a movement.
- **Effort:** L — needs federation prep (NX7), public-facing docs,
  contributor onboarding flow, brand-licensing decision (do other regions
  use the SmokySignal name?).
- **Risk:** high — opens governance questions. Brand dilution risk if we
  don't enforce voice + design constraints on franchisees.
- **Brand tension:** major — letting other operators use the brand means
  trusting them to honor it.
- **Dependencies:** NX7 (federation prep), L4 (community infra).
- **Status:** worth exploring conceptually; commit only if Alex wants the
  product to outlive its current scope.

### L4. Anonymous CB-handle community
- **Description:** Optional "handle" a rider can pick (e.g. `Big-Iron-Mike`)
  that lets them post timestamped Spots with a 140-char note. No accounts,
  no DMs, no avatars. CB-radio analog of Twitter, fits the brand exactly.
- **Why it matters:** Spots are currently anonymous and silent. Adding a
  handle + short note creates an actual community signal — riders sharing
  what they saw, where, when.
- **Effort:** L — moderation is the hard part; anonymous-but-pseudonymous
  systems get spammed without strong rate limits + report flow.
- **Risk:** high — community moderation is its own product. Side-project
  bandwidth probably can't sustain it.
- **Brand tension:** minor — fits naturally if the UX stays radio-cadence.
- **Dependencies:** abuse-prevention infra, possibly moderation tooling.
- **Status:** ambitious; only if Alex has appetite for ongoing community
  ops.

### L5. Tip jar / "Smokey Plus" tier
- **Description:** Optional support — Stripe checkout for a one-time tip
  ($5/$10/$25 buttons) or a recurring $3/mo "Smokey Plus" tier with a
  small non-feature perk (custom corridor alerts, longer history retention,
  first-in-line for new regions).
- **Why it matters:** Hosting + push aren't free. Even token
  monetization changes the math from "Alex eating cost forever" to
  "self-sustaining."
- **Effort:** M — Stripe integration is well-trodden; the harder question
  is whether to do it at all.
- **Risk:** med — introduces customer-support burden; brand-wise the
  product so far has been "love it or leave it" with no commercial layer.
- **Brand tension:** meaningful — the brand has zero pretension and zero
  upsell language. Even a $3/mo tier risks reading as conversion-funnel.
  If we ship this, the copy must match the existing voice ("Buy us a
  coffee. We'll keep listening." not "Upgrade for premium features.")
- **Dependencies:** decide brand stance.
- **Status:** worth a tradeoff conversation; defer until cost becomes a
  real constraint.

### L6. Geographic expansion — second region (Bay Area)
- **Description:** Stand up a second SmokySignal instance for the Bay Area
  (CHP aviation), shared codebase, separate KV namespace + tail registry.
- **Why it matters:** The product format is generalizable; expansion is
  the easiest validation of "is this a pattern or just a Puget Sound
  thing?"
- **Effort:** L — assumes NX7 and L3 have already happened. Without those,
  it's a fork-and-maintain headache.
- **Risk:** med.
- **Brand tension:** none if NX7+L3 are done; major if we expand by
  forking (brand drifts across instances).
- **Dependencies:** NX7 (federation prep), ideally L3 (federation framing).
- **Status:** consider only after the federation work.

### L7. Time-scrubber for historical playback on `/radar`

PROMOTED to NX8 in P10. See Tier 2.

### L8. PMTiles self-hosting
- **Description:** Replace public OpenFreeMap vector tiles with self-hosted
  PMTiles for the Puget Sound region. Drops the public tile dependency
  while keeping the same MapLibre rendering path.
- **Why it matters:** OpenFreeMap has no key gate or view cap, but a public
  endpoint is still an external dependency. Self-hosting on Vercel Blob is
  one-time work + indefinite control.
- **Effort:** L — generate the tile bundle, host it, switch the map
  source.
- **Risk:** med — if PMTiles serving is slow on Vercel Blob, the radar gets
  worse.
- **Brand tension:** none.
- **Dependencies:** none.
- **Status:** preemptive; ship if the public tile endpoint becomes a real
  reliability constraint.

## Tier 4 — Maybe-Never (deliberate rejections)

What we don't do is as important as what we do. The brand has identity
because the boundaries are clear.

### MN1. Light mode
- **Description:** A user-toggleable light theme that inverts the palette
  to dark text on light background.
- **Why we say no:** BRAND.md §4 + §8 are explicit — the brand is dark-only
  on purpose. The orbit glyph, the orange-means-bird semantic, the OLED
  battery-friendly aesthetic, the "glanceable in sun glare" affordance —
  all built around dark. Inverting it produces a second product that
  shares a name and not much else.
- **What would change our mind:** A documented accessibility need that
  high-contrast mode (NX1) doesn't address. The full conversation lives
  in the "Light mode" tradeoff section below — read that before pushing
  back.

### MN2. Predictive flight paths on the radar
- **Description:** Draw a forward-projected line showing where the bird
  is likely to fly next, based on its current heading + historical
  patterns.
- **Why we say no:** Two reasons. (1) The truth-over-polish principle —
  a predictive line implies confidence we don't have, and a wrong
  prediction is worse than no prediction. (2) Riders making decisions
  based on a speculative path is exactly the "evade enforcement" framing
  BRAND.md §8 explicitly refuses.
- **What would change our mind:** If predictor confidence reaches a level
  where we can label it as "tendency, not prediction" without it reading
  as evasion-aid copy. Hard to imagine that conversation going well.

### MN3. Smokey-photo gallery / spotter leaderboard
- **Description:** Riders submit photos of the planes they've spotted; a
  leaderboard ranks the top spotters.
- **Why we say no:** BRAND.md §8 explicitly refuses depicting authority.
  A photo gallery of patrol aircraft puts those depictions front and
  center. Also, ranking spotters introduces the "evade enforcement"
  framing — "I spotted Smokey 12 times this month" is exactly the
  scoreboard the brand refuses.
- **What would change our mind:** Nothing. This is a clean refusal.

### MN4. AI-generated brand voice expansion
- **Description:** Using an LLM to auto-generate copy variants for new
  surfaces in "the SmokySignal voice."
- **Why we say no:** The voice is sharp because it's hand-tuned. Auto-
  generating it produces voice-shaped slop that erodes the discipline.
  The voice-guardian skill exists to catch slips, not to scale generation.
- **What would change our mind:** Nothing. Voice is human work.

### MN5. Mainstream tech press push / App Store featuring
- **Description:** Submit the app to TechCrunch, get reviewed in Wired,
  push for App Store featuring. (Distinct from posting in
  `/r/motorcycles`, podcasts, or local rider community channels — those
  are welcome and fall under organic word-of-mouth.)
- **Why we say no:** Fundamental scale mismatch. The codebase is hosted on
  Vercel free tier. The data sources are rate-limited free APIs. A
  TechCrunch wave would 503 us inside an hour and we'd be paying
  enterprise tier on every dependency. The product is right-sized for
  the rider community that finds it through word of mouth — that audience
  IS welcome and not what this rejection is about.
- **What would change our mind:** A funded scaling plan + clear monetization.
  Unlikely at side-project scale.

### MN6. Generic "law enforcement aircraft tracker" rebrand
- **Description:** Generalize the product away from WSP/Smokey into a
  generic "see all enforcement aircraft anywhere" framing.
- **Why we say no:** The brand IS the regional specificity. "Smokey"
  works in PNW because it's a real, recognized callsign. Stripping that
  for generality kills the voice. Federation (L3) is the right move
  toward generality — keep the brand local, scale by replication, not by
  blandification.
- **What would change our mind:** Nothing about the WSP version. The
  generalization happens via L3.

### MN7. Push notifications for non-rider use cases
- **Description:** Push for press releases, app updates, marketing.
- **Why we say no:** Push is precious. The single permission ask is the
  rider's trust that we'll only ping them when the bird matters. Adding
  marketing push silently breaks that contract.
- **What would change our mind:** Nothing. Push stays for bird-up alerts
  only.

### MN8. Background recording of rider's ride history
- **Description:** Trip-recording feature — the app keeps the rider's
  GPS track for later review.
- **Why we say no:** BRAND.md §6 + the privacy posture in PR #7 promise
  "we listen, we don't talk." Recording riders' tracks server-side breaks
  that promise even if we encrypt and never look. Local-only storage might
  be OK but adds complexity for a feature riders can do better in Strava.

### MN9. Real-time mainstream-press / Twitter-X virality push
- **Description:** Same as MN5 specifically calling out
  Twitter/X virality and "viral on Hacker News" goals.
- **Why we say no:** Same scale-mismatch reasoning as MN5. A
  viral spike has the same effect as a mainstream press wave —
  503 in an hour, enterprise-tier bills the next day. Riders
  finding it via the rider community is the right discovery
  path; a viral spike is a mismatched audience anyway (most
  viewers won't ride).
- **What would change our mind:** Same as MN5 — funded scaling
  plan + monetization.

### MN10. User-uploaded plane photos / spotter leaderboard
- **Description:** Reaffirms MN3. Riders submit photos of
  spotted aircraft + a leaderboard ranks the top spotters.
- **Why we say no:** BRAND.md §8 explicitly refuses depicting
  authority. A scoreboard introduces "evade enforcement" framing.
  See MN3 for the full refusal.

## Why this exists when FlightRadar24 covers the data

A common question. The answer is **curation + context + voice**, not
data.

| What FR24 does | What SmokySignal does |
|---|---|
| Shows everything that flies | Shows only enforcement-relevant aircraft |
| General-purpose | Rider-specific (status pill, hot zones, role-aware copy) |
| "See all aviation" brand | "Is the bird up?" brand |
| Aircraft + position | Aircraft + position + pattern + context (historical-context line, freshness label, learning state) |
| Subscription model with tiered features | Free, no-account, single-purpose |

FR24's data quality + breadth is unmatched. We don't try to outdata
them. The product's value is the **curation** (16 specific tails, not
40,000) and the **voice** (laconic, dark, "Channel 19's tuning in"
not "Track every aircraft"). A rider checking SmokySignal at a
stoplight gets one answer in one second — they'd need 30 seconds
+ knowledge of the WSP tail registry to extract the same answer
from FR24.

If a competitor with FR24's data also nails the curation and voice,
that's a real threat. Until then, the moat is editorial.

## Tradeoff conversations worth having

### Light mode

Alex asked. The brand says no. Here's the full conversation.

**The case for light mode:**
1. Some users have visual conditions (light sensitivity inverted, certain
   types of photophobia) where dark text on light background is the only
   readable option.
2. Some contexts (a tablet on a workshop bench in fluorescent light,
   bright outdoor reading on a glossy screen) are objectively easier in
   light mode.
3. iOS / Android system-wide dark-mode toggles set an expectation that
   apps respect the system preference.
4. "Just an option" feels low-cost.

**The case against:**
1. BRAND.md §4 explicitly defines the brand as dark, with semantic colors
   tuned for dark. The amber alert and green clear semantics rely on the
   dark canvas to feel right; on a white background they read as warning
   and success in a generic-product way that flattens the voice.
2. The orbit glyph and the chevron icons are designed for dark. Inverting
   them isn't a simple color swap — they need redesign or they look wrong.
3. Light mode is not "just an option" — every component, every token,
   every contrast ratio has to be re-validated. It's a parallel design
   system, not a CSS variable swap.
4. The product is glance-on-bike. A bike rider in sunglasses reading their
   phone in motion isn't well-served by a bright canvas — dark with
   high-contrast amber wins for that use case regardless of the user's
   theme preference.
5. Once we ship light mode, every new component has to be designed twice.
   The brand discipline that makes the product fast becomes 2x slower.

**The proposed path:**
Don't ship light mode. Ship NX1 instead — a high-contrast variant that
stays dark, bumps the greys to AA+, and pushes the alert amber to a
higher-saturation hue. That addresses the genuine accessibility concern
(low-vision riders need higher contrast) without forking the design
system. The brand stays sharp; the accessibility need gets met.

If a rider explicitly comes back with "high contrast doesn't help me, I
need light mode," we revisit. Until then, light mode lives in MN1.

### Native shell (Capacitor) for background geolocation

The speed-warning feature (N1) is the headline. PWAs can't background-
geolocate on iOS. So either:

1. **Ship N1 foreground-only** — speed warning fires when the app is open,
   not when the screen is locked. Honest, but limits the value: most
   rider scenarios involve a phone in a tank-bag mount where the screen
   sleeps after a minute.
2. **Ship a native shell** — Capacitor wraps the existing web app, runs
   in the background, fires the warning even when the screen is off.
   Unlocks the headline use case but introduces a second shipping
   discipline (App Store review, certs, build pipeline).

**The proposed path:**
Ship N1 foreground-only first. Get data on whether riders use it that way.
If usage shows clear demand for background mode, queue L1. Don't pre-
optimize for a use case we haven't validated. The native shell is a
big, ongoing commitment; the data has to justify it.

### Data-source diversification

OpenSky's historical-tracks endpoint is broken. adsb.fi works.

**Short term (N2):** Port the backfill script to adsb.fi. No brand or
scope tension; just maintenance.

**Medium term:** ADSB Exchange offers paid historical access with better
SLAs. Worth keeping in mind if adsb.fi has reliability issues.

**Long term:** A "user-contributed feeds" pattern where individual riders
running their own ADS-B receivers contribute their feed to the project.
Federation-adjacent (L3). Cool idea, premature.

The proposed path: do N2 now; revisit further diversification only if
adsb.fi goes the way of OpenSky.

### Federation / multi-region

The product format generalizes — any region with public ADS-B + an
enforcement aviation fleet could host a SmokySignal. Three approaches:

1. **Fork-and-maintain:** Other regions fork the repo, run their own.
   Brand drifts; we maintain WSP-only.
2. **Multi-tenant single deployment:** One Vercel project serves
   `puget.smokysignal.app` / `bay.smokysignal.app` / etc with shared code,
   per-region KV namespacing. Concentrates ops but lets us enforce brand.
3. **Template + license:** Open-source the codebase as
   `smokysignal-template`, license the brand to operators who agree to
   voice + design constraints. Decentralized but governed.

**The proposed path:** NX7 (Q3) lays the foundation regardless. L3 (Q4)
proposes the framing. The choice between (2) and (3) above is Alex's
call about how much ongoing operations he wants. If "side-project that
might be done in a month," (3) is the only sustainable path. If the
ambition expands, (2) is more defensible.

## Open questions

These tier assignments depend on Alex's input:

1. **Is this a side project that might wrap up in a month, or a long-arc
   product?** Tier 1 fits the side-project framing. Tier 3 assumes the
   ambition is bigger. The answer changes which tier most items belong in.
2. **Does Alex want to monetize at all?** L5 only makes sense if "yes."
3. **Does Alex want to take on community ops?** L4 + L3 only make sense
   if "yes."
4. **iOS native shell — do enough riders want background warnings to
   justify the App Store discipline?** N1 ships and tells us.
5. **Brand-license decision for federation.** Are we comfortable letting
   other regions use the SmokySignal name with constraints, or do we
   prefer they fork under their own name?

## Implementation notes

For Now-tier items, the next step is one of:

- Write a `PROMPT_N_<title>.md` in `~/Documents/Claude/Projects/SmokeySignal/`
- Update the README paste order
- Run on the Mac Mini autonomously (P6/P7 demonstrated this works) or
  queue for a focused session

The autonomous prompts in `Prompts/` already encode the working pattern
— "do the thing, open a PR, gate-check before merge."

## Revision history

- 2026-05-02: Initial roadmap, generated by Prompt 8.
- 2026-05-02 (later): Post-P9/P10 update —
  - Marked N3, N4, N5, N6, N7, N14 (cool feature historical-context),
    NX5, NX6 as ✓ SHIPPED via Prompt 9.
  - Marked N9, N10, N11, N12 as ✓ SHIPPED via Prompt 10.
  - Marked N13 (Nashville geo-fence) and N8 (region selector) as
    in-flight via Prompt 10 (both gate-failed for legitimate reasons,
    awaiting manual review).
  - Split N1 → N1a (DRY-RUN) + N1b (UI surface). N1a deferred pending
    posted-speed-limit + hot-zone-proximity primitives.
  - Promoted L7 (time-scrubber) → NX8.
  - Added NX9 (mobile-specific heat-map paint), NX10 (premium tier),
    NX11 (ground-patrol awareness), NX12 (predictor tuning).
  - Added MN9 (Twitter-X virality push), MN10 (spotter leaderboard
    reaffirmed).
  - Added "Why this exists when FlightRadar24 covers the data"
    section.
  - Tightened MN5 wording to distinguish mainstream tech press from
    rider-community press (welcome).
- 2026-05-01: Post-P11 update —
  - Marked N8 (region selector) and N13 (Nashville geo-fence) as
    ✓ SHIPPED — both cleared review during/after P11 kickoff.
  - Added N15 (per-plane patrol heatmap), N16 (click-to-follow),
    N17 (unified operator/tail filter — markers + heat), N18
    (dashboard restoration + ProximityFlash), N19 (rider-defined
    geofences foundation) — all shipped in P11. Push integration
    for N19 deferred (requires server-side state).
