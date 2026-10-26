export function releaseIdentityMatches(actual, expected) {
  return actual?.releaseId === expected.releaseId && actual?.checkpointSha256 === expected.checkpointSha256;
}
