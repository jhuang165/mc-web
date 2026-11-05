import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, HOSTILE } from "./entities.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { JavaRandom } from "./java-random.js";

// A flat grass world (stone below y 1; the original finds no ground at y 0) that records edits.
const cells = new Map();
const key = (x, y, z) => `${x},${y},${z}`;
const world = {
  numericSeed: 1, solid: (x, y, z) => y < 1 || (cells.get(key(x, y, z)) ?? 0) > 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  get: (x, y, z) => cells.get(key(x, y, z)) ?? (y < 1 ? 1 : 0), getMeta: () => 0,
  set: (x, y, z, id) => { if (id) cells.set(key(x, y, z), id); else cells.delete(key(x, y, z)); },
};
const survival = (time) => ({ health: 20, creative: false, time, damage() {}, scaledDamage() {}, count: () => 0 });
const make = (extra = {}) => {
  const w = new EntityWorld(world, [{ id: "e0", type: "enderman", x: 64.5, y: 1, z: 64.5, health: 40, ...extra }], () => 0.5);
  w.difficulty = 2;
  w.isDaytime = () => false;
  return w;
};

test("the enderman is a 40 health 0.6 x 2.9 hostile with 7 damage and no loot of its own", () => {
  const t = ENTITY_TYPES.enderman;
  assert.equal(t.health, 40);
  assert.equal(t.width, Math.fround(0.6));
  assert.equal(t.height, Math.fround(2.9));
  assert.equal(t.damage, 7);
  assert.ok(HOSTILE.has("enderman"));
});

test("a player looking straight at it makes it aggressive after six ticks", () => {
  cells.clear();
  const w = make(), e = w.entities[0];
  // Java yaw 0 looks to +z; this build's view yaw is 180 - java yaw in radians, so the player stands at -z of the enderman.
  w.look = { yaw: Math.PI, pitch: 0 };
  const p = { x: 64.5, y: 1 + 1.45 - 1.62, z: 56.5 }; // the eye (feet + 1.62) at the enderman's middle
  for (let i = 0; i < 8; i++) w.tick(p, survival(18000));
  assert.equal(e.aggressive, true);
  assert.ok(w.ai.brain(e).attackTarget, "the sixth staring tick sets the target");
  assert.equal(e.screaming, true);
});

test("a looking-away player does not anger it", () => {
  cells.clear();
  const w = make(), e = w.entities[0];
  w.look = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 12; i++) w.tick({ x: 64.5, y: 0, z: 56.5 }, survival(18000));
  assert.equal(e.aggressive, false);
  assert.equal(w.ai.brain(e).attackTarget, null);
});

test("a projectile deals no damage and teleports it", () => {
  cells.clear();
  const w = make(), e = w.entities[0];
  w.look = { yaw: 0, pitch: 0 };
  w.tick({ x: 20, y: 0, z: 20 }, survival(18000));
  const at = { x: e.x, y: e.y, z: e.z };
  w.damage(e, 5, 60, 60, true, null, { projectile: true });
  assert.equal(e.health, 40);
  assert.ok(e.x !== at.x || e.z !== at.z || e.y !== at.y, "it teleported");
});

test("a melee hit hurts and makes it hunt the player", () => {
  cells.clear();
  const w = make(), e = w.entities[0];
  w.look = { yaw: 0, pitch: 0 };
  w.tick({ x: 62, y: 0, z: 62 }, survival(18000));
  w.damage(e, 4, 62, 62, true);
  assert.equal(e.health, 36);
  assert.equal(e.aggressive, true);
  assert.ok(w.ai.brain(e).attackTarget);
});

test("drops 0 to 1 ender pearl (looting adds) and gives 5 experience", () => {
  const counts = new Set();
  for (let s = 0; s < 200; s++) counts.add(mobDrops({ type: "enderman" }, { playerHit: true }, new JavaRandom(s * 7919)).length);
  assert.deepEqual([...counts].sort(), [0, 1]);
  for (let s = 0; s < 200; s++) assert.ok(mobDrops({ type: "enderman" }, { playerHit: true, looting: 3 }, new JavaRandom(s * 7919)).length <= 4);
  assert.equal(mobDrops({ type: "enderman", carried: 2 }, { playerHit: true }, new JavaRandom(1)).every(([id]) => id === 378), true);
  assert.equal(experiencePoints({ type: "enderman" }, new JavaRandom(1), new JavaRandom(1)), 5);
});

test("its carried block survives a save and a restore", () => {
  cells.clear();
  const w = make({ carried: 3, carriedData: 1 });
  assert.equal(w.entities[0].carried, 3);
  assert.equal(w.entities[0].carriedData, 1);
  const bad = make({ carried: 999, carriedData: 99 });
  assert.equal(bad.entities[0].carried, 0);
});
