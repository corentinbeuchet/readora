import { test, expect } from '@playwright/test';

/**
 * Full authentication journey against a running stack (frontend + backend).
 * Run locally with `docker compose up -d` (backend on :8080) and `npm start` (frontend on :4200).
 */
test.describe('Authentication flow', () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e_${suffix}@readora.test`;
  const username = `e2e_${suffix}`;
  const password = 'Sup3rSecret!';

  test('register → profile visible → logout → login → session survives reload', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    // Client-side validation (Signal Forms) blocks an empty submit.
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill('does-not-match');
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Redirected to the profile, header shows the account menu.
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(username);
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveValue(username);

    // A plain reader has no Scanlation entry in the menubar and no bookmarks yet.
    await expect(page.getByRole('menuitem', { name: 'Scanlation' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Bookmarks' }).click();
    await expect(page.getByText('Bookmarks are a Premium feature')).toBeVisible();

    // Session survives a reload thanks to the HttpOnly refresh cookie.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(username);

    // Logout clears the session and protects /profile again.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fprofile/);

    // Login with the wrong password shows the API error, the right one redirects to returnUrl.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toContainText(/Invalid email or password/i);

    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(username);
  });

  test('anonymous visitors are redirected away from guarded routes', async ({ page }) => {
    await page.goto('/scanlation/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);

    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Choose your plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Subscribe with Stripe' }).click();
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fsubscription/);
  });
});
