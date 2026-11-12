import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { EntityWorld, ENTITY_TYPES, HOSTILE, setEntityRandom, entityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { Effects, POISON } from "./status-effects.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { SHADOWS } from "./shadows.js";
import { spiderAttack, isSpider, caveSpiderPoisonTicks } from "./spider.js";
import { setInWeb } from "./block-collisions.js";
import { JavaRandom } from "./java-random.js";
import { MobSpawners } from "./mob-spawner.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/mob-spawner-reference.json", import.meta.url)));
const cases = (name) => ref.records.filter((r) => r.case === name);
const flat = { numericSeed: 123, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }) };
class Counting extends JavaRandom {
  constructor(seed) { super(seed); this.calls = 0; }
  next(bits) { this.calls++; return super.next(bits); }
}

test("cave spider constructor facts agree with the unchanged EntityCaveSpider", () => {
  const r = cases("facts")[0], t = ENTITY_TYPES.cave_spider;
  assert.equal(t.width, r.width);
  assert.equal(t.height, r.height);
  assert.equal(t.health, r.health);
  assert.equal(t.movement, r.speed);
  assert.equal(t.damage, r.damage);
  assert.equal(ENTITY_TYPES.spider.width, r.spiderWidth);
  assert.equal(ENTITY_TYPES.spider.health, r.spiderHealth);
  assert.equal(r.poisonAllowed, false);
  assert.ok(HOSTILE.has("cave_spider") && isSpider("cave_spider") && isSpider("spider") && !isSpider("zombie"));
});

test("attackEntityAsMob poisons for 7 s on Normal and 15 s on Hard only", () => {
  for (const r of cases("poison")) {
    const w = new EntityWorld(flat, []), e = w.create(r.cave ? "cave_spider" : "spider", 64, 0, 64);
    w.difficulty = r.difficulty;
    const survival = { effects: new Effects(), scaledDamage: () => true };
    assert.equal(w.hitPlayer(e, survival), r.hit);
    const effect = survival.effects.get(POISON);
    assert.equal(effect?.duration ?? 0, r.duration, `difficulty ${r.difficulty} cave ${r.cave}`);
    if (r.duration) assert.equal(effect.amplifier, r.amplifier);
    if (r.cave) assert.equal(caveSpiderPoisonTicks(r.difficulty), r.duration);
  }
  // A refused hit (creative, invulnerable) applies nothing.
  const w = new EntityWorld(flat, []), survival = { effects: new Effects(), scaledDamage: () => false };
  w.difficulty = 3;
  assert.equal(w.hitPlayer(w.create("cave_spider", 64, 0, 64), survival), false);
  assert.equal(survival.effects.has(POISON), false);
});

test("onSpawnWithEgg returns its argument with no rolls; the spider's draws are unchanged", () => {
  for (const r of cases("egg")) {
    const w = new EntityWorld(flat, []), world = new Counting(5), e = w.create(r.cave ? "cave_spider" : "spider", 64, 0, 64), rand = new Counting(77);
    w.worldRandom = world;
    setEntityRandom(e, rand);
    assert.equal(w.onSpawnWithEgg(e), e);
    assert.equal(world.calls, r.worldCalls);
    assert.equal(rand.calls, r.entityCalls);
    if (r.cave) assert.equal(e.followRange, undefined);
  }
});

test("RenderCaveSpider: cave_spider.png, 0.7 model scale, 0.7 shadow", async () => {
  assert.deepEqual(ref.render.caveSpider, { texture: "textures/entity/spider/cave_spider.png", modelScale: 0.7, shadowScale: 0.7 });
  assert.equal(SHADOWS.cave_spider.size, f(SHADOWS.spider.size * f(0.7)));
  await access(new URL("../public/media/1.7.10/entity/spider/cave_spider.png", import.meta.url));
  const source = await readFile(new URL("./mob-renderer.js", import.meta.url), "utf8");
  assert.match(source, /cave \? "cave_spider" : "spider"\}\.png/);
});

test("cave spiders keep the spider's drops, experience, sounds and web immunity", () => {
  for (let seed = 0; seed < 20; seed++)
    for (const playerHit of [true, false])
      assert.deepEqual(mobDrops({ type: "cave_spider" }, { playerHit }, new JavaRandom(seed)), mobDrops({ type: "spider" }, { playerHit }, new JavaRandom(seed)));
  assert.equal(experiencePoints({ type: "cave_spider" }, new JavaRandom(1), new JavaRandom(2)), 5);
  const w = new EntityWorld(flat, []), e = w.create("cave_spider", 64, 0, 64);
  w.entities.push(e);
  w.damage(e, 1, 63, 64);
  assert.ok(w.drain().some((ev) => ev.sound === "mob.spider.say"));
  e.hurt = 0; w.kill(e, { player: true });
  assert.ok(w.drain().some((ev) => ev.sound === "mob.spider.death"));
  const state = { type: "cave_spider", inWeb: false };
  setInWeb(state);
  assert.equal(state.inWeb, false);
});

test("the melee test uses the cave spider's own 0.5 height", () => {
  const target = { x: 0, y: f(0.6), z: 1, height: 1.8 };
  const at = (type) => spiderAttack({ x: 0, y: 0, z: 0, attack: 0, onGround: true }, target, 1, 0, () => 0.5, ENTITY_TYPES[type].height);
  assert.equal(at("spider"), "hit");
  assert.equal(at("cave_spider"), "none");
});

test("saved cave spiders reload with their health and spider state", () => {
  const w = new EntityWorld(flat, []), hooks = w.spawnerHooks();
  const e = hooks.createMob("cave_spider", 64.25, 0, 63.5, 90);
  hooks.addMob(e);
  e.health = 7;
  e.climbing = true;
  e.spiderTarget = true;
  const loaded = new EntityWorld(flat, JSON.parse(JSON.stringify(w.serialize()))).entities;
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].type, "cave_spider");
  assert.equal(loaded[0].health, 7);
  assert.equal(loaded[0].climbing, false);
  assert.equal(loaded[0].spiderTarget, false);
  assert.ok(Math.abs(loaded[0].rotationYaw - 90) < 1e-4);
});

test("no natural cave spiders; a dark spawner fills to six and they poison the player", () => {
  const w = new EntityWorld(flat, [], () => 0.5), s = new Survival({ slots: [], time: 14000 }), p = { x: 64, y: 0, z: 64 };
  w.lightAt = () => 0;
  for (let i = 0; i < 400; i++) w.tick(p, s);
  assert.equal(w.entities.some((e) => e.type === "cave_spider"), false);
  // A spawner one block underground beside the player, World.rand as weather.random would be.
  const spawners = new MobSpawners(), random = new JavaRandom(42);
  spawners.add({ x: 66, y: 1, z: 64, entityId: "CaveSpider" });
  const world = { ...flat, solid: (x, y, z) => y < 0 || (x === 66 && y === 1 && z === 64), get: (x, y, z) => (y < 0 ? 1 : x === 66 && y === 1 && z === 64 ? 52 : 0) };
  const m = new EntityWorld(world, [], () => 0.5);
  m.worldRandom = random;
  const ctx = { ...m.spawnerHooks({ skyLight: () => 0, lightValue: () => 0 }), random, players: [p] };
  let spawned = 0;
  for (let i = 0; i < 4000 && m.entities.filter((e) => e.type === "cave_spider").length < 6; i++) spawned += spawners.tick(ctx).length;
  const caves = m.entities.filter((e) => e.type === "cave_spider");
  assert.ok(caves.length >= 1 && spawned === caves.length);
  for (const e of caves) assert.equal(e.followRange, undefined);
  // Within the spawner box only cave spiders count toward MaxNearbyEntities.
  assert.equal(ctx.countNearby("cave_spider", [58, -3, 56, 75, 6, 73]), caves.length);
  assert.equal(ctx.countNearby("spider", [58, -3, 56, 75, 6, 73]), caves.length);
  // In the dark, adjacent, a cave spider's hit poisons on Normal.
  const ew = new EntityWorld(flat, [], () => 0.5), e = ew.create("cave_spider", 64, 0, 66), sv = new Survival({ slots: [], food: 20, time: 14000 });
  ew.entities.push(e);
  ew.lightAt = () => 0;
  setEntityRandom(e, new JavaRandom(3));
  for (let i = 0; i < 80 && !sv.effects.has(POISON); i++) ew.tick(p, sv);
  assert.ok(sv.health < 20);
  assert.equal(sv.effects.get(POISON).duration > 100, true);
  assert.ok(entityRandom(e));
});
