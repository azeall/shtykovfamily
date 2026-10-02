const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || undefined,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const base = process.env.SITE_URL || "http://127.0.0.1:4173/";
  const results = [];
  const errors = [],
    failedAssets = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      failedAssets.push(response.url());
  });
  page.setDefaultTimeout(5000);
  async function check(name, run) {
    try {
      await run();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  }
  await check("A direct travel link opens the travel page", async () => {
    await page.goto(base + "#travels");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#travels").isVisible(), true);
  });
  await check(
    "Travel photos reference existing files, including exact case",
    async () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const root = path.resolve(__dirname, "..");
      const missing = await page.evaluate(() =>
        worldPlaces.flatMap((p) => p.photos),
      );
      for (const file of missing) {
        assert.ok(
          fs
            .readdirSync(path.join(root, path.dirname(file)))
            .includes(path.basename(file)),
          file,
        );
      }
    },
  );
  await check("The map loads locally with all twenty places", async () => {
    await page.waitForSelector(".map-pin");
    assert.equal(await page.locator(".map-pin").count(), 20);
    assert.equal(await page.locator(".place-card").count(), 20);
    assert.equal(await page.locator(".current-label").count(), 1);
    assert.match(
      await page
        .locator(".current-label")
        .locator("..")
        .locator("..")
        .innerText(),
      /Москва/,
    );
  });
  await check(
    "Region and text filters combine, including the empty state and reset",
    async () => {
      await page.getByRole("button", { name: "Россия", exact: true }).click();
      assert.equal(await page.locator(".place-card").count(), 5);
      await page
        .getByRole("searchbox", { name: "Найти город или страну" })
        .fill("моск");
      assert.equal(await page.locator(".place-card").count(), 1);
      await page
        .getByRole("searchbox", { name: "Найти город или страну" })
        .fill("Токио");
      assert.equal(await page.locator("#placesEmpty").isVisible(), true);
      await page.locator("#resetPlaces").click();
      assert.equal(await page.locator(".place-card").count(), 20);
    },
  );
  await check(
    "Photo viewer supports arrows, wraparound, nested Escape and focus restoration",
    async () => {
      await page
        .locator(".place-card")
        .filter({ hasText: "Эгейские острова" })
        .click();
      await page.locator("#mPhotos button").first().click();
      assert.match(await page.locator("#lbCaption").innerText(), /1 \/ 4/);
      await page.keyboard.press("ArrowLeft");
      assert.match(await page.locator("#lbCaption").innerText(), /4 \/ 4/);
      await page.keyboard.press("ArrowRight");
      assert.match(await page.locator("#lbCaption").innerText(), /1 \/ 4/);
      await page.locator("#lightbox").evaluate((element) => {
        const start = new Touch({
          identifier: 1,
          target: element,
          clientX: 280,
          clientY: 300,
        });
        const end = new Touch({
          identifier: 1,
          target: element,
          clientX: 80,
          clientY: 302,
        });
        element.dispatchEvent(
          new TouchEvent("touchstart", { touches: [start], bubbles: true }),
        );
        element.dispatchEvent(
          new TouchEvent("touchend", { changedTouches: [end], bubbles: true }),
        );
      });
      assert.match(await page.locator("#lbCaption").innerText(), /2 \/ 4/);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#lightbox").isVisible(), false);
      assert.equal(await page.locator("#placeDialog").isVisible(), true);
      assert.equal(
        await page.evaluate(
          () =>
            document.activeElement ===
            document.querySelector("#mPhotos button"),
        ),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#placeDialog").isVisible(), false);
      assert.equal(
        await page.evaluate(() =>
          document.body.classList.contains("modal-open"),
        ),
        false,
      );
    },
  );
  await check("A place without photos has an honest empty album", async () => {
    await page.locator(".place-card").filter({ hasText: "Токио" }).click();
    assert.match(
      await page.locator("#mPhotos").innerText(),
      /пока не добавлены/,
    );
    assert.equal(await page.locator("#mPhotos img").count(), 0);
    await page.keyboard.press("Escape");
  });
  await check(
    "Family search and tree activation work with a keyboard",
    async () => {
      await page.locator('.desktop-nav a[href="#family"]').click();
      await page
        .getByRole("searchbox", { name: "Найти родственника" })
        .fill("Егор");
      assert.equal(await page.locator(".person-card").count(), 1);
      await page.locator(".person-card").click();
      assert.match(
        await page.locator(".person-portrait").getAttribute("src"),
        /egor.png/,
      );
      await page.keyboard.press("Escape");
      await page
        .getByRole("searchbox", { name: "Найти родственника" })
        .fill("Неттакого");
      assert.equal(await page.locator("#familyEmpty").isVisible(), true);
      await page.getByRole("button", { name: "Дерево", exact: true }).click();
      await page.locator('[data-person="0"]').focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#personName").innerText(), "Виктор");
      await page.locator("#personHistory").click();
      await page.waitForFunction(
        () => document.querySelector("#ai").hidden === false,
      );
      assert.equal(await page.locator("#personDialog").isVisible(), false);
    },
  );
  await check(
    "Browser back, refresh and old route links select the correct page",
    async () => {
      await page.goBack();
      assert.equal(await page.locator("#tree").isVisible(), true);
      await page.reload();
      assert.equal(await page.locator("#tree").isVisible(), true);
      await page.goto(base + "#ai");
      assert.equal(await page.locator("#ai").isVisible(), true);
      assert.equal(
        await page.locator('.desktop-nav [aria-current="page"]').innerText(),
        "История рода",
      );
    },
  );
  await check(
    "Memory form rejects blank content and saves/restores/downloads a local draft",
    async () => {
      await page.locator("#memoryName").fill("Виктор");
      await page.locator("#memoryText").fill("          ");
      await page.locator('#memoryForm button[type="submit"]').click();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("shtykov-family-memory-v1"),
        ),
        null,
      );
      await page
        .locator("#memoryText")
        .fill("Помню нашу семейную поездку. <script>alert(1)</script>");
      await page.locator('#memoryForm button[type="submit"]').click();
      assert.match(await page.locator("#memoryStatus").innerText(), /сохранён/);
      await page.reload();
      assert.equal(await page.locator("#memoryName").inputValue(), "Виктор");
      assert.match(await page.locator("#memoryText").inputValue(), /<script>/);
      const download = page.waitForEvent("download");
      await page.locator("#downloadMemory").click();
      const result = await download;
      assert.equal(result.suggestedFilename(), "Семейное воспоминание.txt");
      const content = require("node:fs").readFileSync(
        await result.path(),
        "utf8",
      );
      assert.match(content, /Виктор/);
      assert.match(content, /Помню нашу семейную поездку/);
    },
  );
  await check(
    "Anniversary tabs support keyboard and defer YouTube until requested",
    async () => {
      await page.locator('.desktop-nav a[href="#anniversary"]').click();
      assert.equal(await page.locator(".letter").count(), 3);
      assert.equal(await page.locator("iframe").count(), 0);
      await page.locator("#tab-letters").focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.locator("#jp1").isVisible(), true);
      await page.route("https://www.youtube-nocookie.com/**", (route) =>
        route.abort(),
      );
      await page.locator("#loadVideo").click();
      assert.match(
        await page.locator("iframe").getAttribute("src"),
        /qWJl66FUE-k/,
      );
      assert.ok(await page.locator("iframe").getAttribute("title"));
      await page.locator("#tab-house").click();
      assert.equal(await page.locator("#jp3").isVisible(), true);
      assert.equal(
        (await page.request.get(base + "brother_sketch.pdf")).status(),
        200,
      );
      await page.locator("#tab-cap").click();
      await page.locator(".sketch-button").click();
      assert.equal(await page.locator(".lightbox-next").isVisible(), false);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "Local video plays and stops when leaving its chapter",
    async () => {
      await page.goto(base + "#history");
      await page.locator("video").evaluate((video) => video.play());
      await page.waitForFunction(
        () => document.querySelector("video").currentTime > 0,
      );
      await page.locator('.desktop-nav a[href="#travels"]').click();
      assert.equal(
        await page.locator("video").evaluate((video) => video.paused),
        true,
      );
    },
  );
  await check(
    "All local page resources load without 404s or JavaScript errors",
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(failedAssets, []);
      const duplicates = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      });
      assert.deepEqual(duplicates, []);
    },
  );
  await check(
    "Map failure does not hide travel cards, and retry recovers",
    async () => {
      const isolated = await browser.newPage();
      await isolated.route("**/assets/world.json", (route) => route.abort());
      await isolated.goto(base + "#travels");
      await isolated.waitForSelector("#mapRetry:not([hidden])");
      assert.equal(await isolated.locator(".place-card").count(), 20);
      await isolated.getByRole("button", { name: "Азия", exact: true }).click();
      assert.equal(await isolated.locator(".place-card").count(), 3);
      await isolated.unroute("**/assets/world.json");
      await isolated.locator("#mapRetry").click();
      await isolated.waitForSelector(".map-pin");
      assert.equal(await isolated.locator(".map-pin").count(), 3);
      await isolated.close();
    },
  );
  await check(
    "Blocked local storage reports a failure while keeping the text downloadable",
    async () => {
      const isolated = await browser.newPage();
      await isolated.addInitScript(() => {
        Storage.prototype.setItem = () => {
          throw new DOMException("Blocked", "SecurityError");
        };
      });
      await isolated.goto(base + "#history");
      await isolated.locator("#memoryName").fill("Любовь");
      await isolated
        .locator("#memoryText")
        .fill("Семейное воспоминание для сохранения.");
      await isolated.locator('#memoryForm button[type="submit"]').click();
      assert.match(
        await isolated.locator("#memoryStatus").innerText(),
        /не разрешил/,
      );
      const download = isolated.waitForEvent("download");
      await isolated.locator("#downloadMemory").click();
      await download;
      await isolated.close();
    },
  );
  await check(
    "Mobile menu, focus loop and all pages fit the viewport",
    async () => {
      const mobile = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await mobile.goto(base);
      await mobile.getByRole("button", { name: "Открыть меню" }).click();
      assert.equal(await mobile.locator("#mobileMenu").isVisible(), true);
      await mobile.locator("#mobileMenu a").last().focus();
      await mobile.keyboard.press("Tab");
      assert.equal(
        await mobile.evaluate(() =>
          document.activeElement.classList.contains("menu-toggle"),
        ),
        true,
      );
      await mobile.locator('#mobileMenu a[href="#family"]').click();
      assert.equal(await mobile.locator("#mobileMenu").isVisible(), false);
      assert.equal(await mobile.locator("#familyList").isVisible(), true);
      for (const width of [320, 390, 768, 1440]) {
        await mobile.setViewportSize({ width, height: 900 });
        for (const route of [
          "home",
          "family",
          "travels",
          "history",
          "anniversary",
        ]) {
          await mobile.goto(base + "#" + route);
          const overflow = await mobile.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert.equal(overflow, false, `Overflow at ${width}px, ${route}`);
        }
      }
      await mobile.close();
    },
  );
  if (process.env.CAPTURE_DIR) {
    const fs = require("node:fs"),
      path = require("node:path");
    fs.mkdirSync(process.env.CAPTURE_DIR, { recursive: true });
    await page.evaluate(() => localStorage.clear());
    await page.goto(base);
    await page.reload();
    for (const route of [
      "home",
      "family",
      "travels",
      "history",
      "anniversary",
    ]) {
      await page.goto(base + "#" + route);
      await page.waitForTimeout(450);
      await page.screenshot({
        path: path.join(process.env.CAPTURE_DIR, route + "-desktop.png"),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "#home");
    await page.waitForTimeout(450);
    await page.screenshot({
      path: path.join(process.env.CAPTURE_DIR, "home-mobile.png"),
      fullPage: true,
    });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  if (results.some((r) => !r.pass)) process.exitCode = 1;
})();
