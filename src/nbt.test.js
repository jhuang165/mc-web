import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NBT, encodeNbt, decodeNbt} from './nbt.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/nbt-reference.json', import.meta.url)));
const bytes = hex => Uint8Array.from(Buffer.from(hex, 'hex'));
const compound = entries => ({type: NBT.COMPOUND, value: new Map(entries)});
const root = (type, value) => ({name: '', tag: compound([['value', {type, value}]])});
function payload(type, value) {
  switch (type) {
    case NBT.LONG: return BigInt(value);
    case NBT.FLOAT: case NBT.DOUBLE: return typeof value === 'string' ? Number(value) : value;
    case NBT.BYTE_ARRAY: return Int8Array.from(value);
    case NBT.INT_ARRAY: return Int32Array.from(value);
    case NBT.LIST: return {elementType: value.elementType, items: value.items.map(item => payload(value.elementType, item))};
    case NBT.COMPOUND: return new Map(value.map(([key, tag]) => [key, {type: tag.type, value: payload(tag.type, tag.value)}]));
    default: return value;
  }
}
function equalTag(actual, expected, message) {
  // node:assert's recursive Map comparison overflows on the depth-512 fixture.
  const pending = [[actual, expected]];
  while (pending.length) {
    const [a, b] = pending.pop();
    assert.equal(a.type, b.type, message);
    if (a.type === NBT.COMPOUND) {
      assert.deepEqual([...a.value.keys()], [...b.value.keys()], message);
      for (const [key, tag] of a.value) pending.push([tag, b.value.get(key)]);
    } else if (a.type === NBT.LIST) {
      assert.equal(a.value.elementType, b.value.elementType, message);
      assert.equal(a.value.items.length, b.value.items.length, message);
      for (let i = 0; i < a.value.items.length; i++) pending.push([
        {type: a.value.elementType, value: a.value.items[i]},
        {type: b.value.elementType, value: b.value.items[i]},
      ]);
    } else assert.deepEqual(a.value, b.value, message);
  }
}

test('raw NBT matches 73 original-class typed trees and binary streams', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(reference.cases.length, 73);
  for (const c of reference.cases) {
    const native = bytes(c.hex);
    const expected = {name: c.name, tag: {type: c.tag.type, value: payload(c.tag.type, c.tag.value)}};
    const decoded = decodeNbt(native);
    assert.equal(decoded.name, expected.name, c.id);
    assert.equal(decoded.bytesRead, native.length, c.id);
    equalTag(decoded.tag, expected.tag, c.id);
    assert.deepEqual(encodeNbt(expected), native, c.id + ' independent encode');
    assert.deepEqual(encodeNbt(decoded), native, c.id + ' re-encode');
  }
});

test('NBT honors view offsets, owns decoded arrays, and exposes consumed bytes', () => {
  const input = root(NBT.BYTE_ARRAY, new Int8Array([-128, -1, 0, 1, 127]));
  const wire = encodeNbt(input), padded = new Uint8Array(wire.length + 8);
  padded.set(wire, 3);
  const decoded = decodeNbt(padded.subarray(3, 3 + wire.length));
  assert.deepEqual(decoded.tag, input.tag);
  padded.fill(0);
  assert.deepEqual(decoded.tag.value.get('value').value, input.tag.value.get('value').value);
  const extra = new Uint8Array([...wire, 99]);
  assert.throws(() => decodeNbt(extra), /Trailing/);
  assert.equal(decodeNbt(extra, {allowTrailing: true}).bytesRead, wire.length);
});

test('NBT uses exact longs, signed arrays and native NaN/empty-list canonicalization', () => {
  const a = decodeNbt(encodeNbt(root(NBT.LONG, 9007199254740993n)));
  assert.equal(a.tag.value.get('value').value, 9007199254740993n);
  for (const type of [NBT.FLOAT, NBT.DOUBLE]) {
    // Signaling NaNs are readable, but Java DataOutput writes canonical quiet NaNs.
    const canonical = encodeNbt(root(type, NaN));
    const signaling = canonical.slice(), view = new DataView(signaling.buffer);
    if (type === NBT.FLOAT) view.setUint32(11, 0xff800001);
    else view.setBigUint64(11, 0xfff0000000000001n);
    assert.ok(Number.isNaN(decodeNbt(signaling).tag.value.get('value').value));
    assert.deepEqual(encodeNbt(decodeNbt(signaling)), canonical);
  }
  const typedEmpty = root(NBT.LIST, {elementType: NBT.INT, items: []});
  assert.equal(decodeNbt(encodeNbt(typedEmpty)).tag.value.get('value').value.elementType, NBT.END);
  const wire = encodeNbt(typedEmpty); wire[11] = NBT.INT;
  assert.equal(decodeNbt(wire).tag.value.get('value').value.elementType, NBT.INT);
  assert.deepEqual(encodeNbt(decodeNbt(wire)), encodeNbt(typedEmpty));
});

test('NBT compounds preserve names safely and later duplicate entries win', () => {
  // Two byte tags named x. This follows NBTTagCompound.load's map.put behavior.
  const wire = bytes('0a00000100017801010001780200');
  const decoded = decodeNbt(wire);
  assert.deepEqual(decoded.tag, compound([['x', {type: NBT.BYTE, value: 2}]]));
  const c = reference.cases.find(c => c.id === 'compound/names');
  const names = decodeNbt(bytes(c.hex)).tag.value;
  assert.equal(names.get('__proto__').value, '__proto__');
  assert.equal(names.get('constructor').value, 'constructor');
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test('NBT modified UTF-8 handles Java code units and rejects invalid sequences', () => {
  // DataInput.readUTF accepts a literal NUL and overlong forms; DataOutput normalizes them.
  for (const encoded of ['00', 'c080', 'e08080']) {
    const length = (encoded.length / 2).toString(16).padStart(4, '0');
    assert.equal(decodeNbt(bytes('0a' + length + encoded + '00')).name, '\0');
  }
  for (const malformed of ['80', 'c0', 'c020', 'e080', 'e02080', 'f09f9880', 'ff']) {
    const length = (malformed.length / 2).toString(16).padStart(4, '0');
    assert.throws(() => decodeNbt(bytes('0a' + length + malformed + '00')), /UTF-8/);
  }
  assert.throws(() => encodeNbt({name: 'a'.repeat(65536), tag: compound([])}), /65535/);
  assert.throws(() => encodeNbt(root(NBT.STRING, '\0'.repeat(32768))), /65535/);
  assert.throws(() => encodeNbt(root(NBT.STRING, '\u0800'.repeat(21846))), /65535/);
});

test('NBT rejects truncation, invalid tag types and invalid container lengths', () => {
  for (const c of reference.cases.filter(c => ['chunk-shaped', 'string/7', 'list/type-10'].includes(c.id))) {
    const wire = bytes(c.hex);
    for (let n = 0; n < wire.length; n++) assert.throws(() => decodeNbt(wire.subarray(0, n)), undefined, `${c.id}/${n}`);
  }
  for (const wire of [
    '000000', // End root
    '03000000000000', // Scalar root
    '0a00000c00017800', // No LongArray tag in 1.7.10
    '0a000007000178ffffffff00', // Negative byte array
    '0a00000b000178ffffffff00', // Negative int array
    '0a00000900017803ffffffff00', // Negative list (stricter than native)
    '0a000009000178000000000100', // Nonempty End list (stricter than native)
    '0a0000090001780c0000000000', // Unknown list element type
    '0a0000070001780000001000', // Short byte array payload
    '0a00000b000178000000020000000000', // Short int array payload
  ]) assert.throws(() => decodeNbt(bytes(wire)), undefined, wire);
});

test('NBT bounds bytes, aggregate elements and depth before excessive allocation', () => {
  const wire = encodeNbt(root(NBT.INT_ARRAY, new Int32Array(100)));
  assert.throws(() => decodeNbt(wire, {maxBytes: wire.length - 1}), /byte limit/);
  assert.throws(() => encodeNbt(root(NBT.INT_ARRAY, new Int32Array(100)), {maxBytes: wire.length - 1}), /byte limit/);
  assert.throws(() => decodeNbt(wire, {maxElements: 100}), /element limit/);
  assert.throws(() => encodeNbt(root(NBT.INT_ARRAY, new Int32Array(100)), {maxElements: 100}), /element limit/);
  assert.doesNotThrow(() => decodeNbt(wire, {maxElements: 101}));
  for (const type of ['07', '09', '0b']) {
    const hex = '0a0000' + type + '000178' + (type === '09' ? '0a' : '') + '7fffffff00';
    assert.throws(() => decodeNbt(bytes(hex)), /integer|element limit/);
  }
  const deep = bytes(reference.cases.find(c => c.id === 'depth/512').hex);
  assert.doesNotThrow(() => decodeNbt(deep));
  assert.throws(() => decodeNbt(deep, {maxDepth: 511}), /depth/);
  assert.throws(() => encodeNbt(decodeNbt(deep), {maxDepth: 511}), /depth/);
  const cyclic = compound([]); cyclic.value.set('cycle', cyclic);
  assert.throws(() => encodeNbt({tag: cyclic}), /depth/);
  for (const options of [{maxBytes: 0}, {maxDepth: 513}, {maxElements: -1}, {maxDepth: NaN}]) {
    assert.throws(() => decodeNbt(bytes('0a000000'), options));
  }
});

test('NBT writers reject lossy or incorrectly typed inputs', () => {
  for (const [type, value] of [
    [NBT.BYTE, 128], [NBT.SHORT, -32769], [NBT.INT, 2147483648], [NBT.INT, 1.5],
    [NBT.LONG, 9007199254740992], [NBT.LONG, 1n << 63n], [NBT.LONG, -(1n << 63n) - 1n],
    [NBT.FLOAT, '1'], [NBT.DOUBLE, '1'], [NBT.STRING, 1],
    [NBT.BYTE_ARRAY, new Uint8Array(1)], [NBT.INT_ARRAY, [1]], [NBT.COMPOUND, {}],
    [NBT.LIST, {elementType: 0, items: [0]}], [NBT.LIST, {elementType: 12, items: []}],
    [NBT.LIST, {elementType: 1, items: new Int8Array(1)}], [12, []], [0, null],
  ]) assert.throws(() => encodeNbt(root(type, value)), undefined, `${type}: ${String(value)}`);
  assert.throws(() => encodeNbt({tag: {type: NBT.INT, value: 0}}), /root/);
  assert.throws(() => decodeNbt(new ArrayBuffer(4)), /Uint8Array/);
});
