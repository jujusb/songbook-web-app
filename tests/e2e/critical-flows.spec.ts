import { test, expect } from '@playwright/test';
import { cleanup, loginAsAdmin, submitLogin } from './support';

/**
 * These flows run against a freshly seeded content directory. Most seed
 * translations are unpublished, so nearly every assertion requires an
 * authenticated admin session — the public read path would 404 on them.
 */

test.describe('Authentication', () => {
  test('logs in with valid credentials', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await submitLogin(page, 'admin', 'definitely-wrong');
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logs out and shows the login link', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });
});

test.describe('Browsing the songbook', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('lists the seeded songs', async ({ page }) => {
    await page.goto('/songs');
    await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Amazing Grace/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /How Great Thou Art/ })).toBeVisible();
  });

  test('filters songs by search term', async ({ page }) => {
    await page.goto('/songs');
    await page.getByPlaceholder('Search').fill('Amazing');
    await expect(page.getByRole('link', { name: /Amazing Grace/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /How Great Thou Art/ })).toHaveCount(0);
  });

  test('opens a song and renders its chord sheet', async ({ page }) => {
    await page.goto('/songs');
    await page.getByRole('link', { name: /Amazing Grace/ }).first().click();
    await expect(page).toHaveURL(/\/songs\/amazing-grace/);
    await expect(page.getByRole('heading', { name: 'Amazing Grace', exact: true }).first()).toBeVisible();
    await expect(page.locator('.visual-chord-sheet').first()).toBeVisible();
  });

  test('transposes the chord sheet', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    const transposeUp = page.getByRole('button', { name: 'Transpose up' });
    await expect(transposeUp).toBeVisible();
    await transposeUp.click();
    await transposeUp.click();
    await expect(page.getByText('+2', { exact: true })).toBeVisible();
  });

  test('toggles repeated chorus sections', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    const hideRepeats = page.getByRole('button', { name: 'Hide Repeats' });
    await expect(hideRepeats).toBeVisible();
    await hideRepeats.click();
    await expect(page.getByRole('button', { name: 'Show Repeats' })).toBeVisible();
  });

  test('switches between translations', async ({ page }) => {
    await page.goto('/songs/amazing-grace?lang=es');
    await expect(page.getByRole('heading', { name: 'Sublime Gracia', exact: true }).first()).toBeVisible();
    await expect(page.locator('.visual-chord-sheet').first()).toBeVisible();
  });

  test('shows references for a song', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    await expect(page.getByText('1 Timothy 1:15').first()).toBeVisible();
  });
});

test.describe('Song authoring', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates a new song', async ({ page }) => {
    await cleanup(page, '/api/songs', 'e2e-test-song');
    await page.goto('/songs/new');
    await page.getByPlaceholder('e.g. Amazing Grace').fill('E2E Test Song');
    await page.locator('textarea').first().fill(
      '{title: E2E Test Song}\n{key: C}\n\n{start_of_verse: 1}\n[C]Hello [G]world\n{end_of_verse}',
    );
    await page.getByRole('button', { name: 'Create Song' }).click();
    await page.waitForURL(/\/songs\/e2e-test-song/);
    await expect(page.getByRole('heading', { name: 'E2E Test Song', exact: true }).first()).toBeVisible();
    await expect(page.locator('.visual-chord-sheet').first()).toBeVisible();
  });

  test('edits a song title and persists the change', async ({ page }) => {
    await cleanup(page, '/api/songs', 'e2e-edit-song');
    await page.request.post('/api/songs', {
      data: {
        id: 'e2e-edit-song',
        title: 'E2E Edit Song',
        lang: 'en',
        chordpro: '{title: E2E Edit Song}\n{key: G}\n\n{start_of_verse: 1}\n[G]A line\n{end_of_verse}',
      },
    });

    await page.goto('/edit/e2e-edit-song/en');
    const titleInput = page.getByRole('textbox', { name: 'Song title' });
    await expect(titleInput).toHaveValue('E2E Edit Song');

    const saveButton = titleInput.locator('xpath=following-sibling::button[1]');
    await expect(saveButton).toHaveText('Saved');

    await titleInput.fill('E2E Edit Song Renamed');
    await expect(saveButton).toHaveText('Save');
    await saveButton.click();
    await expect(saveButton).toHaveText('Saved');

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Song title' })).toHaveValue('E2E Edit Song Renamed');
  });
});

test.describe('Album management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('lists the seeded album', async ({ page }) => {
    await page.goto('/albums');
    await expect(page.getByRole('heading', { name: 'Albums', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Classic Hymns/ })).toBeVisible();
  });

  test('creates a new album with a song', async ({ page }) => {
    await cleanup(page, '/api/albums', 'e2e-test-album');
    await page.goto('/albums/new');
    await page.getByPlaceholder('Album title').fill('E2E Test Album');
    await page.getByRole('button', { name: '+ Amazing Grace' }).click();
    await page.getByRole('button', { name: 'Create Album' }).click();
    await page.waitForURL(/\/albums\/e2e-test-album/);
    await expect(page.getByRole('heading', { name: 'E2E Test Album', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Amazing Grace/ })).toBeVisible();
  });
});

test.describe('Setlist management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates a setlist containing a song', async ({ page }) => {
    await cleanup(page, '/api/setlists', 'e2e-test-setlist');
    await page.goto('/setlists/new');
    await page.getByPlaceholder('Sunday Service').fill('E2E Test Setlist');
    await page.getByPlaceholder('Search songs to add...').fill('Amazing');
    await page.getByRole('button', { name: /Amazing Grace/ }).first().click();
    await page.getByRole('button', { name: 'Create Setlist' }).click();
    await page.waitForURL(/\/setlists\/e2e-test-setlist/);
    await expect(page.getByRole('heading', { name: 'E2E Test Setlist', exact: true }).first()).toBeVisible();
  });

  test('creates a share link for a setlist', async ({ page }) => {
    await page.goto('/setlists/my-setlist');
    const createLink = page.getByRole('button', { name: 'Create share link' });
    if (await createLink.count()) {
      await createLink.click();
    }
    const shareInput = page.locator('input[readonly]').last();
    await expect(shareInput).toHaveValue(/\/setlists\/share\//);
  });
});

test.describe('User management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('lists the admin user', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
    await expect(page.locator('td.font-mono', { hasText: 'admin' }).first()).toBeVisible();
  });

  test('creates a new user', async ({ page }) => {
    await cleanup(page, '/api/admin/users', 'e2euser');
    await page.goto('/admin/users');
    await page.getByRole('button', { name: '+ Create User' }).click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.locator('input[type="text"]').first().fill('e2euser');
    await modal.locator('input[type="password"]').fill('e2e-password');
    await modal.locator('input[type="text"]').nth(1).fill('E2E User');
    await modal.locator('input[type="email"]').fill('e2e@example.com');
    await modal.locator('select').selectOption('reviewer');
    await modal.getByRole('button', { name: 'Create User' }).click();

    await expect(page.locator('td.font-mono', { hasText: 'e2euser' }).first()).toBeVisible();
  });
});

test.describe('Print view', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('renders a printable songbook page', async ({ page }) => {
    await page.goto('/print/en?song=amazing-grace');
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Amazing Grace/ }).first()).toBeVisible();
  });
});

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('renders the chord sheet on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/songs/amazing-grace');
    await expect(page.locator('.visual-chord-sheet').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transpose up' })).toBeVisible();
  });
});
