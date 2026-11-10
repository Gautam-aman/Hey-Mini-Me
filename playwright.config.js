import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  use: { baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "PORT=3100 DATABASE_PATH=./data/browser.sqlite npm run dev",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
