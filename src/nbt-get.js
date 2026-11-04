// NBTTagCompound getters of 1.7.10 over the src/nbt.js tree. getByte/getShort/getInteger/getLong/getFloat/getDouble cast
// the stored tag to NBTPrimitive (dz) and convert, so any numeric tag reads as any numeric type: an int "IsBaby:1" typed
// in a command is a byte to EntityZombie. The conversions follow dg/dw/dp/dr/dm/dk (byte, short, int, long, float,
// double): narrowing masks the low bits, floats and doubles floor first (MathHelper.floor_float/floor_double). Every
// other type must match exactly (getString needs a string tag, getCompoundTag a compound). A missing or unreadable tag
// gives `fallback`.
import { NBT } from './nbt.js';

const INT_MIN = -2147483648, INT_MAX = 2147483647;
// Java's (int) cast of a double: NaN is 0, out of range saturates.
const d2i = (d) => (Number.isNaN(d) ? 0 : d >= INT_MAX ? INT_MAX : d <= INT_MIN ? INT_MIN : Math.trunc(d));
const floorInt = (d) => { const i = d2i(d); return d < i ? i - 1 : i; };
const d2l = (d) => (Number.isNaN(d) ? 0n : d >= 9223372036854775807 ? (1n << 63n) - 1n : d <= -9223372036854775808 ? -(1n << 63n) : BigInt(Math.trunc(d)));
const NUMERIC = new Set([NBT.BYTE, NBT.SHORT, NBT.INT, NBT.LONG, NBT.FLOAT, NBT.DOUBLE]);

// NBTPrimitive's int view: dp.d (the int), dr.d ((int) long), dm.d / dk.d (floor).
function asInt(tag) {
  switch (tag.type) {
    case NBT.LONG: return Number(BigInt.asIntN(32, tag.value));
    case NBT.FLOAT: case NBT.DOUBLE: return floorInt(tag.value);
    default: return tag.value;
  }
}

export function primitiveAs(tag, type) {
  switch (type) {
    case NBT.BYTE: return tag.type === NBT.BYTE ? tag.value : (asInt(tag) << 24) >> 24;
    case NBT.SHORT: return tag.type === NBT.BYTE || tag.type === NBT.SHORT ? tag.value : (asInt(tag) << 16) >> 16;
    case NBT.INT: return asInt(tag);
    case NBT.LONG:
      if (tag.type === NBT.LONG) return tag.value;
      if (tag.type === NBT.FLOAT) return d2l(tag.value);
      if (tag.type === NBT.DOUBLE) return d2l(Math.floor(tag.value));
      return BigInt(tag.value);
    case NBT.FLOAT: return Math.fround(Number(tag.value));
    case NBT.DOUBLE: return Number(tag.value);
    default: return undefined;
  }
}

export function nbtGet(map, key, type, fallback) {
  const tag = map instanceof Map ? map.get(key) : undefined;
  if (!tag) return fallback;
  if (tag.type === type) return tag.value;
  if (NUMERIC.has(type) && NUMERIC.has(tag.type)) return primitiveAs(tag, type);
  return fallback;
}

// NBTTagCompound.hasKey(key, 99): any numeric tag.
export const hasNumber = (map, key) => map instanceof Map && NUMERIC.has(map.get(key)?.type);
