// Replays public/research/giant-reference.json (tools/probes/GiantProbe.java through tools/verify-giant.mjs) and checks the live Giant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GIANT, GIANT_SOUNDS, giantPathWeight, giantAttackReady } from "./giant.js";
import { EntityWorld, ENTITY_TYPES, HOSTILE, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { Survival } from "./survival.js";
import { SUMMONABLE } from "./commands.js";
import { JAVA_MOBS, javaMobFromNbt, importedMobType } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { SHADOWS } from "./shadows.js";
import { isEntityMob } from "./mob-steps.js";

const ref = JSON.parse(await readFile(new URL("../public/research/giant-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;

test("facts of the unchanged EntityGiantZombie", () => {
  const [r] = by("facts");
  assert.equal(GIANT.width, f(r.width));
  assert.equal(GIANT.height, f(r.height));
  assert.equal(GIANT.yOffset, r.yOffset);
  assert.equal(GIANT.health, r.health);
  assert.equal(GIANT.movement, r.speed);
  assert.equal(GIANT.attackDamage, r.damage);
  assert.equal(GIANT.followRange, r.followRange);
  assert.equal(GIANT.experience, r.experience);
  assert.equal(GIANT_SOUNDS.say, r.say);
  assert.equal(GIANT_SOUNDS.hurt, r.hit);
  assert.equal(GIANT_SOUNDS.death, r.kill);
  assert.equal(r.aiEnabled, false);
  assert.equal(r.zombie, false);
  assert.equal(r.creature, true);
  assert.equal(r.dropItem, 0);
  assert.deepEqual(ENTITY_TYPES.giant, { health: 100, width: f(r.width), height: f(r.height), movement: 0.5, ai: {}, damage: 50, drop: 0 });
});
test("getBlockPathWeight is brightness - 0.5", () => {
  for (const r of by("pathWeight")) {
    const brightness = [0.05, 0.0572, 0.0893, 0.1333, 0.1904, 0.2679, 0.3699, 0.5000]; // unused: the rule is checked on the probe's own outputs
    void brightness;
    assert.equal(giantPathWeight(f(r.weight + 0.5)), f(r.weight));
  }
  assert.equal(giantPathWeight(1), 0.5);
});
test("EntityMob.attackEntity grid", () => {
  for (const r of by("attack")) {
    const ready = giantAttackReady({ y: 0, attackTime: r.attackTime }, r.targetMinY, r.targetMaxY, f(r.distance));
    assert.equal(ready, r.hit, JSON.stringify(r));
  }
});
test("registered in the mob tables, summon, region import, shadow and sound classes", () => {
  assert.equal(SUMMONABLE.Giant, "giant");
  assert.equal(JAVA_MOBS.Giant, "giant");
  assert.equal(importedMobType("Giant"), "giant");
  assert.ok(HOSTILE.has("giant"));
  assert.ok(isEntityMob("giant"));
  assert.equal(SHADOWS.giant.size, 3);
  const tag = new Map([["id", { type: NBT.STRING, value: "Giant" }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1, 70, 2] } }]]);
  const rec = javaMobFromNbt(tag);
  assert.equal(rec.type, "giant");
  assert.equal(rec.health, 100);
});

function flatWorld() {
  const key = (x, y, z) => `${x},${y},${z}`, cells = new Map();
  return {
    numericSeed: 1, cells,
    get: (x, y, z) => cells.get(key(x, y, z)) ?? (y < 0 ? 1 : 0), getMeta: () => 0,
    set(x, y, z, b) { cells.set(key(x, y, z), b); return true; },
    solid: (x, y, z) => y < 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
}
test("a live giant has the 6x box, saves and reloads, and drops nothing", () => {
  const w = new EntityWorld(flatWorld(), []), e = w.create("giant", 64.5, 0, 64.5);
  w.entities.push(e);
  assert.equal(e.health, 100);
  const loaded = new EntityWorld(flatWorld(), JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(loaded.entities[0].type, "giant");
  assert.equal(w.attackEntityFrom(e, 30, { player: true, from: { x: 60, z: 64 }, name: "player" }), true);
  assert.equal(e.health, 70);
  assert.ok(w.drain().some((ev) => ev.sound === "game.hostile.hurt"));
});
test("a giant hunts the player down: it walks from 8 blocks to the collision gap, and inside 2.0 the hit is the 50-damage EntityMob strike", () => {
  // Entity.rand is seeded: EntityCreature's nextInt(100) path drop zeroes moveForward and, once every waypoint is within
  // width x 2 (7.2) of the giant, nothing sets it again, so some seeds stall short of the player.
  const w = new EntityWorld(flatWorld(), [], () => 0.5), s = new Survival({ slots: [], time: 6000 }, "survival"), p = { x: 64.5, y: 0, z: 64.5, alive: true };
  const e = w.create("giant", 72.5, 0, 64.5);
  setEntityRandom(e, new JavaRandom(1));
  w.entities.push(e);
  for (let i = 0; i < 150; i++) w.tick(p, s);
  // The 0.2-expanded collision push holds a stationary player's centre about 2.3 away, outside the 2.0 reach.
  assert.ok(Math.hypot(e.x - p.x, e.z - p.z) < 2.5, `giant at ${e.x}`);
  assert.equal(s.health, 20);
  const near = w.create("giant", 66.4, 0, 64.5);
  setEntityRandom(near, new JavaRandom(1));
  w.entities = [near];
  w.tick(p, s); // findPlayerToAttack
  w.tick(p, s); // attackEntity at 1.9
  assert.equal(s.health, 0);
  assert.equal(giantAttackReady({ y: 0, attackTime: 0 }, 0, 1.8, 1.9), true);
  assert.equal(ENTITY_TYPES.giant.damage, 50);
});
