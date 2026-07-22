import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSyncIntervalSeconds } from './sync-livesync-compatible.mjs';

test('compat sync interval rejects unsafe values and retains valid values', () => {
    assert.equal(normalizeSyncIntervalSeconds(-1), 30);
    assert.equal(normalizeSyncIntervalSeconds(0), 30);
    assert.equal(normalizeSyncIntervalSeconds('invalid'), 30);
    assert.equal(normalizeSyncIntervalSeconds(7), 7);
});
