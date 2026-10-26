import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseMatches, validPublishedRelease, verifyPublishedRelease } from '../src/lib/model/release.js';
import { RUNTIME } from '../src/lib/runtime.generated.js';
import { verifyFileBytes } from '../runtime/file-integrity.js';
import { releaseIdentityMatches } from '../scripts/release-identity.mjs';

const valid = structuredClone(RUNTIME.release);

test('release manifest must match the embedded identity, checkpoint, content hash, and every file', () => {
  assert.equal(releaseMatches(valid, structuredClone(valid)), true);
  for (const key of ['releaseId', 'checkpointSha256', 'contentHash', 'runtimeHash', 'runtime', 'modelBase']) {
    const changed = structuredClone(valid);
    changed[key] = 'different';
    assert.equal(releaseMatches(valid, changed), false, `${key} mismatch is rejected`);
  }
  const changedFile = structuredClone(valid);
  const firstFile = Object.keys(changedFile.files)[0];
  changedFile.files[firstFile].sha256 = 'd'.repeat(64);
  assert.equal(releaseMatches(valid, changedFile), false);
  const missingFile = structuredClone(valid);
  delete missingFile.files[firstFile];
  assert.equal(releaseMatches(valid, missingFile), false);
});

test('build release pin rejects an identity or selected-checkpoint hash mismatch', () => {
  const pinned = { releaseId: 'v10-r8p', checkpointSha256: 'a'.repeat(64) };
  assert.equal(releaseIdentityMatches(pinned, pinned), true);
  assert.equal(releaseIdentityMatches({ ...pinned, releaseId: 'v10-r7' }, pinned), false);
  assert.equal(releaseIdentityMatches({ ...pinned, checkpointSha256: 'b'.repeat(64) }, pinned), false);
});

test('same-size cached bytes with a different hash are rejected', async () => {
  const data = new Uint8Array([1, 2, 3]);
  const file = { bytes: 3, sha256: '0'.repeat(64) };
  const hash = async (buf) => Buffer.from(buf).toString('hex');
  assert.equal(await verifyFileBytes(data, file, hash), false);
  assert.equal(await verifyFileBytes(data, { ...file, sha256: '010203' }, hash), true);
  assert.equal(await verifyFileBytes(data.subarray(0, 2), file, hash), false);
});

test('page release check fetches the published manifest without cache', async () => {
  let request;
  const release = await verifyPublishedRelease(async (...args) => {
    request = args;
    return { ok: true, json: async () => RUNTIME.release };
  });
  assert.equal(release.releaseId, RUNTIME.release.releaseId);
  assert.equal(request[0], '/model-release.json');
  assert.deepEqual(request[1], { cache: 'no-store' });
});

test('a future model release can use its own versioned assets and runtime', () => {
  const future = structuredClone(valid);
  future.releaseId = 'v10-r9';
  future.model.releaseId = 'v10-r9';
  future.model.version = 'v10-r9';
  assert.equal(validPublishedRelease(future), true);
  assert.equal(releaseMatches(valid, future), false);
});
