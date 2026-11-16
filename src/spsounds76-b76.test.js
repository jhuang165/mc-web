// Batch 76 spsounds76: the single-player right-click item sounds replayed against public/research/sound-sweep2-reference.json
// (tools/probes/SpSounds76Probe.java on the unchanged 1.7.10 classes: ItemBucket.tryPlaceContainedLiquid, onItemRightClick of the thrown items,
// onItemUse of fire charge, hoe, bone meal, lily pad, shears, flint and steel; tools/verify-spsounds76.mjs).
// The dig hit sound (PlayerControllerMP.onPlayerDamageBlock, bje.c) and the item bytecode strings are Bytecode-read; see the b76 track note.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeContainedLiquid } from "./buckets.js";
import { WATER, LAVA } from "./world.js";
import { hitSound, hoeSound, breakSound } from "./block-sounds.js";
import { fromOriginal } from "./block-registry.js";
import { throwHeldItem, SNOWBALL, EGG, ENDER_PEARL } from "./player-throw-simulation.js";
import { useFireCharge, throwExpBottle } from "./spawn-egg-use.js";
import { ITEM_FIRE_CHARGE } from "./spawn-eggs.js";
import { usePotion } from "./potion-use.js";
import { tickPlayerMining } from "./player-mining.js";
import { Survival } from "./survival.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/sound-sweep2-reference.json", import.meta.url), "utf8"));
const rec = (kind, f = () => true) => ref.records.filter((r) => r.kind === kind && f(r));
const f = Math.fround;
const parse = (text) => {
  const m = /^(?:sound |ent )?(\S+) (\S+) (\S+)(?: @(\S+),(\S+),(\S+))?$/.exec(text);
  return { name: m[1], volume: f(Number(m[2])), pitch: f(Number(m[3])), pos: m[4] === undefined ? null : [Number(m[4]), Number(m[5]), Number(m[6])] };
};
const GRASS = fromOriginal(2, 0).id, STONE = fromOriginal(1, 0).id, TALL = fromOriginal(31, 1).id;

test("b76: ItemBucket has no sound of its own; only water in the Nether fizzes (random.fizz 0.5, 2.6 + (r - r) * 0.8, at the cell centre)", () => {
  let checked = 0;
  for (const r of rec("bucket")) {
    const liquid = r.item === 326 ? WATER : LAVA, plant = r.cell === "tall-grass";
    const world = {
      isHell: r.nether, inside: () => true, solid: () => r.cell === "stone", set() {},
      get: () => (r.cell === "stone" ? STONE : plant ? TALL : 0),
    };
    const log = [];
    world.evaporated = (x, y, z) => log.push(["fizz", x, y, z]);
    const used = placeContainedLiquid(world, 8, 64, 8, liquid, (x, y, z, b) => log.push(["break", x, y, z, b]));
    assert.equal(used, r.result, `used ${r.item} ${r.cell}`);
    const fizz = r.sounds.filter((s) => s.startsWith("sound "));
    assert.equal(log.filter((e) => e[0] === "fizz").length, fizz.length, `fizz ${JSON.stringify(r)}`);
    if (fizz.length) {
      const want = parse(fizz[0]);
      assert.equal(want.name, "random.fizz");
      assert.equal(want.volume, 0.5);
      assert.deepEqual(want.pos, [8.5, 64.5, 8.5]);
      assert.ok(want.pitch >= f(2.6 - 0.8) && want.pitch <= f(2.6 + 0.8));
    }
    // the plant breaks (aux 2001, only on the server's world) unless the Nether water fizzed instead
    const aux = r.sounds.filter((s) => s.startsWith("aux 2001"));
    assert.equal(log.filter((e) => e[0] === "break").length > 0 && !r.remote, aux.length > 0, `break ${JSON.stringify(r)}`);
    if (aux.length) assert.deepEqual(log.find((e) => e[0] === "break").slice(1, 4), [8, 64, 8], "the break is at the replaced cell");
    checked++;
  }
  assert.equal(checked, 24);
  // water into plants: the Nether fizz keeps the plant (no aux 2001), the Overworld breaks it
  assert.ok(rec("bucket", (r) => r.item === 326 && r.nether && r.cell === "tall-grass" && !r.remote)[0].sounds.every((s) => !s.startsWith("aux")));
  assert.ok(rec("bucket", (r) => r.item === 326 && !r.nether && r.cell === "tall-grass" && !r.remote)[0].sounds[0].startsWith("aux 2001"));
});

test("b76: the bucket's break sound is the replaced plant's own break sound at that cell", () => {
  const aux = rec("bucket", (r) => !r.remote && !r.nether && r.cell === "tall-grass")[0].sounds[0];
  const data = Number(aux.split(",").at(-1));
  assert.equal(data & 4095, 31);
  const b = breakSound(TALL);
  assert.equal(b.name, "dig.grass");
});

test("b76: snowball, egg, ender pearl, bottle o' enchanting and splash potion play random.bow 0.5 at 0.4 / (rand * 0.4 + 0.8) in float32", () => {
  let checked = 0;
  for (const r of rec("throw", (x) => x.item !== 381)) {
    assert.equal(r.sounds.length, 1, `${r.item} ${r.remote}`);
    const want = parse(r.sounds[0]);
    assert.equal(want.name, "random.bow");
    assert.equal(want.volume, 0.5);
    // recover the draw from the native pitch, then run the port's formula on it
    const roll = (0.4 / want.pitch - 0.8) / 0.4;
    assert.ok(roll >= -1e-6 && roll < 1);
    const play = [];
    const hooks = { random: () => f(roll), playSound: (name, o) => play.push([name, o]), resetEquipped() {}, renderHotbar() {}, markUnsaved() {} };
    if ([332, 344, 368].includes(r.item)) {
      const id = r.item === 332 ? SNOWBALL : r.item === 344 ? EGG : ENDER_PEARL;
      const survival = { creative: false, take() {}, held: { id, count: 3 } };
      const projectiles = { throwSnowball: () => ({ kind: "s" }), throwEgg: () => ({ kind: "e" }), throwEnderPearl: () => ({ kind: "p" }) };
      throwHeldItem({ survival, projectiles, position: {}, yaw: 0, pitch: 0 }, id, hooks);
    } else if (r.item === 384) {
      const inv = { held: { id: 1951, count: 3 }, current: 0, decr() {} };
      throwExpBottle({ survival: { creative: false, inventory: inv, take() {} }, mobs: { potions: { throwFromPlayer: () => ({}) } }, position: {}, yaw: 0, pitch: 0 }, hooks);
    } else {
      usePotion({ survival: { creative: false, held: { id: 373, damage: 16421, count: 3 }, take() {} }, mobs: { potions: { throwFromPlayer() {} } }, position: {}, yaw: 0, pitch: 0 }, hooks);
    }
    assert.equal(play.length, 1, `port ${r.item}`);
    assert.equal(play[0][0], "random.bow");
    assert.equal(play[0][1].volume, 0.5);
    assert.ok(Math.abs(play[0][1].pitch - want.pitch) < 2e-6, `pitch ${r.item}: ${play[0][1].pitch} vs ${want.pitch}`);
    assert.equal(play[0][1].pitch, f(play[0][1].pitch), "float32 value");
    checked++;
  }
  assert.equal(checked, 10);
});

test("b76: eye of ender with no stronghold in range plays nothing and is not consumed (random.bow follows a found stronghold)", () => {
  for (const r of rec("throw", (x) => x.item === 381)) { assert.deepEqual(r.sounds, []); assert.equal(r.count, 3); }
});

test("b76: fire charge plays fire.ignite only on the server world (volume 1, pitch rand * 0.4 + 0.8, placed cell centre)", () => {
  for (const r of rec("use", (x) => x.item === 385)) {
    if (r.remote) { assert.deepEqual(r.sounds, [], "the client's ItemFireball returns at once"); continue; }
    const want = parse(r.sounds[0]);
    assert.equal(want.name, "fire.ignite");
    assert.equal(want.volume, 1);
    assert.ok(want.pitch >= f(0.8) && want.pitch < f(1.2));
    const roll = (want.pitch - 0.8) / 0.4;
    const target = r.scenario === "stone-floor" ? { block: [8, 63, 8], adjacent: [8, 64, 8] } : { block: [8, 64, 8], adjacent: [8, 64, 9] };
    const play = [];
    const state = {
      survival: { held: { id: ITEM_FIRE_CHARGE, count: 3 }, creative: true, inventory: {} },
      world: { height: 256, inside: () => true, get: () => 0 }, fire: { ignite() {}, drain: () => [] },
    };
    assert.equal(useFireCharge(state, target, { random: () => roll, playSound: (n, o) => play.push([n, o]) }), true);
    assert.equal(play.length, 1);
    assert.equal(play[0][0], "fire.ignite");
    assert.equal(play[0][1].volume, 1);
    assert.ok(Math.abs(play[0][1].pitch - want.pitch) < 1e-5);
    assert.deepEqual([play[0][1].position.x, play[0][1].position.y, play[0][1].position.z], want.pos);
  }
});

test("b76: hoe tilling plays the farmland step sound at (volume + 1) / 2 and frequency * 0.8 on the tilled block, on both sides", () => {
  const tilled = rec("use", (x) => x.item >= 290 && x.item <= 294 && x.result === true);
  assert.ok(tilled.length >= 4);
  const got = hoeSound(fromOriginal(60, 0).id);
  for (const r of tilled) {
    assert.equal(r.sounds.length, 1);
    const want = parse(r.sounds[0]);
    assert.equal(want.name, got.name);
    assert.equal(want.volume, f(got.volume));
    assert.equal(want.pitch, f(got.pitch));
    assert.deepEqual(want.pos, [8.5, 63.5, 8.5], "the tilled block's centre");
  }
  for (const r of rec("use", (x) => x.item >= 290 && x.item <= 294 && x.result === false)) assert.deepEqual(r.sounds, [], "nothing is tilled, nothing plays");
});

test("b76: bone meal plays no sound (only aux 2005 sparkles, on the server); lily pad item and shears are silent", () => {
  for (const r of rec("use", (x) => x.item === 351)) for (const s of r.sounds) assert.match(s, /^aux 2005 /);
  assert.ok(rec("use", (x) => x.item === 351 && x.sounds.length).length >= 2);
  for (const r of rec("use", (x) => x.item === 111 || x.item === 359)) assert.deepEqual(r.sounds, []);
});

test("b76: flint and steel plays fire.ignite on both worlds with the adjacent air cell's centre and pitch rand * 0.4 + 0.8", () => {
  const rows = rec("use", (x) => x.item === 259);
  assert.equal(rows.length, 2);
  for (const r of rows) { const w = parse(r.sounds[0]); assert.equal(w.name, "fire.ignite"); assert.equal(w.volume, 1); assert.deepEqual(w.pos, [8.5, 64.5, 8.5]); assert.ok(w.pitch >= f(0.8) && w.pitch < f(1.2)); }
});

test("b76: dig hit sound (PlayerControllerMP.onPlayerDamageBlock, Bytecode-read): step sound at (volume + 1) / 8, frequency * 0.5, on the first and every 4th continued hit", () => {
  // bje.c: `if (stepSoundTickCounter % 4.0F == 0) playSound(new PositionedSoundRecord(stepResourcePath, (v + 1) / 8, f * 0.5, x + .5, y + .5, z + .5))`, then the counter + 1; reset to 0 for each new block
  for (const [orig, step, vol] of [[1, "step.stone", 1], [2, "step.grass", 1], [3, "step.gravel", 1], [12, "step.sand", 1], [5, "step.wood", 1], [20, "step.stone", 1], [35, "step.cloth", 1], [88, "step.sand", 1]]) {
    const m = fromOriginal(orig, 0), h = hitSound(m.id);
    assert.equal(h.name, step, `block ${orig}`);
    assert.equal(f(h.volume), f((vol + 1) / 8));
    assert.equal(f(h.pitch), f(1 * 0.5));
  }
  // cadence: the port plays on hit 0, 4, 8 of a continued dig and not on the others
  const BLOCK = [4, 12, 7], hard = 3;
  const survival = new Survival({ slots: [] });
  const state = { playing: true, mineHeld: true, target: { block: [...BLOCK], adjacent: [4, 13, 7] }, aimedEntity: null, cooldown: 0, survival, heldTool: 0, grounded: true,
    mining: { block: [...BLOCK], type: hard, progress: 0, tool: 0, auto: false } };
  const hits = [];
  for (let i = 0; i < 9; i++) tickPlayerMining(state, { getBlock: () => hard, swing() {}, digSound: (type, cell) => hits.push([i, type, cell]), hitParticles() {} });
  assert.deepEqual(hits.map((h) => h[0]), [0, 4, 8]);
  assert.deepEqual(hits[0].slice(1), [hard, BLOCK]);
});
