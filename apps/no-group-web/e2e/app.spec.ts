import { test, expect } from '@playwright/test';

test('the flagship homepage introduces the group and routes through the ecosystem', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A new perspective starts here/i })).toBeVisible();
  await expect(page.getByText('Independent technology group', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Ecosystem', exact: true }).click();
  await expect(page).toHaveURL(/\/ecosystem$/);
  await expect(page.getByRole('heading', { name: /A connected portfolio/i })).toBeVisible();
  await expect(page.locator('a.product-card').filter({ hasText: 'Vortex' })).toHaveAttribute('href', 'https://vortex.no-group.org');
});

test('each flagship route works directly and updates its document title', async ({ page }) => {
  const pages = [
    ['/infrastructure', /Infrastructure — N\.O Group/],
    ['/intelligence', /Jeris AI — N\.O Group/],
    ['/ventures', /Ventures — N\.O Group/],
    ['/company', /Company — N\.O Group/],
    ['/contact', /Contact — N\.O Group/],
  ] as const;
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('main h1')).toBeVisible();
  }
});

test('the theme control switches palettes and remembers the selected theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('the mobile menu exposes the complete corporate information architecture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Intelligence' }).click();
  await expect(page).toHaveURL(/\/intelligence$/);
  await expect(page.getByRole('heading', { name: /Intelligence with room to think/i })).toBeVisible();
});

test('the contact experience has direct channels and a private inquiry helper', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: /contact@no-group\.org/ })).toHaveAttribute('href', 'mailto:contact@no-group.org');
  await expect(page.locator('a[href="tel:+2347075536341"]')).toHaveText('+234 (0) 707 5536 341');
  await expect(page.locator('a[href="https://wa.me/2347075536341"]')).toBeVisible();
  await page.getByLabel('Your name').fill('Ada Builder');
  await page.getByLabel('Your email').fill('ada@example.com');
  await page.getByLabel('I am reaching out as').selectOption({ label: 'Developer or builder' });
  await page.getByLabel('Tell us a little about it').fill('I would like to explore a practical partnership.');
  await page.getByRole('button', { name: 'Prepare my inquiry' }).click();
  await expect(page.getByText('Your message is ready to send', { exact: false })).toBeVisible();
});

test('product and social destinations use the supplied URLs', async ({ page }) => {
  await page.goto('/ecosystem');
  const destinations = [
    ['Vortex', 'https://vortex.no-group.org'],
    ['Tungsten', 'https://tungsten.no-group.org'],
    ['Jeris', 'https://jeris.no-group.org'],
    ['Link', 'https://link.no-group.org'],
    ['KwikChat', 'https://kwikchat.no-group.org'],
    ['ToolsKit', 'https://toolskit.no-group.org'],
  ] as const;
  for (const [name, url] of destinations) {
    await expect(page.locator('a.product-card').filter({ hasText: name }).first()).toHaveAttribute('href', url);
  }
  await page.goto('/infrastructure');
  await expect(page.locator('a[href="https://graphene.no-group.org"]')).toBeVisible();
  await expect(page.locator('a[href="https://tether.no-group.org"]')).toBeVisible();
  await expect(page.locator('a[href="https://mtekfiresafetyltd.com"]')).toBeVisible();
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/NO-Group');
  await expect(page.getByRole('link', { name: /Discord/ })).toHaveAttribute('href', 'https://discord.gg/3q2VQq9DAh');
  await expect(page.getByRole('link', { name: /Bluesky/ })).toHaveAttribute('href', 'https://bsky.app/profile/no-group.bsky.social');
});

test('sitemap and robots instructions describe every public route', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  for (const route of ['/', '/ecosystem', '/infrastructure', '/intelligence', '/ventures', '/company', '/contact']) {
    expect(xml).toContain(`https://n.o-group.org${route}`);
  }
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toMatch(/Sitemap: https:\/\/n\.o-group\.org\/sitemap\.xml/);
});

test('homepage passes automated accessibility checks', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.goto('/');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
});
