import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const backendDir = path.join(__dirname, '..', 'backend');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'npm run dev',
          cwd: backendDir,
          url: 'http://localhost:4000/health',
          reuseExistingServer: true,
          timeout: 120000
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120000
        }
      ]
});
