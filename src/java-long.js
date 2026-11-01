// Java `long` arithmetic on [hi, lo] int32 pairs for hot loops (the GenLayer seed LCG runs several times per biome
// cell, where BigInt would be far slower). Results land in the module-level H and L; read them right after the call.
// Products are split into 16-bit limbs so every partial sum stays an exact double.

export let H = 0, L = 0;

// (ah:al) * (bh:bl) mod 2^64.
export function mul(ah, al, bh, bl) {
  const a48 = ah >>> 16, a32 = ah & 0xffff, a16 = al >>> 16, a00 = al & 0xffff;
  const b48 = bh >>> 16, b32 = bh & 0xffff, b16 = bl >>> 16, b00 = bl & 0xffff;
  let c00 = a00 * b00;
  let c16 = (c00 >>> 16) + a16 * b00;
  let c32 = c16 >>> 16;
  c16 = (c16 & 0xffff) + a00 * b16;
  c32 += c16 >>> 16;
  c32 += a32 * b00;
  let c48 = c32 >>> 16;
  c32 = (c32 & 0xffff) + a16 * b16;
  c48 += c32 >>> 16;
  c32 = (c32 & 0xffff) + a00 * b32;
  c48 += c32 >>> 16;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  H = ((c48 & 0xffff) << 16) | (c32 & 0xffff);
  L = ((c16 & 0xffff) << 16) | (c00 & 0xffff);
}

// (ah:al) + (bh:bl) mod 2^64.
export function add(ah, al, bh, bl) {
  const lo = (al >>> 0) + (bl >>> 0);
  H = (ah + bh + (lo > 0xffffffff ? 1 : 0)) | 0;
  L = lo | 0;
}

export const toBig = (hi, lo) => (BigInt(hi) << 32n) | BigInt(lo >>> 0);
export function fromBig(v) {
  v = BigInt.asIntN(64, BigInt(v));
  H = Number(BigInt.asIntN(32, v >> 32n));
  L = Number(BigInt.asIntN(32, v));
}

// String.hashCode, the seed a typed world name becomes.
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
