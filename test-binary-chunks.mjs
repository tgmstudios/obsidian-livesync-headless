import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import {
    decodeBinaryChunks,
    encodeFileToChunks,
    generateChunkId,
} from './src/sync.mjs';
import {
    decodeBinaryChunks as decodeBinaryChunksCompat,
    encodeFileToChunks as encodeFileToChunksCompat,
} from './sync-livesync-compatible.mjs';

test('decodeBinaryChunks decodes each base64 chunk before concatenating', () => {
    const original = Buffer.concat([
        Buffer.from('%PDF-1.7\n'),
        randomBytes(4096),
        Buffer.from('\n%%EOF\n'),
    ]);
    const chunks = [original.subarray(0, 137), original.subarray(137, 2048), original.subarray(2048)]
        .map((chunk) => chunk.toString('base64'));

    const decoded = decodeBinaryChunks(chunks);
    assert.deepEqual(decoded, original);
});

test('joining base64 chunks directly would truncate at first padded chunk', () => {
    const original = Buffer.from('abcdefghijklmnopqrstuvwxyz0123456789');
    const chunks = [original.subarray(0, 5), original.subarray(5)].map((chunk) => chunk.toString('base64'));
    assert.notDeepEqual(Buffer.from(chunks.join(''), 'base64'), original);
    assert.deepEqual(decodeBinaryChunks(chunks), original);
});

test('encodeFileToChunks splits binary as independently-decodable base64 chunks', () => {
    const original = randomBytes(250_000);
    const chunks = encodeFileToChunks(Buffer.from(original), true, 100_000);
    assert.equal(chunks.length, 3);
    assert.deepEqual(decodeBinaryChunks(chunks), Buffer.from(original));
});

test('compatible script binary helpers preserve independently-decodable chunks', () => {
    const original = randomBytes(250_000);
    const chunks = encodeFileToChunksCompat(Buffer.from(original), true, 100_000);
    assert.equal(chunks.length, 3);
    assert.deepEqual(decodeBinaryChunksCompat(chunks), Buffer.from(original));
});

test('generateChunkId is exported for regression coverage', () => {
    assert.match(generateChunkId('abc', ''), /^h:[a-f0-9]{40}$/);
});
