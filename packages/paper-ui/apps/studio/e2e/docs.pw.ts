import { expect, test } from '@playwright/test';

const PAGES = [
  { id: 'paper-surface', name: 'PaperSurface' },
  { id: 'material-effect', name: 'MaterialEffect' },
  { id: 'pencil-text', name: 'PencilText' },
  { id: 'paper-card', name: 'PaperCard' },
  { id: 'paper-button', name: 'PaperButton' },
];

test('every component page has the documented sections in order and real props', async ({ page }) => {
  for (const { id, name } of PAGES) {
    await page.goto('/#' + id);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    const headings = await page.locator('.docs-article h2').allTextContents();
    expect(headings).toEqual(['Installation', 'Usage', 'Examples', 'Keyboard and accessibility', 'API']);
    await expect(page.locator('.docs-article h3').first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Prop' })).toBeVisible();
    await expect(page.getByText('npm install @in-c0/paper-ui@alpha react')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Previous and next page' })).toBeVisible();
  }
});

test('a page never mounts more than one WebGL material', async ({ page }) => {
  for (const { id } of PAGES) {
    await page.goto('/#' + id);
    await page.waitForTimeout(400);
    const live = await page.locator('[data-shader-status="webgl"], [data-shader-status="suspended"]').count();
    expect(live, id).toBeLessThanOrEqual(1);
  }
});

test('handing the shader to another preview keeps a single live material', async ({ page }) => {
  await page.goto('/#material-effect');
  await page.getByRole('button', { name: 'Render live' }).first().click();
  await page.waitForTimeout(300);
  expect(await page.locator('[data-shader-status="webgl"], [data-shader-status="suspended"]').count()).toBeLessThanOrEqual(1);
});

test('Preview / Code switch shows the snippet for the selected option', async ({ page }) => {
  await page.goto('/#paper-surface');
  const preview = page.locator('.docs-preview').first();
  await preview.getByRole('button', { name: "light='diffuse'" }).click();
  await preview.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(preview.locator('pre')).toContainText('light="diffuse"');
  await preview.getByRole('button', { name: 'Replay preview' }).click();
  await expect(preview.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('copy buttons swap to a check for two seconds without a toast', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#paper-button');
  const copy = page.getByRole('button', { name: 'Copy command' });
  await copy.click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install @in-c0/paper-ui@alpha react');
  await expect(page.getByRole('button', { name: 'Copy command' })).toBeVisible({ timeout: 3500 });
});

test('the package manager choice is remembered across pages', async ({ page }) => {
  await page.goto('/#paper-card');
  await page.getByRole('group', { name: 'Package manager' }).getByRole('button', { name: 'pnpm' }).click();
  await expect(page.getByText('pnpm add @in-c0/paper-ui@alpha react')).toBeVisible();
  await page.goto('/#pencil-text');
  await page.reload();
  await expect(page.getByText('pnpm add @in-c0/paper-ui@alpha react')).toBeVisible();
});

test('copy page produces Markdown with the API table and alpha status', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#material-effect');
  await page.getByRole('button', { name: 'Copy page as Markdown' }).click();
  const md = await page.evaluate(() => navigator.clipboard.readText());
  expect(md).toContain('# MaterialEffect');
  expect(md).toContain('| Prop | Type | Default | Description |');
  expect(md).toContain('experimental alpha');
  expect(md).toContain('`renderMode`');
});

test('the palette opens with / and Ctrl+K and navigates with the keyboard', async ({ page }) => {
  await page.goto('/#paper-button');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search pages' });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('card');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#paper-card$/);
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('[ and ] move between component pages; the Studio share hash still opens the Studio', async ({ page }) => {
  await page.goto('/#paper-surface');
  await page.keyboard.press(']');
  await expect(page).toHaveURL(/#material-effect$/);
  await page.keyboard.press('[');
  await expect(page).toHaveURL(/#paper-surface$/);
  await page.goto('/#effect=grain-sphere&speed=0.31');
  await expect(page.getByRole('heading', { name: 'The afternoon arrives.' })).toBeVisible();
});

test('the skip link on a docs page focuses content without leaving the page', async ({ page }) => {
  await page.goto('/#pencil-text');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveURL(/#pencil-text$/);
});

test('docs pages do not overflow at 390px and the menu lists every page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { id } of PAGES) {
    await page.goto('/#' + id);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, id).toBeLessThanOrEqual(391);
  }
  await page.getByRole('button', { name: 'Open menu' }).click();
  const nav = page.getByRole('navigation', { name: 'All pages' });
  for (const { name } of PAGES) await expect(nav.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
});

test('llms.txt is served and states the alpha status', async ({ request }) => {
  const res = await request.get('/llms.txt');
  expect(res.ok()).toBe(true);
  const text = await res.text();
  expect(text).toContain('npm install @in-c0/paper-ui@alpha react');
  expect(text).toContain('Not production-certified');
});
