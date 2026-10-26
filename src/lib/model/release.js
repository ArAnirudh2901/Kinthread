import { RUNTIME } from '../runtime.generated.js';

export const RELEASE_URL = '/model-release.json';

export function releaseMatches(expected, published) {
  if (!expected || !published) return false;
  if (expected.releaseId !== published.releaseId ||
      expected.checkpointSha256 !== published.checkpointSha256 ||
      expected.contentHash !== published.contentHash ||
      expected.modelBase !== published.modelBase) return false;
  const a = expected.files || {}, b = published.files || {};
  const names = Object.keys(a).sort();
  if (names.length !== Object.keys(b).length || names.some((name) => !b[name])) return false;
  return names.every((name) => a[name].bytes === b[name].bytes && a[name].sha256 === b[name].sha256);
}

export async function verifyPublishedRelease(fetchImpl = fetch) {
  const response = await fetchImpl(RELEASE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Release manifest request failed with HTTP ${response.status}.`);
  let published;
  try { published = await response.json(); }
  catch { throw new Error('The published release manifest is not valid JSON.'); }
  return releaseMatches(RUNTIME.release, published);
}
