// Raw, big-endian Java 1.7.10 NBT. Compression and game/save adapters are separate.
export const NBT = Object.freeze({ END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4,
  FLOAT: 5, DOUBLE: 6, BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11 });

function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError('Invalid NBT integer');
  return value;
}
function typeId(type, end = false) { return integer(type, end ? 0 : 1, 11); }
function limits(options) {
  return {
    maxBytes: integer(options.maxBytes ?? 16 * 1024 * 1024, 1, 0x7fffffff),
    maxDepth: integer(options.maxDepth ?? 512, 0, 512),
    maxElements: integer(options.maxElements ?? 1000000, 1, 0x7fffffff),
  };
}
class Budget {
  constructor(options) { Object.assign(this, limits(options)); this.elements = 0; }
  count(n = 1) {
    integer(n, 0, this.maxElements);
    if ((this.elements += n) > this.maxElements) throw new RangeError('NBT element limit exceeded');
  }
  depth(depth) { if (depth > this.maxDepth) throw new RangeError('NBT depth limit exceeded'); }
}

class Reader extends Budget {
  constructor(bytes, options) {
    super(options);
    if (!(bytes instanceof Uint8Array)) throw new TypeError('NBT input must be Uint8Array');
    if (bytes.byteLength > this.maxBytes) throw new RangeError('NBT byte limit exceeded');
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }
  need(n) {
    if (n > this.bytes.length - this.offset) throw new RangeError('Truncated NBT');
  }
  number(method, size) {
    this.need(size);
    const value = this.view[method](this.offset, false);
    this.offset += size;
    return value;
  }
  byte() { return this.number('getUint8', 1); }
  length(size = 0) {
    const n = this.number('getInt32', 4);
    this.count(n);
    this.need(n * size);
    return n;
  }
  // DataInput.readUTF uses modified UTF-8: UTF-16 code units, encoded NUL,
  // and surrogate halves (including unpaired ones), rather than UTF-8 scalars.
  string() {
    const length = this.number('getUint16', 2);
    this.need(length);
    const end = this.offset + length, chars = [];
    const continuation = () => {
      if (this.offset >= end) throw new Error('Malformed NBT modified UTF-8');
      const b = this.byte();
      if ((b & 0xc0) !== 0x80) throw new Error('Malformed NBT modified UTF-8');
      return b & 63;
    };
    while (this.offset < end) {
      const b = this.byte();
      if (b < 0x80) chars.push(b);
      else if ((b & 0xe0) === 0xc0) chars.push(((b & 31) << 6) | continuation());
      else if ((b & 0xf0) === 0xe0) chars.push(((b & 15) << 12) | (continuation() << 6) | continuation());
      else throw new Error('Malformed NBT modified UTF-8');
    }
    let value = '';
    for (let i = 0; i < chars.length; i += 4096) value += String.fromCharCode(...chars.slice(i, i + 4096));
    return value;
  }
  payload(type, depth) {
    this.depth(depth);
    switch (type) {
      case 1: return this.number('getInt8', 1);
      case 2: return this.number('getInt16', 2);
      case 3: return this.number('getInt32', 4);
      case 4: return this.number('getBigInt64', 8);
      case 5: return this.number('getFloat32', 4);
      case 6: return this.number('getFloat64', 8);
      case 7: {
        const n = this.length(1), result = new Int8Array(n);
        result.set(new Int8Array(this.bytes.buffer, this.bytes.byteOffset + this.offset, n));
        this.offset += n;
        return result;
      }
      case 8: return this.string();
      case 9: {
        const elementType = typeId(this.byte(), true), n = this.length();
        if (elementType === 0 && n) throw new Error('Nonempty NBT End list');
        const items = [];
        for (let i = 0; i < n; i++) items.push(this.payload(elementType, depth + 1));
        return { elementType, items };
      }
      case 10: {
        const entries = new Map();
        for (;;) {
          const childType = typeId(this.byte(), true);
          if (!childType) return entries;
          this.count();
          const name = this.string();
          entries.set(name, { type: childType, value: this.payload(childType, depth + 1) });
        }
      }
      case 11: {
        const n = this.length(4), result = new Int32Array(n);
        for (let i = 0; i < n; i++) result[i] = this.number('getInt32', 4);
        return result;
      }
      default: throw new Error('Unsupported NBT type');
    }
  }
}

class Writer extends Budget {
  constructor(options) {
    super(options);
    this.bytes = new Uint8Array(Math.min(1024, this.maxBytes));
    this.view = new DataView(this.bytes.buffer);
    this.offset = 0;
  }
  need(n) {
    const length = this.offset + n;
    if (length > this.maxBytes) throw new RangeError('NBT byte limit exceeded');
    if (length > this.bytes.length) {
      const bytes = new Uint8Array(Math.min(this.maxBytes, Math.max(length, this.bytes.length * 2)));
      bytes.set(this.bytes); this.bytes = bytes; this.view = new DataView(bytes.buffer);
    }
  }
  number(method, size, value) {
    this.need(size); this.view[method](this.offset, value, false); this.offset += size;
  }
  byte(value) { this.number('setUint8', 1, value); }
  string(value) {
    if (typeof value !== 'string') throw new TypeError('NBT string required');
    let length = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      length += c >= 1 && c <= 0x7f ? 1 : c <= 0x7ff ? 2 : 3;
      if (length > 65535) throw new RangeError('NBT modified UTF-8 exceeds 65535 bytes');
    }
    this.number('setUint16', 2, length); this.need(length);
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 1 && c <= 0x7f) this.byte(c);
      else if (c <= 0x7ff) { this.byte(0xc0 | (c >> 6)); this.byte(0x80 | (c & 63)); }
      else { this.byte(0xe0 | (c >> 12)); this.byte(0x80 | ((c >> 6) & 63)); this.byte(0x80 | (c & 63)); }
    }
  }
  payload(type, value, depth) {
    this.depth(depth);
    switch (type) {
      case 1: this.number('setInt8', 1, integer(value, -128, 127)); break;
      case 2: this.number('setInt16', 2, integer(value, -32768, 32767)); break;
      case 3: this.number('setInt32', 4, integer(value, -2147483648, 2147483647)); break;
      case 4:
        if (typeof value !== 'bigint' || value < -(1n << 63n) || value >= (1n << 63n)) throw new RangeError('NBT long requires signed 64-bit BigInt');
        this.number('setBigInt64', 8, value); break;
      case 5: case 6:
        if (typeof value !== 'number') throw new TypeError('NBT float/double requires Number');
        if (Number.isNaN(value)) {
          // DataOutput canonicalizes all NaNs via floatToIntBits/doubleToLongBits.
          if (type === 5) this.number('setUint32', 4, 0x7fc00000);
          else this.number('setBigUint64', 8, 0x7ff8000000000000n);
        } else this.number(type === 5 ? 'setFloat32' : 'setFloat64', type === 5 ? 4 : 8, value);
        break;
      case 7: case 11: {
        if (type === 7 ? !(value instanceof Int8Array) : !(value instanceof Int32Array)) throw new TypeError('NBT array requires signed typed array');
        this.count(value.length);
        this.number('setInt32', 4, value.length);
        this.need(value.length * (type === 7 ? 1 : 4));
        for (const item of value) this.number(type === 7 ? 'setInt8' : 'setInt32', type === 7 ? 1 : 4, item);
        break;
      }
      case 8: this.string(value); break;
      case 9: {
        const elementType = typeId(value.elementType, true), items = value.items;
        if (!Array.isArray(items)) throw new TypeError('NBT list items must be an array');
        if (!elementType && items.length) throw new Error('Nonempty NBT End list');
        this.count(items.length);
        // NBTTagList.write resets the type of empty lists to End.
        this.byte(items.length ? elementType : 0); this.number('setInt32', 4, items.length);
        for (const item of items) this.payload(elementType, item, depth + 1);
        break;
      }
      case 10:
        if (!(value instanceof Map)) throw new TypeError('NBT compound requires Map');
        this.count(value.size);
        for (const [name, tag] of value) {
          this.byte(typeId(tag.type)); this.string(name); this.payload(tag.type, tag.value, depth + 1);
        }
        this.byte(0); break;
      default: throw new Error('Unsupported NBT type');
    }
  }
}

/** Decode one named compound. Reject trailing bytes unless allowTrailing is true. */
export function decodeNbt(bytes, options = {}) {
  const reader = new Reader(bytes, options);
  if (reader.byte() !== NBT.COMPOUND) throw new Error('NBT root must be a compound');
  const name = reader.string();
  const tag = { type: NBT.COMPOUND, value: reader.payload(NBT.COMPOUND, 0) };
  if (!options.allowTrailing && reader.offset !== bytes.length) throw new Error('Trailing NBT bytes');
  return { name, tag, bytesRead: reader.offset };
}

/** Encode a named compound; compound iteration follows Map insertion order. */
export function encodeNbt({ name = '', tag }, options = {}) {
  if (tag.type !== NBT.COMPOUND) throw new Error('NBT root must be a compound');
  const writer = new Writer(options);
  writer.byte(NBT.COMPOUND); writer.string(name); writer.payload(NBT.COMPOUND, tag.value, 0);
  return writer.bytes.slice(0, writer.offset);
}
