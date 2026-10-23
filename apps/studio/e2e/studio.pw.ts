import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the studio is the first experience and the original paper preset is visible', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Paper, in the light.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Components and materials' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cotton paper' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('slider', { name: 'Paper roughness' })).toHaveValue('0.66');
  await expect(page.getByRole('slider', { name: 'Surface wrinkles' })).toHaveValue('0.87');
  await expect(page.locator('.studio-preview__material')).toBeVisible();
});

test('all material modes are selectable, controls update and share link persists them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const mode of ['Warm sphere', 'Gentle blob', 'Amber wave', 'Dithered light', 'Printed study']) {
    await page.getByRole('button', { name: mode }).click();
    await expect(page.getByRole('button', { name: mode })).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.studio-preview__material')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Warm sphere' }).click();
  await page.getByRole('slider', { name: 'Movement' }).fill('0.31');
  await expect(page.getByRole('slider', { name: 'Movement' })).toHaveValue('0.31');
  await expect.poll(() => new URL(page.url()).hash).toContain('speed=0.31');
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Movement' })).toHaveValue('0.31');
  await expect(page.getByRole('button', { name: 'Warm sphere' })).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('the lettering mode lets visitors edit and replay writing', async ({ page }) => {
  await page.getByRole('button', { name: 'Written in graphite' }).click();
  await expect(page.getByRole('heading', { name: 'Words, made slowly.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Handwritten text' }).fill('조금씩, 꾸준히.');
  await page.getByRole('button', { name: 'Write it again' }).click();
  await page.getByRole('button', { name: 'Dark pencil' }).click();
  await expect(page.getByRole('button', { name: 'Dark pencil' })).toHaveAttribute('aria-pressed', 'true');
});

test('buttons have actual effects', async ({ page }) => {
  const save = page.getByRole('button', { name: 'Save note' });
  await save.click();
  await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Paper roughness' }).fill('0.24');
  await page.getByRole('button', { name: 'Reset parameters' }).click();
  await expect(page.getByRole('slider', { name: 'Paper roughness' })).toHaveValue('0.66');
});

test('mobile does not overflow horizontally and controls can be used', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Paper, in the light.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Printed study' })).toBeVisible();
  await page.getByRole('button', { name: 'Printed study' }).click();
  await expect(page.getByRole('heading', { name: 'Collected impressions.' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    width: window.innerWidth,
    overflowingElements: Array.from(document.querySelectorAll('*'))
      .map((element) => ({ el: element, right: element.getBoundingClientRect().right }))
      .filter(({ right }) => right > window.innerWidth + 1)
      .slice(0, 12)
      .map(({ el, right }) => ({ tag: el.tagName, className: el.getAttribute('class'), right: Math.round(right) })),
  }));
  expect(dimensions.content, JSON.stringify(dimensions.overflowingElements)).toBeLessThanOrEqual(dimensions.width + 1);
});

test('the reduced-motion preference disables ambient shader controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Gentle blob' }).click();
  await expect(page.getByRole('button', { name: 'Reduced motion enabled' })).toBeDisabled();
});

test('the halftone image picker uses a local browser blob without server upload', async ({ page }) => {
  await page.getByRole('button', { name: 'Printed study' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'sketch.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="30"/></svg>'),
  });
  await expect(page.locator('.studio-live-status')).toContainText('Nothing uploaded');
});

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('studio.png'), fullPage: true });
});
