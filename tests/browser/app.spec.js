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
