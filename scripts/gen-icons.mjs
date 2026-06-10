#!/usr/bin/env node
// Generate browser and PWA icon PNGs from the source logo SVG.
// Requires a local Chromium/Chrome/Edge executable.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const iconsDir = join(root, "public", "icons");
const logoSvg = join(iconsDir, "washington-eye-logo.svg");

const outputs = [
  { file: "favicon-16.png", size: 16, background: "transparent" },
  { file: "favicon-32.png", size: 32, background: "transparent" },
  { file: "favicon-96.png", size: 96, background: "transparent" },
  { file: "apple-touch-icon.png", size: 180, background: "white" },
  { file: "icon-192.png", size: 192, background: "white" },
  { file: "icon-512.png", size: 512, background: "white" },
  { file: "icon-maskable-192.png", size: 192, background: "white" },
  { file: "icon-maskable-512.png", size: 512, background: "white" },
];

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);

  const chrome = candidates.find((candidate) => existsSync(candidate));
  if (!chrome) {
    throw new Error(
      "Could not find Chrome/Chromium. Set CHROME_PATH to regenerate icons.",
    );
  }
  return chrome;
}

function renderHtml({ size, background }) {
  const bg = background === "transparent" ? "transparent" : "#ffffff";
  const svgUrl = pathToFileURL(logoSvg).href;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${size}, initial-scale=1">
    <style>
      html,
      body {
        width: ${size}px;
        height: ${size}px;
        margin: 0;
        overflow: hidden;
        background: ${bg};
      }

      img {
        display: block;
        width: ${size}px;
        height: ${size}px;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img src="${svgUrl}" alt="">
  </body>
</html>`;
}

async function main() {
  if (!existsSync(logoSvg)) {
    throw new Error(`Missing source logo: ${logoSvg}`);
  }

  await mkdir(iconsDir, { recursive: true });
  const chrome = findChrome();
  const tempDir = mkdtempSync(join(tmpdir(), "out-of-sight-icons-"));

  try {
    for (const output of outputs) {
      const htmlPath = join(tempDir, `${output.file}.html`);
      const pngPath = join(iconsDir, output.file);
      writeFileSync(htmlPath, renderHtml(output), "utf8");

      const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        "--force-device-scale-factor=1",
        `--window-size=${output.size},${output.size}`,
        `--screenshot=${pngPath}`,
      ];

      if (output.background === "transparent") {
        args.push("--default-background-color=00000000");
      }

      args.push(pathToFileURL(htmlPath).href);
      execFileSync(chrome, args, { stdio: "ignore" });
      console.log(`wrote public/icons/${output.file}`);
    }

    await copyFile(logoSvg, join(iconsDir, "favicon.svg"));
    await copyFile(logoSvg, join(iconsDir, "safari-pinned-tab.svg"));
    console.log("synced favicon.svg and safari-pinned-tab.svg");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
