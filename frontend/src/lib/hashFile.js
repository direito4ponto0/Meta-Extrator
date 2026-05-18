import {
  createMD5,
  createSHA1,
  createSHA256,
  createSHA384,
  createSHA512,
  createSHA3,
  createBLAKE3,
} from "hash-wasm";

const CHUNK_SIZE = 32 * 1024 * 1024; // 32 MB

// Default set for extraction (kept for backwards compatibility)
export async function hashFile(file, onProgress) {
  const [md5, sha1, sha256] = await Promise.all([
    createMD5(),
    createSHA1(),
    createSHA256(),
  ]);

  let offset = 0;
  const size = file.size;

  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    const buf = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    md5.update(buf);
    sha1.update(buf);
    sha256.update(buf);
    offset = end;
    if (onProgress) onProgress(offset, size);
  }

  return {
    md5: md5.digest("hex"),
    sha1: sha1.digest("hex"),
    sha256: sha256.digest("hex"),
  };
}

// Factory map for available algorithms
const FACTORIES = {
  md5: createMD5,
  sha1: createSHA1,
  sha256: createSHA256,
  sha384: createSHA384,
  sha512: createSHA512,
  "sha3-256": () => createSHA3(256),
  "sha3-512": () => createSHA3(512),
  blake3: createBLAKE3,
};

export const HASH_ALGORITHMS = [
  { id: "md5", label: "MD5", strength: "legacy", bits: 128 },
  { id: "sha1", label: "SHA-1", strength: "legacy", bits: 160 },
  { id: "sha256", label: "SHA-256", strength: "padrão", bits: 256 },
  { id: "sha384", label: "SHA-384", strength: "forte", bits: 384 },
  { id: "sha512", label: "SHA-512", strength: "forte", bits: 512 },
  { id: "sha3-256", label: "SHA3-256", strength: "moderno", bits: 256 },
  { id: "sha3-512", label: "SHA3-512", strength: "moderno", bits: 512 },
  { id: "blake3", label: "BLAKE3", strength: "moderno", bits: 256 },
];

// Hash a file with a specific list of algorithms (multi-algorithm streaming)
export async function hashFileMulti(file, algorithms, onProgress) {
  const requested = algorithms.filter((a) => FACTORIES[a]);
  if (requested.length === 0) throw new Error("Nenhum algoritmo válido selecionado.");

  const hashers = await Promise.all(requested.map((id) => FACTORIES[id]()));
  const map = Object.fromEntries(requested.map((id, i) => [id, hashers[i]]));

  let offset = 0;
  const size = file.size;
  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    const buf = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    for (const h of hashers) h.update(buf);
    offset = end;
    if (onProgress) onProgress(offset, size);
  }

  const out = {};
  for (const id of requested) out[id] = map[id].digest("hex");
  return out;
}

// Compare two hash strings (case-insensitive, ignore whitespace)
export const compareHashes = (a, b) => {
  if (!a || !b) return false;
  return a.toLowerCase().trim().replace(/\s+/g, "") === b.toLowerCase().trim().replace(/\s+/g, "");
};

// Detect probable algorithm from hash string length
export const detectAlgorithmByLength = (hash) => {
  if (!hash) return null;
  const len = hash.replace(/\s+/g, "").length;
  const map = {
    32: "md5",
    40: "sha1",
    56: "sha224",
    64: "sha256 / sha3-256 / blake3",
    96: "sha384",
    128: "sha512 / sha3-512",
  };
  return map[len] || null;
};
