import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, 'e2e/.env.test') })

/**
 * Runs against production (fees.edupro.co.zw) -- there's no staging
 * environment for this app. Real test accounts only (see e2e/README.md);
 * students-crud.spec.ts and procurement-workflow.spec.ts create data that
 * is clearly marked and cleaned up by the spec itself.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // several specs share the same demo accounts -- avoid concurrent session collisions
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://fees.edupro.co.zw',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
