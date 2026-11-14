import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { AccountStore } from '../server/accounts.js';
import { capeFields, setCapeShow } from './multiplayer/cape-wire.js';
import { AccountApi } from './multiplayer/account-api.js';

function png(width, height) {
  const t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(type, 4, 'ascii'); data.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + data.length)), 8 + data.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0x7f); for (let y = 0; y < height; y++) raw[y * (width * 4 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const account = () => ({ id: 'a1', name: 'Alex', skin: null, skinHash: null, cape: null, capeHash: null });

test('cape upload is validated like a skin: 64x32 PNG, at most 16 KB', async () => {
  const store = new AccountStore({ accounts: [account()] }), a = store.accounts.get('a1');
  await assert.rejects(store.setCape(a, png(64, 64)), { status: 400 });
  await assert.rejects(store.setCape(a, png(22, 17)), { status: 400 });
  await assert.rejects(store.setCape(a, Buffer.from('not a png at all, just text bytes of enough length....')), { status: 400 });
  await assert.rejects(store.setCape(a, Buffer.alloc(16385)), { status: 413 });
  const out = await store.setCape(a, png(64, 32));
  assert.match(out.cape, /^[a-f0-9]{20}$/);
  assert.ok(store.capes.has(out.cape));
  assert.equal(out.skin, null);
  assert.equal((await store.clearCape(a)).cape, null);
  assert.equal(store.capes.size, 0);
});

test('a saved cape is reloaded and shared hashes survive one clear', async () => {
  const store = new AccountStore({ accounts: [account(), { ...account(), id: 'a2', name: 'Bo' }] });
  const [a, b] = [store.accounts.get('a1'), store.accounts.get('a2')];
  const hash = (await store.setCape(a, png(64, 32))).cape; await store.setCape(b, png(64, 32));
  await store.clearCape(a);
  assert.ok(store.capes.has(hash));
  const again = new AccountStore({ accounts: [...store.accounts.values()] });
  assert.ok(again.capes.has(hash));
});

test('wire round trip: presence rows carry the cape hash and the hide flag', () => {
  const sim = new DedicatedSimulation({}, { world: Object.assign(new World('cape-wire'), { spawn: () => ({ x: 64.5, y: 80, z: 64.5 }) }) });
  sim.addPlayer('p1', 'Alex', 'k1', { cape: 'abcdefabcdefabcdefab' });
  sim.addPlayer('p2', 'Bo', 'k2');
  const rows = () => Object.fromEntries(sim.presence().map(r => [r.id, r]));
  assert.equal(rows().p1.cape, 'abcdefabcdefabcdefab');
  assert.equal(rows().p1.hideCape, undefined);
  assert.equal(rows().p2.cape, null);
  assert.equal(JSON.parse(JSON.stringify(rows().p1)).cape, 'abcdefabcdefabcdefab');
});

test('Show Cape off sets the hide flag; on clears it; junk is ignored', () => {
  const p = { cape: 'x' };
  assert.equal(setCapeShow(p, false), true);
  assert.deepEqual(capeFields(p), { cape: 'x', hideCape: true });
  assert.equal(setCapeShow(p, 'no'), false);
  assert.equal(p.hideCape, true);
  setCapeShow(p, true);
  assert.deepEqual(capeFields(p), { cape: 'x' });
  assert.equal(setCapeShow(null, true), false);
});

test('the client API builds cape URLs', () => {
  const api = new AccountApi('ws://host:1');
  assert.equal(api.capeUrl('abc'), api.base + 'capes/abc.png');
  assert.equal(api.capeUrl(null), null);
});
