# How to hand this off to Claude Code

Step-by-step. Follow in order.

---

## 1. Get the bundle onto your machine

Download `design_handoff_smokysignal.zip` from this chat (the download card below this message). Unzip somewhere sensible, e.g.:

```
~/code/smokysignal/
```

The folder you unzip will have `README.md` and a `design/` subfolder.

---

## 2. Create the actual project repo next to it

```bash
cd ~/code
mkdir smokysignal-app
cd smokysignal-app
git init
```

Move the design bundle **inside** the new repo so Claude Code can read it:

```bash
mv ../smokysignal/design_handoff_smokysignal ./design_handoff
```

Your tree should now look like:

```
smokysignal-app/
└── design_handoff/
    ├── README.md
    ├── KICKOFF_PROMPT.md       ← paste this into Claude Code
    └── design/
        ├── SmokySignal.html
        ├── data.jsx
        ├── ui.jsx
        ├── map.jsx
        ├── screens.jsx
        └── tail-numbers-source-photo.jpg
```

---

## 2.5. First-time local dev setup

Once the repo is cloned (or after a fresh `git pull` onto a new machine):

```bash
cd ~/Dev/SmokySignal
npm install
npx vercel link            # one-time. Pick the SmokySignal project.
npm run env:pull           # populates .env.local from Vercel Development scope.
npm run dev                # predev hook checks for missing keys.
```

If `npm run dev` aborts with a missing-env error, follow its instructions — usually it just means re-running `npm run env:pull` after Vercel got new env vars. If `npx vercel` itself errors with "token provided via VERCEL_TOKEN environment variable is not valid," your shell has a stale token set; `unset VERCEL_TOKEN` and try again.

**Map note.** Radar uses OpenFreeMap's public dark style by default. To test a self-hosted style, set `NEXT_PUBLIC_MAP_STYLE_URL` in `.env.local`.

---

## 3. Open Claude Code in that repo

```bash
cd ~/code/smokysignal-app
claude
```

(If you don't have Claude Code yet: https://docs.anthropic.com/en/docs/claude-code/quickstart)

---

## 4. Paste the kickoff prompt

Open `design_handoff/KICKOFF_PROMPT.md`, copy its contents, paste into Claude Code as your first message. It tells Claude Code exactly what to read, what to build first, and where to stop and ask you.

The first thing Claude Code will do is read `design_handoff/README.md` end-to-end. Let it. Don't skip ahead.

---

## 5. Before you let it write code, you'll need

- **A Vercel account** (free) — https://vercel.com/signup
- **Node 20+** locally
- **The Vercel CLI** — `npm i -g vercel`
- **Decide on auth for the admin tail editor.** Easiest v1: a single passcode in an env var. Claude Code will ask.

You don't need adsb.fi or OpenSky keys — both are anonymous-friendly for the volume this app will use.

---

## 6. Verify the tail registry against FAA

Before going live, open `design_handoff/design/tail-numbers-source-photo.jpg`, transcribe each N-number into Claude Code, and ask it to check each against `registry.faa.gov`. The printed list may have stale entries — Cessnas get sold.

---

## 7. Ship it

After Claude Code has the Glanceable home + `/api/aircraft` working locally:

```bash
vercel link    # connect to a new Vercel project
vercel env add MAPTILER_KEY
vercel env add ADMIN_PASSCODE
vercel --prod
```

KV: from the Vercel dashboard → Storage → Create KV. Claude Code knows how to wire `@vercel/kv` once the binding exists.

---

## 8. PWA install

Once it's deployed, on iPhone: open in Safari → Share → Add to Home Screen. That gives you push, full-screen, and the home-screen icon. No App Store needed for v1.

---

## What to do if Claude Code goes off the rails

- It writes too much before you've seen anything render → tell it to stop and just get the Glanceable home rendering against mock data first.
- It invents new colors or fonts → point it back at the **Design tokens** section of `README.md`.
- It tries to OCR the tail-number photo → tell it no, you'll transcribe by hand.
- It tries to ship background geolocation on iOS → remind it that's foreground-only without a native shell; that's a v2.

---

## Where to come back here

Anytime you want to:
- Explore a new screen or flow as a design before building it
- Iterate on visuals (color, type, layout) — that's faster here than in code
- Spec a v2 feature

Bring screenshots from the deployed app back into a new chat and we'll mock the next iteration.
