// The committed model copy (vendor/kinship) must match its SHA-256 manifest byte for byte.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dir = new URL('../vendor/kinship/', import.meta.url);
test('vendor/kinship files match manifest.json', () => {
  const { files } = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
  assert.ok(Object.keys(files).length >= 17);
  for (const [name, want] of Object.entries(files)) {
    const buf = readFileSync(new URL(name, dir));
    assert.equal(buf.length, want.bytes, name);
    assert.equal(createHash('sha256').update(buf).digest('hex'), want.sha256, name);
  }
});
