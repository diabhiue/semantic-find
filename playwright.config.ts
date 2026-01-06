import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180000, // 3 minutes for model download
  retries: 0,
  workers: 1, // Run serially for extension tests
  use: {
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
});
