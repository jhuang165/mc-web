import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, ENTITY_TYPES, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { insideOpaqueBlock, mobEyeHeight, PLAYER_EYE } from "./suffocation.js";
import { normalCube, SAND, PHYSICS } from "./world.js";
import { JavaRandom } from "./lighting.js";

const f = Math.fround;
const load = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url)));
const reference = load("suffocation-reference.json"), shadow = load("shadow-reference.json").blocks;
const records = (c) => reference.records.filter((r) => r.case === c);
// Internal block id of an original id (this build renumbers: glass 20 is 9, stone 1 is 3). Original ids
// this build lacks (slabs, stairs, fences, soul sand) map to undefined and are skipped.
const internal = { 0: 0, ...Object.fromEntries(Object.entries(shadow).map(([id, b]) => [b.mc, +id])) };
const STONE = internal[1];
const key = (x, y, z) => `${x},${y},${z}`;
const cellsWorld = (cells) => ({
  get: (x, y, z) => cells.get(key(x, y, z)) ?? (y < 0 ? STONE : 0),
  solid: (x, y, z) => normalCube(cells.get(key(x, y, z)) ?? (y < 0 ? STONE : 0)),
  numericSeed: 1,
  surface: () => 0,
  spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
});

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(Object.fromEntries(["cube", "inside", "sequence"].map((c) => [c, records(c).length])), { cube: 38, inside: 102, sequence: 78 });
});

test("normalCube agrees with Block.isNormalCube for every recorded block this build has", () => {
  let checked = 0;
  for (const c of records("cube")) {
    if (internal[c.id] === undefined) continue;
    assert.equal(normalCube(internal[c.id]), c.normal, `original ${c.id}`);
    checked++;
  }
  assert.ok(checked >= 24, `${checked}`);
  // Partial blocks (slabs, stairs, fences) are not normal cubes in the original either; this build has none.
  for (const id of [44, 53, 67, 85, 108, 109, 126, 134, 156, 164]) assert.equal(records("cube").find((c) => c.id === id).normal, false);
});

test("entity sizes of the build match the original constructors", () => {
  for (const r of records("inside")) {
    if (r.type === "player") {
      assert.deepEqual([f(r.width), f(r.height)], [f(PHYSICS.width), f(PHYSICS.height)]);
      continue;
    }
    const base = ENTITY_TYPES[r.type.replace("Child", "")], scale = r.type.endsWith("Child") ? 0.5 : 1;
    assert.deepEqual([f(r.width), f(r.height)], [f(base.width * scale), f(base.height * scale)], r.type);
  }
});

test("isEntityInsideOpaqueBlock matches the original at every sampled position and block", () => {
  let checked = 0, inside = 0;
  for (const r of records("inside")) {
    const id = internal[r.block];
    if (id === undefined) continue;
    const eye = r.type === "player" ? PLAYER_EYE : mobEyeHeight(f(r.height)), world = cellsWorld(new Map([[key(64, 5, 64), id]]));
    for (const [x, y, z, expected] of r.rows) {
      assert.equal(insideOpaqueBlock(world, x, y, z, f(r.width), eye), expected, `${r.type} block ${r.block} at ${x},${y},${z}`);
      checked++;
      inside += expected;
    }
  }
  assert.ok(checked > 8000 && inside > 1000, `${checked} ${inside}`);
});

// The scripted ticks: ops run before the tick (block changes, hits), then the entity's update.
const ops = (r) => r.ops.map(([t, op]) => [t, ...op.split(":")]);
const startOf = (r) => [...r.pos];

test("a mob in a wall takes 1 every 10 ticks as the original does, with its hurt resistance, top-ups and sounds", () => {
  let hits = 0, topUps = 0, deaths = 0;
  for (const r of records("sequence").filter((s) => s.type !== "player")) {
    const cells = new Map(), world = cellsWorld(cells), w = new EntityWorld(world, []), [x, y, z] = startOf(r), at = r.name;
    w.fx = { spawn() {} };
    const e = w.create(r.type, x, y, z);
    if (r.setup.health !== undefined) e.health = f(r.setup.health);
    w.entities.push(e);
    setEntityRandom(e, new JavaRandom(7));
    const t = ENTITY_TYPES[r.type], script = ops(r);
    let skipped = false;
    for (let i = 0; i < r.ticks.length; i++) {
      for (const [tick, op, a, b, c, d] of script) {
        if (tick !== i) continue;
        if (op === "set") {
          if (internal[+d] === undefined) skipped = true;
          else cells.set(key(+a, +b, +c), internal[+d]);
        } else if (a !== undefined && b === "fall") w.hazard(e, f(+a), "fall");
        else w.damage(e, f(+a), x + 2, z, false, "zombie");
      }
      if (skipped) break;
      w.drain();
      const s = r.ticks[i], before = e.health, step = `${at} tick ${i}`;
      assert.equal(e.health > 0 && insideOpaqueBlock(world, e.x, e.y, e.z, t.width, mobEyeHeight(t.height)), s.inside, step);
      // EntityLivingBase.onEntityUpdate: the fire, inWall, the air, the counters, then EntityLiving's living sound.
      w.suffocate(e, t);
      e.hurt = Math.max(0, e.hurt - 1);
      w.talk(e);
      const events = w.drain(), sounds = events.filter((q) => q.sound).map((q) => [q.sound, q.volume, q.pitch]);
      assert.equal(e.health, f(s.health), step);
      assert.equal(e.hurt, s.hurtTime, step);
      assert.equal(e.hurt > 0 ? e.hurt + 10 : s.resist <= 10, e.hurt > 0 ? s.resist : true, step);
      assert.equal(e.lastDamage, f(s.last), step);
      assert.deepEqual(sounds, s.sounds.filter((q) => !q.startsWith("status|")).map((q) => q.split("|")).map(([n, v, p]) => [n, f(+v), f(+p)]), step);
      hits += e.health < before;
      if (e.health <= 0) {
        assert.equal(i, r.deadAt, at);
        deaths++;
        break;
      }
    }
    if (!skipped && r.deadAt < 0) assert.equal(e.health > 0, true, at);
    topUps += r.name.startsWith("first-") && r.name.includes("-0.5-");
  }
  assert.ok(hits > 100 && topUps >= 2 && deaths >= 4, `${hits} ${topUps} ${deaths}`);
});

test("the player in a wall takes 1 every 10 ticks, bypassing armour, refused in Creative and while spawn protected", () => {
  let hits = 0, deaths = 0;
  for (const r of records("sequence").filter((s) => s.type === "player")) {
    const cells = new Map(), world = cellsWorld(cells), [x, y, z] = startOf(r), at = r.name;
    const p = new Survival({}, r.setup.creative ? "creative" : "survival");
    // FoodStats.onUpdate does not run in the probe: keep the food below natural regeneration.
    p.food = 10;
    p.saturation = 0;
    if (r.setup.health !== undefined) p.health = f(r.setup.health);
    p.protection = r.setup.protection ?? 0;
    if (r.setup.armor) {
      for (let i = 0; i < 4; i++) p.inventory.setStack(36 + i, makeStack(408 + i, 1, 0));
      assert.ok(p.armorValue >= 15, at);
    }
    const script = ops(r);
    let skipped = false;
    for (let i = 0; i < r.ticks.length; i++) {
      for (const [tick, op, a, b, c, d] of script) {
        if (tick !== i) continue;
        if (op === "set") {
          if (internal[+d] === undefined) skipped = true;
          else cells.set(key(+a, +b, +c), internal[+d]);
        } else p.damage(f(+a), b === "fall" ? "fall" : "a zombie", b === "mob");
      }
      if (skipped) break;
      const s = r.ticks[i], before = p.health, fresh = p.hurtCount, step = `${at} tick ${i}`;
      const inWall = insideOpaqueBlock(world, x, y, z, PHYSICS.width, PLAYER_EYE);
      assert.equal(p.health > 0 && inWall, s.inside, step);
      p.tick({ inWall });
      assert.equal(p.health, f(s.health), step);
      assert.equal(p.hurtTicks > 0 ? p.hurtTicks + 10 : s.resist <= 10, p.hurtTicks > 0 ? s.resist : true, step);
      assert.equal(p.hurtAmount, f(s.last), step);
      // The hurt flash (entity status 2) comes with every hit that opens a window, never a top-up.
      assert.equal(p.hurtCount > fresh, s.sounds.includes("status|2"), step);
      hits += p.health < before;
      if (p.health <= 0) {
        assert.equal(i, r.deadAt, at);
        assert.equal(p.lastDamage, "suffocation");
        deaths++;
        break;
      }
    }
    if (!skipped && r.deadAt < 0) assert.ok(p.health > 0, at);
  }
  assert.ok(hits > 80 && deaths >= 2, `${hits} ${deaths}`);
});

test("spawn protection counts down each tick and does not refuse hits afterwards", () => {
  const p = new Survival({}, "survival");
  p.protection = 2;
  assert.equal(p.damage(3, "fall"), false);
  p.tick();
  assert.equal(p.damage(3, "fall"), false);
  p.tick();
  assert.equal(p.damage(3, "fall"), true);
  assert.equal(p.health, 17);
});

test("falling sand needs no special case: the block in the head cell is what counts", () => {
  const cells = new Map([[key(64, 6, 64), SAND]]);
  assert.equal(insideOpaqueBlock(cellsWorld(cells), 64.5, 5, 64.5, 0.6, PLAYER_EYE), true);
});
