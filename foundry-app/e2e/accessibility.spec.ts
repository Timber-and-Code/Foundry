import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function filterCritical(violations: Array<{ impact?: string | null }>) {
  return violations.filter((v) => v.impact === 'critical');
}

function filterSerious(violations: Array<{ impact?: string | null }>) {
  return violations.filter((v) => v.impact === 'serious');
}

function logViolations(violations: Array<{ id: string; impact?: string | null; description: string; nodes: Array<{ html: string }> }>) {
  if (violations.length === 0) return;
  console.log(`\n--- ${violations.length} a11y violation(s) ---`);
  for (const v of violations) {
    console.log(`[${v.impact}] ${v.id}: ${v.description}`);
    for (const node of v.nodes) {
      console.log(`  -> ${node.html}`);
    }
  }
}

async function blockSupabase(page: import('@playwright/test').Page) {
  await page.route('**/supabase.co/**', (route) => route.abort());
  await page.route('**/auth/v1/**', (route) => route.abort());
}

test.describe('Accessibility regression', () => {
  test('Onboarding page has no critical a11y violations', async ({ page }) => {
    await blockSupabase(page);
    await page.goto('/');

    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('foundry:'));
      for (const key of keys) localStorage.removeItem(key);
    });
    await page.reload();

    await expect(page.getByText('THE FOUNDRY')).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    logViolations(results.violations);

    const serious = filterSerious(results.violations);
    if (serious.length) console.warn(`⚠ ${serious.length} serious a11y issue(s) — fix soon`);
    const critical = filterCritical(results.violations);
    expect(critical).toHaveLength(0);
  });

  test('Setup page Step 1 has no critical a11y violations', async ({ page }) => {
    await blockSupabase(page);
    await page.goto('/');

    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('foundry:'));
      for (const key of keys) localStorage.removeItem(key);
    });
    await page.reload();

    await expect(page.getByText('THE FOUNDRY')).toBeVisible({ timeout: 10_000 });

    // Navigate through onboarding to reach SetupPage step 1
    await page.getByText('Enter The Forge').click();
    await page.getByPlaceholder(/name/i).fill('Atlas');
    await page.getByText(/continue/i).click();
    await page.getByText(/intermediate/i).click();
    await page.getByText(/continue/i).click();
    await page.getByText(/build muscle/i).click();
    await page.getByText(/continue/i).click();
    await page.getByText('Build My Program').click();

    const results = await new AxeBuilder({ page }).analyze();
    logViolations(results.violations);

    const serious = filterSerious(results.violations);
    if (serious.length) console.warn(`⚠ ${serious.length} serious a11y issue(s) — fix soon`);
    const critical = filterCritical(results.violations);
    expect(critical).toHaveLength(0);
  });

  test('Auth page has no critical a11y violations (when Supabase reachable)', async ({ page }) => {
    await page.goto('/');

    const authVisible = await page.getByText(/forge your strength/i).isVisible().catch(() => false);

    if (!authVisible) {
      test.skip(true, 'Auth page not visible — Supabase may be unreachable');
      return;
    }

    const results = await new AxeBuilder({ page }).analyze();
    logViolations(results.violations);

    const serious = filterSerious(results.violations);
    if (serious.length) console.warn(`⚠ ${serious.length} serious a11y issue(s) — fix soon`);
    const critical = filterCritical(results.violations);
    expect(critical).toHaveLength(0);
  });

  test('Home page has no critical a11y violations (with seeded state)', async ({ page }) => {
    await blockSupabase(page);
    await page.goto('/');

    await page.evaluate(() => {
      localStorage.setItem('foundry:onboarded', '1');
      localStorage.setItem(
        'foundry:profile',
        JSON.stringify({
          name: 'Atlas',
          experience: 'intermediate',
          goal: 'build_muscle',
          splitType: 'ppl',
          daysPerWeek: 3,
          equipment: 'barbell,dumbbell',
          mesoLength: 6,
          weight: 80,
        }),
      );
    });
    await page.reload();

    const results = await new AxeBuilder({ page }).analyze();
    logViolations(results.violations);

    const serious = filterSerious(results.violations);
    if (serious.length) console.warn(`⚠ ${serious.length} serious a11y issue(s) — fix soon`);
    const critical = filterCritical(results.violations);
    expect(critical).toHaveLength(0);
  });
});
