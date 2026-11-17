// NBTTagCompound.getString (1.7.10): a missing key gives "", a string tag its data, and every other tag its toString() (executed by
// tools/probes/FallingBlock78Probe.java Tiles79: a sign's Text1 of int 5 loads as "5", a byte 1 as "1b", a list [1] as "[0:1,]").
// The port's nbtGet(..., NBT.STRING) only reads string tags; use getStringAny where the native reader calls getString without hasKey(key, 8).
import { NBT } from './nbt.js';

// Double.toString / Float.toString: plain between 1e-3 and 1e7 (with ".0" on a whole number), else d.dddE-n.
function javaDouble(d) {
  if (!Number.isFinite(d)) return Number.isNaN(d) ? 'NaN' : d > 0 ? 'Infinity' : '-Infinity';
  const a = Math.abs(d);
  if (a === 0) return Object.is(d, -0) ? '-0.0' : '0.0';
  if (a >= 1e-3 && a < 1e7) return Number.isInteger(d) ? d.toFixed(1) : String(d);
  const [m, e] = d.toExponential().split('e');
  return (m.includes('.') ? m : `${m}.0`) + 'E' + Number(e);
}
function javaFloat(f) {
  f = Math.fround(f);
  if (!Number.isFinite(f) || f === 0) return javaDouble(f);
  for (let p = 1; p <= 9; p++) { const s = Number(f.toPrecision(p)); if (Math.fround(s) === f) return javaDouble(s); }
  return javaDouble(f);
}
// java.util.HashMap iteration order (Java 8+, as the probe ran): bucket index of the spread String.hashCode over a power-of-two table, insertion order inside a bucket.
function hashOrder(keys) {
  let cap = 16;
  while (keys.length > cap * 0.75) cap *= 2;
  const bucket = (k) => { let h = 0; for (let i = 0; i < k.length; i++) h = (Math.imul(h, 31) + k.charCodeAt(i)) | 0; return ((h ^ (h >>> 16)) & (cap - 1)); };
  return keys.map((k, i) => [bucket(k), i, k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((e) => e[2]);
}
// NBTBase.toString of one tag (a string inside a compound or list is quoted; NBTBase.func_150285_a_ unquotes only the top one).
export function nbtToJavaString(tag) {
  switch (tag.type) {
    case NBT.BYTE: return `${tag.value}b`;
    case NBT.SHORT: return `${tag.value}s`;
    case NBT.INT: return String(tag.value);
    case NBT.LONG: return `${tag.value}L`;
    case NBT.FLOAT: return `${javaFloat(tag.value)}f`;
    case NBT.DOUBLE: return `${javaDouble(tag.value)}d`;
    case NBT.STRING: return `"${tag.value}"`;
    case NBT.BYTE_ARRAY: return `[${tag.value.length} bytes]`;
    case NBT.INT_ARRAY: return `[${[...tag.value].map((v) => `${v},`).join('')}]`;
    case NBT.LIST: return `[${tag.value.items.map((v, i) => `${i}:${nbtToJavaString({ type: tag.value.elementType, value: v })},`).join('')}]`;
    case NBT.COMPOUND: return `{${hashOrder([...tag.value.keys()]).map((k) => `${k}:${nbtToJavaString(tag.value.get(k))},`).join('')}}`;
    default: return '';
  }
}
export function getStringAny(map, key, fallback = '') {
  const tag = map instanceof Map ? map.get(key) : undefined;
  if (!tag) return fallback;
  return tag.type === NBT.STRING ? tag.value : nbtToJavaString(tag);
}
