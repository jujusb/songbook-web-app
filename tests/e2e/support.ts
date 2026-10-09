import { expect, type Page } from '@playwright/test';

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin';

/**
 * The login form's inputs have no `name` attributes, so target them by type.
 * Does not wait for success — callers decide how to assert the outcome.
 */
export async function submitLogin(
  page: Page,
  username = ADMIN_USERNAME,
  password = ADMIN_PASSWORD,
) {
  await page.goto('/login');
  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Log in as the auto-seeded admin and wait until the browse page is ready. */
export async function loginAsAdmin(page: Page) {
  await submitLogin(page);
  await page.waitForURL('**/browse');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

/** Best-effort delete; keeps authoring tests idempotent across CI retries. */
export async function cleanup(page: Page, endpoint: string, id: string) {
  await page.request.delete(`${endpoint}?id=${encodeURIComponent(id)}`);
}
