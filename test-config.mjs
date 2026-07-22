import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSyncIntervalSeconds } from './src/sync.mjs';

test('normalizeSyncIntervalSeconds falls back to 30 for non-positive or invalid values', () => {
    assert.equal(normalizeSyncIntervalSeconds(-1), 30);
    assert.equal(normalizeSyncIntervalSeconds(0), 30);
    assert.equal(normalizeSyncIntervalSeconds('not-a-number'), 30);
});

test('normalizeSyncIntervalSeconds preserves valid positive numeric values', () => {
    assert.equal(normalizeSyncIntervalSeconds(7), 7);
});
