import { test, expect, Page } from '@playwright/test';

const VIEWPORTS = [
  { label: 'mobile-375',  width: 375,  height: 812,  isMobile: true  },
  { label: 'tablet-768',  width: 768,  height: 1024, isMobile: true  },
  { label: 'laptop-1024', width: 1024, height: 768,  isMobile: false },
  { label: 'desktop-1440',width: 1440, height: 900,  isMobile: false },
] as const;

const ROUTES = [
  { path: '/',               name: 'landing' },
  { path: '/pricing',        name: 'pricing' },
  { path: '/about',          name: 'about' },
  { path: '/agents/vega',    name: 'agent-vega' },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.label} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`${route.name} — loads, no horizontal overflow, key elements visible`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: 'load' });
        await page.waitForLoadState('networkidle').catch(() => { /* networkidle may not settle w/ images */ });

        // Key landmarks are visible
        const nav = page.getByTestId('site-nav');
        await expect(nav).toBeVisible();

        await assertNoHorizontalOverflow(page);

        // Screenshot for manual review (not baseline-compared)
        await page.screenshot({
          path: `e2e/screenshots/${route.name}-${vp.label}.png`,
          fullPage: true,
        });
      });

      if (vp.isMobile) {
        test(`${route.name} — hamburger drawer opens/closes at ${vp.width}px`, async ({ page }) => {
          await page.goto(route.path, { waitUntil: 'load' });

          const hamburger = page.getByTestId('nav-hamburger').first();
          await expect(hamburger).toBeVisible();

          // Pill nav should be hidden below 900px (CSS)
          const pillNavVisible = await page
            .locator('.vq-nav-desktop')
            .first()
            .isVisible();
          expect(pillNavVisible).toBe(false);

          await hamburger.click();
          const drawer = page.getByTestId('nav-drawer');
          await expect(drawer).toBeVisible();

          // Drawer contains at least one agent link
          await expect(drawer.getByText(/vega/i).first()).toBeVisible();

          // Close via Escape
          await page.keyboard.press('Escape');
          await expect(drawer).toBeHidden();

          // Reopen and close via close button
          await hamburger.click();
          await expect(drawer).toBeVisible();
          await page.getByTestId('nav-drawer-close').click();
          await expect(drawer).toBeHidden();

          await assertNoHorizontalOverflow(page);
        });
      }
    }
  });
}
