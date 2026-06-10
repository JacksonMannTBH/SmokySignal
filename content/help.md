# SmokySignal help

A short tour of what SmokySignal shows you, where the data comes from, what you can change, and what to do when something looks wrong.

## What this is

SmokySignal is a situational-awareness tool for motorcyclists in Washington state. It tells you, in one glance, whether a known traffic-enforcement aircraft is up and roughly where it's working. The point is to be informed, not to evade — knowing the bird is up is the same as seeing a marked patrol car ahead. Ride within the limit and ride well.

We track {{TAIL_COUNT}} fixed-wing planes and helicopters across WSP, KCSO, Pierce SO, Snohomish SO, Spokane SO, State of WA, CBP, and USCG. The full list is on the [About](/about) page.

## Status tiers

SmokySignal tracks the law-enforcement aircraft over Washington. Anything in the air with an enforcement mission reads as "Smokey" — that's the umbrella. Underneath, we keep four backend roles so plane-detail pages can tell you exactly what airframe is up.

**SMOKEY (speed enforcement)** — fixed-wing planes, usually Cessnas with FLIR cameras, used for clocking speed from the air. WSP runs five of these. Pierce SO runs one. Pill: SMOKEY UP. Headline: "Smokey's up."

**SMOKEY (patrol helicopter)** — county sheriff helicopters that may be doing traffic, pursuit, or SAR. Same SMOKEY UP pill. Body copy still says "patrol helicopter" so you know the airframe.

**SAR** (search and rescue) — Hueys and similar. Almost always responding to a rescue, not enforcement. Status stays green; we just note the rescue in a footnote.

**TRANSPORT** — state aircraft used for executive transport or aerial photography. Status stays green.

Roles are best-guess from public records. The admin tail editor lets us refine them as we learn. A "(tentative)" suffix on the badge means we're not 100% certain about the classification yet.

## What you can change

Every preference lives on your device — browser localStorage or a non-tracking cookie. Nothing rides home to the server. The home for these toggles is [Settings → Alerts](/settings/alerts).

**Time format** — 24-hour (default, brand spec) or 12-hour. Cookie-backed so server and client render the same value with no hydration flicker.

**Contrast** — Normal (default) or High. Stays dark in either mode; High mode lifts the secondary-text and hairline opacity for legibility under glare or low-vision conditions. Brand alert/clear/sky/warn colors are unchanged so the radar still reads the same.

**Region** — Puget Sound, North Sound, Olympic Peninsula, Southwest WA, Central WA, East WA, or All Washington. Drives where the radar centers. Also adjustable from the radar top-bar dropdown — the two surfaces stay in sync.

**Voice readback** — Toggle on the radar. When armed, the page speaks the headline and tail count any time a state changes. Foreground only — your phone's screen has to be on and the tab visible.

**Proximity ping** — Bell icon on the radar. When armed, plays a short ping any time an alert-tier tail comes within your chosen radius (default 8 nm). Browser-only; uses your device's geolocation.

**Custom zones** — [Settings → Zones](/settings/zones) lets you draw geofences around your home, work, or favorite roads. When a Smokey enters a zone you've armed for alerts, it gets called out.

**Reset all** — At the bottom of [Settings → Alerts](/settings/alerts). Clears every device-side preference and returns to defaults. Push subscriptions stay armed unless you disarm them separately.

## Push notifications

If your browser supports Web Push (Chrome, Firefox, Edge, Android Chrome, iOS 16.4+ in standalone PWAs), you can arm push alerts from the home screen. Tap **Arm alerts**, allow notifications, and choose which tails or roles you want to hear about.

When a Smokey takes off — or enters one of your custom zones — you get a push, even with the tab closed. Quiet hours (22:00–06:00 local) suppress non-critical pushes by default; emergency squawks always come through.

**iOS riders**: web push only works after you've installed SmokySignal to your home screen and opened it from there. The browser's permission prompt won't appear in regular Safari tabs. The "Add to Home Screen" callout walks you through it on first visit.

To disarm: tap the bell again, or revoke notification permission in your browser settings. Disarming locally also removes the subscription from our server.

## Reading each screen

### Home

The hero panel is the headline. It always reads as one of three states:

- **SMOKEY UP / Smokey's up.** — A law-enforcement plane is in the air — fixed-wing FLIR or patrol helicopter. Mind the throttle.
- **ALL CLEAR / Smokey's down.** — Nothing alert-class is up. If a SAR or transport aircraft happens to be in the air, you'll see a small footnote.

Below the hero, the **activity strip** shows the most recent state-change event — a takeoff, landing, or emergency squawk. It auto-hides if there's nothing recent (older than 6 hours).

The **also up** card lists every other watcher up right now. Tap any row to open its detail page.

The **next likely sweep** card is a probability prediction based on accumulated takeoff history. It only appears once we've gathered enough data; otherwise the home shows a "still learning" placeholder.

In the top-right, the small **moon icon** toggles a screen wake lock — handy on the bike. Filled with a slash through it means "screen will stay on." Outline crescent means "screen sleeps normally."

### Radar

The map is a live view of Washington state. The status pill at the top mirrors the home screen's state:

- **SMOKEY UP** (amber) — a law-enforcement plane is up (fixed-wing FLIR, patrol helicopter, or unconfirmed alert-class)
- **ALL CLEAR** (green) — nothing alert-class is up

Top-right shows `0/{{TAIL_COUNT}} UP` — how many of our {{TAIL_COUNT}} tracked tails are up right now. The number turns amber any time it's nonzero.

Each up plane appears as an amber chevron pointing along its current heading. Helicopters use a circular rotor icon. Tap a chevron to open the plane detail page.

When something's up, a horizontal carousel slides up from the bottom with one card per plane — quick stats and a tap-target for each.

The **Hot Zones** and **Flight Paths** toggles bottom-left show 30-day historical density and the live flight-path threads, respectively. Each toggles independently. The chevron next to them opens a filter panel where you can narrow by category (Smokey / Search & Rescue / Transport), operator, or specific tail.

The **Spotted** button (binoculars icon, bottom-right) lets you log an in-person sighting. Tap it once when you actually see a plane, and it records your GPS location and any airborne fleet members visible at the time. Useful for ground-truthing the live data.

The pulsing **blue dot** is your current location.

### Activity

Each row is a state-change event for one of our tracked tails:

- **Takeoff** — was grounded, now up
- **Landing** — was up, now grounded
- **First seen** — newly added tail, already up on first observation
- **Emergency squawk** — transponder code 7500 / 7600 / 7700

Tap a row to open the plane detail page. The feed polls every 30 seconds while the tab is visible.

### Plane detail

Each tail has its own page at `/plane/{TAIL}`. It shows:

- **Status pill**: `AIRBORNE · WATCHING` (amber) or `GROUNDED` (green) with last-seen relative time, plus a small role badge ("SMOKEY" for any law-enforcement plane, "SEARCH & RESCUE", or "TRANSPORT")
- **Live data block** (when up): altitude, ground speed, heading, squawk code
- **Recent track**: a real interactive map of the most recent flight session, with a polyline of the path. Pinch to zoom, drag to pan.
- **Session metadata**: first/last seen, duration, sample count, max altitude
- **Fleet metadata**: ICAO24 hex code and operational role

The map shows the in-progress flight if the plane is currently up (with a pulsing end dot), or the most recent completed flight if grounded.

### Forecast

`/forecast` shows a 7×24 grid: probability of any fleet takeoff per hour-of-week. Brighter cells = more historical activity. The current Pacific (day, hour) is outlined in amber. Tap any cell to see which tails most commonly fly in that bucket.

## Sharing flights

Every flight gets a permanent shareable URL: `/flight/{TAIL}/{FLIGHT_ID}`. You can grab it via the **Share** button next to the back link on any plane detail page (and on the admin recent-flights view). The link works without auth and includes a social-friendly preview image.

Flights are kept for 30 days; older ones are pruned automatically.

## Why we don't track you

SmokySignal is a one-way receiver. We pull public aircraft signals from [adsb.fi](https://adsb.fi) and OpenSky and render them. Your location, your speed, your taps — none of it leaves the device.

There are no rider accounts, no individual analytics, no back channel to any agency. The repository is public; the data flow is fully visible at [/legal](/legal).

If a friend tells you the app secretly snitches when you cross 80, they're working with bad intel. We listen on the open channel. We don't broadcast.

The only thing that touches our servers is the **Spotted** button — when tapped, it sends your current location plus the timestamp to our database. That data isn't tied to any account or identifier; it's used to validate when planes go silent on ADS-B.

Your wake-lock preference, hot-zone filter, region, time-format, contrast, voice and proximity toggles, and custom zones all live on your phone's local storage or in non-tracking cookies, and never leave the device. Push subscriptions are the one exception — Web Push requires your browser endpoint server-side. We treat it as PII-equivalent and use it only to send the alerts you asked for.

## Why is it still learning?

You'll see a "Learning your sky" panel on the home, radar, or forecast screens until SmokySignal has watched the sky for a full 30 days. We track the start of that window from the first ADS-B sample we ingested — not from when you opened the app — so the timer ticks for everyone in sync.

A month is the floor for these features to mean something:

- **Hot zones** need at least four weekend cycles of patrols before the heatmap settles. Two flights over the same county look like a hot zone after a week and like noise after a month.
- **The forecast grid** needs roughly one observation per hour-of-week before any cell's probability stops jumping around. That's 168 buckets to fill from a fleet of {{TAIL_COUNT}} tails.
- **The home prediction card** holds back its "next likely sweep" line until both the day count clears and we've logged enough takeoffs to call a pattern (10+).

The counter on the panel shows where we are in the 30-day window. Past day 30, the panels switch to "30+ days in" and the data-driven cards take over. If a panel still appears past day 30, it means we've crossed the time threshold but the data is still sparse — usually because the sky's been quieter than expected. Give it another week.

## Glossary

**ADS-B** — Automatic Dependent Surveillance-Broadcast. The radio signal every modern aircraft transmits with its position, altitude, and identity. Free and public; anyone with a $20 receiver can pick it up.

**ICAO24** — A six-character hexadecimal identifier permanently assigned to each aircraft worldwide (e.g. `A8C7B0`). Doesn't change when a plane is repainted or re-registered, so we use it as the durable key behind the scenes.

**Tail** — A plane's tail number, its civilian registration (e.g. `N305DK`). What's painted on the side. Easier to read than the ICAO24, so it's what most rider-facing UI shows.

**Squawk** — A four-digit transponder code the pilot sets. Most flights use a routine code. Three are emergencies: `7500` (hijack), `7600` (lost comms), `7700` (general emergency). When SmokySignal sees an emergency squawk, the activity feed flags it.

**FLIR** — Forward-Looking Infrared. The thermal imaging camera mounted on speed-enforcement Cessnas. Lets the pilot clock vehicles from altitude.

**Hot zone** — A grid cell where SmokySignal has seen high cumulative aircraft activity over the past 30 days. Brighter on the map = more flight time logged in that cell.

**Flight path** — A live polyline of where a tail has flown during its current session. Different colors per tail.

**Spotted** — A rider's manual sighting log. Tap the binoculars icon on the radar to record your current GPS plus the airborne fleet members at that moment. Used to ground-truth the data.

**Region** — One of seven preset map extents (Puget Sound, North Sound, Olympic Peninsula, Southwest WA, Central WA, East WA, All Washington). Drives radar centering and the home-page distance ring.

**Quiet hours** — A nightly window (22:00–06:00 local) during which non-critical push notifications are suppressed. Emergency squawks always come through.

**Voice mode** — A radar toggle that uses your browser's speech synthesizer to read the headline aloud on every state change. Foreground-only and never sends audio anywhere.

## Where the data comes from

Aircraft positions are pulled from public ADS-B telemetry. The primary source is [adsb.fi](https://adsb.fi); the fallback is [OpenSky Network](https://opensky-network.org). Both are anonymous, free, and require attribution, provided in the app footer and on the legal page.

The tail registry is built from publicly available state and county fleet records. If you spot a wrong tail or a misclassified aircraft, email **feedback@smokysignal.app**.

We don't use enforcement-tier feeds, FlightAware Pro, ADS-B Exchange premium, or anything not freely available to anyone with a Pi and a dongle.

## When something looks wrong

- **The hot-zones heatmap is empty.** Either we're inside the 30-day learning window (see "Why is it still learning?" above), or your filter is narrow enough that nothing matches — try widening the operator or region.
- **The map shows blank tiles.** The public OpenFreeMap style may be unreachable from your network. Refresh once; if it persists, the status page and alerts still work.
- **"Couldn't get a fix" when tapping Spotted.** Your browser's location permission is denied or your GPS is having a moment. Allow location access for `smokysignal.app` in browser settings.
- **The activity feed is empty.** Either no fleet member has had a state change recently, or, if it's been many hours, the cron job that refreshes the snapshot may be on its daily schedule. Activity events fire once per snapshot refresh.
- **Push permission prompt never appears on iPhone.** Web Push on iOS only works inside an installed home-screen PWA. Tap the share icon in Safari, choose "Add to Home Screen," then open SmokySignal from the home-screen icon.
- **A push fired and the alert is no longer airborne when I tap.** Pushes deliver based on what was true at takeoff. Birds land. The radar always reflects current truth — trust the screen, not the notification timestamp.
- **The role badge says "(tentative)".** We're still confirming which mission profile that tail flies. Treat the airframe info as the ground truth, not the role.
- **A tail seems wrong or missing.** Email **feedback@smokysignal.app** with the tail number and what you're seeing. We update the registry from public records and rider reports.

## Project info

SmokySignal is a personal/hobby project. Source: [github.com/adavenport-ops/SmokySignal](https://github.com/adavenport-ops/SmokySignal). Bug reports and corrections to [feedback@smokysignal.app](mailto:feedback@smokysignal.app). See [Legal](/legal) for disclaimers and attribution.
