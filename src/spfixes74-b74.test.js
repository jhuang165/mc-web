// Batch 74 spfixes74: EntityPlayer.onDeath's motion (death-throw.js), the non-living targets of a falling anvil (falling-hurt.js) and the bonus chest torch rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Survival } from "./survival.js";
import { deathThrow, attackedAtOf } from "./death-throw.js";
import { hurtNonLiving } from "./falling-hurt.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Boats } from "./boats.js";
import { Hanging, FRAME_ITEM } from "./hanging.js";
import { torchAddedMeta } from "./torches.js";
const LEAVES = 5, STONE = 3; // port ids (trees.js, world.js)
import { makeStack } from "./inventory.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test("death throw: motionY 0.1, horizontal 0.1 away from the attacker, S12 rounding", () => {
  const from = (x, z) => attackedAtOf(true, { x, z });
  let t = deathThrow(from(5, 0), { x: 0, z: 0 }, 37); // attacker east: angle 0 -> motionX -0.1, motionZ 0
  near(t.x, -0.0999, 2e-4); near(t.z, 0, 2e-4); assert.equal(t.y, 0.1);
  t = deathThrow(from(0, 5), { x: 0, z: 0 }, -80); // attacker south (+z): angle 90 -> motionZ -0.1
  near(t.x, 0, 2e-4); near(t.z, -0.0999, 2e-4);
  t = deathThrow(from(-5, 0), { x: 0, z: 0 }, 0); // attacker west: motionX +0.1
  near(t.x, 0.0999, 2e-4);
  assert.equal(t.x * 8000, Math.trunc(t.x * 8000)); // multiples of 1/8000
});

test("no attacker entity: attackedAtYaw is 0 or 180 plus the yaw; inside the hurt window it is 0", () => {
  let t = deathThrow(attackedAtOf(true, null, () => 0.1), { x: 0, z: 0 }, 0); // (int)(0.1 * 2) * 180 = 0 -> cos 0
  near(t.x, -0.0999, 2e-4);
  t = deathThrow(attackedAtOf(true, null, () => 0.9), { x: 0, z: 0 }, 0); // 180
  near(t.x, 0.0999, 2e-4);
  t = deathThrow(attackedAtOf(false, { x: 9, z: 9 }), { x: 0, z: 0 }, 90); // rel 0 + yaw 90
  near(t.z, -0.0999, 2e-4);
});

test("Survival.damage records the attacker for the death throw", () => {
  const s = new Survival({}, "survival");
  s.damage(2, "mob", false, undefined, { x: 3, z: 4 });
  assert.deepEqual(s.attackedAt, { from: { x: 3, z: 4 } });
  s.hurtTicks = 0;
  s.damage(1, "fall");
  assert.ok(s.attackedAt.rel === 0 || s.attackedAt.rel === 180);
});

test("a falling anvil's box hurts items, orbs, boats and hanging entities (EntityFallingBlock.fall hurts every entity)", () => {
  const items = new ItemEntities(), xpOrbs = new ExperienceOrbs(), boats = new Boats(), hanging = new Hanging();
  const weak = items.spawn(makeStack(4, 1), 0.5, 1, 0.5), strong = items.spawn(makeStack(4, 1), 0.5, 1, 0.55);
  const far = items.spawn(makeStack(4, 1), 9.5, 1, 9.5);
  xpOrbs.spawn(3, { x: 0.5, y: 1, z: 0.5 });
  const boat = boats.spawnBoat({ x: 0.5, y: 1, z: 0.5 });
  const frame = hanging.summon("frame", 0, 0, 1, 0, 0.5, 1, 0.5, { item: { id: 1, count: 1, damage: 0 } });
  const painting = hanging.summon("painting", 0, 0, 1, 0, 0.5, 1, 0.5);
  const box = [0, 0.5, 0, 1, 2, 1];
  const hit = hurtNonLiving(box, 2, "anvil", { items, xpOrbs, minecarts: null, boats, hanging });
  assert.equal(weak.health, 3); assert.equal(far.health, 5);
  assert.ok(hit.includes(boat) && boat.damage === 20 && !boat.dead);
  assert.equal(frame.item, null); assert.equal(frame.dead, false); // a frame with an item drops it and stays
  assert.equal(painting.dead, true);
  assert.equal(xpOrbs.orbs.length ? xpOrbs.orbs[0].health : 0, 3);
  hurtNonLiving(box, 6, "anvil", { items, xpOrbs, minecarts: null, boats, hanging }); // 6 >= 5: the items and the orb die; the boat passes 40
  assert.equal(strong.dead, true); assert.equal(xpOrbs.orbs.length, 0); assert.equal(boat.dead, true);
  assert.equal(items.items.includes(strong), false);
  assert.ok(hanging.drain().some((d) => d.stack.id === FRAME_ITEM || d.stack.id === 1));
});

test("bonus chest torches: leaves are not a solid side (isBlockNormalCubeDefault), stone is", () => {
  const cells = new Map();
  const world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? STONE : 0), getMeta: () => 0, solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? (y < 0 ? STONE : 0)) !== 0 };
  cells.set("-1,0,0", LEAVES);
  assert.equal(torchAddedMeta(world, 0, 0, 0, 0), 5);
  cells.set("1,0,0", STONE);
  assert.equal(torchAddedMeta(world, 0, 0, 0, 0), 2);
});
