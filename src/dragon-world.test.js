// The Ender Dragon inside EntityWorld: registration, ticking, part picking, damage routing, crystal healing, death and portal, save/restore.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, entityHit } from "./entities.js";
import { Survival } from "./survival.js";
import { SUMMONABLE } from "./commands.js";
import { JavaRandom } from "./lighting.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";
import { dragonBossStatus } from "./dragon.js";

const cells = new Map();
const key = (x, y, z) => x + "," + y + "," + z;
const world = {
  numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }),
  get: (x, y, z) => cells.get(key(x, y, z)) ?? 0,
  getMeta: () => 0,
  set(x, y, z, id) { cells.set(key(x, y, z), id); return true; },
  inside: () => true, streaming: true, isTicking: () => true, height: 256,
};
const make = () => { cells.clear(); return new EntityWorld(world, [], () => 0.5); };
const player = (x = 40, y = 70, z = 40) => ({ x, y, z, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 });
const surv = () => new Survival({});

test("registration and spawn helper", () => {
  assert.equal(SUMMONABLE.EnderDragon, "ender_dragon");
  assert.equal(ENTITY_TYPES.ender_dragon.health, 200);
  const w = make();
  const d = spawnDragonIfAbsent(world, w, () => 0.25);
  assert.ok(d && d.x === 0 && d.y === 128 && d.rotationYaw === 90);
  assert.equal(spawnDragonIfAbsent(world, w), null);
});

test("flight: the dragon moves, its yaw follows, parts are placed", () => {
  const w = make(), d = spawnDragonIfAbsent(world, w), s = surv(), p = player();
  setDragonRandom(d, new JavaRandom(12345));
  for (let i = 0; i < 100; i++) w.tick(p, s);
  assert.ok(Math.hypot(d.x, d.z) > 0.5 || d.y !== 128);
  assert.equal(d.dragon.parts.length, 7);
  assert.ok(d.health === 200);
});

test("part pick, damage routing and hurt window", () => {
  const w = make(), d = spawnDragonIfAbsent(world, w), s = surv(), p = player(200, 70, 200);
  setDragonRandom(d, new JavaRandom(7));
  w.tick(p, s);
  const head = d.dragon.parts[0];
  const hx = (head.box[0] + head.box[3]) / 2, hy = (head.box[1] + head.box[4]) / 2, hz = (head.box[2] + head.box[5]) / 2;
  const origin = { x: hx, y: hy + 10, z: hz }, dir = { x: 0, y: -1, z: 0 };
  assert.ok(entityHit(origin, dir, d, 20) > 0);
  assert.equal(d.dragon.lastPart, 0);
  const before = d.health;
  assert.equal(w.attackEntityFrom(d, 8, { player: true, name: "player" }), true);
  assert.equal(d.health, before - 8);
  assert.equal(w.attackEntityFrom(d, 8, { player: true, name: "player" }), true); // inside the hurt window
  assert.equal(d.health, before - 8);
  assert.equal(w.attackEntityFrom(d, 3, { name: "fall" }), false);
  assert.ok(dragonBossStatus(d).fraction < 1);
});

test("death: 200 ticks, 12000 experience, exit portal, removal", () => {
  const w = make(), d = spawnDragonIfAbsent(world, w), s = surv(), p = player(200, 70, 200);
  setDragonRandom(d, new JavaRandom(3));
  w.tick(p, s);
  d.health = 0;
  let xp = 0, sounds = [];
  for (let i = 0; i < 205; i++) {
    w.tick(p, s);
    for (const ev of w.drain()) { if (ev.xp) xp += ev.xp; if (ev.sound === "mob.enderdragon.end") sounds.push(ev); }
  }
  assert.equal(xp, 12000);
  assert.equal(sounds.length, 1);
  assert.ok(!w.entities.includes(d));
  assert.ok([...cells.values()].includes(149), "end portal blocks placed");
});

test("save and restore keep the dragon", () => {
  const w = make(), d = spawnDragonIfAbsent(world, w), s = surv(), p = player(200, 70, 200);
  for (let i = 0; i < 20; i++) w.tick(p, s);
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  assert.equal(saved.length, 1);
  const r = w.restore(saved[0]);
  assert.equal(r.type, "ender_dragon");
  assert.ok(Math.abs(r.x - d.x) < 1e-9);
  const w2 = new EntityWorld(world, saved, () => 0.5);
  for (let i = 0; i < 5; i++) w2.tick(p, s);
  assert.equal(w2.entities.length, 1);
});
