// Batch 95 entnbt95: the player compound the port writes (levelNbt) against what a real EntityPlayerMP writes
// (public/research/entnbt95-reference.json from tools/probes/Entnbt95Probe.java, tools/verify-entnbt95.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NBT } from './nbt.js';
import { javaPlayerFromNbt } from './level-dat.js';
import { levelNbt } from './region-export.js';
import { HELD_DAMAGE_MODIFIERS, ITEM_MODIFIER_UUID } from './player-nbt.js';
import { decodeNbt } from './nbt.js';
import { populationBlockMapperReady } from './population-world.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt, chunkFromNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress } from './region-file.js';
import { importJavaRegionArea } from './region-import.js';
import { importedRuntime } from './world-import.js';
import { exportJavaSave } from './region-export.js';
import { Survival } from './survival.js';
import { World } from './world.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/entnbt95-reference.json', import.meta.url), 'utf8'));
const level = JSON.parse(readFileSync(new URL('../public/research/level-dat-reference.json', import.meta.url), 'utf8'));
const fromHex = (h) => decodeNbt(Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const plain = (t) => {
  const v = t.value;
  if (t.type === NBT.COMPOUND) return Object.fromEntries([...v].map(([k, x]) => [k, plain(x)]));
  if (t.type === NBT.LIST) return v.items.map((i) => plain({ type: v.elementType, value: i }));
  return v;
};
const native = (name) => ref.players.find((p) => p.name === name);
const richNative = fromHex(level.players.find((c) => c.name === 'rich').written);
const W = { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) };
function exported(patch = {}, playerPatch = {}) {
  const rich = javaPlayerFromNbt(richNative);
  const record = { mode: 'survival', player: { ...rich.player, ...playerPatch }, experience: rich.experience, bed: { spawn: rich.bedSpawn }, position: rich.position, worldSpawn: [0, 64, 0], ...patch };
  return plain(levelNbt(record, W).tag.value.get('Data').value.get('Player'));
}
const attr = (p, name) => p.Attributes.find((a) => a.Name === name);

test('the held-item damage modifiers are exactly the items the real Item.getAttributeModifiers gives one', () => {
  assert.equal(ref.mods.length, Object.keys(HELD_DAMAGE_MODIFIERS).length);
  for (const [id, attribute, name, most, amount, operation, saved] of ref.mods) {
    assert.deepEqual(HELD_DAMAGE_MODIFIERS[id], [name, amount], `item ${id}`);
    assert.equal(attribute, 'generic.attackDamage'); assert.equal(operation, 0); assert.equal(saved, true);
    assert.equal(BigInt(most), ITEM_MODIFIER_UUID.most);
  }
  const m = native('weapon-modifier').out.match(/UUIDMost:(-?\d+)L,UUIDLeast:(-?\d+)L,Amount:7\.0d,Operation:0,Name:"Weapon modifier"/);
  assert.equal(BigInt(m[1]), ITEM_MODIFIER_UUID.most); assert.equal(BigInt(m[2]), ITEM_MODIFIER_UUID.least);
});

test('a player holding a tool or sword writes its Weapon / Tool modifier on attackDamage; others write none', () => {
  // The rich save's hotbar slot 0 is item 278 (Tool modifier 5 in the reference).
  const held = exported({}, { current: 0 });
  const mod = attr(held, 'generic.attackDamage').Modifiers;
  assert.equal(mod.length, 1);
  assert.equal(mod[0].Name, 'Tool modifier'); assert.equal(mod[0].Amount, 5); assert.equal(mod[0].Operation, 0);
  assert.equal(mod[0].UUIDMost, ITEM_MODIFIER_UUID.most); assert.equal(mod[0].UUIDLeast, ITEM_MODIFIER_UUID.least);
  for (const a of held.Attributes) if (a.Name !== 'generic.attackDamage') assert.equal(a.Modifiers, undefined, a.Name);
  const stone = exported(); // current slot 1: stone
  assert.equal(attr(stone, 'generic.attackDamage').Modifiers, undefined);
  const empty = exported({}, { current: 5 });
  assert.equal(attr(empty, 'generic.attackDamage').Modifiers, undefined);
});

test('a sprinting player writes the empty Modifiers list the unsaved sprint modifier leaves on movementSpeed', () => {
  assert.match(native('sprinting').out, /Base:0\.10000000149011612d,Modifiers:\[\],Name:"generic\.movementSpeed"/);
  assert.equal(native('sprinting').re.includes('Modifiers'), false);
  const p = exported({ playerState: { sprinting: true } });
  assert.deepEqual(attr(p, 'generic.movementSpeed').Modifiers, []);
  assert.equal(attr(exported(), 'generic.movementSpeed').Modifiers, undefined);
});

test('OnGround, FallDistance, HurtTime and the dying DeathTime come from the saved player state', () => {
  assert.match(native('fall-onground').out, /FallDistance=7\.5f;.*OnGround=0b/);
  const p = exported({ playerState: { onGround: true, fallDistance: 3.5, hurtTime: 6, deathTime: 9, sprinting: false } });
  assert.equal(p.OnGround, 1); assert.equal(p.FallDistance, 3.5); assert.equal(p.HurtTime, 6);
  assert.equal(p.DeathTime, 0, 'a live player never writes a DeathTime of its own');
  const dead = exported({ playerState: { deathTime: 9 } }, { health: 0 });
  assert.equal(dead.HealF, 0); assert.equal(dead.Health, 0); assert.equal(dead.DeathTime, 9);
  assert.match(native('dead').out, /DeathTime=9s/);
  assert.equal(exported({}, { health: 0 }).DeathTime, 0);
  const bare = exported();
  assert.equal(bare.OnGround, 0); assert.equal(bare.FallDistance, 0); assert.equal(bare.HurtTime, 0);
});

test('a player saved asleep writes Sleeping and its SleepTimer, and the native load wakes it at once', () => {
  assert.match(native('sleeptimer-only').out, /SleepTimer=77s;Sleeping=0b/);
  const p = exported({ bed: { spawn: [-40, 65, 12], bed: [3, 64, 4], timer: 60 } });
  assert.equal(p.Sleeping, 1); assert.equal(p.SleepTimer, 60);
  assert.equal(exported().Sleeping, 0); assert.equal(exported().SleepTimer, 0);
  const rich = javaPlayerFromNbt(levelNbt({ mode: 'survival', player: javaPlayerFromNbt(richNative).player, experience: javaPlayerFromNbt(richNative).experience, bed: { spawn: [-40, 65, 12], bed: [3, 64, 4], timer: 60 }, position: javaPlayerFromNbt(richNative).position, worldSpawn: [0, 64, 0] }, W).tag.value.get('Data').value.get('Player').value);
  assert.ok(rich.sleeping); assert.ok(rich.sleepingAt);
});

// The batch 94 edge test could not compare a zombie's rolled zombie.spawnReinforcements or a horse's rolled attributes (random per run; a /summon does not run onSpawnWithEgg, so the "Random spawn bonus" modifiers stay with the batch 21 attrVariant rows). The executed compounds
// (entnbt94-reference.json, column 5: written by the real class, random values included) are used as the input here, so the round trip is exact.
await populationBlockMapperReady;
const edge94 = JSON.parse(readFileSync(new URL('../public/research/entnbt94-reference.json', import.meta.url), 'utf8')).edge;
test('executed zombie and horse compounds (rolled zombie.spawnReinforcements, rolled horse attributes) keep their Attributes list through import and export', async () => {
  const rows = edge94.filter((r) => (r[0] === 'Zombie' || r[0] === 'EntityHorse') && !r[4].startsWith('!'));
  assert.ok(rows.length >= 8);
  const entities = rows.map((r, i) => {
    const tag = new Map(decodeNbt(Uint8Array.from(r[4].match(/../g).map((b) => parseInt(b, 16)))).tag.value);
    tag.set('id', { type: NBT.STRING, value: r[0] });
    tag.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + (i % 8) * 1.9, 70, 0.5 + Math.floor(i / 8) * 1.4] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  importedRuntime(JSON.parse(JSON.stringify(record)));
  const { files: out } = await exportJavaSave({ ...record, id: 'a95', name: 'A', player: new Survival({}, 'survival').serialize(), updated: 1700000000000 }, { world: new World('95', 'javaStreamed', 12) });
  const back = [];
  for (const [name, buf] of out) if (name.startsWith('region/')) for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  const pick = (list, id) => list.filter((e) => e.get('id').value === id);
  const problems = [];
  for (const id of ['Zombie', 'EntityHorse']) {
    const want = pick(entities, id).map((e) => plain(e.get('Attributes'))), got = pick(back, id).map((e) => plain(e.get('Attributes')));
    assert.equal(got.length, want.length, id);
    const key = (a) => JSON.stringify(a.map((x) => Object.fromEntries(Object.entries(x).sort())));
    for (const a of want) if (!got.some((g) => key(g) === key(a))) problems.push(`${id}: want ${key(a)} got ${got.map(key).join(' | ')}`);
  }
  assert.deepEqual(problems, []);
  assert.ok(new Set(pick(entities, 'Zombie').map((e) => JSON.stringify(plain(e.get('Attributes'))))).size >= 4, 'the rolled zombie.spawnReinforcements bases differ per row');
});
