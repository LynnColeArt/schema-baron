import { workshopJourney } from './workshop-journey.js';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { startIsolatedStudio } from './helpers.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(900000);
let visitorContext: BrowserContext | undefined;
let visitorPage: Page | undefined;
let studio: Awaited<ReturnType<typeof startIsolatedStudio>>;
test.beforeAll(async () => { studio = await startIsolatedStudio('schema-baron-workshop-ui-'); });
test.afterAll(async () => { await visitorContext?.close();
 await studio?.stop(); });
test.afterEach(async ({ page }, info) => {
 if (info.status !== info.expectedStatus) {
  await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true, mask: [page.locator('input[type=password]')] });
  writeFileSync(info.outputPath('visible-failure.txt'), await page.locator('body').innerText());
  if (visitorPage && !visitorPage.isClosed()) { await visitorPage.screenshot({ path: info.outputPath('visitor-failure.png'), mask: [visitorPage.locator('input[type=password]')] }); writeFileSync(info.outputPath('visitor-failure.txt'), await visitorPage.locator('body').innerText(), { mode: 0o600 }); }
 }
});

test('Workshop Planner is authored and used from a cold wizard without hidden model repairs', async ({ page, browser }, info) => {
 await workshopJourney(page, browser, info, studio, { onVisitor: (context, app) => { visitorContext = context; visitorPage = app; } });
});
