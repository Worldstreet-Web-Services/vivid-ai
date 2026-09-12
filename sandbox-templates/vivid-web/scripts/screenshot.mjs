// Screenshot the running dev server at a desktop and a phone width.
//   node scripts/screenshot.mjs <url> <outDir>
// Writes desktop.jpg and mobile.jpg (full page, capped height). Used by the
// builder's critique step; Chromium comes from the template image.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

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
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 1,
    isMobile: s.mobile,
    hasTouch: s.mobile,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  // Full page, but a runaway page must not produce a 40k pixel image.
  const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 3200);
  await page.setViewportSize({ width: s.width, height: Math.max(s.height, height) });
  await page.screenshot({ path: `${outDir}/${s.name}.jpg`, type: "jpeg", quality: 72, fullPage: false });
  await ctx.close();
}
await browser.close();
console.log("ok");
