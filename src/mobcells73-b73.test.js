import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { ItemEntities } from "./item-entities.js";
import { Arrows, ARROW } from "./bow.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { plain } from "./legacy-ai-replay.js";
import { entityWalkers } from "./entity-simulation.js";
import { collectPickups } from "./pickup-order.js";
import { ENTITY_TYPES } from "./entities.js";
import "./blaze-ghast-mobs.js";
import { PHYSICS } from "./world.js";
import { FALLING_SIZE } from "./falling.js";
import { WITHER } from "./wither-rules.js";
import { PIGMAN } from "./nether-melee.js";
import { entityBox } from "./weather.js";
import { vehicleSize } from "./vehicle-seat.js";
import { orderTargets, stampEntity, forgetEntity, hasCell } from "./candidate-order.js";

// Batch 73 (mobcells73). public/research/pickup-order-reference.json (tools/probes/PickupOrderProbe.java): EntityPlayer.onLivingUpdate's pickup pass (bytecode-read loop, composed) over the
// unchanged World.getEntitiesWithinAABBExcludingEntity on real chunks, calling the real EntityItem, EntityXPOrb and EntityArrow onCollideWithPlayer.
const ref = JSON.parse(readFileSync(new URL("../public/research/pickup-order-reference.json", import.meta.url))).records;
const f = Math.fround, STONE = 3, NATIVE = { "1": STONE, "262": ARROW }, invOf = (s) => s.inventory.main.map((x) => (x ? `${x.id}*${x.count}` : 0));
const natInv = (a) => a.map((v) => (v === 0 ? 0 : v.replace(/^(\d+)\*/, (_, id) => `${NATIVE[id]}*`)));

function scene(r) {
  const items = new ItemEntities(() => 0.5), arrows = new Arrows(), orbs = new ExperienceOrbs([], () => 0.5), survival = new Survival({}, "survival"), made = [];
  r.before.forEach((v, i) => { survival.inventory.main[i] = v === 0 ? null : makeStack(NATIVE[v.split("*")[0]], +v.split("*")[1]); });
  for (const [kind, name, n, pos, moved] of r.entities) {
    const [x, y, z] = pos, [mx, , mz] = moved ?? pos;
    let e;
    if (kind === "item") { e = items.spawn({ id: name === "arrow" ? ARROW : STONE, count: n, damage: 0 }, mx, y, mz, { motion: [0, 0, 0] }); }
    else if (kind === "orb") { e = newOrb(n, mx, y, mz, () => 0); orbs.orbs.push(e); }
    else { e = arrows.make({ x: mx, y, z: mz, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), { inGround: true, pickup: 1 }); arrows.list.push(e); }
    stampEntity(e, x, kind === "item" ? y : y, z); // World.spawnEntityInWorld (the item's and orb's posY is the given y)
    if (moved) stampEntity(e, mx, y, mz); // an update that moved it: the re-slice
    made.push(e);
  }
  const feet = { x: r.feet[0], y: r.feet[1] + 1.62 - f(1.62), z: r.feet[2] }; // the native box starts posY - 1.62F (ChunkOrderProbe note)
  return { items, arrows, orbs, survival, made, feet };
}
function run(r, order) {
  const s = scene(r), half = f(0.6) / 2, taken = [];
  const playerBox = [s.feet.x - half, s.feet.y, s.feet.z - half, s.feet.x + half, s.feet.y + f(1.8), s.feet.z + half];
  const orbValue = s.orbs.collect(s.feet, 0.6, 1.8);
  const orbIdx = orbValue ? s.made.findIndex((e) => e.dead && e.value === orbValue) : -1;
  if (order === "native") {
    collectPickups({ ...s, feet: s.feet, width: 0.6, height: 1.8, playerBox, add: (st) => s.survival.inventory.add(st) }, { itemPicked: ({ item }) => taken.push(s.made.indexOf(item)), arrowTaken: (a) => taken.push(s.made.indexOf(a)) });
  } else { // before batch 73: every item in creation order, then the arrows
    for (const it of [...s.items.items]) if (s.items.pickupCandidates(s.feet, 0.6, 1.8).some((c) => c.ref === it)) { const got = s.items.takeOne(it, (st) => s.survival.inventory.add(st)); if (got) taken.push(s.made.indexOf(it)); }
    for (const c of s.arrows.pickupCandidates(playerBox)) if (s.arrows.takeOne(c.ref, s.survival)) taken.push(s.made.indexOf(c.ref));
  }
  return { taken, inv: invOf(s.survival), orbIdx, pops: s.arrows.drain().length };
}

test("the executed records show kinds sharing one list order", () => {
  assert.equal(ref.length, 700);
  assert.ok(ref.filter((r) => new Set(r.candidates.map((i) => r.entities[i][0])).size > 1 && r.candidates.some((v, i) => i && v < r.candidates[i - 1])).length > 150);
  assert.ok(ref.filter((r) => r.taken.length > 1).length > 300);
});

test("one interleaved pass takes items, orbs and arrows as EntityPlayer does (700 scenes: pickup order, inventory, orb, arrow sounds)", () => {
  for (const [n, r] of ref.entries()) {
    const got = run(r, "native"), kinds = r.entities.map((e) => e[0]), nativeTaken = r.taken.filter((i) => kinds[i] !== "orb");
    assert.deepEqual(got.taken, nativeTaken, `scene ${n} order`);
    assert.deepEqual(got.inv, natInv(r.inventory), `scene ${n} inventory`);
    assert.equal(got.orbIdx, r.taken.find((i) => kinds[i] === "orb") ?? -1, `scene ${n} orb`);
    assert.equal(got.pops, r.taken.filter((i) => kinds[i] === "arrow").length, `scene ${n} arrow sounds`);
  }
});

test("the separate passes of before batch 73 filled slots in another order in some scenes", () => {
  let wrong = 0, wrongOrder = 0;
  for (const r of ref) {
    const got = run(r, "legacy");
    if (JSON.stringify(got.inv) !== JSON.stringify(natInv(r.inventory))) wrong++;
    if (JSON.stringify(got.taken) !== JSON.stringify(r.taken.filter((i) => r.entities[i][0] !== "orb"))) wrongOrder++;
  }
  assert.ok(wrong >= 5, `inventory differs in ${wrong} scenes`);
  assert.ok(wrongOrder > wrong);
});

// The re-slice after each update (World.updateEntityWithOptionalForce): the walk in EntityWorld.tickMobs stamps every walked entity, so an entity that left its cell and came back
// sits at the end of its list, which a lazy stamp (only when a sweep looks) never saw.
test("the single-player walk stamps each entity's cell after its update (a round trip over a chunk border)", () => {
  const ew = new EntityWorld(plain([]), [], () => 0.5);
  ew.brightnessLevel = () => 15; ew.isDaytime = () => false; ew.ai.player.unticked = true; ew.ai.think = () => {};
  const items = new ItemEntities(() => 0.5), survival = new Survival({}, "survival"), player = { x: 8, y: 100, z: 8 };
  const ctx = { state: { world: ew.world, items, arrows: new Arrows(), primed: [], xpOrbs: new ExperienceOrbs([], () => 0.5), mobs: ew, survival, position: player }, hooks: {} };
  ew.walks = new Map([...entityWalkers(() => ctx)].filter(([k]) => k === "item" || k === "arrow" || k === "orb"));
  items.joined = (e) => ew.joined(e, "item");
  const a = items.spawn({ id: STONE, count: 1, damage: 0 }, 15.9, 100, 8, { motion: [0, 0, 0] }), b = items.spawn({ id: STONE, count: 1, damage: 1 }, 15.8, 100, 8, { motion: [0, 0, 0] });
  const cands = () => [a, b].map((e) => ({ key: e, ref: e, box: items.box(e), posY: e.y + 0.125 }));
  assert.equal(hasCell(a), false);
  a.mx = 0.5; ew.tickMobs(player, survival); // a crosses into chunk 1
  assert.equal(hasCell(a), true, "stamped by the walk, no sweep needed");
  a.mx = -0.5; ew.tickMobs(player, survival); // and back: the native list moved it behind b
  assert.ok(a.x < 16 && b.x < 16);
  assert.deepEqual(orderTargets(cands()).map((c) => c.ref === a ? "a" : "b"), ["b", "a"]);
  forgetEntity(a); forgetEntity(b); // the lazy stamp: first seen now, in list order
  assert.deepEqual(orderTargets(cands()).map((c) => c.ref === a ? "a" : "b"), ["a", "b"]);
});

// Entity.setSize(float, float) stores floats: a box edge is posX +- (float) width / 2. The tables the port reads must hold the floats, or a comparison at an edge goes the other way.
test("sizes of mobs, the player, falling blocks and vehicles are the setSize floats", () => {
  for (const [name, t] of Object.entries(ENTITY_TYPES)) { assert.equal(t.width, f(t.width), `${name} width`); assert.equal(t.height, f(t.height), `${name} height`); }
  assert.equal(PHYSICS.width, f(0.6)); assert.equal(PHYSICS.height, f(1.8));
  assert.equal(FALLING_SIZE, f(0.98)); assert.equal(WITHER.width, f(0.9)); assert.equal(PIGMAN.width, f(0.6)); assert.equal(PIGMAN.height, f(1.8));
  assert.deepEqual(vehicleSize({ boat: true }), [f(1.5), f(0.6)]); assert.deepEqual(vehicleSize({}), [f(0.98), f(0.7)]);
  assert.equal(ENTITY_TYPES.slime.width * 3, f(0.6) * 3); // EntitySlime.setSlimeSize: 0.6F * size, a float product
});

test("an entity box edge compares as the float does (a player 1e-8 off a block face)", () => {
  const x = 10.30000001, [minX] = entityBox({ x, y: 0, z: 0 }, 0.6, 1.8);
  assert.ok(minX < 10, "the float box reaches into the block at x = 10 (the double 0.6 box ends at 10.00000001)");
  assert.ok(x - 0.6 / 2 > 10);
});
