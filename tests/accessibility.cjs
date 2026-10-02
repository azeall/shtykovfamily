const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || undefined,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const base = process.env.SITE_URL || "http://127.0.0.1:4173/";
  const results = [];
  async function audit(name) {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const result = await page.evaluate(() =>
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    results.push({
      name,
      violations: result.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
        summaries: v.nodes.map((n) => n.failureSummary),
      })),
    });
  }
  for (const route of ["home", "family", "travels", "history", "anniversary"]) {
    await page.goto(base + "#" + route);
    if (route === "travels") await page.waitForSelector(".map-pin");
    await audit(route);
  }
  await page.goto(base + "#family");
  await page.locator('[data-person="0"]').click();
  await audit("person dialog");
  await page.keyboard.press("Escape");
  await page.goto(base + "#travels");
  await page
    .locator(".place-card")
    .filter({ hasText: "Эгейские острова" })
    .click();
  await audit("photo album");
  await page.locator("#mPhotos button").first().click();
  await audit("lightbox");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "#home");
  await audit("mobile home");
  await page.locator(".menu-toggle").click();
  await audit("mobile menu");
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  assert.equal(
    results.reduce((sum, r) => sum + r.violations.length, 0),
    0,
    "Accessibility violations",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
