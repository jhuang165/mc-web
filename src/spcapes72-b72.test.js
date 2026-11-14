import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { capePngError } from './skin.js';
import { AccountStore } from '../server/accounts.js';
import { SpCapeStore, applyLocalCape } from './sp-cape.js';
import { PlayerRenderer } from './player-renderer.js';
import { capeVisible } from './cape.js';

function png(width, height) {
  const t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(type, 4, 'ascii'); data.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + data.length)), 8 + data.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0x7f); for (let y = 0; y < height; y++) raw[y * (width * 4 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const renderer = () => { const r = { capeHash: null, calls: [], setCape(t) { this.calls.push(t); } }; return r; };

test('validation: 64x32 PNG, at most 16 KB, same function the server uses', async () => {
  assert.equal(capePngError(png(64, 32)), null);
  assert.equal(capePngError(png(64, 64)).status, 400);
  assert.equal(capePngError(Buffer.from('plain text that is long enough to pass the header length check')).status, 400);
  assert.equal(capePngError(Buffer.alloc(16385)).status, 413);
  const accounts = new AccountStore({ accounts: [{ id: 'a', name: 'A', skin: null, skinHash: null, cape: null, capeHash: null }] });
  await assert.rejects(accounts.setCape(accounts.accounts.get('a'), png(64, 64)), { status: 400 });
  await assert.rejects(accounts.setCape(accounts.accounts.get('a'), Buffer.alloc(16385)), { status: 413 });
});

test('store round trip: set, reload from storage, clear', () => {
  const storage = memory(), bytes = new Uint8Array(png(64, 32));
  const a = new SpCapeStore(storage);
  assert.equal(a.get(), null); assert.equal(a.tag, null);
  assert.throws(() => a.set(new Uint8Array(png(32, 32))), /64 × 32/);
  assert.equal(storage.m.size, 0);
  a.set(bytes);
  assert.deepEqual([...new SpCapeStore(storage).get()], [...bytes]); // a fresh store (page reload) reads it back
  assert.equal(a.tag, 'local:1');
  a.clear();
  assert.equal(new SpCapeStore(storage).get(), null);
  assert.equal(a.tag, null);
  storage.setItem('blockworld.cape', 'bm90IGEgcG5n'); // corrupt value is ignored
  assert.equal(new SpCapeStore(storage).get(), null);
  assert.throws(() => new SpCapeStore({ setItem() { throw new Error('quota'); } }).set(bytes), /could not store/);
});

test('apply: cape set on the renderer once, replaced on change, removed on clear', async () => {
  const store = new SpCapeStore(memory()), r = renderer(), loads = [];
  const load = async b => { loads.push(b); return { tex: loads.length }; };
  applyLocalCape(r, store, load); assert.deepEqual(r.calls, []); // nothing chosen: nothing set
  store.set(new Uint8Array(png(64, 32)));
  applyLocalCape(r, store, load); applyLocalCape(r, store, load);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(r.calls, [{ tex: 1 }]); assert.equal(loads.length, 1);
  store.set(new Uint8Array(png(64, 32))); applyLocalCape(r, store, load); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(r.calls.at(-1), { tex: 2 });
  store.clear(); applyLocalCape(r, store, load);
  assert.equal(r.calls.at(-1), null);
});

test('apply: after the account cape was shown online the offline cape returns, and Show Cape hides it', async () => {
  const store = new SpCapeStore(memory()), r = renderer();
  store.set(new Uint8Array(png(64, 32)));
  r.capeHash = 'abcdef'; // multiplayer applyCape(account hash)
  applyLocalCape(r, store, async () => 'tex'); await Promise.resolve(); await Promise.resolve();
  assert.equal(r.capeHash, 'local:1'); assert.equal(r.calls.at(-1), 'tex');
  assert.equal(capeVisible({ hasCape: true, invisible: false, hideCape: false }), true);
  assert.equal(capeVisible({ hasCape: true, invisible: false, hideCape: true }), false); // main.js passes hideCape: options.showCape === false
  assert.equal(typeof PlayerRenderer.prototype.setCape, 'function');
});
