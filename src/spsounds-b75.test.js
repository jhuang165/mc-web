// Batch 75 spsounds75: the single-player place, break and step sounds replayed against public/research/sound-sweep-reference.json
// (tools/probes/SoundSweepProbe.java: Item.onItemUse for every registered item, RenderGlobal.playAuxSFX 2001 for every block and metadata,
// Entity.func_145780_a for every block, all run on the unchanged 1.7.10 classes; tools/verify-sound-sweep.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { fromOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { breakSound, placeSound, placesSilently, footstepSound } from "./block-sounds.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/sound-sweep-reference.json", import.meta.url), "utf8"));
const rec = (kind) => ref.records.filter((r) => r.kind === kind);
const f = Math.fround;
// "minecraft:dig.stone 1.0 0.8 @8.5,64.5,8.5" / "sound dig.stone 1.0 0.8 @..." / "ent step.stone 0.15 1.0"
const parse = (text) => {
  const m = /^(?:sound |ent )?(?:minecraft:)?(\S+) (\S+) (\S+)(?: @(\S+),(\S+),(\S+))?$/.exec(text);
  return { name: m[1], volume: f(Number(m[2])), pitch: f(Number(m[3])), pos: m[4] === undefined ? null : [Number(m[4]), Number(m[5]), Number(m[6])] };
};
const same = (got, want, what) => {
  assert.equal(got.name, want.name, what + " name");
  assert.equal(f(got.volume), want.volume, what + " volume");
  assert.equal(f(got.pitch), want.pitch, what + " pitch");
};

test("b75: every block break (RenderGlobal.playAuxSFX 2001) matches breakSound for every id and metadata", () => {
  let checked = 0, silent = 0;
  for (const r of rec("break")) {
    const m = fromOriginal(r.id, r.meta);
    if (!m) continue;
    if (!r.sounds.length) { assert.equal(r.id, 0); silent++; continue; }
    assert.equal(r.sounds.length, 1);
    const want = parse(r.sounds[0]);
    same(breakSound(m.id), want, `break ${r.id}:${r.meta}`);
    assert.deepEqual(want.pos, [8.5, 64.5, 8.5]);
    checked++;
  }
  assert.ok(checked >= 150 && silent === 1, `${checked} ${silent}`);
});

test("b75: every block's step sound (Entity.func_145780_a), plain and under a snow layer, matches footstepSound", () => {
  let checked = 0;
  for (const r of rec("step")) {
    const m = fromOriginal(r.id, 0);
    if (!m) continue;
    const got = footstepSound(m.id, r.snowAbove ? fromOriginal(78, 0).id : 0);
    if (!r.sounds.length) { assert.equal(got, null, `step ${r.id}`); checked++; continue; }
    same(got, parse(r.sounds[0]), `step ${r.id} snow ${r.snowAbove}`);
    checked++;
  }
  assert.ok(checked >= 300, String(checked));
});

// The probe's cells sit at y 63-66; the port world is shifted down by 30 (as client-predict-b56.test.js does).
const DY = -30;
function freshWorld(name) {
  const w = new World(name);
  for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) for (let y = 28; y <= 40; y++) w.set(x, y, z, y === 33 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : y < 33 ? 1 : 0, false, 0);
  return w;
}
const SCENARIOS = {
  "stone-floor": { setup: [], at: [8, 63, 8], side: 1 }, "stone-wall": { setup: [[8, 64, 8, 1, 0]], at: [8, 64, 8], side: 3 },
  farmland: { setup: [[8, 63, 8, 60, 7]], at: [8, 63, 8], side: 1 }, "soul-sand": { setup: [[8, 63, 8, 88, 0]], at: [8, 63, 8], side: 1 },
  "sand-water": { setup: [[8, 63, 8, 12, 0], [7, 63, 8, 9, 0]], at: [8, 63, 8], side: 1 }, grass: { setup: [[8, 63, 8, 2, 0]], at: [8, 63, 8], side: 1 },
  dirt: { setup: [[8, 63, 8, 3, 0]], at: [8, 63, 8], side: 1 }, "snow-layer": { setup: [[8, 64, 8, 78, 0]], at: [8, 64, 8], side: 1 },
  "half-slab": { setup: [[8, 64, 8, 44, 0]], at: [8, 64, 8], side: 1 }, "tall-grass": { setup: [[8, 64, 8, 31, 1]], at: [8, 64, 8], side: 1 },
};
const faceCell = ([x, y, z], side) => [[x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1], [x - 1, y, z], [x + 1, y, z]][side];
const sh = ([x, y, z]) => [x, y + DY, z];

const shared = freshWorld("b75-sweep");
test("b75: placeHeldBlock plays the native place sound (name, volume, pitch, cell) wherever both place, and nothing where native is silent", () => {
  const stats = { compared: 0, silent: 0, bothPlaced: 0, skipped: 0 }, mismatches = [], notPlaced = new Set(), unmapped = new Set();
  for (const r of rec("place")) {
    if (r.error || r.result !== true || !r.diff.length) continue;
    const item = itemFromOriginal(r.item, r.damage);
    const sc = SCENARIOS[r.scenario];
    if (!item) { stats.skipped++; unmapped.add(r.item); continue; }
    const w = shared; // reset the probe's 5x5x5 box (y 62-66 here 32-36) to the base: stone at y 33, air above
    for (let x = 6; x <= 10; x++) for (let z = 6; z <= 10; z++) for (let y = 32; y <= 36; y++) w.set(x, y, z, y <= 33 ? 1 : 0, false, 0);
    let ok = true;
    for (const [x, y, z, id, meta] of sc.setup) { const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta); if (!m) ok = false; else w.set(x, y + DY, z, m.id, false, m.meta); }
    if (!ok) { stats.skipped++; continue; }
    const survival = new Survival();
    survival.inventory.setStack(0, { id: item.id, count: 3, damage: item.damage });
    const calls = [];
    const at = sh(sc.at), adjacent = sh(faceCell(sc.at, sc.side));
    let out;
    try {
      out = placeHeldBlock({ world: w, survival, position: { x: 30.5, y: 20, z: 30.5 }, flowers: { yellow: 38, red: 37 }, yaw: 0, farming: { observe() {} } }, { id: item.id, item: ITEMS[item.id], target: { block: at, adjacent } }, {
        collides: () => false, sound: (place, block, cell) => calls.push({ block, cell }), playSound: (name, o) => calls.push({ name, ...o }),
      });
    } catch { stats.skipped++; continue; }
    if (!out?.placed) { stats.skipped++; notPlaced.add(`${r.item}:${r.damage}/${r.scenario}/${out?.reason}`); continue; } // a placement difference, not a sound one
    stats.bothPlaced++;
    // main.js sound(): silent blocks play nothing; otherwise placeSound at the placed cell centre
    const played = calls.map((c) => c.name ? c : (placesSilently(c.block) ? null : { ...placeSound(c.block), position: { x: c.cell[0] + 0.5, y: c.cell[1] + 0.5, z: c.cell[2] + 0.5 } })).filter(Boolean);
    const want = r.sounds.map(parse);
    const label = `${r.item}:${r.damage} ${r.scenario}`;
    if (played.length !== want.length) { mismatches.push(`${label}: port ${played.length} sounds, native ${want.length}`); continue; }
    for (let i = 0; i < want.length; i++) {
      const g = played[i];
      try { same(g, want[i], label); assert.deepEqual([g.position.x, g.position.y - DY, g.position.z], want[i].pos, label + " cell"); } catch (e) { mismatches.push(e.message.split("\n")[0]); }
    }
    want.length ? stats.compared++ : stats.silent++;
  }
  if (process.env.SWEEP_DEBUG) console.log([...unmapped].join(' '), '\n', [...notPlaced].join(' '));
  assert.deepEqual(mismatches, []);
  assert.ok(stats.compared >= 200, JSON.stringify(stats));
});

test("b75: seeds and nether wart (ItemSeeds) and the other silent placers play nothing natively; the port plays none for seeds", () => {
  const silent = new Set(rec("place").filter((r) => r.result === true && r.diff.length && !r.sounds.length && !r.error).map((r) => r.item));
  for (const id of [295, 361, 362, 372, 391, 392, 324, 330, 331]) assert.ok(silent.has(id), `native ${id} is silent`);
  assert.ok(![...silent].some((id) => id < 256 && ![26, 55, 59, 63, 64, 68, 71, 104, 105, 115, 141, 142, 144].includes(id)), "no other silent ItemBlock");
  const src = readFileSync(new URL("./player-edit-simulation.js", import.meta.url), "utf8");
  assert.ok(!/playSound', 'step\.grass'/.test(src), "seeds and wart no longer play step.grass");
});

test("b75: a double plant plays its place sound (ItemBlock) at the lower cell", () => {
  const native = rec("place").find((r) => r.item === 175 && r.scenario === "grass" && r.result === true);
  assert.ok(native && native.sounds.length === 1, "native plays one sound");
  const w = freshWorld("b75-double"), survival = new Survival(), calls = [];
  const item = itemFromOriginal(175, native.damage);
  w.set(8, 33, 8, fromOriginal(2, 0).id, false, 0);
  survival.inventory.setStack(0, { id: item.id, count: 2, damage: item.damage });
  const out = placeHeldBlock({ world: w, survival, position: { x: 30.5, y: 20, z: 30.5 }, flowers: {}, yaw: 0, farming: { observe() {} } }, { id: item.id, item: ITEMS[item.id], target: { block: [8, 33, 8], adjacent: [8, 34, 8] } }, { collides: () => false, sound: (...a) => calls.push(a) });
  assert.equal(out.reason, "double-plant");
  assert.deepEqual(calls.map((c) => [c[0], c[2]]), [[true, [8, 34, 8]]]);
  assert.equal(placesSilently(calls[0][1]), false);
  same(placeSound(calls[0][1]), parse(native.sounds[0]), "double plant");
});
