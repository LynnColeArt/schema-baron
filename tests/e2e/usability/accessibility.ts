import { chromium, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export const AXE_SOURCE = process.env.AXE_SOURCE ?? '/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js';
export async function audit(page: Page, info: TestInfo, name: string) {
  await page.addScriptTag({
    content: readFileSync(AXE_SOURCE, 'utf8')
  });
  const result = await page.evaluate(async () => (window as unknown as {
    axe: {
      run: (options: unknown) => Promise<{
        violations: unknown[];
      }>;
    };
  }).axe.run({
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa']
    }
  }));
  writeFileSync(info.outputPath(name + '.json'), JSON.stringify({
    AXE_SOURCE,
    ...result
  }, null, 2));
  expect(result.violations).toEqual([]);
}
export async function nativeContext(root: string) {
  const profile = mkdtempSync(join(root, 'native-200-'));
  mkdirSync(join(profile, 'Default'));
  writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify({
    partition: {
      default_zoom_level: {
        x: Math.log(2) / Math.log(1.2)
      }
    }
  }));
  return chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chromium',
    viewport: {
      width: 1280,
      height: 800
    },
    args: ['--window-size=1280,800', '--force-device-scale-factor=1', '--no-sandbox']
  });
}
export async function nativeMetrics(page: Page, info: TestInfo) {
  const metrics = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    devicePixelRatio,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    viewportScale: visualViewport?.scale
  }));
  expect(metrics).toEqual({
    innerWidth: 640,
    innerHeight: 400,
    devicePixelRatio: 2,
    cssZoom: '1',
    viewportScale: 1
  });
  writeFileSync(info.outputPath('native-200-metrics.json'), JSON.stringify(metrics, null, 2));
}
