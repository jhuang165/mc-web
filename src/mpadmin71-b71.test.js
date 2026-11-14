// Batch 71 mpadmin71: list order, the four list files, and generate-structures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ServerAdmin } from './multiplayer/server-admin.js';
import { hashKeyOrder } from './multiplayer/user-list-order.js';
import { tabComplete } from './multiplayer/server-tabcomplete.js';
import { joinNiceString } from './commands-scoreboard.js';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { restoreReplica } from './multiplayer/client.js';
import { createDedicatedServer } from '../server/server.js';

const UUIDS = Array.from({ length: 12 }, (_, i) => `00000000-0000-0000-0000-0000000000${String(i * 7 + 10)}`);
const NAMES = UUIDS.map((_, i) => `Player${i}`);
const lines = (admin, cmd) => {
  const out = []; admin.run(cmd, { sender: 'Op', level: 4, deliver: (to, c) => out.push(c), ops: () => [], online: () => [] });
  return out;
};
const text = (c) => c.text ?? '';
const nice = joinNiceString; // CommandBase.joinNiceString: "a, b and c"
const seeded = () => {
  const admin = new ServerAdmin({ profiles: UUIDS.map((uuid, i) => ({ uuid, name: NAMES[i] })) });
  UUIDS.forEach((uuid, i) => { admin.bans.set(uuid, { uuid, name: NAMES[i], created: 'x', source: 's', expires: 'forever', reason: 'r' }); admin.allow.set(uuid, { uuid, name: NAMES[i] }); });
  for (const ip of ['10.0.0.1', '192.168.1.20', '8.8.8.8', '172.16.5.4', '1.2.3.4', '203.0.113.9']) admin.ipBans.set(ip, { ip, created: 'x', source: 's', expires: 'forever', reason: 'r' });
  return admin;
};

test('/banlist, /banlist ips and /whitelist list print HashMap order, not insertion order', () => {
  const admin = seeded();
  const nameOrder = hashKeyOrder(UUIDS).map((u) => NAMES[UUIDS.indexOf(u)]);
  assert.notDeepEqual(nameOrder, NAMES, 'the fixture must hash apart');
  const joined = (out) => out.map(text).join('|');
  assert.ok(joined(lines(admin, 'banlist')).includes(nice(nameOrder)));
  assert.ok(joined(lines(admin, 'whitelist list')).includes(nice(nameOrder)));
  const ips = [...admin.ipBans.keys()], ipOrder = hashKeyOrder(ips);
  assert.notDeepEqual(ipOrder, ips);
  assert.ok(joined(lines(admin, 'banlist ips')).includes(nice(ipOrder)));
});

test('/whitelist add completes the profile cache keySet: lowercase names in HashMap order; a rejoin moves the name last in its bucket', () => {
  const admin = new ServerAdmin({ profiles: NAMES.map((name, i) => ({ uuid: UUIDS[i], name })) });
  const lower = NAMES.map((n) => n.toLowerCase());
  assert.deepEqual(admin.profileNames(), hashKeyOrder(lower));
  const ctx = { sender: 'Op', level: 4, online: ['Op'], admin, isOp: () => false, scoreboard: null };
  const got = tabComplete('/whitelist add ', ctx);
  assert.deepEqual(got, hashKeyOrder(lower), 'the command completion lists the same names');
  admin.seen(UUIDS[0], 'Renamed'); // same uuid, new name: the old key is removed
  assert.ok(!admin.profiles.has('player0') && admin.profiles.has('renamed'));
});

test('the four list files load at start-up (file wins, a missing one is migrated) and are saved in HashMap order', () => {
  const disk = new Map(), writes = [];
  const files = { read: (n) => (disk.has(n) ? structuredClone(disk.get(n)) : null), write: (n, rows) => { disk.set(n, structuredClone(rows)); writes.push(n); } };
  const saved = { ops: [{ uuid: 'save-op', name: 'FromSave', level: 4 }], whitelist: [{ uuid: 'save-w', name: 'SaveW' }], banned: [{ uuid: 'save-b', name: 'SaveB', reason: 'x' }] };
  disk.set('ops', [{ uuid: 'file-op', name: 'FromFile', level: 2 }]);
  disk.set('banned-ips', [{ ip: '9.9.9.9', created: 'c', source: 's', expires: 'forever', reason: 'r' }]);
  const admin = new ServerAdmin(saved); admin.listFiles = files;
  assert.deepEqual(admin.loadFiles().sort(), ['banned-ips', 'ops']);
  assert.deepEqual([...admin.ops.keys()], ['file-op'], 'the file wins over the save');
  assert.deepEqual([...admin.ipBans.keys()], ['9.9.9.9']);
  assert.deepEqual([...admin.allow.keys()], ['save-w'], 'no whitelist.json: the save is kept');
  assert.deepEqual(disk.get('whitelist'), [{ uuid: 'save-w', name: 'SaveW' }], 'and written once (migration)');
  assert.deepEqual(disk.get('banned-players').map((r) => r.uuid), ['save-b']);
  assert.ok(!writes.includes('ops') && !writes.includes('banned-ips'), 'files read unchanged are not rewritten');
  writes.length = 0;
  for (const [i, uuid] of UUIDS.entries()) admin.profiles.set(NAMES[i].toLowerCase(), { uuid, name: NAMES[i] });
  for (const n of NAMES) lines(admin, `whitelist add ${n}`);
  assert.deepEqual(disk.get('whitelist').map((r) => r.uuid), hashKeyOrder(['save-w', ...UUIDS]), 'saved in the native iteration order');
  assert.deepEqual(admin.save().whitelist.map((r) => r.uuid), hashKeyOrder(['save-w', ...UUIDS]));
  lines(admin, 'ban Player3'); assert.ok(writes.includes('banned-players'));
  lines(admin, 'op Player4'); assert.ok(writes.includes('ops'));
  lines(admin, 'ban-ip 5.6.7.8'); assert.ok(writes.includes('banned-ips'));
});

test('an unreadable list file keeps the save and is not overwritten until the list changes', () => {
  const writes = [];
  const admin = new ServerAdmin({ banned: [{ uuid: 'b', name: 'B' }], profiles: [{ uuid: 'p', name: 'P' }] });
  admin.listFiles = { read: (n) => { if (n === 'banned-players') throw new Error('bad json'); return null; }, write: (n) => writes.push(n) };
  admin.loadFiles();
  assert.equal(admin.bans.size, 1);
  assert.ok(!writes.includes('banned-players'));
  lines(admin, 'ban P'); assert.ok(writes.includes('banned-players'));
});

test('the dedicated server reads the files at start and writes them atomically beside the world file', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-lists-'));
  await writeFile(path.join(dir, 'whitelist.json'), JSON.stringify([{ uuid: 'u-1', name: 'Alpha' }]));
  const simulation = new DedicatedSimulation({ seed: 'lists', biome: 'java', generationVersion: 9, admin: { whitelist: [{ uuid: 'save', name: 'Saved' }], ops: [{ uuid: 'op-1', name: 'Boss', level: 4 }] } });
  const app = await createDedicatedServer({ port: 0, token: 'test-only-not-a-deployed-server-key', dataFile: path.join(dir, 'world.json'), simulation, tickMs: 1000, saveMs: 600000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  assert.deepEqual([...simulation.admin.allow.keys()], ['u-1'], 'whitelist.json wins over the save');
  const files = (await readdir(dir)).sort();
  for (const f of ['ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json']) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => f.endsWith('.tmp') && f !== 'world.json.tmp'), 'no temp file is left behind');
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'ops.json'), 'utf8')), [{ uuid: 'op-1', name: 'Boss', level: 4 }], 'migrated from the save');
});

test('generate-structures=false builds no mineshaft or other MapGen structure in a finite Java world; the Nether bridge generator has no such flag', async () => {
  await populationBlockMapperReady;
  const on = new World('3', 'java', 14), off = new World('3', 'java', 14, 'default', '', false);
  assert.equal(on.generatedStructures.mineshafts.length, 1, 'seed 3 has a mineshaft');
  assert.equal(off.generatedStructures.mineshafts.length, 0);
  let diff = 0; for (const [k, c] of on.chunks) { const o = off.chunks.get(k); for (let i = 0; i < c.blocks.length; i++) if (c.blocks[i] !== o.blocks[i]) diff++; }
  assert.ok(diff > 1000, 'the mineshaft blocks are gone');
  assert.equal(new World('3', 'java', 14).mapFeatures, true);
  const old = new World('3', 'java', 10, 'default', '', false);
  assert.equal(old.generatedStructures?.mineshafts?.length ?? 0, 0, 'generation 10 mineshafts are skipped too');
});

test('the server rule reaches the world, a saved flag wins, and the client replica is built the same way', async () => {
  await populationBlockMapperReady;
  const sim = new DedicatedSimulation({ seed: '3', biome: 'java', generationVersion: 14 }, { rules: { generateStructures: false } });
  assert.equal(sim.world.mapFeatures, false);
  assert.equal(sim.save().generateStructures, false);
  const again = new DedicatedSimulation(sim.save(), { rules: { generateStructures: true } });
  assert.equal(again.world.mapFeatures, false, 'a saved world keeps its creation-time flag');
  assert.equal(again.rules.generateStructures, false);
  const snap = sim.snapshot('p1');
  assert.equal(snap.mapFeatures, false);
  assert.equal(restoreReplica(snap).mapFeatures, false);
  const normal = new DedicatedSimulation({ seed: '3', biome: 'java', generationVersion: 9 });
  assert.equal('mapFeatures' in normal.snapshot('p1'), false);
});
