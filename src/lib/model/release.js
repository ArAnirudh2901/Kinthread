import { RUNTIME } from '../runtime.generated.js';

export const RELEASE_URL = '/model-release.json';
const HASH = /^[a-f0-9]{64}$/;
const SHORT_HASH = /^[a-f0-9]{12}$/;

function flattenFiles(model) {
  const files = {};
  for (const entry of Object.values(model.files || {})) {
    if (entry.json) files[entry.json.file] = entry.json;
    for (const part of entry.parts || []) files[part.file] = part;
  }
  return files;
}

export function validPublishedRelease(release) {
  if (!release || typeof release.releaseId !== 'string' || !/^[\w.-]{1,64}$/.test(release.releaseId) ||
      !HASH.test(release.checkpointSha256 || '') || !SHORT_HASH.test(release.contentHash || '') ||
      !SHORT_HASH.test(release.runtimeHash || '') || release.modelBase !== `/m/${release.contentHash}/` ||
      release.runtime !== `/r/${release.runtimeHash}/`) return false;
  const model = release.model;
  if (!model || model.releaseId !== release.releaseId || model.version !== release.releaseId ||
      model.contentHash !== release.contentHash || model.base !== release.modelBase ||
      !Number.isSafeInteger(model.totalBytes) || model.totalBytes <= 0 || !model.files) return false;
  const parts = flattenFiles(model);
  const publishedFiles = release.files;
  if (!publishedFiles || Object.keys(parts).length !== Object.keys(publishedFiles).length) return false;
  let total = 0;
  for (const [name, file] of Object.entries(parts)) {
    const published = publishedFiles[name];
    if (!published || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !HASH.test(file.sha256 || '') ||
        file.bytes !== published.bytes || file.sha256 !== published.sha256) return false;
    total += file.bytes;
  }
  return total === model.totalBytes;
}

export function releaseMatches(expected, published) {
  if (!validPublishedRelease(published) || expected?.releaseId !== published.releaseId ||
      expected?.checkpointSha256 !== published.checkpointSha256 || expected?.contentHash !== published.contentHash ||
      expected?.runtimeHash !== published.runtimeHash || expected?.runtime !== published.runtime ||
      expected?.modelBase !== published.modelBase) return false;
  const a = expected.files || {}, b = published.files || {};
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) =>
    a[name]?.bytes === b[name]?.bytes && a[name]?.sha256 === b[name]?.sha256);
}

export function sameRelease(expected, published) {
  return releaseMatches(expected, published);
}

export async function verifyPublishedRelease(fetchImpl = fetch) {
  const response = await fetchImpl(RELEASE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Release manifest request failed with HTTP ${response.status}.`);
  let published;
  try { published = await response.json(); }
  catch { throw new Error('The published release manifest is not valid JSON.'); }
  if (!validPublishedRelease(published)) throw new Error('The published release manifest is incomplete or invalid.');
  return published;
}

export const EMBEDDED_RELEASE = RUNTIME.release;
