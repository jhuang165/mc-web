// JsonToNBT of 1.7.10 (net.minecraft.nbt.JsonToNBT, obfuscated eb with its Any/Compound/List/Primitive helpers ec-ef):
// the parser behind the data-tag argument of /give, /summon, /setblock and /testforblock. Ported from the bytecode,
// including its quirks: Java String.trim/split/matches semantics, the bracket stack, the name/value scan that ends a
// tag after a closing quote, the int-array shortcut, and the fallback to a string on a NumberFormatException.
// tools/verify-json-nbt.mjs runs the unchanged client over a corpus; src/json-nbt.test.js replays it.
// Output is the src/nbt.js tree: {type, value}; compounds hold a Map, lists {elementType, items}.
import { NBT } from './nbt.js';

export class NBTException extends Error {}
// The list loop of makeAny never advances past an empty element ("[a,,b]"), so the native server thread spins
// forever. The port stops there instead and reports it.
export class NBTHang extends NBTException {}
class NumberFormat extends Error {}

const trim = (s) => {
  let a = 0, b = s.length;
  while (a < b && s.charCodeAt(a) <= 32) a++;
  while (b > a && s.charCodeAt(b - 1) <= 32) b--;
  return s.slice(a, b);
};
// Character.isWhitespace: SPACE_SEPARATOR/LINE_SEPARATOR/PARAGRAPH_SEPARATOR except the no-break spaces, plus
// \t \n \u000B \f \r and \u001C-\u001F.
function isWhitespace(c) {
  if ((c >= 9 && c <= 13) || (c >= 0x1c && c <= 0x20)) return true;
  return c === 0x1680 || (c >= 0x2000 && c <= 0x2006) || (c >= 0x2008 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x205f || c === 0x3000;
}
// String.split(","): trailing empty strings are removed; no match gives the whole string.
function split(s, ch) {
  const parts = s.split(ch);
  if (parts.length === 1) return parts;
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}
// Integer/Short/Byte.parseX: an optional sign and decimal digits, in range.
function parseInteger(s, min, max) {
  if (!/^[-+]?\d+$/.test(s)) throw new NumberFormat(s);
  const v = BigInt(s);
  if (v < min || v > max) throw new NumberFormat(s);
  return v;
}
const quote = 34, backslash = 92;

// JsonToNBT.topTagsCount (eb.b): validates quotes and brackets and counts the top-level groups.
function topTagsCount(s) {
  let count = 0, inQuote = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === quote) {
      if (i > 0 && s.charCodeAt(i - 1) === backslash) {
        if (!inQuote) throw new NBTException('Illegal use of \\": ' + s);
      } else inQuote = !inQuote;
    } else if (!inQuote) {
      if (c === 123 || c === 91) {
        if (!stack.length) count++;
        stack.push(c);
      } else if (c === 125) {
        if (!stack.length || stack.pop() !== 123) throw new NBTException('Unbalanced curly brackets {}: ' + s);
      } else if (c === 93) {
        if (!stack.length || stack.pop() !== 91) throw new NBTException('Unbalanced square brackets []: ' + s);
      }
    }
  }
  if (inQuote) throw new NBTException('Unbalanced quotation: ' + s);
  if (stack.length) throw new NBTException('Unbalanced brackets: ' + s);
  return count === 0 && s.length ? 1 : count;
}

// eb.a(String, char): the first ch outside quotes, or -1 when an opening bracket comes first.
function indexOutside(s, ch) {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === quote) {
      if (!(i > 0 && s.charCodeAt(i - 1) === backslash)) inQuote = !inQuote;
    } else if (!inQuote) {
      if (c === ch) return i;
      if (c === 123 || c === 91) return -1;
    }
  }
  return -1;
}

// eb.a(String, boolean): the next "name:value" (or list element) of a compound/list body.
function nextTag(s, isArray) {
  let index = indexOutside(s, 58);
  if (index < 0 && !isArray) throw new NBTException('Unable to locate name/value separator for string: ' + s);
  const comma = indexOutside(s, 44);
  if (comma >= 0 && comma < index && !isArray) throw new NBTException('Name error at: ' + s);
  if (isArray && (index < 0 || index > comma)) index = -1;
  const stack = [];
  let i = index + 1, inQuote = false, quoted = false, started = false, quoteEnd = 0;
  for (; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === quote) {
      if (i > 0 && s.charCodeAt(i - 1) === backslash) {
        if (!inQuote) throw new NBTException('Illegal use of \\": ' + s);
      } else {
        inQuote = !inQuote;
        if (inQuote && !started) quoted = true;
        if (!inQuote) quoteEnd = i;
      }
    } else if (!inQuote) {
      if (c === 123 || c === 91) stack.push(c);
      else if (c === 125) {
        if (!stack.length || stack.pop() !== 123) throw new NBTException('Unbalanced curly brackets {}: ' + s);
      } else if (c === 93) {
        if (!stack.length || stack.pop() !== 91) throw new NBTException('Unbalanced square brackets []: ' + s);
      } else if (c === 44 && !stack.length) return s.slice(0, i);
    }
    if (!isWhitespace(c)) {
      if (!inQuote && quoted && quoteEnd !== i) return s.slice(0, quoteEnd + 1);
      started = true;
    }
  }
  return s.slice(0, i);
}

// eb.b / eb.c (String, boolean): the name and value around the first ':' (a plain indexOf).
function locateName(s, isArray) {
  if (isArray) {
    s = trim(s);
    if (s.startsWith('{') || s.startsWith('[')) return '';
  }
  const i = s.indexOf(':');
  if (i < 0) {
    if (isArray) return '';
    throw new NBTException('Unable to locate name/value separator for string: ' + s);
  }
  return trim(s.slice(0, i));
}
function locateValue(s, isArray) {
  if (isArray) {
    s = trim(s);
    if (s.startsWith('{') || s.startsWith('[')) return s;
  }
  const i = s.indexOf(':');
  if (i < 0) {
    if (isArray) return s;
    throw new NBTException('Unable to locate name/value separator for string: ' + s);
  }
  return trim(s.slice(i + 1));
}

const SEPARATORS = new Set([44, 123, 125, 91, 93]);
function advance(value, tag) {
  const c = value.charCodeAt(tag.length);
  if (!SEPARATORS.has(c)) throw new NBTException("Unexpected token '" + value[tag.length] + "' at: " + value.slice(tag.length));
  return value.slice(tag.length + 1);
}

// eb.a(String, String) (makeAny) builds the Any tree; parse() turns it into tags.
function makeAny(name, value) {
  value = trim(value);
  topTagsCount(value);
  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new NBTException('Unable to locate ending bracket for: ' + value);
    value = value.slice(1, -1);
    const children = [];
    while (value.length) {
      const tag = nextTag(value, false);
      if (!tag.length) throw new NBTHang('Empty compound element; the native parser never returns: ' + value);
      children.push(makeAny(locateName(tag, false), locateValue(tag, false)));
      if (value.length < tag.length + 1) break;
      value = advance(value, tag);
    }
    return { name, compound: children };
  }
  if (value.startsWith('[') && !/^\[[-\d|,\t\n\x0B\f\r ]+\]$/.test(value)) {
    if (!value.endsWith(']')) throw new NBTException('Unable to locate ending bracket for: ' + value);
    value = value.slice(1, -1);
    const children = [];
    while (value.length) {
      const tag = nextTag(value, true);
      if (!tag.length) throw new NBTHang('Empty list element; the native parser never returns: ' + value);
      children.push(makeAny(locateName(tag, true), locateValue(tag, true)));
      if (value.length < tag.length + 1) break;
      value = advance(value, tag);
    }
    return { name, list: children };
  }
  return { name, primitive: value };
}

// String.equalsIgnoreCase: char by char, equal after toUpperCase or after toLowerCase.
function equalsIgnoreCase(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    const ux = x.toUpperCase(), uy = y.toUpperCase();
    if (ux.length === 1 && ux === uy) continue;
    if (ux.length === 1 && uy.length === 1 && ux.toLowerCase() === uy.toLowerCase()) continue;
    return false;
  }
  return true;
}
const unescape = (s) => s.replaceAll('\\"', '"');
// JsonToNBT.Primitive.parse (ef.a).
function primitive(b) {
  try {
    if (/^[-+]?[0-9]*\.?[0-9]+[d|D]$/.test(b)) return { type: NBT.DOUBLE, value: Number(b.slice(0, -1)) };
    // Float.parseFloat rounds the decimal once; fround(Number) rounds twice, which differs only on exact ties.
    if (/^[-+]?[0-9]*\.?[0-9]+[f|F]$/.test(b)) return { type: NBT.FLOAT, value: Math.fround(Number(b.slice(0, -1))) };
    if (/^[-+]?[0-9]+[b|B]$/.test(b)) return { type: NBT.BYTE, value: Number(parseInteger(b.slice(0, -1), -128n, 127n)) };
    if (/^[-+]?[0-9]+[l|L]$/.test(b)) return { type: NBT.LONG, value: parseInteger(b.slice(0, -1), -(1n << 63n), (1n << 63n) - 1n) };
    if (/^[-+]?[0-9]+[s|S]$/.test(b)) return { type: NBT.SHORT, value: Number(parseInteger(b.slice(0, -1), -32768n, 32767n)) };
    if (/^[-+]?[0-9]+$/.test(b)) return { type: NBT.INT, value: Number(parseInteger(b, -2147483648n, 2147483647n)) };
    if (/^[-+]?[0-9]*\.?[0-9]+$/.test(b)) return { type: NBT.DOUBLE, value: Number(b) };
    if (equalsIgnoreCase(b, 'true') || equalsIgnoreCase(b, 'false')) return { type: NBT.BYTE, value: equalsIgnoreCase(b, 'true') ? 1 : 0 };
    if (b.startsWith('[') && b.endsWith(']')) {
      if (b.length <= 2) return { type: NBT.INT_ARRAY, value: new Int32Array(0) };
      const inner = b.slice(1, -1), parts = split(inner, ',');
      try {
        const ints = parts.length <= 1 ? [trim(inner)] : parts.map(trim);
        return { type: NBT.INT_ARRAY, value: Int32Array.from(ints, (p) => Number(parseInteger(p, -2147483648n, 2147483647n))) };
      } catch (e) {
        if (e instanceof NumberFormat) return { type: NBT.STRING, value: b };
        throw e;
      }
    }
    if (b.startsWith('"') && b.endsWith('"') && b.length > 2) b = b.slice(1, -1);
    return { type: NBT.STRING, value: unescape(b) };
  } catch (e) {
    if (e instanceof NumberFormat) return { type: NBT.STRING, value: unescape(b) };
    throw e;
  }
}

function parse(any) {
  if (any.compound) {
    const map = new Map();
    for (const child of any.compound) map.set(child.name, parse(child));
    return { type: NBT.COMPOUND, value: map };
  }
  if (any.list) {
    // NBTTagList.appendTag: the first tag fixes the element type; a mismatching tag is dropped with a warning.
    let elementType = 0;
    const items = [];
    for (const child of any.list) {
      const tag = parse(child);
      if (!elementType) elementType = tag.type;
      else if (elementType !== tag.type) continue;
      items.push(tag.value);
    }
    return { type: NBT.LIST, value: { elementType, items } };
  }
  return primitive(any.primitive);
}

/** JsonToNBT.func_150315_a: parse one data tag; throws NBTException with the native message. */
export function parseJsonNbt(text) {
  const s = trim(text);
  if (topTagsCount(s) !== 1) throw new NBTException('Encountered multiple top tags, only one expected');
  return parse(s.startsWith('{') ? makeAny('tag', s) : makeAny(locateName(s, false), locateValue(s, false)));
}

/** The probe's canonical form of a tag: sorted compound keys, float/double bits, longs as strings. */
export function canonicalNbt(tag) {
  const raw = (type, value) => {
    switch (type) {
      case NBT.LONG: return String(value);
      case NBT.FLOAT: { const v = new DataView(new ArrayBuffer(4)); v.setFloat32(0, value); return v.getInt32(0); }
      case NBT.DOUBLE: { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, value); return String(v.getBigInt64(0)); }
      case NBT.BYTE_ARRAY: case NBT.INT_ARRAY: return [...value];
      case NBT.LIST: return value.items.map((item) => canonicalNbt({ type: value.elementType, value: item }));
      case NBT.COMPOUND: {
        const out = {};
        for (const key of [...value.keys()].sort()) out[key] = canonicalNbt(value.get(key));
        return out;
      }
      default: return value;
    }
  };
  const out = { t: tag.type, v: raw(tag.type, tag.value) };
  if (tag.type === NBT.LIST) out.e = tag.value.elementType;
  return out;
}
