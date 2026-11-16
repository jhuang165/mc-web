// Batch 77 (spdispense77): the dispenser behaviours batch 76 left open, against public/research/sp-dispense77-reference.json (executed: tools/probes/SpDispense77Probe.java,
// the unchanged Bootstrap registry over DispenseProbe's World double), and the armour selection of ItemArmor's behaviour (abc / sp, bytecode-read).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Dispensing, ITEM } from "./dispense.js";
import { JavaRandom } from "./java-random.js";
import { fireballAcceleration } from "./blaze-ghast.js";
import { dispenseFirework } from "./fireworks-live.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { ITEMS } from "./survival.js";
import { equipArmor } from "./sp-dispense76.js";
import { forgetEntity } from "./candidate-order.js";
import { summonedMobRecord } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { gearFieldsFrom } from "./mob-equipment-live.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/sp-dispense77-reference.json", import.meta.url)));
const X = 10, Y = 64, Z = 10, f = Math.fround;
const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const INTERNAL = { 333: ITEM.BOAT, 385: ITEM.FIRE_CHARGE, 401: ITEM.FIREWORK };

class Fake {
  constructor(seed) { this.rand = new JavaRandom(seed); this.blocks = new Map(); this.log = []; }
  put(x, y, z, id) { this.blocks.set(`${x},${y},${z}`, id); }
  getBlock(x, y, z) { return this.blocks.get(`${x},${y},${z}`) ?? 0; }
  getBlockMetadata() { return 0; }
}
function replay(r, host) {
  const w = new Fake(r.seed), [fx, fy, fz] = FACE[r.facing];
  for (const c of r.cells) { const [dx, dy, dz, id] = c.split(",").map(Number); w.put(X + fx + dx, Y + fy + dy, Z + fz + dz, id); }
  const [id, count, damage] = r.item.split(":").map(Number), stack = { id: INTERNAL[id], count, damage };
  const aux = [];
  const engine = new Dispensing({ aux: (a, x, y, z, d) => aux.push(`aux,${a},${x},${y},${z},${d}`), spawnItem: () => {}, ...host });
  engine.dispense(w, X, Y, Z, r.facing, stack);
  return { w, aux, stack };
}

test("the reference was recorded from the unchanged 1.7.10 client and has the whole registry", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ref.rows.filter((r) => r.kind === "dispense").length, 12 + 35 + 6);
  assert.ok(ref.rows.every((r) => !r.error));
});

test("registry sweep (executed): the dispensable items are exactly the ones the port gives a behaviour; shears, pumpkins and skulls are not dispenser items in 1.7.10", () => {
  const ids = ref.rows.filter((r) => r.kind === "registry").map((r) => r.id);
  assert.deepEqual(ids, [46, 259, 262, ...Array.from({ length: 20 }, (_, i) => 298 + i), 325, 326, 327, 328, 332, 333, 342, 343, 344, 351, 373, 383, 384, 385, 401, 407, 408, 422]);
  for (const o of [359, 86, 397, 347, 346]) assert.ok(!ids.includes(o), `original ${o} has no dispense behaviour`);
  const engine = new Dispensing({ armorType: (s) => ITEMS[s.id]?.armor, boat: () => {} });
  const name = (s) => engine.behaviourFor(s) === engine.behaviourFor({ id: 280, count: 1, damage: 0 }) ? "default" : "own";
  for (const o of [359, 86, 397]) assert.equal(name({ id: ORIGINAL_ITEMS[o], count: 1, damage: 0 }), "default", `original ${o} is thrown`);
  for (let o = 298; o <= 317; o++) assert.equal(name({ id: ORIGINAL_ITEMS[o], count: 1, damage: 0 }), "own", `armour ${o}`);
  for (const o of [46, 259, 262, 325, 326, 327, 328, 332, 333, 342, 344, 351, 383, 384, 385, 401]) assert.equal(name({ id: ORIGINAL_ITEMS[o], count: 1, damage: o === 351 ? 15 : 0 }), "own", `item ${o}`);
});

test("fire charge (executed): start 0.3F beyond the face on x and z but the Y slip uses the X offset, acceleration = normalised (facing + 0.05 * gaussian) * 0.1, aux 1009, world Random consumption", () => {
  const rows = ref.rows.filter((r) => r.name === "fireCharge");
  assert.equal(rows.length, 12);
  for (const r of rows) {
    const balls = [], o = replay(r, { fireball: (b) => balls.push(b) }), e = r.spawned[0];
    assert.equal(balls.length, 1);
    const b = balls[0], [ax, ay, az] = fireballAcceleration(b.ax, b.ay, b.az);
    assert.ok(Math.abs(b.x - e.x) < 1e-12 && Math.abs(b.y - e.y) < 1e-12 && Math.abs(b.z - e.z) < 1e-12, `f${r.facing} position ${b.x},${b.y},${b.z} vs ${e.x},${e.y},${e.z}`);
    const d = e.doubles;
    assert.ok(Math.abs(ax - d["ze.b"]) < 1e-12 && Math.abs(ay - d["ze.c"]) < 1e-12 && Math.abs(az - d["ze.d"]) < 1e-12, `f${r.facing} acceleration`);
    assert.deepEqual(o.aux, r.log.filter((l) => l.startsWith("aux")), `f${r.facing} events`);
    assert.equal(o.w.rand.nextInt(1000000), r.worldNext, "three gaussians from the world Random");
    assert.equal(o.stack.count, r.after[0][1]);
  }
});

test("boats (executed): water or flowing water in front lifts the boat 1.0, air over water 0.0, everything else (lava, stone, nothing) throws the item with both sound pairs", () => {
  const rows = ref.rows.filter((r) => r.name?.startsWith("boat"));
  assert.equal(rows.length, 35);
  for (const r of rows) {
    const boats = [], items = [], o = replay(r, { boat: (x, y, z) => boats.push([x, y, z]), spawnItem: (s) => items.push(s) });
    const e = r.spawned[0], thrown = e.class === "xk";
    assert.equal(boats.length, thrown ? 0 : 1, r.name);
    assert.equal(items.length, thrown ? 1 : 0, r.name);
    if (!thrown) {
      // EntityBoat(world, x, y, z) puts posY at y + yOffset (0.3F); boats.js spawnBoat adds it, so the hook's y is the probe's posY minus 0.3F.
      assert.ok(Math.abs(boats[0][0] - e.x) < 1e-9 && Math.abs(boats[0][1] + f(0.3) - e.y) < 1e-6 && Math.abs(boats[0][2] - e.z) < 1e-9, `${r.name} f${r.facing}: ${boats[0]} vs ${e.x},${e.y},${e.z}`);
    }
    assert.deepEqual(o.aux, r.log.filter((l) => l.startsWith("aux")), `${r.name} f${r.facing} events`);
    assert.equal(o.stack.count, r.after[0][1]);
  }
});

test("fireworks (executed): the rocket starts at the cell centre + front x / z, y + 0.2F, aux 1002 then the smoke", () => {
  const rows = ref.rows.filter((r) => r.name === "firework");
  assert.equal(rows.length, 6);
  for (const r of rows) {
    const rockets = [], o = replay(r, { firework: (stack, x, y, z, fx, fz) => rockets.push(dispenseFirework({ launch: (...a) => a }, x, y, z, fx, fz, stack)) });
    const e = r.spawned[0], [x, y, z] = rockets[0];
    assert.ok(Math.abs(x - e.x) < 1e-9 && Math.abs(y - e.y) < 1e-9 && Math.abs(z - e.z) < 1e-9, `f${r.facing}`);
    assert.deepEqual(o.aux, r.log.filter((l) => l.startsWith("aux")), `f${r.facing} events`);
  }
});

// ---- armour selection ----
const mob = (x, z, extra = {}) => ({ x, y: 64, z, health: 20, canPickUpLoot: true, type: "zombie", equipment: [null, null, null, null, null], dropChances: Array(5).fill(f(0.085)), ...extra });
const helmet = { id: ORIGINAL_ITEMS[298], count: 3, damage: 0 };
const ctx = (mobs, extra = {}) => ({ mobs: { entities: mobs }, size: () => [0.6, 1.8], survival: { health: 20, inventory: { armor: [null, null, null, null] } }, ...extra });

test("armour goes to the FIRST qualifying entity in the native list order (chunk x, chunk z, slice, insertion), not the player first and not the port's list order", () => {
  const a = mob(15.9, 5.5), b = mob(16.1, 5.5); // the cell [15, 16): a stands in chunk 0, b in chunk 1; both boxes reach into the cell
  assert.equal(equipArmor(ctx([b, a]), [15, 64, 5], helmet, 4), true);
  assert.ok(a.equipment[4] && !b.equipment[4], "chunk 0 first although b is first in the port's list");
  assert.equal(a.dropChances[4], 2);
  assert.equal(a.equipment[4].count, 1);
  forgetEntity(a); forgetEntity(b);
  // the player in chunk 1 comes after a mob in chunk 0: natively the player is not always first
  const m = mob(15.9, 5.5), p = { position: { x: 16.1, y: 64, z: 5.5 }, width: 0.6, height: 1.8 }, c = ctx([m], { player: p });
  assert.equal(equipArmor(c, [15, 64, 5], helmet, 4), true);
  assert.ok(m.equipment[4] && !c.survival.inventory.armor[3], "the mob in the lower chunk wins");
  // the player and a mob in the same chunk: the player joined first
  const m2 = mob(15.2, 5.5), p2 = { position: { x: 15.5, y: 64, z: 5.5 }, width: 0.6, height: 1.8 }, c2 = ctx([m2], { player: p2 });
  forgetEntity("player");
  assert.equal(equipArmor(c2, [15, 64, 5], helmet, 4), true);
  assert.ok(c2.survival.inventory.armor[3] && !m2.equipment[4], "same chunk: the player first");
  forgetEntity(m); forgetEntity(m2); forgetEntity("player");
});

test("qualifying set (sp.a): dead mobs, mobs that cannot pick up loot and occupied slots are skipped; any EntityLiving that can pick up loot gets an equipment array", () => {
  const dead = mob(5.5, 5.5, { health: 0 }), noLoot = mob(5.5, 5.5, { canPickUpLoot: false }), worn = mob(5.5, 5.5), cow = { x: 5.5, y: 64, z: 5.5, health: 10, canPickUpLoot: true, type: "cow" };
  worn.equipment[4] = { id: 298, count: 1, damage: 0 };
  const c = ctx([dead, noLoot, worn, cow]);
  assert.equal(equipArmor(c, [5, 64, 5], helmet, 4), true);
  assert.equal(cow.equipment[4].id, 298, "the cow (no gear storage before) is dressed");
  assert.equal(cow.dropChances[4], 2);
  assert.equal(dead.equipment[4], null); assert.equal(noLoot.equipment[4], null);
  assert.equal(equipArmor(ctx([dead, noLoot]), [5, 64, 5], helmet, 4), false, "nobody qualifies: the item is thrown");
  for (const e of [dead, noLoot, worn, cow]) forgetEntity(e);
});

test("a mob type without gear keeps CanPickUpLoot and worn stacks through NBT and its stored fields; an all-default tag stays field-free", () => {
  const t = (type, value) => ({ type, value });
  const keep = (tag) => summonedMobRecord("cow", tag, { convertItem: (c) => ({ id: 298, count: 1, damage: 0 }) }).record;
  const loot = keep(new Map([["CanPickUpLoot", t(NBT.BYTE, 1)]]));
  assert.equal(loot.canPickUpLoot, true);
  assert.equal(loot.equipment.length, 5);
  const worn = keep(new Map([["Equipment", t(NBT.LIST, { elementType: NBT.COMPOUND, items: [new Map(), new Map(), new Map(), new Map(), new Map([["id", t(NBT.SHORT, 298)], ["Count", t(NBT.BYTE, 1)]])] })]]));
  assert.equal(worn.equipment[4].id, 298);
  const plain = keep(new Map([["CanPickUpLoot", t(NBT.BYTE, 0)]]));
  assert.equal(plain.equipment, undefined);
  const kept = gearFieldsFrom({ type: "cow", equipment: worn.equipment, dropChances: [0.085, 0.085, 0.085, 0.085, 2], canPickUpLoot: true });
  assert.equal(kept.equipment[4].id, 298);
  assert.equal(kept.canPickUpLoot, true);
  assert.equal(kept.dropChances[4], 2);
  assert.deepEqual(gearFieldsFrom({ type: "cow" }), { equipment: undefined, dropChances: undefined, canPickUpLoot: undefined });
});
