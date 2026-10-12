import {
  checkCompatibility,
  LIMITS,
  canonical,
  exact,
  validateArtifact,
  type Artifact,
} from "./artifacts";
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
interface Entry {
  path: string;
  bytes: Uint8Array;
}
/** ZIP STORED only: no decompressor, descriptors, comments, extra fields or ZIP64. */
export function encodeArchive(entries: Entry[]): Uint8Array {
  const names = entries.map((e) => encoder.encode(e.path));
  let size = 22;
  entries.forEach((e, i) => {
    size += 30 + names[i].length + e.bytes.byteLength + 46 + names[i].length;
  });
  if (size > LIMITS.bundle) throw new Error("BUNDLE_LIMIT");
  const out = new Uint8Array(size),
    v = new DataView(out.buffer);
  let offset = 0;
  const localOffsets: number[] = [];
  const crcs: number[] = [];
  entries.forEach((e, i) => {
    localOffsets.push(offset);
    const crc = crc32(e.bytes);
    crcs.push(crc);
    v.setUint32(offset, 0x04034b50, true);
    v.setUint16(offset + 4, 20, true);
    v.setUint32(offset + 14, crc, true);
    v.setUint32(offset + 18, e.bytes.length, true);
    v.setUint32(offset + 22, e.bytes.length, true);
    v.setUint16(offset + 26, names[i].length, true);
    out.set(names[i], offset + 30);
    out.set(e.bytes, offset + 30 + names[i].length);
    offset += 30 + names[i].length + e.bytes.length;
  });
  const central = offset;
  entries.forEach((e, i) => {
    v.setUint32(offset, 0x02014b50, true);
    v.setUint16(offset + 4, 20, true);
    v.setUint16(offset + 6, 20, true);
    v.setUint32(offset + 16, crcs[i], true);
    v.setUint32(offset + 20, e.bytes.length, true);
    v.setUint32(offset + 24, e.bytes.length, true);
    v.setUint16(offset + 28, names[i].length, true);
    v.setUint32(offset + 42, localOffsets[i], true);
    out.set(names[i], offset + 46);
    offset += 46 + names[i].length;
  });
  v.setUint32(offset, 0x06054b50, true);
  v.setUint16(offset + 8, entries.length, true);
  v.setUint16(offset + 10, entries.length, true);
  v.setUint32(offset + 12, offset - central, true);
  v.setUint32(offset + 16, central, true);
  return out;
}
export function exportBundle(a: Artifact): Uint8Array {
  return encodeArchive([
    {
      path: "manifest.json",
      bytes: encoder.encode(
        canonical({ digest: a.digest, manifest: a.manifest }),
      ),
    },
    ...a.snapshots.map((s) => ({
      path: `snapshots/${s.hash}.csv`,
      bytes: s.bytes,
    })),
  ]);
}
function archive(bytes: Uint8Array): Entry[] {
  if (!(bytes instanceof Uint8Array) || bytes.length > LIMITS.bundle)
    throw new Error("BUNDLE_LIMIT");
  if (bytes.length < 22) throw new Error("INVALID_ARCHIVE");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    end = bytes.length - 22;
  if (
    v.getUint32(end, true) !== 0x06054b50 ||
    v.getUint16(end + 4, true) !== 0 ||
    v.getUint16(end + 6, true) !== 0 ||
    v.getUint16(end + 20, true) !== 0
  )
    throw new Error("INVALID_ARCHIVE");
  const count = v.getUint16(end + 10, true),
    start = v.getUint32(end + 16, true),
    centralSize = v.getUint32(end + 12, true);
  if (
    count < 2 ||
    count > 4 ||
    v.getUint16(end + 8, true) !== count ||
    start + centralSize !== end
  )
    throw new Error("INVALID_ARCHIVE");
  const entries: Entry[] = [],
    paths = new Set<string>();
  let central = start,
    expectedLocal = 0,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (
      central + 46 > end ||
      v.getUint32(central, true) !== 0x02014b50 ||
      v.getUint16(central + 6, true) !== 20 ||
      v.getUint16(central + 8, true) !== 0 ||
      v.getUint16(central + 10, true) !== 0
    )
      throw new Error("INVALID_ARCHIVE");
    const nameLen = v.getUint16(central + 28, true),
      size = v.getUint32(central + 24, true),
      compressed = v.getUint32(central + 20, true),
      crc = v.getUint32(central + 16, true),
      local = v.getUint32(central + 42, true);
    if (
      nameLen < 1 ||
      nameLen > 90 ||
      central + 46 + nameLen > end ||
      size !== compressed ||
      v.getUint16(central + 30, true) !== 0 ||
      v.getUint16(central + 32, true) !== 0 ||
      v.getUint16(central + 34, true) !== 0 ||
      v.getUint32(central + 38, true) !== 0 ||
      local !== expectedLocal
    )
      throw new Error("INVALID_ARCHIVE");
    const path = decoder.decode(
      bytes.subarray(central + 46, central + 46 + nameLen),
    );
    if (
      (path !== "manifest.json" &&
        !/^snapshots\/[a-f0-9]{64}\.csv$/.test(path)) ||
      paths.has(path)
    )
      throw new Error("INVALID_ARCHIVE_PATH");
    paths.add(path);
    if (
      size < 1 ||
      size >
        (path === "manifest.json" ? LIMITS.metadata + 256 : LIMITS.snapshot)
    )
      throw new Error("ENTRY_LIMIT");
    total += size;
    if (total > LIMITS.raw + LIMITS.metadata + 256)
      throw new Error("EXPANSION_LIMIT");
    const dataStart = local + 30 + nameLen,
      dataEnd = dataStart + size;
    if (
      local + 30 > start ||
      v.getUint32(local, true) !== 0x04034b50 ||
      v.getUint16(local + 4, true) !== 20 ||
      v.getUint16(local + 6, true) !== 0 ||
      v.getUint16(local + 8, true) !== 0 ||
      v.getUint32(local + 14, true) !== crc ||
      v.getUint32(local + 18, true) !== size ||
      v.getUint32(local + 22, true) !== size ||
      v.getUint16(local + 26, true) !== nameLen ||
      v.getUint16(local + 28, true) !== 0 ||
      dataEnd > start ||
      decoder.decode(bytes.subarray(local + 30, dataStart)) !== path
    )
      throw new Error("INVALID_ARCHIVE");
    const data = bytes.subarray(dataStart, dataEnd);
    if (crc32(data) !== crc) throw new Error("ARCHIVE_CRC_MISMATCH");
    entries.push({ path, bytes: data });
    expectedLocal = dataEnd;
    central += 46 + nameLen;
  }
  if (central !== end || expectedLocal !== start || !paths.has("manifest.json"))
    throw new Error("INVALID_ARCHIVE");
  return entries;
}
export async function importBundle(bytes: Uint8Array): Promise<Artifact> {
  const entries = archive(bytes);
  const raw = decoder.decode(
    entries.find((e) => e.path === "manifest.json")!.bytes,
  );
  const envelope = exact(JSON.parse(raw), ["digest", "manifest"]);
  if (canonical(envelope) !== raw) throw new Error("NONCANONICAL_MANIFEST");
  const blobs = entries
    .filter((e) => e.path !== "manifest.json")
    .map((e) => ({ hash: e.path.slice(10, -4), bytes: e.bytes }));
  const a = await validateArtifact(envelope.manifest, blobs);
  if (a.digest !== envelope.digest) throw new Error("MANIFEST_DIGEST_MISMATCH");
  await checkCompatibility(a.manifest);
  return a;
}
