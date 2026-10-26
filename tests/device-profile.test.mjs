import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deviceProfile } from '../src/lib/model/device-profile.js';

test('low-power profiles use one inference thread and one concurrent download', () => {
  assert.deepEqual(deviceProfile({ hardwareConcurrency: 2, deviceMemory: 8 }), {
    tier: 'low', engine: 'single', maxThreads: 1, maxDownloads: 1,
  });
  assert.equal(deviceProfile({ hardwareConcurrency: 8, deviceMemory: 8, connection: { saveData: true } }).tier, 'low');
  assert.equal(deviceProfile({ hardwareConcurrency: 8, deviceMemory: 8, connection: { effectiveType: '2g' } }).maxDownloads, 1);
});

test('balanced devices cap CPU workers and downloads without forcing scalar WebAssembly', () => {
  assert.deepEqual(deviceProfile({ hardwareConcurrency: 4, deviceMemory: 8 }), {
    tier: 'balanced', engine: 'auto', maxThreads: 2, maxDownloads: 2,
  });
});

test('high-capacity devices retain the calibrated threaded path', () => {
  assert.deepEqual(deviceProfile({ hardwareConcurrency: 8, deviceMemory: 8 }), {
    tier: 'high', engine: 'auto', maxThreads: 4, maxDownloads: 3,
  });
});
