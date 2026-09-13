// SPDX-License-Identifier: GPL-3.0-only
import { test, expect } from "@playwright/test";
test("loads the real WASM worker, collides, resets, scrubs and exports a scenario", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    info.project.name === "webgl-fallback" ? "/?renderer=webgl" : "/",
  );
  await expect(
    page.getByRole("button", { name: "▶ Play", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  if (info.project.name === "webgl-fallback")
    expect(await page.evaluate(() => window.rorWebStatus().renderer)).toBe(
      "webgl",
    );
  else
    expect(await page.evaluate(() => window.rorWebStatus().renderer)).toBe(
      "webgpu",
    );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/${info.project.name}-ready.png`,
  });
  await page.locator("#rate").selectOption("1");
  await page.locator("#play").click();
  await page.waitForFunction(
    () => window.rorWebStatus().yielded > 0,
    {},
    { timeout: 25000 },
  );
  await page.locator("#play").click();
  expect(await page.evaluate(() => window.rorWebStatus().error)).toBeNull();
  await page.screenshot({
    path: `test-results/${info.project.name}-impact.png`,
  });
  await page.locator("#timeline").fill("0");
  await expect(page.locator("#yielded")).toHaveText("0");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "ror-web-scenario.json",
  );
  await page.locator("#reset").click();
  await expect(page.locator("#clock")).toHaveText("0.000 s");
  await expect(page.locator("#yielded")).toHaveText("0");
  expect(errors).toEqual([]);
});

test("an in-flight WASM frame cannot undo pause, scrubbing or reset", async ({
  page,
}, info) => {
  // Delay delivery only: the actual worker and compiled physics still run.
  // This makes the slow-worker race deterministic without production test hooks.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.holdFrames = false;
    window.delayedFrames = [];
    window.Worker = class extends NativeWorker {
      set onmessage(listener) {
        super.onmessage = (event) => {
          if (window.holdFrames && event.data.type === "frame")
            window.delayedFrames.push(() => listener(event));
          else listener(event);
        };
      }
    };
    window.releaseFrames = () => {
      window.holdFrames = false;
      window.delayedFrames.splice(0).forEach((deliver) => deliver());
    };
  });
  await page.goto(
    info.project.name === "webgl-fallback" ? "/?renderer=webgl" : "/",
  );
  await expect(page.locator("#play")).toBeEnabled({ timeout: 30000 });
  await page.locator("#rate").selectOption("1");
  await page.locator("#play").click();
  await page.waitForFunction(() => window.rorWebStatus().yielded > 0);
  await page.evaluate(() => (window.holdFrames = true));
  await page.waitForFunction(() => window.delayedFrames.length === 1);
  await page.locator("#play").click();
  expect(await page.evaluate(() => window.rorWebStatus().playing)).toBe(false);
  await page.locator("#timeline").fill("0");
  await page.evaluate(() => window.releaseFrames());
  await expect(page.locator("#clock")).toHaveText("0.000 s");
  await expect(page.locator("#yielded")).toHaveText("0");
  expect(await page.evaluate(() => window.rorWebStatus().pending)).toBe(false);

  // A late frame from the previous simulation must not change a freshly reset one.
  await page.evaluate(() => (window.holdFrames = true));
  await page.locator("#play").click();
  await page.waitForFunction(() => window.delayedFrames.length === 1);
  await page.locator("#reset").click();
  await page.waitForFunction(() => !window.rorWebStatus().pending);
  await page.evaluate(() => window.releaseFrames());
  await expect(page.locator("#clock")).toHaveText("0.000 s");
  expect(await page.evaluate(() => window.rorWebStatus().frames)).toBe(1);
  expect(await page.evaluate(() => window.rorWebStatus().error)).toBeNull();
});
