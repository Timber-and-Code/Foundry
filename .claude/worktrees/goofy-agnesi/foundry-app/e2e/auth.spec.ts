/**
 * Auth E2E tests
 *
 * These tests require Supabase to be reachable so the AuthPage is rendered.
 * If Supabase is unavailable the app bypasses auth, making these tests N/A.
 *
 * Tests that depend on real Supabase credentials are marked test.skip —
 * they can be enabled in a CI environment with env vars set.
 */

import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';

// Helper: go to root and wait for auth page or app
async function gotoRoot(page: import('@playwright/test').Page) {
  await page.goto('/');
}

// Detect whether AuthPage rendered (Supabase reachable)
async function isAuthPageVisible(page: import('@playwright/test').Page): Promise<boolean> {
  try {
    await page.waitForSelector('text=THE FOUNDRY', { timeout: 6_000 });
    // AuthPage shows "Forge your strength" subtext; onboarding shows "Your Body. Your Blueprint."
    const forgeText = await page.getByText(/forge your strength/i).count();
    return forgeText > 0;
  } catch {
    return false;
  }
}

test.describe('Auth page', () => {
  test('shows THE FOUNDRY branding', async ({ page }) => {
    await gotoRoot(page);
    await expect(page.getByText('THE FOUNDRY').first()).toBeVisible({ timeout: 10_000 });
  });

  test('auth page shows Sign In tab when Supabase reachable', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('auth page shows Create Account tab', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('can toggle to signup mode', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await page.getByRole('button', { name: /create account/i }).click();
    // Submit button should now say "Create Account"
    const submitBtn = page.getByRole('button', { name: /create account/i }).last();
    await expect(submitBtn).toBeVisible();
  });

  test('shows email and password inputs', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await page.getByPlaceholder('you@example.com').fill('invalid@test.invalid');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    // Click the submit button (Sign In)
    await page.getByRole('button', { name: /^sign in$/i }).last().click();
    // Some error text should appear
    await expect(page.locator('[style*="f87171"], [style*="rgba(220"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows Forgot password link in login mode', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await expect(page.getByText(/forgot password/i)).toBeVisible();
  });

  test('forgot password requires email first', async ({ page }) => {
    await gotoRoot(page);
    const authVisible = await isAuthPageVisible(page);
    if (!authVisible) {
      test.skip();
      return;
    }
    await page.getByText(/forgot password/i).click();
    await expect(page.getByText(/enter your email address first/i)).toBeVisible();
  });

  // Requires live Supabase + a real test account — skip by default
  test.skip('can create account with random test email', async ({ page }) => {
    // Skip: requires live Supabase credentials and email confirmation flow
    const randomEmail = `test_${Date.now()}@foundry-e2e.invalid`;
    await gotoRoot(page);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByPlaceholder('you@example.com').fill(randomEmail);
    await page.getByPlaceholder('••••••••').fill('Test1234!');
    await page.getByRole('button', { name: /create account/i }).last().click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
  });
});
