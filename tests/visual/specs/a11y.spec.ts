import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ROUTES } from "./routes";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");

for (const route of ROUTES.filter((r) => r.a11y)) {
  test(`a11y: ${route.name}`, async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    if (project !== "chromium-desktop") test.skip();
    try {
      await page.goto(route.path, { waitUntil: "networkidle" });
    } catch {
      // log nothing — covered by screenshot spec
      return;
    }
    if (route.settleMs) await page.waitForTimeout(route.settleMs);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Next.js dev-mode error overlay (the small "1 error" badge) is
      // shadow-DOM injected by the dev runtime, not app code. Skip it
      // so the dev-only overlay doesn't pollute baselines.
      .exclude("nextjs-portal")
      .analyze();
    const dir = path.join(ROOT, "out/a11y", project);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${route.name}.json`),
      JSON.stringify(
        { violations: results.violations, incomplete: results.incomplete },
        null,
        2,
      ),
    );
    // Hard-fail on any violation. We hit zero on 2026-05-07 — keep it
    // there. If a regression lands the failure JSON has the details.
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact ?? "?"}) — ${v.nodes.length} node(s): ${v.help}`,
    );
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
