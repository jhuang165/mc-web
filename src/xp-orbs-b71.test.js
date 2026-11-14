// Batch 71 mobfixes71: EntityXPOrb keeps closestPlayer (sq.f) until it is null or farther than 8 blocks (sq.h bytecode-read: the field is compared with
// getDistanceSqToEntity > 8 * 8 before World.getClosestPlayerToEntity(this, 8.0) runs again). The server passes every player of the dimension; single player passes the one.
// No Math.random: the orb's random is a fixed function and the id makes the search run every tick (id % 100 = 99, so xpTargetColor < xpColor + 79 always holds).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ExperienceOrbs, newOrb } from "./experience.js";

const open = { get: (x, y, z) => (y < 0 ? 3 : 0), getMeta: () => 0, solid: (x, y, z) => y < 0 };
function setup() {
  const orbs = new ExperienceOrbs([], () => 0.5), o = newOrb(5, 0.5, 3, 0.5, () => 0.5);
  o.id = 99; o.vx = o.vy = o.vz = 0; o.onGround = false;
  orbs.orbs.push(o);
  return { orbs, o };
}
const step = (orbs, o, players) => { orbs.tickOne(open, o, null, undefined, players); o.vx = o.vy = o.vz = 0; o.x = 0.5; o.z = 0.5; o.posY = 3.25; o.y = 3; o.bb = [0.25, 3, 0.25, 0.75, 3.5, 0.75]; };

test("the orb keeps its first player while that player stays within 8 blocks, even when another is closer", () => {
  const { orbs, o } = setup(), a = { x: 5, y: 3, z: 0.5 }, b = { x: 7.5, y: 3, z: 0.5 };
  step(orbs, o, [a, b]);
  assert.equal(o.who, a, "the closest player within 8 (a is 4.5 away, b 7)");
  b.x = 1.5; // b is now closest by far
  for (let i = 0; i < 5; i++) { step(orbs, o, [a, b]); assert.equal(o.who, a, `tick ${i}`); }
});

test("the orb drops its player beyond 8 blocks and takes the closest one then; none within 8 leaves it without a target", () => {
  const { orbs, o } = setup(), a = { x: 5, y: 3, z: 0.5 }, b = { x: 3, y: 3, z: 0.5 };
  step(orbs, o, [a, b]);
  assert.equal(o.who, b, "b is closer at the first search");
  b.x = 20; // b leaves: more than 8 blocks
  step(orbs, o, [a, b]);
  assert.equal(o.who, a);
  a.x = 30;
  step(orbs, o, [a, b]);
  assert.equal(o.who, null);
  assert.equal(o.target, false);
});

test("a player that left the world list is forgotten; saved orbs carry no target", () => {
  const { orbs, o } = setup(), a = { x: 5, y: 3, z: 0.5 };
  step(orbs, o, [a]);
  assert.equal(o.who, a);
  step(orbs, o, []);
  assert.equal(o.who, null);
  assert.equal("who" in orbs.serializeOne(o), false);
});

test("the search distance is strictly inside 8 (squared 64) and the first of two equal players wins", () => {
  const { orbs, o } = setup();
  step(orbs, o, [{ x: 8.5, y: 3.25, z: 0.5 }]);
  assert.equal(o.who, null, "exactly 8 blocks away is not inside");
  const { orbs: orbs2, o: o2 } = setup(), a = { x: 4.5, y: 3.25, z: 0.5 }, b = { x: -3.5, y: 3.25, z: 0.5 };
  step(orbs2, o2, [a, b]);
  assert.equal(o2.who, a);
});
