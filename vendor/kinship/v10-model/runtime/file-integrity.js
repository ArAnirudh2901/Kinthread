export async function verifyFileBytes(buffer, file, hash) {
  if (buffer.byteLength !== file.bytes) return false;
  const actual = await hash(buffer);
  return actual === file.sha256;
}
