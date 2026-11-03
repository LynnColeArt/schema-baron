import { cpus, totalmem, platform, release, arch, loadavg } from 'node:os';
export function distribution(samples: number[]) {
  if (!samples.length || samples.some(value => !Number.isFinite(value) || value < 0)) throw Error('Require finite nonnegative samples');
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samplesMs: samples,
    count: samples.length,
    p95Ms: sorted[Math.ceil(samples.length * .95) - 1]!,
    minMs: sorted[0]!,
    maxMs: sorted.at(-1)!
  };
}
export function environment(browser: string) {
  return {
    capturedAt: new Date().toISOString(),
    hostLoadAverage: loadavg(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    ramBytes: totalmem(),
    os: `${platform()} ${release()} ${arch()}`,
    node: process.version,
    browser,
    warmupOperations: 5,
    percentile: 'nearest-rank',
    timing: 'Playwright action through observed rendered state, including automation overhead; query HTTP round trip through actual owner SQLite worker'
  };
}
/** Browser event -> stable painted state. Automation round trips are recorded separately. */
export async function beginRenderMeasure(page: import('@playwright/test').Page, event: 'keydown' | 'input', value: string, property: boolean) {
  await page.evaluate(({
    event,
    value,
    property
  }) => {
    type MeasurementWindow = Window & {
      wp25Render?: Promise<number>;
    };
    (window as MeasurementWindow).wp25Render = new Promise<number>(resolve => {
      document.addEventListener(event, () => {
        const start = performance.now();
        const check = () => {
          const input = document.querySelector<HTMLInputElement>('[aria-label="Title"]');
          const matches = input?.value === value && (!property || Array.from(document.querySelectorAll('[role=tab][aria-selected=true]')).some(tab => tab.textContent?.includes(value)));
          if (matches) requestAnimationFrame(() => resolve(performance.now() - start));else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }, {
        once: true,
        capture: true
      });
    });
  }, {
    event,
    value,
    property
  });
}
export async function endRenderMeasure(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as unknown as Window & {
    wp25Render: Promise<number>;
  }).wp25Render);
}
