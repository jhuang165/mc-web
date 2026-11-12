import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Dispensing, dispenserBehaviour, ITEM } from "./dispense.js";
import { JavaRandom } from "./java-random.js";
import { spawnEggMob } from "./spawn-egg-use.js";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { Hanging, FRAME_ITEM } from "./hanging.js";

await populationBlockMapperReady;
// Batch 51 (tag b51ad): public/research/away-dispense-reference.json, executed AwayDispenseProbe on the real 1.7.10 dispenser classes.
const ref = JSON.parse(readFileSync(new URL("../public/research/away-dispense-reference.json", import.meta.url)));
const X = 10, Y = 64, Z = 10;
const TO_INTERNAL = { 383: ITEM.SPAWN_EGG, 384: ITEM.EXP_BOTTLE };
const parse = (s) => { const [id, count, damage] = s.split(":").map(Number); return { id: TO_INTERNAL[id], count, damage }; };
class Fake {
  constructor(seed) { this.rand = new JavaRandom(seed); this.blocks = new Map(); this.metas = new Map(); this.log = []; }
  put(x, y, z, id, meta = 0) { this.blocks.set(`${x},${y},${z}`, id); this.metas.set(`${x},${y},${z}`, meta); }
  getBlock(x, y, z) { return this.blocks.get(`${x},${y},${z}`) ?? 0; }
  getBlockMetadata(x, y, z) { return this.metas.get(`${x},${y},${z}`) ?? 0; }
  isBlockIndirectlyGettingPowered() { return false; }
}
function fire(r, host, entityRandom) {
  const w = new Fake(r.seed), tile = { items: Array(9).fill(null) };
  tile.items[0] = parse(r.item);
  if (r.customName) tile.items[0].displayName = r.customName;
  w.put(X, Y, Z, 23, r.facing);
  const engine = new Dispensing({ ...host(w), tile: () => tile, aux: (id, x, y, z, d) => w.log.push(`aux,${id},${x},${y},${z},${d}`) });
  engine.slotRandom = new JavaRandom(555);
  if (entityRandom) engine.entityRandom = entityRandom;
  dispenserBehaviour(engine, false).updateTick(w, X, Y, Z);
  return { w, tile };
}
const after = (s) => (s ? [{ [ITEM.SPAWN_EGG]: 383, [ITEM.EXP_BOTTLE]: 384 }[s.id], s.count, s.damage ?? 0] : null);
const eggRows = ref.rows.filter((r) => r.kind === "dispense" && r.item.startsWith("383:") && r.name !== "eggUnregistered");

test("spawn egg dispense: the spawn point, yaw from the world Random, name, one egg used and the sound (executed rows)", () => {
  assert.ok(eggRows.length >= 70);
  let spawned = 0;
  for (const r of eggRows) {
    const made = [];
    const { w, tile } = fire(r, () => ({
      spawnEgg: (stack, at, roll) => made.push(spawnEggMob({ mobs: { spawnNatural: (type, x, y, z) => ({ type, x, y, z }) } }, stack.damage, at, stack.displayName, () => roll())),
    }));
    const label = `${r.name} f${r.facing} ${r.item}`;
    assert.deepEqual(after(tile.items[0]), r.after, label);
    assert.deepEqual(w.log, r.log, label);
    const want = r.spawned[0], got = made[0];
    assert.ok(want, label);
    if (!got) continue; // an egg this build has no mob for (ghast, blaze, ...): nothing spawns here, the egg is still used up as natively
    spawned++;
    assert.equal(got.x, want.x, label); assert.equal(got.y, want.y, label); assert.equal(got.z, want.z, label);
    for (const k of ["rotationYaw", "rotationYawHead", "renderYawOffset"]) assert.equal(Math.fround(got[k]), Math.fround(want[k === "rotationYaw" ? "yaw" : k === "rotationYawHead" ? "headYaw" : "bodyYaw"]), `${label} ${k}`);
    if (r.customName) assert.equal(got.customName, want.name, label);
    else assert.equal(got.customName, undefined, label);
  }
  assert.ok(spawned >= 40, `${spawned} spawned`);
});

test("spawn egg dispense: an unregistered damage spawns nothing, still uses the egg and draws no world Random", () => {
  const rows = ref.rows.filter((r) => r.name === "eggUnregistered");
  assert.equal(rows.length, 6);
  for (const r of rows) {
    assert.deepEqual(r.spawned, []);
    const { w, tile } = fire(r, () => ({ spawnEgg: (stack, at, roll) => spawnEggMob({ mobs: { spawnNatural() { assert.fail("no mob"); } } }, stack.damage, at, null, roll) }));
    assert.deepEqual(after(tile.items[0]), r.after);
    assert.equal(w.rand.nextInt(1000000), r.worldNext);
  }
});

test("exp bottle dispense: the headings of the real ku (velocity 1.375, inaccuracy 3.0) replay with a reseeded Entity.rand", () => {
  const rows = ref.rows.filter((r) => r.kind === "heading");
  assert.equal(rows.length, 18);
  for (const r of rows) {
    assert.equal(r.velocity, 1.375); assert.equal(r.inaccuracy, 3);
    const got = [];
    fire({ seed: 1, facing: r.facing, item: "384:1:0" }, () => ({ thrown: (kind, e) => got.push({ kind, ...e }) }), () => new JavaRandom(r.seed));
    assert.equal(got[0].kind, "expBottle");
    for (const k of ["mx", "my", "mz"]) assert.ok(Math.abs(got[0][k] - r.entity[k]) < 1e-9, `f${r.facing} s${r.seed} ${k}`);
    for (const k of ["yaw", "pitch"]) assert.equal(Math.fround(got[0][k]), Math.fround(r.entity[k]), `f${r.facing} s${r.seed} ${k}`);
  }
});

test("exp bottle dispense rows: position, class zn, stack shrink and sounds", () => {
  const rows = ref.rows.filter((r) => r.name === "expBottle");
  assert.equal(rows.length, 12);
  for (const r of rows) {
    const got = [];
    const { w, tile } = fire(r, () => ({ thrown: (kind, e) => got.push({ kind, ...e }) }), () => new JavaRandom(1));
    assert.equal(r.spawned[0].class, "zn");
    for (const k of ["x", "y", "z"]) assert.ok(Math.abs(got[0][k] - r.spawned[0][k]) < 1e-9, k);
    assert.deepEqual(after(tile.items[0]), r.after);
    assert.deepEqual(w.log, r.log);
  }
});

// The away run: an item frame whose support block is gone drops itself and its item on its 101st update (hanging-reference.json "frame-removed",
// executed HangingProbe: deadAt 100, drops frame item then the held item, delay 10).
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = (root, ticks) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  return runAway(plan);
};
test("away run: an unsupported item frame breaks on the 101st update and drops the frame and its item", async () => {
  const hanging = new Hanging(); hanging.entities.push(hanging.make("frame", 0, 5, 12, 5, { item: { id: 4, count: 1, damage: 0 }, rotation: 0, dropChance: 1 }));
  const records = hanging.toJSON();
  const ref2 = JSON.parse(readFileSync(new URL("../public/research/hanging-reference.json", import.meta.url))).cases.find((c) => c.name === "frame-removed");
  assert.equal(ref2.deadAt, 100);
  const held = await run({ ...base, hanging: records }, ref2.deadAt);
  assert.equal(held.entities.hanging.length, 1, "alive through the 100th update");
  const gone = await run({ ...base, hanging: records }, ref2.deadAt + 1);
  assert.equal(gone.entities.hanging.length, 0);
  const ids = gone.entities.drops.map((d) => d.id ?? d.stack?.id ?? d.item?.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [4, FRAME_ITEM].sort((a, b) => a - b), JSON.stringify(gone.entities.drops[0]));
  assert.equal(ref2.drops.length, gone.entities.drops.length);
});
