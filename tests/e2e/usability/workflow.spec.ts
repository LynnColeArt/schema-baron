import { test } from '@playwright/test';
import { keyboardJourney } from './journey';
import { nativeContext } from './accessibility';
import { root } from './harness';
test.setTimeout(300000);
test.use({
  actionTimeout: 10000
});
test('keyboard primary journey and full five-mode application checkpoint', async ({
  page
}, info) => keyboardJourney(page, info));
test('native 200 percent keyboard primary journey uses actual browser zoom and all five modes', async ({}, info) => {
  const context = await nativeContext(root);
  try {
    await keyboardJourney(context.pages()[0]!, info, true);
  } finally {
    await context.close();
  }
});
