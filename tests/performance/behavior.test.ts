import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distribution } from './behavior.ts';
test('nearest rank retains raw tails without rounding or averaging failed budgets', () => {
  const values = Array.from({
    length: 30
  }, (_, i) => i + .25);
  assert.equal(distribution(values).p95Ms, 28.25);
  assert.deepEqual(distribution(values).samplesMs, values);
  assert.throws(() => distribution([]));
  assert.throws(() => distribution([NaN]));
});
