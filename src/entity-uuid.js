// Entity.writeToNBT's UUIDMost / UUIDLeast (two signed longs) for every entity, and the AttributeModifier UUIDs. 1.7.10 draws
// UUID.randomUUID() in the Entity constructor and writes it with every entity (probed: zombie, boat, carts, pig, horse, cow, spider in
// player-riding-reference.json, interchange-reference.json). A record keeps its own `uuid` string (version 4 form) once it has one; a
// record without one (an older save, a short-lived entity such as a drop) gets a name-based one so two exports of the same state agree.

import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";

const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === "string" && HEX.test(s);

function format(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4, as UUID.randomUUID
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // IETF variant
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// A fresh random UUID (the browser's crypto source: it must not consume any game Random).
export function newUuid() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? { getRandomValues: (b) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); return b; } }).getRandomValues(bytes);
  return format(bytes);
}
// A deterministic UUID from a seed string (same seed, same UUID).
export function deriveUuid(seed) {
  const text = String(seed), bytes = new Uint8Array(16);
  for (let w = 0; w < 4; w++) { // four 32-bit cyrb-style hashes with different seeds
    let h = (0x9e3779b9 * (w + 1)) | 0;
    for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 0x5bd1e995); h ^= h >>> 15; }
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
    for (let k = 0; k < 4; k++) bytes[w * 4 + k] = (h >>> (8 * k)) & 255;
  }
  return format(bytes);
}
// UUID.getMostSignificantBits / getLeastSignificantBits as BigInt.
export function uuidLongs(uuid) {
  const h = uuid.replace(/-/g, "");
  return { most: BigInt.asIntN(64, BigInt("0x" + h.slice(0, 16))), least: BigInt.asIntN(64, BigInt("0x" + h.slice(16))) };
}
export function longsUuid(most, least) {
  const hex = (v) => BigInt.asUintN(64, BigInt(v)).toString(16).padStart(16, "0"), h = hex(most) + hex(least);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// A record's own UUID when it has a valid one, else one derived from `seed`.
export const uuidOf = (record, seed) => (isUuid(record?.uuid) ? record.uuid.toLowerCase() : deriveUuid(seed));
// Keep a record's UUID (assign a random one the first time it is saved, so it stays the same across saves).
export function ensureUuid(record) {
  if (!isUuid(record.uuid)) record.uuid = newUuid();
  return record.uuid;
}
// Entity.readFromNBT: UUIDMost and UUIDLeast (both longs) when present -> { uuid }, else {} (the record then gets a fresh one).
export function uuidFields(tag) {
  const most = nbtGet(tag, "UUIDMost", NBT.LONG), least = nbtGet(tag, "UUIDLeast", NBT.LONG);
  return most !== undefined && least !== undefined ? { uuid: longsUuid(most, least) } : {};
}
