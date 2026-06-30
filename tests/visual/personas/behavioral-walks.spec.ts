// Behavioral persona walks. Static walks (run-walk.ts) load and review
// each route once. Behavioral walks attempt a goal — tap something,
// scroll, fill a form — and emit an action log + final-state screenshot
// for downstream review.
//
// Each test below codifies one (persona, route, goal) tuple. Steps are
// deterministic Playwright interactions; the review pass is the same
// claude --print pipeline used by static walks (skipped here when no
// auth — the action log alone is the artifact). Phase 1's PR workflow
// runs this spec alongside static walks; Phase 2's nightly sweep runs
// it against prod.

import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.env.SS_VISUAL_BASE_URL ?? "https://smokysignal.app";
const STAMP = process.env.PERSONA_WALK_STAMP ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_ROOT = path.resolve(__dirname, "..", "out", "behavioral-walks", STAMP);
fs.mkdirSync(OUT_ROOT, { recursive: true });

type ActionLog = {
  persona: string;
  route: string;
  goal: string;
  steps: Array<{ at: number; action: string; outcome: string; screenshot?: string }>;
  finalState: string;
  goalReached: boolean;
};

async function shot(page: Page, persona: string, route: string, label: string): Promise<string> {
  const safeRoute = route.replace(/[^A-Za-z0-9_-]/g, "_") || "home";
  const file = path.join(OUT_ROOT, `${persona}_${safeRoute}_${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(OUT_ROOT, file);
}

function writeLog(log: ActionLog) {
  const safeRoute = log.route.replace(/[^A-Za-z0-9_-]/g, "_") || "home";
  fs.writeFileSync(
    path.join(OUT_ROOT, `${log.persona}_${safeRoute}.json`),
    JSON.stringify(log, null, 2),
  );
}

test.describe("behavioral persona walks", () => {
  test.use({ baseURL: BASE });

  test("sport-bike-rider × / — 'Tap Arm Alerts. Walk through the opt-in flow.'", async ({
    page,
  }) => {
    const log: ActionLog = {
      persona: "sport-bike-rider",
      route: "/",
      goal: "Tap Arm Alerts. Walk through the opt-in flow as if you actually want push enabled.",
      steps: [],
      finalState: "",
      goalReached: false,
    };
    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    log.steps.push({
      at: Date.now() - t0,
      action: "load /",
      outcome: "home loaded",
      screenshot: await shot(page, log.persona, log.route, "01-home"),
    });

    const armCta = page.locator('a[href="/settings/alerts"]:has-text("Arm")').first();
    const armExists = (await armCta.count()) > 0;
    if (!armExists) {
      log.steps.push({
        at: Date.now() - t0,
        action: 'find "Arm alerts" CTA',
        outcome:
          "CTA absent — Arm-alerts surface may be the iOS install prompt or the blocked-state. Goal cannot proceed in this UA.",
      });
      log.finalState = "no Arm CTA on /";
      writeLog(log);
      return;
    }

    await armCta.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    log.steps.push({
      at: Date.now() - t0,
      action: "tap Arm CTA → /settings/alerts",
      outcome: `landed on ${page.url().replace(BASE, "")}`,
      screenshot: await shot(page, log.persona, log.route, "02-alerts-page"),
    });

    const text = await page.locator("main").innerText();
    log.goalReached = /alerts/i.test(text) && /enable|arm|allow|notification/i.test(text);
    log.finalState = log.goalReached
      ? "/settings/alerts reached with arm/notification UI visible"
      : "/settings/alerts loaded but expected UI not detected";
    writeLog(log);
    expect(log.goalReached).toBe(true);
  });

  test("skeptic × /legal — 'Read until you decide whether you trust the data flow.'", async ({
    page,
  }) => {
    const log: ActionLog = {
      persona: "skeptic",
      route: "/legal",
      goal: "Read until you decide whether you trust the app's data flow. Note where you got skeptical.",
      steps: [],
      finalState: "",
      goalReached: false,
    };
    const t0 = Date.now();
    await page.goto("/legal", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    log.steps.push({
      at: Date.now() - t0,
      action: "load /legal",
      outcome: "legal loaded",
      screenshot: await shot(page, log.persona, log.route, "01-top"),
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    log.steps.push({
      at: Date.now() - t0,
      action: "scroll to bottom",
      outcome: "fully read",
      screenshot: await shot(page, log.persona, log.route, "02-bottom"),
    });
    const text = await page.locator("main").innerText();
    const mentionsNoAccount = /no account|no sign[- ]?in|no login/i.test(text);
    const mentionsDataSources = /adsb\.fi|opensky/i.test(text);
    const mentionsRetention = /retain|delete|keep|store/i.test(text);
    log.goalReached = mentionsNoAccount && mentionsDataSources;
    log.finalState = `noAccount=${mentionsNoAccount} dataSources=${mentionsDataSources} retention=${mentionsRetention}`;
    writeLog(log);
    expect(mentionsDataSources).toBe(true);
  });

  test("lurker × / — 'You just heard about this app. Decide if you'd install in 90 seconds.'", async ({
    page,
  }) => {
    const log: ActionLog = {
      persona: "lurker",
      route: "/",
      goal: "You just heard about this app. Decide if you'd install it within 90 seconds.",
      steps: [],
      finalState: "",
      goalReached: false,
    };
    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    log.steps.push({
      at: Date.now() - t0,
      action: "land on /",
      outcome: "first impression captured",
      screenshot: await shot(page, log.persona, log.route, "01-arrival"),
    });
    const aboutLink = page.locator('a[href="/about"]').first();
    if ((await aboutLink.count()) > 0) {
      await aboutLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
      log.steps.push({
        at: Date.now() - t0,
        action: "tap About",
        outcome: `landed on ${page.url().replace(BASE, "")}`,
        screenshot: await shot(page, log.persona, log.route, "02-about"),
      });
    }
    const aboutText = await page.locator("main").innerText();
    const mentionsLore = /Bird|Channel 19|campaign hat/i.test(aboutText);
    log.goalReached = mentionsLore;
    log.finalState = mentionsLore
      ? "lurker would install — lore landed in <90s"
      : "lurker bounces — about page failed to deliver the why";
    writeLog(log);
    expect(mentionsLore).toBe(true);
  });
});
