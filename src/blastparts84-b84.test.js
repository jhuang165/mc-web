// b84 blastparts84: arrows set velocityChanged (sa.a = setBeenAttacked), a crystal's box is [posY - 1, posY + 1] with eye posY (wz yOffset 1, bytecode-read), a hanging
// entity's drop is spawned at its own turn (single player's plain Hanging drained through vehicleDrop), and a dragon body takes the push (xa.a(ro, F) returns false).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Arrows } from "./bow.js";
import { explodeMobs, explodeNonLiving } from "./explosion-simulation.js";

const air = () => ({ get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0, set: () => true, isLoaded: () => true, isTicking: () => true, height: 256 });

test("an arrow in a blast sets velocityChanged with its push; out of reach it does not", () => {
  const arrows = new Arrows(() => 0.5), world = air();
  const a = { x: 2.5, y: 20, z: 0.5, mx: 0, my: 0, mz: 0, dead: false }, far = { x: 50, y: 20, z: 0.5, mx: 0, my: 0, mz: 0, dead: false };
  arrows.list.push(a, far);
  arrows.explode(world, 0.5, 20, 0.5, 4);
  assert.equal(a.velocityChanged, true);
  assert.ok(a.mx > 0);
  assert.ok(!far.velocityChanged);
});

test("an ender crystal's reach uses posY +/- 1 and eye posY", () => {
  const world = air(), hits = [];
  const mobs = { entities: [{ type: "ender_crystal", x: 0.5, y: 20, z: 5.5, vx: 0, vy: 0, vz: 0, health: 5, growingAge: 0 }], hazard: (e) => hits.push(e), damage: (e) => hits.push(e) };
  // a centre 2.5 above posY is still inside its box (posY + 1 = 21, centre y 22.5 is 1.5 above, within size 2 reach); the old box [20, 22] put the eye 1.7 above feet
  const r = explodeMobs({ world, mobs, position: { x: 100, y: 100, z: 100 } }, { x: 0.5, y: 18.5, z: 5.5, size: 2 });
  assert.equal(r.length, 1, "posY 20 is 1.5 from the centre: inside the 4-block reach");
  assert.ok(Math.abs(r[0].entity.vy) > 0);
});

test("a hanging entity's drop is spawned at once at its turn when single player drains it through vehicleDrop", () => {
  const drained = [];
  const e = { dead: false, x: 0.5, y: 20, z: 0.5 };
  const hanging = { entities: [e], explodeOne(h) { h.dead = true; hanging.drops.push({ stack: { id: 321 }, x: 0.5, posY: 20, z: 0.5 }); }, drops: [], drain() { const d = hanging.drops; hanging.drops = []; return d; } };
  explodeNonLiving({ world: air(), hanging }, 0.5, 20, 1.5, 3, null, false, (d) => drained.push(d));
  assert.equal(drained.length, 1);
  assert.equal(hanging.drops.length, 0);
});

test("source: dragon body row pushes and parts are collected before the first hurt", () => {
  const src = readFileSync(new URL("./explosion-simulation.js", import.meta.url), "utf8");
  assert.match(src, /const listed = \[\.\.\.entity\.dragon\.parts\.entries\(\)\]/);
  assert.match(src, /entity\.vx \+= body\.push\[0\]/);
});
