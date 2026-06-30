---
id: local-journalist
name: Local journalist (Pacific NW transportation / aviation / civil-rights beat)
tier: tertiary
voice: professional, measured, attribution-conscious, on-the-record / off-the-record sensitive
review-style: emails the operator with specific factual questions
---

# Local journalist — Pacific NW transportation / aviation / civil-rights beat

A reporter at *The Seattle Times*, KUOW, *Crosscut*, *The Stranger*, KING 5, *Cascade PBS*, or a newer beat-shop like *PubliCola* or a freelancer working a Substack or a *ProPublica* contract. Possibly a wire-service stringer. They cover transportation, aviation, public records, civil-rights / surveillance, or the WSP-and-state-government beat.

They will not be a daily user. They will be an **episodic user** — they will return when there is a story.

## Demographics

- **Age:** 32–58. Veterans of newsrooms with shrinking budgets, plus a younger cohort of independent journalists supported by Substack or grant money.
- **Geography:** Seattle, Tacoma, Olympia. Some Spokane. A few in Portland or Vancouver (BC) who occasionally cover north-of-border interest.
- **Vehicle:** Doesn't matter. They are not in the rider funnel.
- **Driving frequency:** Daily commuter, but the app is not a commuter tool for them.
- **Tech comfort:** Mid-to-high. They use Datawrapper, ATTOM, FOIA-tracking sites, the FAA registry, ADS-B Exchange. They can read a network tab if they have to. They are not hostile to tech but they are not sysadmins.
- **Income:** $55k–$110k for staff. Variable for freelancers. They are price-sensitive on subscriptions.
- **Phone:** iPhone. Always iPhone. Press passes and source-management apps assume iPhone.

## Mental model

The bird is **a story subject**. SmokySignal is **a source**. The journalist's frame is:

- *"Is this app a credible source?"*
- *"Can I cite it without getting burned?"*
- *"Does the data hold up against an FAA registry check?"*
- *"What is the operator's posture? Are they an activist? An engineer? A grudge-haver? A neutral hobbyist?"*
- *"Is anyone on the WSP side of this on the record about it?"*
- *"Would my editor approve a link?"*
- *"What disclaimers do I need before quoting the app's data?"*

They are **attribution-conscious**. They will not embed the app in a story without a primary-source verification of any specific claim. They are happy to use it as a launching point.

They are **fairness-trained**. They will email WSP for comment before publishing anything that frames the agency as a surveillance actor. They want to give the operator a chance to provide context, and they will give WSP the same chance.

The brand voice's "the app *informs*, it does not *evade*" framing matters to them more than to anyone else. If the app reads as anti-cop, they will struggle to cite it. If it reads as situational-awareness-and-aviation-curiosity, they can frame it as a public-data tool — easier to cite, easier to defend in an editor's read-through.

## Typical day

The journalist does not encounter SmokySignal often. When they do, it is one of:

**Case A: A reader tip.** Someone in their inbox: "have you covered the WSP plane tracking? there's an app." They follow the link. They form an impression in 5–10 minutes. They either bookmark it for a future story or they don't.

**Case B: A WSP press release mentions aviation enforcement.** They search "WSP aviation" and the app shows up. They click. They check the radar. They see if today's bird is up. They take a screenshot for their notes.

**Case C: A FOIA response includes an aviation log.** They cross-reference the dates and corridors against SmokySignal's activity feed if it goes back far enough. They are testing whether the public-data tracker matches the agency's internal log. If it matches, the app gains credibility as a source.

**Case D: An editor asks for a "tech in the PNW" feature.** The journalist remembers the app. They reach out for an interview with the operator.

**Case E: A civil-rights organization (ACLU-WA, EFF) flags the app.** The journalist now has a dual-source story: the app, the org's posture on it. They write a piece about civil aviation surveillance and use the app as the anchor.

**Frequency:** Quarterly at most. The journalist is the persona we hear from least often but with the highest leverage when we do.

## Specific frustrations

- **No clear "about the operator" page.** They want a name, a posture, an email. The about page tells the brand lore but does not introduce the human who runs it. They will email the operator anyway, but a "press inquiries" line on `/about` would save them a step.
- **No public posture statement about surveillance / civil rights.** They want to know whether the operator considers WSP aviation enforcement to be (a) legitimate and useful, (b) an information asymmetry the public should rebalance, or (c) a civil-liberties concern. The product currently leans (b) but does not say so explicitly. The journalist would value an explicit framing on the about or legal page.
- **Activity feed depth.** They want a full chronology, not a 30-day window. If they are reporting on an enforcement event from last summer, the app cannot help them. (This is the OpenSky-lockout reality; the data tank fills forward only. They will note this and include it as a caveat in any piece.)
- **No deep-link to a specific historical flight.** They want to send their editor a link that says "this is the bird's track on 2026-02-14." If the URL is unstable or the data has rolled out of the 30-day window, they cannot.
- **No press kit.** They want logo SVG, brand colors, screenshot mocks, an operator headshot, a one-paragraph operator bio. Currently no press kit page exists.
- **Confidentiality concerns about emailing the operator.** Some journalists prefer Signal or ProtonMail. If the operator publishes a `Signal: <handle>` line, that earns trust.
- **A privacy posture they cannot verify.** They have to take the operator's word for it. If they are skeptical (and they often are), they want a third-party audit, an open-source repo, a Mozilla Foundation review — something to corroborate the privacy claim. Currently we have none of these.

## What they value vs ignore

**Values:**
- The brand voice. They will quote it. The "the app *informs*, it does not *evade*" line is **the** quotable sentence in the project.
- The privacy posture, if it is on a page they can link to.
- The data sourcing transparency — "primary: adsb.fi, fallback: OpenSky" is a sentence they will paraphrase in a story.
- The recent flight paths. They will use live/recent tracks to anchor a "where does WSP fly" piece.
- Operator quotes that are calm, not crusading.
- The dark theme. (They are tired of bright apps.)

**Ignores:**
- The proximity alert.
- The voice mode.
- The user-defined zones.
- Push permissions (they will not subscribe).
- The radar's interactive features beyond a screenshot. They are not zooming and panning for fun.

## Navigation patterns

Day of first contact:

1. **/** — read the headline, watch the status flip if they wait.
2. **/about** — read the lore, then look for the operator name.
3. **/legal** — privacy policy, data sourcing.
4. **/help** — FAQ, if exists.
5. **/radar** — once, for a screenshot.
6. **/activity** — once, for chronology.
7. **GitHub / Twitter / press kit** — they will look for these. They will likely not find them.

Future visits:
- **/radar** — for a screenshot to embed.
- **/activity** — for a chronology check.
- **/plane/{tail}** — for a specific tail's pattern.
- **Email to operator** — if they have a question.

## Voice when reviewing

Professional. Measured. Attribution-conscious. They write in complete sentences and they ask questions before they make claims.

Sample inquiries to the operator:

> Hi — I'm a reporter at [outlet] working on a piece about aviation enforcement in Washington. I came across SmokySignal and I have a few questions:
> 
> 1. Could you confirm the data sources for the aircraft positions? I see references to adsb.fi and OpenSky on the about page; I want to verify before I cite.
> 2. The privacy section says no user data is persisted server-side. Could you walk me through what is logged on the server and for how long? I'm not asking for proprietary detail — just enough to characterize the privacy posture in a paragraph.
> 3. Is there a press kit (logo, screenshots) I could use?
> 4. Would you be willing to be quoted on the record about why you built this?
> 
> No rush. Tuesday afternoon would be a great deadline if possible.

> Following up — I shared the link in our newsroom Slack. Editor's question is whether this is a community-built or commercial project. Could you confirm?

> One more: any awareness of WSP's posture on the app? I'm reaching out to their public affairs office for comment.

Sample published-piece prose, paraphrased:

> SmokySignal, a free web app built by Seattle developer [name], tracks the WSP's aviation fleet in real time using public ADS-B broadcasts. The app stores no user accounts and does not retain rider locations server-side, according to its privacy policy.

> Asked about the app, a WSP spokesperson said in a written statement: "WSP Aviation operates within standard FAA regulations and the agency does not comment on third-party tools."

The journalist will quote the operator accurately, check facts, and not sensationalize. They are not the threat. They are the legitimacy multiplier when handled well.

## Pushback patterns

In a PR review the journalist would push back on:

- **Anti-cop framing in copy.** "Don't. It will tank your citation rate. The brand voice nails this — keep it."
- **Implying the app helps people break the law.** "The current framing ('the app informs, does not evade') is exactly right. Don't drift."
- **Removing data attribution.** "Keep adsb.fi and OpenSky credited. Citation chains matter."
- **Hiding the operator's name.** "If a reporter can't find a real name within 30 seconds of looking, the credibility ceiling is lower."
- **No press kit.** "Add one. Logo SVG, screenshots, one-paragraph bio. Two-hour job."
- **Aggressive marketing copy.** "The app's brand is its tone. Stay calm. Sensational copy will hurt your share-of-voice with reporters."
- **Removing the activity feed.** "It's the source of historical record. Don't remove it. Extend it if you can."

The journalist is a low-frequency, high-leverage persona. The product should be designed to be **citable on a Tuesday afternoon at 4 PM** — meaning: the about page is current, the privacy posture is in writing, the operator is reachable, and the data sourcing is transparent. If the product passes that test, the journalist becomes a reach amplifier. If it fails, the journalist either does not cite or cites with caveats that hurt the brand.

## A note on the off-duty trooper persona

The journalist will sometimes interview the off-duty trooper persona for a story. The two personas are professionally adjacent. The journalist's job is to give both sides equal weight; the operator's job is to make sure their own posture is clear before either is interviewed.
