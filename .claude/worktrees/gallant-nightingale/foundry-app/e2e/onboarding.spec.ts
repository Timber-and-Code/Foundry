/**
 * Onboarding E2E tests
 *
 * These tests assume Supabase is unreachable (authUnavailable=true), which
 * causes the app to bypass auth and fall straight into the onboarding flow.
 * If Supabase IS reachable, the auth page will appear first — those tests
 * are skipped/handled in auth.spec.ts.
 *
 * To force the onboarding flow, we clear localStorage before each test.
 */

import { test, expect } from '@playwright/test';

// Helper: block Supabase network calls so authUnavailable is triggered
async function blockSupabase(page: import('@playwright/test').Page) {
  await page.route('**/supabase.co/**', (route) => route.abort());
  await page.route('**/auth/v1/**', (route) => route.abort());
}

// Helper: clear app state and open the root page
async function openFresh(page: import('@playwright/test').Page) {
  await blockSupabase(page);
  // Navigate once so we can access localStorage on the correct origin
  await page.goto('/');
  // Clear any onboarding/profile flags that may persist across tests
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('foundry:'))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.reload();
  // Wait for the auth check to resolve (Supabase blocked → authUnavailable)
  // and the OnboardingFlow to render
  await page.waitForLoadState('networkidle');
}

test.describe('Onboarding flow', () => {
  test('landing page loads with THE FOUNDRY title', async ({ page }) => {
    await openFresh(page);
    await expect(page.getByText('THE FOUNDRY')).toBeVisible();
  });

  test('landing page shows "Enter The Forge" button', async ({ page }) => {
    await openFresh(page);
    await expect(page.getByRole('button', { name: /enter the forge/i })).toBeVisible();
  });

  test('landing page shows tagline', async ({ page }) => {
    await openFresh(page);
    await expect(page.getByText(/your body\. your blueprint\./i)).toBeVisible();
  });

  test('clicking Enter The Forge shows name input screen', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
    await expect(page.getByText(/what should/i)).toBeVisible();
  });

  test('shows validation error if name is empty and Continue clicked', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/please enter your name/i)).toBeVisible();
  });

  test('can type a name and advance to experience screen', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/how long have you/i)).toBeVisible();
  });

  test('experience screen shows Beginner, Intermediate, Advanced options', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('radio', { name: /beginner/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /intermediate/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /advanced/i })).toBeVisible();
  });

  test('selecting experience and continuing reaches goal screen', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /intermediate/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/what's your/i)).toBeVisible();
    await expect(page.getByText(/primary goal/i)).toBeVisible();
  });

  test('goal screen shows Build Muscle option', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /intermediate/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('radio', { name: /build muscle/i })).toBeVisible();
  });

  test('selecting goal and continuing shows ready/confirmation screen', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /intermediate/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /build muscle/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/ready to forge/i)).toBeVisible();
  });

  test('full flow: Build My Program button appears on final screen', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: /enter the forge/i }).click();
    await page.getByPlaceholder('Your name').fill('Atlas');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /intermediate/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('radio', { name: /build muscle/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('button', { name: /build my program/i })).toBeVisible();
  });

  test('progress dots are visible during onboarding', async ({ page }) => {
    await openFresh(page);
    // There should be 5 progress dots (aria-label "Step N")
    const dots = page.getByRole('button', { name: /step 1/i });
    await expect(dots).toBeVisible();
  });
});
