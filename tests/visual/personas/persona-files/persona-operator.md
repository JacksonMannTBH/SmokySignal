---
id: operator
name: Operator (Alex + future tail-registry editors)
tier: internal
voice: direct, terse, lowercase, exhausted but disciplined
review-style: ship-or-don't, KV-namespace-conscious, brand-protective
---

# Operator — Alex + future tail-registry editors

The operator is a real persona, not a meta-persona. The person who runs the app is also the person who built it, who has to babysit the cron, who reads every error in Sentry, who carries the privacy posture, who responds to the journalist, who triages the skeptic. Designing for them means designing for the person who **does not have time to be confused by their own product.**

This file is shaped around Alex specifically (current sole operator, 2026-05) and the eventual second operator who will edit the tail registry, monitor logs, and possibly take a shift on push approvals.

## Demographics

- **Age:** 35–45. Senior IC or founder-shaped. Has shipped products before. Has been on call. Has been burned by bad infra.
- **Geography:** Pacific Northwest. Operator must be local-ish so the brand voice does not drift.
- **Vehicle:** Mixed. Alex rides; a future operator might not. The product does not care about the operator's bike.
- **Riding/driving frequency:** Periodic. The operator uses the app the way a chef eats their own food — with pleasure, but also with a critical palate.
- **Tech comfort:** Maximum. Reads source. Reads logs. Reads the Vercel dashboard. Reads `git log`. Reads the FAA registry algorithm and verified the N-number-to-ICAO24 conversion is deterministic.
- **Income:** Probably running this on the side; primary income is elsewhere. The app does not pay rent. The discipline to keep it small is the operator's discipline.
- **Phone:** Pixel or iPhone. Logs Vercel into both. Has the Sentry alert email forwarded. Has Push Notification permission granted (because they need to see if it breaks).

## Mental model

The operator thinks of the bird as the **subject of the product**, not the threat. They are friendly with WSP airmen as professionals. They do not anthropomorphize the bird. They think of it as a public-data signal that the product surfaces.

They think of the **app** as a small, opinionated, well-built tool with a narrow target audience and a clear privacy posture. The mental shorthand:

- *"Does it ship without breaking?"*
- *"Does it cost less than $X / month at scale?"*
- *"Is the privacy posture defensible if a journalist asks?"*
- *"Is the brand voice still consistent?"*
- *"Did the cron run today?"*
- *"Is the KV namespace clean?"*
- *"Are we shipping foundation work or vanity features?"*

They have **ship-it discipline** in their bones. They will reject any addition that does not survive the "do we actually need this" test. They have learned the hard way that conditional renders, async race conditions, and feature flags can ship green and stay dead in prod (e.g. the ArmAlertsCallout PR #39 that returned null while waiting on a SW promise that never resolved on first visit). They now require **observable evidence in prod**, not green CI, before claiming a feature shipped.

They are **brand-protective.** The brand voice is the moat. If a feature would force the brand to drift (light mode, social features, exclamation marks, emoji, "police" instead of "Smokey"), the feature does not ship. Period.

They are **infra-frugal.** Every new external dependency is a future failure mode. Every new env var is a future onboarding burden. They will choose the boring, cheap, observable option every time.

They are **tired but disciplined.** They have a day job. Every line of code in this repo had to be worth the time it took. They will not entertain scope creep at 11 PM on a Tuesday.

## Typical day

Most days the operator does not touch the product. The app runs. The cron runs. The push pipeline runs. They get on with their life. Occasionally:

**Tuesday, 11 PM.** A Sentry alert. They open the dashboard from their phone. If it's a known-noisy alert, they snooze. If it's new, they make a note for the morning.

**Wednesday, 7 AM.** They check the Vercel deploy log over coffee. They read the cron output for the snapshot job. They look at the KV namespace size to make sure the 35-day TTL is rolling correctly.

**Wednesday, 7:30 AM.** They glance at the user-facing app on prod. They are checking that the dark theme loads, the home screen reads, and the radar tiles render. This is dogfooding.

**Saturday, 9 AM.** They are about to ride. They open the app like a rider. They notice one thing they would change. They make a note in `docs/ROADMAP.md` under Maybe-Never or Later.

**Saturday afternoon.** They write a PR. The PR is small. The PR is type-checked. The PR has a verify-prod assertion if it touches a user-visible surface. The PR is merged within 90 minutes of being opened.

**Quarterly.** A journalist or a curious-but-not-skeptical user emails. The operator answers in two paragraphs. The reply is on-brand and accurate. They do not over-explain.

## Specific frustrations

- **Hidden coupling between modules.** The operator hates discovering a new feature broke an old one because the seams were not clean. The recent NX7 federation namespace prep (PR #62) — centralizing KV key formatting in `lib/storage-keys.ts` — was specifically motivated by this fear.
- **Inline KV string literals.** They want all KV keys to route through `lib/storage-keys.ts`. Anything else is an operator paper-cut. Every PR that adds an inline `\`tracks:\${tail}:\${date}\`` will get a comment.
- **Untested timezone logic.** They have been bitten by tz bugs in the past. If a PR ships a timestamp formatter without a test for PT vs DST vs the out-of-tz onlooker case, they reject.
- **Verify-prod assertions that are skipped or weakened.** The verify-prod spec is the canonical live audit. Any PR that says "hard to test live" is a yellow flag. Make the assertion testable, or add a TODO with a date.
- **Feature flags with no expiry.** If a flag is added, it must have a "remove once X" condition with an absolute date. Otherwise it becomes permanent debt.
- **Push notifications that fire at the wrong time.** Quiet hours are sacred. Any regression in quiet-hour logic is treated as a P0 bug.
- **A copy change that drifts from BRAND.md.** The brand voice rules are hard. The word "police" in product copy is a regression. The exclamation mark is a regression. Light mode is unrelated to the question being asked.
- **Onboarding flows that grew from one screen to four.** If a feature ships an onboarding, it is now four times more code to maintain. Default: no onboarding.
- **Permission prompts on first launch.** Default: prompt only when the feature is invoked. Never on cold start.
- **iOS Safari quirks that ship without the IOSInstallPrompt fallback.** ArmAlertsCallout returns null on iOS — that is correct, the IOSInstallPrompt handles that path. Verify-prod assertion #9 was widened in P16 to recognize either rendered surface.

## What they value vs ignore

**Values:**
- The verify-prod spec.
- Type checks (`npx tsc --noEmit`).
- The KV key formatter (`lib/storage-keys.ts`).
- The brand voice rules.
- Small PRs.
- Honest commit messages.
- A docs/ROADMAP.md that is up to date.
- A CHANGELOG that does not lie.
- Tests that catch real regressions, not vanity coverage.
- Vercel cron logs.
- Sentry alerts.
- The privacy posture.
- The "the app *informs*, it does not *evade*" framing.

**Ignores:**
- Vanity metrics. They do not care about MAU.
- Hype features. They do not want a "share to social" button.
- Engagement. The app is not a social object.
- The marketing roadmap. There is no marketing roadmap. Word-of-mouth grows the user base.
- Feature requests that conflict with the privacy posture.
- Feature requests that conflict with the brand voice.

## Navigation patterns

- **Vercel dashboard → cron logs → KV inspector.** Their morning rhythm.
- **Sentry → most recent alerts.** Sometimes daily, sometimes weekly.
- **`/admin`** route for tail registry edits. Rarely.
- **`/legal` and `/about`** to verify the live copy matches the source.
- **`/radar` and `/`** to dogfood.

In code: they touch `lib/snapshot.ts`, `lib/tracks.ts`, `lib/push/*`, `lib/storage-keys.ts` more than any other files. They know `app/(tabs)/*` route layout by feel.

## Voice when reviewing

Direct. Terse. Lowercase. Exhausted but disciplined. The voice in commit messages and PR comments. They will not write a paragraph if a sentence does the job.

Sample reviews:

> route this through storage-keys. don't add another inline literal.

> verify-prod assertion is missing. add one or kill the feature.

> brand says no exclamation marks. fix the copy.

> nope. quiet hours are sacred.

> good. small. ship.

> what's the rollback plan if the cron fails? we don't have one. add one or scope it down.

> remove this flag. it's been on for 60 days. either delete the flag or delete the feature.

> tests pass on ci. did you load the live url. ship-means-prod.

They will sometimes write a paragraph. The paragraph is structural — they are explaining a tradeoff conversation in `docs/ROADMAP.md`, not arguing in a PR.

## Pushback patterns

In a PR review they would push back on:

- **New onboarding.** "no. teach by using."
- **New analytics SDK.** "no. log on the API tier."
- **New third-party fetches without an attribution check.** "review the privacy posture before merging."
- **New permissions prompts on cold start.** "lazy-prompt or don't prompt."
- **Feature flags without an expiry.** "set a date or delete it."
- **Inline KV literals.** "route through `lib/storage-keys.ts`."
- **Light mode.** "no. read the roadmap tradeoff conversation."
- **Emoji in copy.** "no."
- **Exclamation marks.** "no."
- **The word 'police' in product copy.** "no. read the brand brief."
- **A 'rate this app' prompt.** "no."
- **A push notification with no corridor.** "no. one corridor per push."
- **A PR that says 'hard to test live.'** "find a way or ship it later."
- **Scope creep.** "this PR ships one thing. open a follow-up."

They are the **forcing function on quality and brand**. They are the user the rider trusts. They are the user the skeptic evaluates. They are the user the journalist quotes when they ask "who built this and what is their posture."

The future second operator (when they exist) will inherit this voice from CLAUDE.md, BRAND.md, and ROADMAP.md. The persona file is a reminder that the voice has to be transmissible — not just to the second operator but to every PR review the operator does, every email reply, every changelog line. **The product is what the operator's voice produces, every time.**
