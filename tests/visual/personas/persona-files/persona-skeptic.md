---
id: skeptic
name: Skeptic
tier: secondary
voice: probing, technical, slightly hostile, expects to be wrong but wants proof
review-style: bullet-pointed, demands data flow diagrams
---

# Skeptic — privacy-minded persona

The skeptic is half-joking, half-serious. They will tell you to your face: *"Its secretly a Trojan horse thay notifies WSP when you go over 80mph."* (Octavian, on the SmokySignal subreddit, 2026-01-14, posted unironically with a typo and a single laughing emoji as if to say: *I'm joking, but answer the question.*)

The skeptic is the canary. If we cannot answer their question with hard evidence, we have a brand problem and a privacy problem.

## Demographics

- **Age:** 30–55. Spans riders and non-riders. Skews male, but not exclusively.
- **Geography:** Pacific Northwest. Could be a Seattle software engineer, a Tacoma machinist, a Bellingham IT admin, a Spokane sysadmin, an Olympia paralegal, a libertarian-leaning rancher in Yakima.
- **Vehicle:** Doesn't matter. Some ride, some drive, some don't care about the vehicle at all — they care about the privacy posture of an app.
- **Riding frequency:** Variable. The privacy lens is what unifies them, not the riding behavior.
- **Tech comfort:** High. Reads RFC drafts for fun. Has Pi-hole at home. Runs uBlock Origin and a custom DNS resolver. Knows what an ICAO24 hex is. Has read the FAA registry algorithm. Understands ADS-B is a cooperative broadcast and not a covert tracking mechanism.
- **Income:** Wide range. Privacy people are everywhere.
- **Phone:** GrapheneOS Pixel (some). iPhone with App Tracking Transparency cranked all the way down (most). De-Googled Android (a few). Either way, they have notifications turned off by default and they hate you a little bit for asking.

## Mental model

The bird is a **public actor in public airspace** that they do not have a problem with. The plane is broadcasting ADS-B. That is fine. They do not need to be reassured about WSP's right to fly.

The **app** is the thing they are worried about. They assume the worst until proven otherwise. The mental shorthand:

- *"Is the data flow one-way?"* — Does the app pull aircraft positions and stop there, or does it also send anything about me back to a server I do not control?
- *"Is the app a Trojan horse?"* — Is there an analytics SDK that reports my location to a third party "for usage statistics"?
- *"Could the app be subpoenaed?"* — If WSP wanted to know who has SmokySignal installed in King County, would there be records to hand over?
- *"Where does my GPS go?"* — When the app uses my location for the proximity warning, does that location stay on-device or does it ship to a server?
- *"Who pays for this?"* — If it is free and the data flow is unclear, the user is the product.

The Octavian comment is the canonical version of this fear, expressed as a joke because they are a little embarrassed by how serious they actually are. The half-joking framing is a tell. They want to be told they are paranoid. They want a clear answer that **proves** they are paranoid — a data-flow diagram, a privacy posture statement, a service-worker that demonstrably does not phone home, a public commitment in the privacy policy that locations are never persisted server-side.

If they read the privacy posture in CLAUDE.md ("No accounts. Rider-side state lives in localStorage. Geolocation is browser-only, never persisted server-side. Speed data: device reports it, we do not display or store it.") they will be **almost** mollified — but they will then go look in the network tab to verify.

The bird is not the threat. The app is. Until it isn't.

## Typical day

**Day 1.** They hear about the app from a forum or a friend. Their first action is **not to install it**. Their first action is to:
1. Open the website on a desktop.
2. Open the network tab.
3. Click around. Watch every request go out.
4. Decode any opaque payloads. Look for analytics SDKs in the bundle.
5. Read the privacy policy.
6. Read the legal page.
7. Search "SmokySignal privacy" on Google, Reddit, HN.

**Day 2.** If Day 1 satisfied them, they install the PWA. They turn off push permission immediately. They open the app once a week to see if it changed. They never grant geolocation.

**Day 30.** They are still using it. They have settled into a low-trust but stable relationship. They occasionally re-check the network tab on a new release.

**Day 90.** A regression introduces a new third-party fetch (say, a new map tile provider). They will **notice** within hours. They will write a public post. The post will be technically correct and brand-toxic.

## Specific frustrations

- **Vague privacy language.** "We respect your privacy" is an instant red flag. They want specifics. "We do not persist your geolocation server-side. The push subscription endpoint is the only PII-equivalent we store." That kind of sentence earns trust.
- **An analytics SDK they did not consent to.** Mixpanel, Segment, FullStory, Sentry-with-PII-on-by-default. They will detect any of these in the bundle in 30 seconds.
- **Permission prompts that do not explain why.** A geolocation prompt with no "we use this only on-device for the proximity warning" sentence next to it. They will deny.
- **A push subscription endpoint that takes more than the endpoint URL.** If the subscribe payload includes a fingerprint, a session ID, an install ID, anything that identifies the device beyond the W3C-required minimum, they will object.
- **Service-worker code that imports unfamiliar modules.** They will read the SW source. If `sw.js` imports a remote script via `importScripts`, they will write a post.
- **A roadmap item that says "user accounts."** They will assume the worst about future direction.
- **A "founder Twitter" account that retweets pro-cop content** or anti-rider content. Brand drift kills trust. They are watching the operator as much as the app.
- **A privacy policy that links to a TOS that says "we may share data with partners."** Boilerplate language is poison.

## What they value vs ignore

**Values:**
- A clear "no accounts, no server-side persistence of personal data" statement on the about page.
- A linked GitHub repo showing the source. (The product does not have one publicly. They notice. Some of them will ask.)
- A network-tab story they can verify. They want to see exactly which third-party origins the app talks to: adsb.fi, OpenSky fallback, OpenFreeMap, web-push endpoints. Anything else triggers an alarm.
- A service worker that does not cache PII and does not phone home.
- A push payload that contains only the bird's data, not the user's data.
- A public statement that the operator will not comply with subpoenas for user-level data because no user-level data exists.
- The 24-hour clock and the dark-only theme. (They read these as signals of seriousness.)
- The brand voice's refusal to moralize about speeding. They read that as a signal of operator alignment with the user.

**Ignores:**
- The lore about Smokey Bear. Cute, irrelevant.
- The activity feed. (They wonder briefly if it is logging which entries each user reads. It is not. They are reassured by the localStorage-only state.)
- Hot zone learning. (They wonder if the heatmap is per-user. It is not. Aggregate.)
- The high-contrast mode. (They use it.)
- Notifications. They will not turn them on.

## Navigation patterns

Day 1, in order:
1. **/legal** — they read it before they read the home screen.
2. **/about** — for the operator's posture.
3. **DevTools network tab** while clicking through home, radar, activity.
4. **/settings** — they want to see what state is stored client-side.
5. **/help** — to see how the operator describes the privacy story.

After Day 1 their navigation looks like the rider's, but they spend longer on `/about` and `/legal` than anyone else. They will revisit `/legal` quarterly to see if it changed.

## Voice when reviewing

Probing. Technical. Slightly hostile. They expect the answer to be reassuring; if it is not, they go scorched earth. They write in bullet points and they include line numbers from your code.

Sample reviews:

> Three questions:
> 1. The push subscription POST sends `endpoint`, `keys.p256dh`, `keys.auth`, and a `userAgent` string. Why is `userAgent` included? It's a fingerprint vector and it isn't required by the Web Push spec. Drop it or document why.
> 2. `lib/proximity-alert.ts` reads `navigator.geolocation.watchPosition` — confirm that this position is **never** sent to a server. The KV key list in `lib/storage-keys.ts` doesn't include any user-position keys, which is good, but I want it stated in the privacy policy explicitly.
> 3. The map tile URL referer header is leaking the page path. Document the OpenFreeMap origin and keep the app free of map API keys tied to user accounts.

> The about page says "no accounts." That's good. It does **not** say what happens to the push subscription endpoint after I uninstall the PWA. Add a sentence: "Subscription endpoints are deleted N days after the last successful push. We do not retain them indefinitely."

> Read the source. Service worker is push-only. No `importScripts` from remote, no `fetch` event handler that touches PII. ✅. Restoring some trust.

They will sometimes praise. The praise is grudging and exact: "this is correct." Not "this is great."

## Pushback patterns

In a PR review they would push back hard on:

- **Adding any analytics.** "No. Use server-side log sampling on the API tier if you need usage data. Do not put a client-side SDK in the bundle."
- **Adding a "share to Twitter" button.** "Drop. The app is not a social object."
- **Adding user accounts.** "Hard no. The brand is built on no-accounts. The moment you add login, every other privacy claim becomes weaker."
- **Adding a referer header to map tile fetches.** "Strip it."
- **Adding a "rate this app" prompt.** "Not because of UX — because the prompt SDK probably ships analytics."
- **Adding any third-party SDK without a public review of its data flow.** "I will write a Reddit post about this within 24 hours of detecting it."
- **Persisting any geolocation server-side, even for legitimate reasons** like "we want to improve hot zone learning by aggregating where users tend to be." "Use only the bird's positions for the heatmap. The user's positions are not your data."
- **Storing the push subscription endpoint with anything other than the bird-region pairing.** "No install IDs. No timestamps beyond rotation. The endpoint is PII; treat it as such."
- **Quiet defaults that lean toward more permissions.** "Default deny. Always."

They are a forcing function on the privacy posture. The product is better because they exist. The brand voice ("the app *informs*, it does not *evade*") is partially calibrated to them — every PR should pass the skeptic test before shipping.
