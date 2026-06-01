import { test, expect } from '@playwright/test';

test.describe('Orders desk', () => {
  test.skip(!process.env.E2E_LOGIN_EMAIL, 'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run');

  test('dashboard reachable after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@scalify.ae').fill(process.env.E2E_LOGIN_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_LOGIN_PASSWORD!);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await expect(page.getByText(/Total Orders|Revenue/i).first()).toBeVisible();
  });
});
