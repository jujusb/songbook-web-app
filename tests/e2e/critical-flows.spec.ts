import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login with valid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('logout works', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe('Song Browse Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('displays song list', async ({ page }) => {
    await page.goto('/songs');
    await expect(page.locator('text=Songs')).toBeVisible();
  });

  test('filters songs by search', async ({ page }) => {
    await page.goto('/songs');
    await page.fill('input[placeholder*="search" i]', 'Amazing');
    await expect(page.locator('text=Amazing Grace')).toBeVisible();
  });

  test('opens song detail', async ({ page }) => {
    await page.goto('/songs');
    await page.click('text=Amazing Grace');
    await expect(page).toHaveURL(/\/songs\/amazing-grace/);
    await expect(page.locator('text=Amazing Grace')).toBeVisible();
  });

  test('transposes chords', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    
    const transposeUp = page.locator('button:has-text("+")').first();
    await transposeUp.click();
    await transposeUp.click();
    
    await expect(page.locator('text=+2')).toBeVisible();
  });

  test('toggles repeat sections', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    
    const toggleButton = page.locator('button:has-text("Hide Repeats")');
    await toggleButton.click();
    await expect(page.locator('button:has-text("Show Repeats")')).toBeVisible();
  });
});

test.describe('Song Editor Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('creates new song', async ({ page }) => {
    await page.goto('/songs/new');
    
    await page.fill('input[name="id"]', 'test-song');
    await page.fill('input[name="title"]', 'Test Song');
    await page.selectOption('select[name="lang"]', 'en');
    await page.click('button:has-text("Create")');
    
    await expect(page).toHaveURL(/\/edit\/test-song\/en/);
    await expect(page.locator('text=Test Song')).toBeVisible();
  });

  test('edits song content', async ({ page }) => {
    await page.goto('/edit/test-song/en');
    
    const editor = page.locator('.CodeMirror, [contenteditable="true"]').first();
    await editor.fill('{title: Test Song}\n\n{verse: 1}\n[C]New [G]content');
    
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=Saved')).toBeVisible();
  });

  test('adds translation', async ({ page }) => {
    await page.goto('/edit/test-song/en');
    
    await page.click('button:has-text("Add Translation")');
    await page.selectOption('select[name="lang"]', 'es');
    await page.click('button:has-text("Create")');
    
    await expect(page).toHaveURL(/\/edit\/test-song\/es/);
  });
});

test.describe('Album Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('creates new album', async ({ page }) => {
    await page.goto('/albums/new');
    
    await page.fill('input[name="id"]', 'test-album');
    await page.fill('input[name="title"]', 'Test Album');
    await page.selectOption('select[name="artist"]', 'various-artists');
    await page.fill('input[name="year"]', '2024');
    await page.click('button:has-text("Create")');
    
    await expect(page).toHaveURL(/\/albums\/test-album/);
    await expect(page.locator('text=Test Album')).toBeVisible();
  });

  test('adds song to album', async ({ page }) => {
    await page.goto('/albums/test-album');
    
    await page.click('button:has-text("Add Song")');
    await page.fill('input[name="songId"]', 'amazing-grace');
    await page.click('button:has-text("Add")');
    
    await expect(page.locator('text=Amazing Grace')).toBeVisible();
  });
});

test.describe('Setlist Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('creates setlist', async ({ page }) => {
    await page.goto('/setlists/new');
    
    await page.fill('input[name="id"]', 'test-setlist');
    await page.fill('input[name="title"]', 'Test Setlist');
    await page.fill('input[name="date"]', '2024-01-15');
    await page.click('button:has-text("Create")');
    
    await expect(page).toHaveURL(/\/setlists\/test-setlist/);
  });

  test('adds songs to setlist', async ({ page }) => {
    await page.goto('/setlists/test-setlist');
    
    await page.click('button:has-text("Add Song")');
    await page.selectOption('select[name="songId"]', 'amazing-grace');
    await page.selectOption('select[name="lang"]', 'en');
    await page.click('button:has-text("Add")');
    
    await expect(page.locator('text=Amazing Grace')).toBeVisible();
  });

  test('generates share link', async ({ page }) => {
    await page.goto('/setlists/test-setlist');
    
    await page.click('button:has-text("Share")');
    await page.click('button:has-text("Generate Link")');
    
    const shareUrl = page.locator('input[readonly]').first();
    await expect(shareUrl).toHaveValue(/\/setlists\/test-setlist\?share=/);
  });
});

test.describe('Print/Export Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('opens print view for song', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    await page.click('button:has-text("Print")');
    
    await expect(page).toHaveURL(/\/print\/amazing-grace/);
  });

  test('opens print view for setlist', async ({ page }) => {
    await page.goto('/setlists/test-setlist');
    await page.click('button:has-text("Print")');
    
    await expect(page).toHaveURL(/\/print\/test-setlist/);
  });

  test('exports PDF', async ({ page }) => {
    await page.goto('/songs/amazing-grace');
    await page.click('button:has-text("Export PDF")');
    
    // Wait for PDF generation
    await expect(page.locator('text=Generating PDF')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Download PDF')).toBeVisible({ timeout: 60000 });
  });
});

test.describe('User Management (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('views user list', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=admin')).toBeVisible();
  });

  test('creates new user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('button:has-text("Create User")');
    
    await page.fill('input[name="username"]', 'newuser');
    await page.fill('input[name="password"]', 'newpass123');
    await page.selectOption('select[name="role"]', 'reviewer');
    await page.fill('input[name="displayName"]', 'New User');
    await page.click('button:has-text("Create")');
    
    await expect(page.locator('text=New User')).toBeVisible();
  });

  test('changes user role', async ({ page }) => {
    await page.goto('/admin/users');
    await page.locator('text=newuser').click();
    await page.selectOption('select[name="role"]', 'admin');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=admin')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('mobile view shows inline chords', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/songs/amazing-grace');
    
    // On mobile, chords should be inline
    const chordSheet = page.locator('.visual-chord-sheet');
    await expect(chordSheet).toBeVisible();
  });

  test('tablet view adapts layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/songs');
    
    await expect(page.locator('.song-list')).toBeVisible();
  });

  test('desktop view shows full layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/songs/amazing-grace');
    
    await expect(page.locator('.visual-chord-sheet')).toBeVisible();
    await expect(page.locator('text=References')).toBeVisible();
  });
});