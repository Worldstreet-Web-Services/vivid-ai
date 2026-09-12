// Screenshot the running dev server at a desktop and a phone width.
//   node scripts/screenshot.mjs <url> <outDir>
// Writes desktop.jpg, mobile.jpg and report.json (console errors, page
// errors, whether the app rendered anything). Used by the builder's critique
// step; Chromium comes from the template image.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const [url = "http://localhost:5173", outDir = "/tmp/shots"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const shots = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const report = { errors: [], rendered: {}, overlay: null };

// Vite compiles on the first request and reloads the page once it has
// optimised newly installed packages. One warm-up visit absorbs both, so the
// captures below see the settled app.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2500);
  } catch {}
  await ctx.close();
}

async function settle(page) {
  // Wait for React to mount something; a page that stays empty is reported.
  try {
    await page.waitForFunction(
      () => (document.querySelector("#root")?.children.length ?? 0) > 0,
      null,
      { timeout: 15000 },
    );
  } catch {}
  await page.waitForTimeout(800);
  const overlay = await page.evaluate(() => {
    const el = document.querySelector("vite-error-overlay");
    return el?.shadowRoot?.querySelector(".message")?.textContent?.trim() ?? null;
  });
  const rendered = await page.evaluate(
    () => (document.querySelector("#root")?.innerText ?? "").trim().length > 0,
  );
  return { overlay, rendered };
}

for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 1,
    isMobile: s.mobile,
    hasTouch: s.mobile,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errors.push(`[${s.name}] ${String(e.message ?? e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(`[${s.name}] console: ${m.text().slice(0, 300)}`);
  });
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  const { overlay, rendered } = await settle(page);
  report.rendered[s.name] = rendered;
  if (overlay) report.overlay = overlay.slice(0, 600);
  // Full page, but a runaway page must not produce a 40k pixel image.
  const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 3200);
  await page.setViewportSize({ width: s.width, height: Math.max(s.height, height) });
  await page.screenshot({ path: `${outDir}/${s.name}.jpg`, type: "jpeg", quality: 72, fullPage: false });
  await ctx.close();
}
report.errors = [...new Set(report.errors)].slice(0, 12);
writeFileSync(`${outDir}/report.json`, JSON.stringify(report));
await browser.close();
console.log("ok");
