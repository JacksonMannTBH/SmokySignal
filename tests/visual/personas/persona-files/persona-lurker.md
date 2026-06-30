---
id: lurker
name: The lurker
tier: silent-majority
voice: never speaks; we infer from their absence
review-style: bounce rate, install-vs-subscribe ratio, never a written word
---

# The lurker — silent majority

The lurker has heard about SmokySignal. From a friend at a track day. From a Reddit post in r/motorcycles. From a forum thread on r/Seattle or r/PNWmotorcycles. From a sticker on a tank-bag. They opened the link. They looked. They closed.

They did not install. They did not subscribe. They did not write feedback. They are the **silent majority of would-be users**, and we will never hear from them directly. The persona file is exclusively about **inference**.

## Demographics

- **Age:** Wide. Mostly 25–55.
- **Geography:** Some are in Puget Sound and would actually use the app daily if they got past the friction. Some are out-of-region, would-be onlookers who could not get the app to do anything for them on the home screen.
- **Vehicle:** Some are riders, some drivers, some neither. The lurker bucket is heterogeneous.
- **Riding/driving frequency:** Whatever. The lurker is defined by what they did not do, not what they ride.
- **Tech comfort:** Variable. Some are low-tech and the PWA install was confusing. Some are high-tech and bounced because the app did not pass their personal smell test in 3 seconds.
- **Income:** Wide.
- **Phone:** Wide.

## Mental model

The lurker has a half-formed mental model. Possibilities:

1. **"Cool, but not for me."** They are not a rider, not a driver who cares, not in PT. The app is a curiosity. They closed the tab.
2. **"Cool, but I'll come back later."** They saw the home screen, registered "this is a thing," intended to install on their phone later, and forgot.
3. **"Looks sketchy."** They saw "no accounts" and read it as "amateur" rather than "principled." Or they saw the dark theme and read it as "unfinished" rather than "intentional." They bounced for taste reasons we cannot directly fix.
4. **"I'm scared of the install flow."** They are on iOS Safari. They do not know what "Add to Home Screen" means. They saw the IOSInstallPrompt and got intimidated. They bounced.
5. **"What does it do?"** The home screen did not communicate the value proposition fast enough. They were expecting a marketing page and got a status pill. They were confused. They left.
6. **"I'm not a speeder."** They read the brand voice and thought it was for criminals. The framing did not land that the app *informs* rather than *evades*. They left feeling vaguely judged.
7. **"This is going to send me notifications I don't want."** They saw a permission prompt on first load, denied it, lost trust, closed the tab.

We do not know which of these is the dominant case. The persona is an exercise in **planning the funnel** so each of these failure modes has a fix.

## Typical day

The lurker's "typical day" is **the moment they hit the app** — usually once, briefly, sometimes a second time months later if reminded.

**Encounter 1: linked from a friend's text.** They are on iOS Safari, on the couch, on a Saturday morning. The friend has texted: "this is the app I was telling you about." They tap the link. They land on `/`. They see the home screen. They scroll. They see status, maybe a corridor, maybe a radar tile preview. They do not install. They close the tab.

**Encounter 2: searched after a Reddit thread.** They are at their desk on a Wednesday at 11 AM. They saw a Reddit comment: "smokysignal.app — tracks WSP planes, no account, dark mode." They opened it on a desktop. They saw a status pill. They thought "interesting." They closed the tab.

**Encounter 3 (rare): six months later, with intent.** They got a ticket. They are mad. They Google "WSP plane tracker." They land back on SmokySignal. They install this time, because they have a reason now.

The lurker's funnel from awareness → install → subscribe → return-user is **the most leveraged metric the product has**. We do not currently measure it because we do not have analytics — and the privacy posture means we are not going to install analytics. The proxy is **install events** in push subscription logs, and we cannot disambiguate that from "user re-installed after uninstalling."

## Specific frustrations

These are inferred from common funnel failure modes in PWAs:

- **No clear "what is this app" moment in the first viewport.** They want one sentence: "Live tracking of WSP aviation. No account, dark mode, glance-able." If the home screen is a status pill with no context, half of them bounce. (The hero copy on `/` should pass this test — currently it largely does.)
- **iOS Add-to-Home-Screen is confusing.** The IOSInstallPrompt helps, but it is still a multi-step flow that depends on the user knowing what the share button looks like. A persistent fraction of iOS lurkers never get past this.
- **They cannot tell if the bird is up "right now" or "in general."** If the status copy is ambiguous, they assume the worst.
- **They do not understand the "learning your sky" empty state.** If the forecast is sparse because we do not have enough takeoff history yet, they read it as "broken" not "learning."
- **The push permission prompt scared them off.** If we ask for it on cold start, they deny and they leave.
- **The dark theme reads as unfinished to a non-tech taste.** A specific subset of lurkers — older, less tech-y — sees a dark UI and thinks "unstyled" rather than "designed." There is no fix; we accept this loss in service of the rider.
- **The about page tells the story but is two clicks away.** Some lurkers needed the lore on the home screen, even just one line, to understand what they were looking at.
- **The 24-hour clock reads as foreign.** A subset of lurkers see "15:42" and bounce because they do not parse it instantly. The 12-hour toggle helps but is in settings, which they will never reach.

## What converts them

Inferred conversion patterns. The product has a real shot at converting if:

- **The first viewport answers "what is this and is it for me."** The status pill alone is too lean. A subhead — "WSP aviation, live, Puget Sound" — does most of the work. (The current `/` design largely has this; check it stays.)
- **The install affordance is patient.** The IOSInstallPrompt should appear after the user has spent ≥5s on the page, not on cold start. Lurkers who scroll a little are warmer than lurkers who land.
- **Push permission is asked only when the user toggles the alerts toggle.** The ArmAlertsCallout pattern is correct. Do not regress.
- **The "learning your sky" copy is honest and specific.** "Day 12 of 30. Patterns are forming." reads as competence, not as broken.
- **The about page lore is one tap from the home screen.** A "why Smokey" link in the footer or header is enough. Lurkers who read the lore convert at a higher rate because the brand carries them past the friction.
- **The tail registry includes recognizable names.** "Smokey," "Smokey 2," etc. read as legitimate. A registry full of N-numbers and no nicknames reads as raw data, which only the skeptic will trust.
- **The privacy posture is one click from the home screen.** "No account, no tracking, dark mode" as a footer line gives the lurker permission to install.
- **The shareable URL is clean.** "smokysignal.app" is shareable. If the URL drifts (subdomains, query parameters), share rates drop.

## What never converts them

- **Locking content behind a sign-up.** The product has none of this. Keep it.
- **Push permission on cold start.** Currently we don't. Keep not.
- **A loading screen that takes >2s.** Lurkers do not wait.
- **Anything that asks them to subscribe to a newsletter.** Hard pass; we do not do this. Keep not.
- **A "limited time" banner.** Anti-brand. Will not happen.

## Navigation patterns (inferred)

- **Land on `/`.** That's it for 60–80% of them.
- **Scroll the home screen.** 30–40% scroll. They see the radar preview / activity feed if it exists below the fold.
- **Click into the about page.** ~15%. These are the warm lurkers; they have a higher install rate.
- **Tap a tail.** ~5%. These are the curious ones; they may install for sport.
- **Tap settings or legal.** ~2%. These are the privacy-adjacent. They are halfway to becoming the skeptic persona.

These are gut-feel funnel numbers; we do not have analytics. The persona reasons in shapes, not measurements.

## Voice when reviewing

Silent. They do not write reviews. They do not fill out surveys. They do not respond to emails because they did not give us an email.

The closest thing to their voice is the **second-degree quote**: "yeah, my buddy showed me that app, looked cool, didn't install it." We hear this in person from time to time. It is, in aggregate, the most important piece of feedback the product gets — and it is unrecorded.

If they did write feedback (they will not), it would sound like:

> Looked cool, didn't really get it. Thanks though.

> Oh that thing? Nah I never installed it.

> I tried to add it to my home screen and got confused.

> What is this for again?

## Pushback patterns

The lurker does not push back in PR reviews because they are not in PR reviews. The PM has to push back on their behalf, with questions like:

- **"Does this PR make the first-viewport story clearer or muddier?"**
- **"Does this PR add friction to the install flow?"**
- **"Does this PR ask for a permission earlier than it needs to?"**
- **"Does this PR shorten or lengthen the time-to-value?"**
- **"Does this PR reduce the share-rate of `/`?"**
- **"Could a non-rider, non-Pacific viewer tell what this app does in 5 seconds?"**

If the answer to any of these is bad, the lurker funnel narrows and the product becomes more cliquish. The lurker's interest is in **the product staying legible to people who have not yet decided to care.** They are the long-tail growth audience. The operator should weigh their interests against the rider's "one viewport, always" rule, and find balance.

## A note on instrumentation

We do not measure lurker behavior because we have no analytics. The privacy posture rules out client-side analytics. Server-side log sampling (anonymized HTTP request rate by route) is permissible and should be used to track:

- `/` hits per day
- Bounce-equivalent (single-route sessions, inferred from IP-rotation buckets)
- `/about` traversal rate
- Push subscription rate
- iOS Install Prompt impressions (currently logged via SW or page-script; verify before relying)

These metrics let us reason about the lurker funnel without identifying anyone. The skeptic persona will tolerate this as long as no PII enters the logs.
