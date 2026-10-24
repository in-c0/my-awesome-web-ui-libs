import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async ({ page }) => {
  await page.goto('/?device-lab=1');
});

test('device laboratory loads without starting a measurement or collecting external telemetry', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'How does paper feel on this device?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start local sample' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download JSON report' })).toBeDisabled();
  await expect(page.getByText('No telemetry, automatic uploads, or remote collection.', { exact: false })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Material to test' })).toBeVisible();
  await expect(page.locator('.device-lab__effect')).toHaveAttribute('data-shader-pixel-budget', '480000');
});

test('320px layout never clips device lab controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole('button', { name: 'Start local sample' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download JSON report' })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    visible: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(sizes.visible).toBeLessThanOrEqual(sizes.width + 1);
});

test('collects a three-second RAF sample and downloads its consented local JSON', async ({ page }) => {
  await page.getByRole('button', { name: '3 s' }).click();
  await page.getByRole('button', { name: 'Start local sample' }).click();
  await expect(page.getByRole('button', { name: 'Sampling…' })).toBeDisabled();
  await expect(page.getByText('Sample complete. You can export the locally generated report.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('lab-p95')).toContainText('ms');
  await page.getByRole('combobox', { name: 'VoiceOver / TalkBack announces and operates controls' }).selectOption('issue');
  await page.getByRole('textbox', { name: 'Device, screen-reader version or observed issues (optional)' }).fill('Simulated mobile Chromium; not real iOS/Android.');
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON report' }).click();
  const download = await wait;
  expect(download.suggestedFilename()).toMatch(/^paper-ui-device-lab-.*\.json$/);
  const raw = await readFile(await download.path(), 'utf8');
  const data = JSON.parse(raw);
  expect(data.schema).toBe('paper-ui.device-lab.v1');
  expect(data.requestedSeconds).toBe(3);
  expect(data.requestAnimationFrame.frameIntervals).toBeGreaterThan(0);
  expect(data.manualChecks.screenReader).toBe('issue');
  expect(data.testerNotes).toContain('Simulated mobile Chromium');
  expect(data.device.viewport.width).toBe(390);
  expect(data.pixelBudget).toBe('480000');
});

test('manually recorded accessibility outcomes stay explicitly untested until selected', async ({ page }) => {
  const screenReader = page.getByRole('combobox', { name: 'VoiceOver / TalkBack announces and operates controls' });
  await expect(screenReader).toHaveValue('not-tested');
  await screenReader.selectOption('pass');
  await expect(screenReader).toHaveValue('pass');
  await page.getByRole('button', { name: 'Amber wave' }).click();
  await expect(page.locator('.device-lab__effect')).toHaveAttribute('data-material-kind', 'grain-wave');
});

test('keyboard focus and reduced-motion preferences remain available', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await expect(page.getByText('Reduced motion is enabled:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start local sample' }).focus();
  await expect(page.getByRole('button', { name: 'Start local sample' })).toHaveCSS('outline-style', 'solid');
});
