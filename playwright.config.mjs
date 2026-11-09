import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4173", headless: true, launchOptions: process.env.CLAVELOCAL_BROWSER ? { executablePath: process.env.CLAVELOCAL_BROWSER } : {} },
  webServer: [
    { command: "node server.mjs", url: "http://127.0.0.1:4173", env: { CLAVELOCAL_NO_OPEN: "1" }, reuseExistingServer: false },
    { command: "node scripts/preview.mjs", url: "http://127.0.0.1:4174", reuseExistingServer: false },
  ],
});
