import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { thresholdsFromCbs } from '../_shared/procurement/cbs.ts';

describe('CBS threshold calculation', () => {
  it('calculates the published September 2026 observation and the following period', () => {
    const result = thresholdsFromCbs(1150.5790803726, 2026, 9);
    assert.equal(result.effectiveFrom, '2026-10-16');
    assert.equal(result.noTenderMax, 170700);
    assert.equal(result.zuta4Max, 416800);
    assert.equal(result.zuta6Max, 833600);
    assert.equal(result.isOfficial, false);
    assert.match(result.source, /2026-09/);
  });

  it('handles year boundaries and rejects invalid inputs', () => {
    assert.equal(thresholdsFromCbs(1000, 2025, 12).effectiveFrom, '2026-01-16');
    assert.throws(() => thresholdsFromCbs(NaN, 2026, 9));
    assert.throws(() => thresholdsFromCbs(1000, 2026, 13));
    assert.throws(() => thresholdsFromCbs(1000, 2026.5, 9));
  });
});
