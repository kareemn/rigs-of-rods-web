// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.ROR_TEST_PORT || 5188);
const url = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: url,
    headless: true,
    launchOptions: {
      args: ["--enable-unsafe-webgpu", "--enable-unsafe-swiftshader"],
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    {
      name: "mobile-layout",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "webgl-fallback", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npm run ${process.env.TEST_PRODUCTION ? "preview" : "dev"} -- --port ${port}`,
    url,
    reuseExistingServer: !process.env.CI,
  },
});
