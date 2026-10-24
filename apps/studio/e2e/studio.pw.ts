import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Switching six expensive shader canvases is a GPU stress test, not a
  // deterministic test of navigation and URL persistence. For those behavior
  // checks, simulate the supported CSS fallback before any shaders mount.
  if (
    testInfo.title.startsWith('all material modes are selectable') ||
    testInfo.title.startsWith('non-WebGL devices retain')
  ) {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return original.call(this, type as '2d', ...(args as []));
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
  }
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
  await expect(page.locator('.studio-upload__filename')).toHaveText('sketch.svg');
});

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('studio.png'), fullPage: true });
});

test('non-WebGL devices retain semantic controls and the artwork fallback', async ({ page }) => {
  await expect(page.locator('.studio-preview__material')).toHaveAttribute('data-shader-status', 'fallback');
  await page.getByRole('button', { name: 'Printed study' }).click();
  await expect(page.locator('.pui-material-effect__fallback-image')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Dot size' })).toBeVisible();
  await page.getByRole('button', { name: 'Written in graphite' }).click();
  await expect(page.getByRole('textbox', { name: 'Handwritten text' })).toBeVisible();
});

test('GPU canvas mounts for the initial paper material when WebGL is supported', async ({ page }) => {
  const material = page.locator('.studio-preview__material');
  await expect.poll(() => material.getAttribute('data-shader-status')).toMatch(/^(webgl|fallback)$/);
  if ((await material.getAttribute('data-shader-status')) === 'webgl') {
    await expect(page.locator('.studio-preview canvas').first()).toBeVisible();
  }
});

test('offscreen shader pauses without hiding DOM or affecting accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.reload();
  const material = page.locator('.studio-preview__material');
  await expect(material).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // Offscreen material no longer needs a GPU context; the UI is still navigable.
  await expect
    .poll(() => material.getAttribute('data-shader-status'))
    .toMatch(/^(suspended|fallback)$/);
  await expect(page.getByRole('button', { name: 'Reset parameters' })).toBeVisible();
  await material.scrollIntoViewIfNeeded();
  await expect.poll(() => material.getAttribute('data-shader-status')).toMatch(/^(webgl|fallback)$/);
});

test('material nav is keyboard-operable', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Amber wave' });
  await button.focus();
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'A slow passing moment.' })).toBeVisible();
});

test('the published CSS is present on interactive cards and buttons', async ({ page }) => {
  const paper = page.getByRole('button', { name: 'Save note' });
  await expect(paper).toHaveCSS('cursor', 'pointer');
  await expect(paper).toHaveCSS('border-top-style', 'solid');
});

test('comparison toggles shader eligibility without hiding material content', async ({ page }) => {
  const material = page.locator('.studio-preview__material');
  await page.getByRole('button', { name: 'Compare without shader' }).click();
  await expect(page.getByRole('button', { name: 'Restore shader' })).toHaveAttribute('aria-pressed', 'true');
  await expect(material).toHaveAttribute('data-shader-status', 'fallback');
  await expect(page.getByText('A little, over time.', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Restore shader' }).click();
  await expect(page.getByRole('button', { name: 'Compare without shader' })).toHaveAttribute('aria-pressed', 'false');
});

test('Korean lettering copied snippet has actual lines and required imports', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Written in graphite' }).click();
  await page.getByRole('button', { name: 'Copy component' }).click();
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toContain("import '@in-c0/paper-ui/styles.css';\n");
  expect(snippet).toContain('<PencilText font={korean}>');
  expect(snippet).not.toContain('\\n');
});

test('inspector explanatory text passes basic 4.5:1 contrast check', async ({ page }) => {
  const ratio = await page.locator('.studio-inspector__hint').first().evaluate((el) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (v: number[]) => v.map((c) => {
      const t = c / 255;
      return t <= 0.04045 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const foreground = lum(rgb(getComputedStyle(el).color));
    const background = lum(rgb(getComputedStyle(el.closest('.studio-inspector')!).backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('custom image picker exposes an accessible label without a native browser button', async ({ page }) => {
  await page.getByRole('button', { name: 'Printed study' }).click();
  const input = page.getByLabel('Your drawing');
  await expect(input).toHaveAttribute('type', 'file');
  await expect(page.getByText('Select image')).toBeVisible();
  await expect(input).toHaveCSS('opacity', '0');
  await input.focus();
  await expect(page.locator('.studio-upload')).toHaveCSS('outline-style', 'solid');
});
