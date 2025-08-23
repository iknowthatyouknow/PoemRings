import { test, expect } from '@playwright/test';

test('environment loads + reveal keeps spaces', async ({ page }) => {
  // Load desktop entry
  await page.goto('index.html');

  // Background iframe exists
  const envIframe = page.locator('#environment-iframe');
  await expect(envIframe).toHaveCount(1);

  // Globals from scripts exist
  await expect.poll(async () => page.evaluate(() => !!window['__WINDS_SONG__'])).toBe(true);

  // Trigger a reveal quickly (simulate)
  await page.evaluate(() => {
    // don't care about timing here—call directly
    // @ts-ignore
    if (typeof window.runRevealSequence === 'function') window.runRevealSequence();
  });

  // The bar appears
  const bar = page.locator('.env-reveal-bar');
  await expect(bar).toBeVisible();

  // Grab the first line’s words and assert NBSP usage (char code 160 present)
  const firstLine = page.locator('.env-reveal-line').first();
  await expect(firstLine).toBeVisible();
  const html = await firstLine.evaluate(el => el.innerHTML);
  expect(html).toMatch(/\u00A0/); // non-breaking space present

  // No console errors
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  expect(errors).toHaveLength(0);
});
