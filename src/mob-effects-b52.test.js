// ActiveEffects NBT of every mob kind, written and read by the unchanged 1.7.10 classes (public/research/mob-effects-reference.json,
// tools/probes/MobEffectsProbe.java, tag b52me): import, the restored mob, and the export all match the native layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/mob-effects-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { javaMobFromNbt, importedMobType } from './java-mobs.js';
import { EntityWorld } from './entities.js';
import { World } from './world.js';
import { Survival } from './survival.js';
import { exportJavaSave } from './region-export.js';
import { readRegion, decodeRegionChunk, regionSlot, regionAddress } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';

const tagOf = (hex) => decodeNbt(Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const MODELED = new Set([1, 2, 5, 6, 9, 10, 11, 12, 13, 14, 18, 19, 20, 22]); // mob-effects.js MOB_EFFECTS
const byId = (a, b) => a.id - b.id;
const modeled = (effects) => effects.filter((e) => MODELED.has(e[0])).map(([id, amplifier, duration, ambient]) => ({ id, amplifier, duration, ...(ambient ? { ambient: true } : {}) })).sort(byId);
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1 };
const listOf = (tag) => (tag.get('ActiveEffects')?.value.items ?? []).map((e) => [e.get('Id').value, e.get('Amplifier').value, e.get('Duration').value, e.get('Ambient').value]);

test('the probe covers 28 kinds and 6 effect layouts; native writes ActiveEffects only for a non-empty map, in HashMap bucket order', () => {
  assert.equal(new Set(reference.rows.map((r) => r.kind)).size, 28);
  assert.equal(reference.rows.length, 28 * 6);
  for (const r of reference.rows) {
    const tag = tagOf(r.nbt);
    assert.equal(tag.has('ActiveEffects'), reference.cases[r.case].length > 0, `${r.kind} ${r.case}`);
    assert.equal(r.nbt, r.reload, `${r.kind} ${r.case}: a loaded mob writes the same tag`);
    const ids = listOf(tag).map((e) => e[0]);
    assert.deepEqual(ids, [...ids].sort((a, b) => (a & 15) - (b & 15) || a - b), 'HashMap bucket order');
  }
});

test('every native record imports its effects (modelled ids, signed bytes, ambient) and restores them on the mob', () => {
  for (const r of reference.rows) {
    const rec = javaMobFromNbt(tagOf(r.nbt), { shiftX: 0, shiftZ: 0 });
    assert.ok(rec, r.kind);
    const native = r.effects;
    assert.deepEqual(modeled(native), [...rec.effects].sort(byId).filter((e) => MODELED.has(e.id)).map(({ id, amplifier, duration, ambient }) => ({ id, amplifier, duration, ...(ambient ? { ambient: true } : {}) })), `${r.kind} ${r.case} import`);
    const mob = new EntityWorld(flat, [{ ...rec, x: 64.5, y: 1, z: 64.5 }], () => 0.5).entities[0];
    if (!mob) continue; // a wither or dragon outside the flat test world may be refused
    assert.deepEqual((mob.effects ?? []).map((e) => [e.id, e.amplifier, e.duration, e.ambient ? 1 : 0]), native.filter((e) => MODELED.has(e[0])), `${r.kind} ${r.case} restore`);
  }
});

test('the export writes the native ActiveEffects layout for every mob kind', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const rows = reference.rows.filter((r) => r.case === 2 || r.case === 3 || r.case === 4);
  const mobs = rows.map((r, i) => ({ ...javaMobFromNbt(tagOf(r.nbt), { shiftX: 0, shiftZ: 0 }), x: -2 - (i % 20) * 0.5, y: 102, z: -2 - Math.floor(i / 20) * 0.5 }));
  const record = { id: 'me', name: 'ME', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, entities: mobs, updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const seen = [];
  for (const f of files.keys()) {
    if (!f.startsWith('region/')) continue;
    const region = readRegion(files.get(f));
    for (let s = 0; s < 1024; s++) {
      const slot = region.get(s);
      if (!slot) continue;
      for (const e of chunkFromNbt(await decodeRegionChunk(slot)).entities) seen.push(e);
    }
  }
  const withEffects = seen.filter((e) => e.has('ActiveEffects'));
  assert.equal(withEffects.length, rows.length, 'every mob exports its effects');
  const want = new Map();
  for (const r of rows) want.set(`${r.kind}/${r.case}`, listOf(tagOf(r.nbt)));
  const key = (e) => `${e.get('id').value}`;
  for (const e of withEffects) {
    const list = listOf(e);
    assert.ok([...want.entries()].some(([k, v]) => k.startsWith(`${key(e)}/`) && JSON.stringify(v) === JSON.stringify(list)), `${key(e)} ${JSON.stringify(list)}`);
  }
});
