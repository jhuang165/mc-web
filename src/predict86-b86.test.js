// Batch 86 predict86: more of sendUseItem's client-side onItemRightClick (client-item-use.js; bytecode-read per class, see the file's header).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { clientUseItem, boatRay, clientBoatFits, clientEntityBoxes } from "./client-item-use.js";
import { applyHeldPlan } from "./client-prediction.js";
import { MapStore, ITEM_EMPTY_MAP, ITEM_FILLED_MAP, createMapData } from "./maps.js";
import { ITEM_GLASS_BOTTLE, ITEM_POTION } from "./potions.js";
import { BOAT_ITEM } from "./boats.js";

function pond() {
  const w = new World("predict86-pond");
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    for (let y = 9; y <= 20; y++) w.set(40 + dx, y, 40 + dz, 0, false, 0);
    w.set(40 + dx, 10, 40 + dz, 3, false, 0); w.set(40 + dx, 11, 40 + dz, WATER, false, 0);
  }
  return w;
}
const DOWN = { eye: [40.5, 12.8, 40.5], dir: [0, -1, 0] };
const survivalOf = (id, n, damage = 0) => { const s = new Survival({ slots: [makeStack(id, n)] }); s.held.damage = damage; s.held.count = n; return s; };
const use = (w, s, extra = {}) => clientUseItem({ world: w, survival: s, held: s.held, ...DOWN, yaw: 0, ...extra });
const fill = (s, id = 1) => { for (let i = 1; i < 36; i++) s.inventory.main[i] = makeStack(id, 64); };
const remoteStore = () => { const m = new MapStore(); m.remote = true; return m; }; // connectMaps: load(null), so the counter is 0

test("empty map: the client's own counter names the map (0, 1, ... per connection) and its data is made at scale 0 round the player", () => {
  const maps = remoteStore(), s = survivalOf(ITEM_EMPTY_MAP, 1);
  const out = use(pond(), s, { maps, position: { x: 200, y: 64, z: -70 }, dimension: -1 });
  assert.deepEqual(out.plan, { dCount: 0, swap: [ITEM_EMPTY_MAP, ITEM_FILLED_MAP], swapDamage: 0 });
  assert.deepEqual([out.map.id, out.map.scale, out.map.xCenter, out.map.zCenter, out.map.dimension], [0, 0, 256, -128, -1]); // Math.round(200 / 128) * 128, round(-70 / 128) = -1
  applyHeldPlan(s.inventory, out.plan);
  assert.deepEqual([s.held.id, s.held.damage, s.held.count], [ITEM_FILLED_MAP, 0, 1]);
  const many = survivalOf(ITEM_EMPTY_MAP, 3);
  const second = use(pond(), many, { maps, position: { x: 0, y: 64, z: 0 } });
  assert.deepEqual(second.plan, { dCount: -1, give: ITEM_FILLED_MAP, giveDamage: 1 });
  const undo = applyHeldPlan(many.inventory, second.plan);
  assert.equal(many.held.count, 2);
  assert.deepEqual([many.inventory.main[1].id, many.inventory.main[1].damage], [ITEM_FILLED_MAP, 1]);
  undo();
  assert.equal(many.held.count, 3); assert.equal(many.inventory.main[1], null);
  assert.equal(maps.counter, 2);
});

test("empty map: Creative takes one too (acl has no creative test), and the client's copy of a map with that id is replaced by a blank one", () => {
  const maps = remoteStore(), old = createMapData(0, { scale: 2, xCenter: 512, zCenter: 512 });
  old.colors.fill(7); maps.set(old); // S34 had filled the client's map_0
  const c = survivalOf(ITEM_EMPTY_MAP, 4); c.mode = "creative";
  const out = use(pond(), c, { maps, position: { x: 10, y: 64, z: 10 } });
  assert.deepEqual(out.plan, { dCount: -1, give: ITEM_FILLED_MAP, giveDamage: 0 });
  assert.notEqual(maps.get(0), old);
  assert.deepEqual([maps.get(0).scale, maps.get(0).xCenter, maps.get(0).colors.some(v => v !== 0)], [0, 0, false]);
  assert.deepEqual(use(pond(), survivalOf(ITEM_EMPTY_MAP, 1)), { cells: [], plan: null }, "no store: nothing predicted");
});

test("overflow: a full inventory gets no filled item and no entity (bjk.a(xk) is empty); only the held stack shrinks, and the undo restores it", () => {
  const w = pond(), s = survivalOf(ITEM_GLASS_BOTTLE, 2);
  fill(s);
  const out = use(w, s);
  assert.deepEqual(out.plan, { dCount: -1, give: ITEM_POTION });
  assert.equal(out.entities, undefined);
  const before = s.inventory.main.map(m => m && [m.id, m.count]);
  const undo = applyHeldPlan(s.inventory, out.plan);
  assert.equal(s.held.count, 1);
  assert.deepEqual(s.inventory.main.slice(1).map(m => m && [m.id, m.count]), before.slice(1));
  undo(); assert.equal(s.held.count, 2);
  const b = survivalOf(340, 3); fill(b);
  applyHeldPlan(b.inventory, use(w, b).plan);
  assert.equal(b.held.count, 2); assert.ok(!b.inventory.main.some(m => m && m.id !== 340 && m.id !== 1));
});

test("a given map merges into a stack with its id (addItemStackToInventory) and the undo takes back only the one added", () => {
  const maps = remoteStore(), s = survivalOf(ITEM_EMPTY_MAP, 2);
  s.inventory.main[5] = makeStack(ITEM_FILLED_MAP, 3, 0);
  const plan = use(pond(), s, { maps, position: { x: 0, y: 64, z: 0 } }).plan, undo = applyHeldPlan(s.inventory, plan);
  assert.equal(s.inventory.main[5].count, 4); assert.equal(s.inventory.main[1], null);
  undo(); assert.equal(s.inventory.main[5].count, 3); assert.equal(s.held.count, 2);
});

test("armour: an empty slot takes the piece and the hand empties at once, Creative too; a worn slot keeps both", () => {
  for (const mode of ["survival", "creative"]) {
    const s = survivalOf(416, 1); s.mode = mode; // diamond helmet, armor type 0 -> slot 39
    const out = use(pond(), s);
    assert.deepEqual(out.plan, { dCount: -1, equip: 39 });
    const undo = applyHeldPlan(s.inventory, out.plan);
    assert.equal(s.inventory.getStack(39)?.id, 416); assert.equal(s.inventory.main[0], null);
    undo(); assert.equal(s.inventory.getStack(39), null); assert.equal(s.inventory.main[0].id, 416);
  }
  const s = survivalOf(417, 1); s.inventory.setStack(38, makeStack(401, 1)); // diamond chestplate over a worn tunic
  assert.equal(use(pond(), s).plan, null);
});

test("boat ray: posY + 1.62 - yOffset (feet - ySize + 1.62, not the camera) along MathHelper sin / cos of the rotation", () => {
  const r = boatRay({ x: 40.5, y: 13, z: 40.5 }, 0, 37, 20);
  assert.ok(Math.abs(r.eye[1] - 14.62) < 1e-12);
  assert.ok(Math.abs(r.dir[0] - Math.sin(37 * Math.PI / 180) * -Math.cos(20 * Math.PI / 180)) < 1e-4);
  assert.ok(Math.abs(r.dir[1] + Math.sin(20 * Math.PI / 180)) < 1e-4);
  assert.ok(Math.abs(boatRay({ x: 0, y: 13, z: 0 }, 0.3, 0, 0).eye[1] - 14.32) < 1e-12);
});

const boatState = (entities, extra = {}) => ({ world: pond(), position: { x: 40.5, y: 13, z: 40.5 }, ySize: 0, mcYaw: 0, mcPitch: 90, yaw: 0, playerBox: [40.2, 13, 40.2, 40.8, 14.8, 40.8], entities, ...extra });
// b87 boatcheck87: the start is where rayTraceBlocks left it (the water cell's entry, y 12), not the eye (14.62); a box round the eye no longer refuses.
test("boat sight check: a collidable copy whose box (grown by its border) holds the ray start refuses; a non-collidable one does not", () => {
  assert.equal(clientBoatFits(boatState([])), true);
  assert.equal(clientBoatFits(boatState([{ bb: [40.3, 14.5, 40.3, 40.7, 14.6, 40.7], collide: true }])), true); // round the eye
  const round = [40.3, 11.85, 40.3, 40.7, 11.95, 40.7]; // 0.05 below the start: inside with the 0.1 border, below the shrunk boat box
  assert.equal(clientBoatFits(boatState([{ bb: round, collide: true }])), false);
  assert.equal(clientBoatFits(boatState([{ bb: round, collide: false }])), true);
  const far = [40.3, 11.3, 40.3, 40.7, 11.4, 40.7]; // 0.6 below: only EntityFireball's 1.0 border reaches
  assert.equal(clientBoatFits(boatState([{ bb: far, collide: true }])), true);
  assert.equal(clientBoatFits(boatState([{ bb: far, collide: true, border: 1 }])), false);
});

test("boat box check: every copy's box counts (an item floating there, the player's own box), and the stack is kept", () => {
  assert.equal(clientBoatFits(boatState([{ bb: [40.4, 12.2, 40.4, 40.65, 12.45, 40.65], collide: false }])), false);
  assert.equal(clientBoatFits(boatState([], { position: { x: 40.5, y: 12, z: 40.5 }, playerBox: [40.2, 12, 40.2, 40.8, 13.8, 40.8] })), false);
  const s = survivalOf(BOAT_ITEM, 2);
  assert.deepEqual(clientUseItem({ ...boatState([]), survival: s, held: s.held, ...DOWN }).plan, { dCount: -1 });
  assert.equal(clientUseItem({ ...boatState([{ bb: [40, 12, 40, 41, 12.5, 41], collide: false }]), survival: s, held: s.held, ...DOWN }).plan, null);
});

test("clientEntityBoxes: canBeCollidedWith and the box of each copy kind", () => {
  const mobs = { list: () => [{ type: "cow", x: 0, y: 0, z: 0, health: 10 }, { type: "ender_dragon", x: 5, y: 0, z: 5, health: 10 }, { type: "pig", x: 9, y: 0, z: 9, health: 0, death: 20 }], factory: { size: () => [0.9, 1.3] } };
  const rows = clientEntityBoxes({ mobs, primed: [{ x: 1, y: 2, z: 3 }], items: [{ x: 0, y: 5, z: 0 }], orbs: [{ x: 0, y: 6, z: 0 }], arrows: [{ x: 0, y: 7, z: 0 }],
    balls: [{ kind: "fireball", x: 0, y: 8, z: 0 }, { kind: "smallFireball", x: 0, y: 9, z: 0 }, { kind: "snowball", x: 0, y: 10, z: 0 }],
    vehicles: { carts: { carts: [{ bb: [0, 0, 0, 1, 1, 1] }, { bb: [2, 0, 2, 3, 1, 3], dead: true }] }, boats: { carts: [] }, hanging: { copies: new Map([["h1", { bb: [4, 4, 4, 5, 5, 4.1] }]]) } } });
  assert.deepEqual(rows.map(r => [r.collide, r.border ?? 0.1]), [[true, 0.1], [false, 0.1], [true, 0.1], [true, 0.1], [true, 0.1], [false, 0.1], [false, 0.1], [false, 0.1], [true, 1], [false, 0.1], [false, 0.1]]);
  assert.deepEqual(rows[5].bb, [-0.125, 5, -0.125, 0.125, 5.25, 0.125]);
  assert.deepEqual(rows[8].bb, [-0.5, 8, -0.5, 0.5, 9, 0.5]);
});

test("main.js hands the client copies, the map store and the tick rotation to clientUseItem", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /clientEntityBoxes\(\{ players: remotePlayers\?\.entries, mobs: remoteMobs, vehicles: remoteVehicles/);
  assert.match(main, /mcYaw, mcPitch, position, ySize: motion\.ySize \?\? 0, playerBox: pbox, entities, maps: mapStore/);
});
