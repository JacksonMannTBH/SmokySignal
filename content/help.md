# SmokySignal help

A short tour of what SmokySignal shows you, where the data comes from, and how to read each screen.

## What this app is

SmokySignal is a situational-awareness tool for motorcyclists in the Puget Sound region. It tells you, in one glance, whether a known traffic-enforcement aircraft is up and roughly where it's working. The point is to be informed, not to evade — knowing the bird is up is the same as seeing a marked patrol car ahead. Ride within the limit and ride well.

We track 16 fixed-wing planes and helicopters across WSP, KCSO, Pierce SO, Snohomish SO, Spokane SO, and other Washington state agencies. The full list is on the **About** page.

## What's a Smokey?

SmokySignal tracks the law-enforcement aircraft over Washington. Anything in the air with an enforcement mission reads as "Smokey" — that's the umbrella. Underneath, we keep four backend roles so plane-detail pages can tell you exactly what airframe is up.

**SMOKEY (speed enforcement)** — fixed-wing planes, usually Cessnas with FLIR cameras, used for clocking speed from the air. WSP runs five of these. Pierce SO runs one. Pill: SMOKEY UP. Headline: "Smokey's up."

**SMOKEY (patrol helicopter)** — county sheriff helicopters that may be doing traffic, pursuit, or SAR. Same SMOKEY UP pill. Body copy still says "patrol helicopter" so you know the airframe.

**SAR** (search and rescue) — Hueys and similar. Almost always responding to a rescue, not enforcement. Status stays green; we just note the rescue in a footnote.

**TRANSPORT** — state aircraft used for executive transport or aerial photography. Status stays green.

Roles are best-guess from public records. The admin tail editor lets us refine them as we learn. A "(tentative)" suffix on the badge means we're not 100% certain about the classification yet.

## Does this app report me to WSP?

No. SmokySignal is a one-way receiver. We pull public aircraft signals from [adsb.fi](https://adsb.fi) and OpenSky and render them. Your location, your speed, your taps — none of it leaves the device.

There are no rider accounts, no individual analytics, no back channel to any agency. The repository is public; the data flow is fully visible at [/legal](/legal).

If a friend tells you the app secretly snitches when you cross 80, they're working with bad intel. We listen on the open channel. We don't broadcast.

## The home screen

The hero panel is the headline. It always reads as one of three states:

- **SMOKEY UP / Smokey's up.** — A law-enforcement plane is in the air — fixed-wing FLIR or patrol helicopter. Mind the throttle.
- **ALL CLEAR / Smokey's down.** — Nothing alert-class is up. If a SAR or transport aircraft happens to be in the air, you'll see a small footnote.

Below the hero, the **activity strip** shows the most recent state-change event — a takeoff, landing, or emergency squawk. It auto-hides if there's nothing recent (older than 6 hours).

The **also up** card lists every other watcher up right now. Tap any row to open its detail page.

The **next likely sweep** card is a probability prediction based on accumulated takeoff history. It only appears once we've gathered enough data; otherwise the home shows a "still learning" placeholder.

In the top-right, the small **moon icon** toggles a screen wake lock — handy on the bike. Filled with a slash through it means "screen will stay on." Outline crescent means "screen sleeps normally."

## The radar screen

The map is a live view centered on Puget Sound. The status pill at the top mirrors the home screen's state:

- **SMOKEY UP** (amber) — a law-enforcement plane is up (fixed-wing FLIR, patrol helicopter, or unconfirmed alert-class)
- **ALL CLEAR** (green) — nothing alert-class is up

Top-right shows `0/16 UP` — how many of our 16 tracked tails are up right now. The number turns amber any time it's nonzero.

Each up plane appears as an amber chevron pointing along its current heading. Helicopters use a circular rotor icon. Tap a chevron to open the plane detail page.

When something's up, a horizontal carousel slides up from the bottom with one card per plane — quick stats and a tap-target for each.

The **Hot Zones** toggle bottom-left shows a heatmap of where fleet aircraft have spent time over the last 30 days. Brighter = more time. The chevron next to the toggle opens a filter panel:

- **Show**: All / Smokey / By operator
- **Region**: Puget Sound (default) / Statewide

The **Spotted** button (binoculars icon, bottom-right) lets you log an in-person sighting. Tap it once when you actually see a plane, and it records your GPS location and any airborne fleet members visible at the time. Useful for ground-truthing the live data.

The pulsing **blue dot** is your current location.

## The activity feed

Each row is a state-change event for one of our tracked tails. Icons:

- **↗ Takeoff** — was grounded, now up
- **↘ Landing** — was up, now grounded
- **✦ First seen** — newly added tail, already up on first observation
- **⚠ Emergency squawk** — transponder code 7500 / 7600 / 7700

Tap a row to open the plane detail page. The feed polls every 30 seconds while the tab is visible.

## The plane detail page

Each tail has its own page at `/plane/{TAIL}`. It shows:

- **Status pill**: `AIRBORNE · WATCHING` (amber) or `GROUNDED` (green) with last-seen relative time, plus a small role badge ("SMOKEY" for any law-enforcement plane, "SEARCH & RESCUE", or "TRANSPORT")
- **Live data block** (when up): altitude, ground speed, heading, squawk code
- **Recent track**: a real interactive map of the most recent flight session, with a polyline of the path. Pinch to zoom, drag to pan.
- **Session metadata**: first/last seen, duration, sample count, max altitude
- **Fleet metadata**: ICAO24 hex code and operational role

The map shows the in-progress flight if the plane is currently up (with a pulsing end dot), or the most recent completed flight if grounded.

## The forecast

`/forecast` shows a 7×24 grid: probability of any fleet takeoff per hour-of-week. Brighter cells = more historical activity. The current Pacific (day, hour) is outlined in amber. Tap any cell to see which tails most commonly fly in that bucket.

## Why is it still learning?

You'll see a "Learning your sky" panel on the home, radar, or forecast screens until SmokySignal has watched the sky for a full 30 days. We track the start of that window from the first ADS-B sample we ingested — not from when you opened the app — so the timer ticks for everyone in sync.

A month is the floor for these features to mean something:

- **Hot zones** need at least four weekend cycles of patrols before the heatmap settles. Two flights over the same county look like a hot zone after a week and like noise after a month.
- **The forecast grid** needs roughly one observation per hour-of-week before any cell's probability stops jumping around. That's 168 buckets to fill from a fleet of 16 tails.
- **The home prediction card** holds back its "next likely sweep" line until both the day count clears and we've logged enough takeoffs to call a pattern (10+).

The counter on the panel shows where we are in the 30-day window. Past day 30, the panels switch to "30+ days in" and the data-driven cards take over. If a panel still appears past day 30, it means we've crossed the time threshold but the data is still sparse — usually because the sky's been quieter than expected. Give it another week.

## Public flight share pages

Every flight gets a permanent shareable URL: `/flight/{TAIL}/{FLIGHT_ID}`. You can grab it via the **Share** button next to the back link on any plane detail page (and on the admin recent-flights view). The link works without auth and includes a social-friendly preview image.

Flights are kept for 30 days; older ones are pruned automatically.

## Where the data comes from

Aircraft positions are pulled from public ADS-B telemetry. The primary source is [adsb.fi](https://adsb.fi); the fallback is [OpenSky Network](https://opensky-network.org). Both are anonymous, free, and require attribution — provided in the app footer and on the legal page.

The tail registry is built from publicly available state and county fleet records. If you spot a wrong tail or a misclassified aircraft, email **feedback@smokysignal.app**.

We don't use enforcement-tier feeds, FlightAware Pro, ADS-B Exchange premium, or anything not freely available to anyone with a Pi and a dongle.

## Privacy

We don't track who you are or what you do in the app. The only thing that touches our servers is the **Spotted** button — when tapped, it sends your current location plus the timestamp to our database. That data isn't tied to any account or identifier; it's used to validate when planes go silent on ADS-B.

Your screen wake-lock preference and hot-zone filter live in your phone's local storage and never leave the device.

## Troubleshooting

- **The hot-zones heatmap is empty.** Either we're inside the 30-day learning window (see "Why is it still learning?" above), or your filter is narrow enough that nothing matches — try widening the operator or region.
- **The map shows "MapTiler key missing."** The deployment is missing its `NEXT_PUBLIC_MAPTILER_KEY` environment variable. The app still works, but maps won't render.
- **"Couldn't get a fix" when tapping Spotted.** Your browser's location permission is denied or your GPS is having a moment. Allow location access for `smokysignal.app` in browser settings.
- **The activity feed is empty.** Either no fleet member has had a state change recently, or — if it's been many hours — the cron job that refreshes the snapshot may be on its daily schedule. Activity events fire once per snapshot refresh.

## Project info

SmokySignal is a personal/hobby project. Source: [github.com/adavenport-ops/SmokySignal](https://github.com/adavenport-ops/SmokySignal). Bug reports and corrections to [feedback@smokysignal.app](mailto:feedback@smokysignal.app). See [Legal](/legal) for disclaimers and attribution.
