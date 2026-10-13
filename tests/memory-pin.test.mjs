import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validMemoryPin } from '../lib/memory-pin.ts';
test('memory pins accept campus coordinates only, including map edges', () => {
  const pin = { mapId: 'columbia', x: 500, y: 800, location: 'Campus grounds' };
  assert(validMemoryPin(pin));
  assert(validMemoryPin({ ...pin, x: 0, y: 1427 }));
  for (const invalid of [null, {}, { ...pin, mapId: 'manhattan' }, { ...pin, x: -1 }, { ...pin, y: 1428 }, { ...pin, x: NaN }, { ...pin, x: Infinity }, { ...pin, x: '500' }, { ...pin, location: 'a'.repeat(101) }]) assert.equal(validMemoryPin(invalid), false);
});
