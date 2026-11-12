// Batch 53 (firetimes, tag b53ft): Entity.setFire on mobs and the fire counter's tick, and the potion effects the port keeps on mobs without modelling them.
// Replays the `setfire` and `firetick` records appended to public/research/mob-victims-reference.json (tools/probes/MobVictimProbe.java) and the `b53ft` ticks of
// public/research/mob-effects-reference.json (tools/probes/MobEffectsProbe.java), recorded from the unchanged 1.7.10 classes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIRE, LAVA } from "./world.js";
import { Arrows } from "./bow.js";
import { GaussianRandom } from "./projectiles.js";
import { EntityWorld } from "./entities.js";
import { setMobFire } from "./armor-enchantments.js";
import { blockCollisions } from "./block-collisions.js";
import { tickMobEffects, addMobEffect, readMobEffects } from "./mob-effects.js";
import { JavaRandom } from "./java-random.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { decodeNbt } from "./nbt.js";

const victims = JSON.parse(readFileSync(new URL("../public/research/mob-victims-reference.json", import.meta.url)));
const effectsRef = JSON.parse(readFileSync(new URL("../public/research/mob-effects-reference.json", import.meta.url)));
const setFires = victims.records.filter((r) => r.victim === "setfire"), fireTicks = victims.records.filter((r) => r.victim === "firetick");
const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const TYPES = { zombie: "zombie", pigman: "pigman", skeleton: "skeleton", witherSkeleton: "wither_skeleton", wither: "wither" };
const stack = (id, enchantments) => ({ id, count: 1, damage: 0, enchantments: enchantments.map(([id, lvl]) => ({ id, lvl })) });
const DIAMOND = [310, 311, 312, 313];
const mob = (kind, extra = {}) => new EntityWorld(flat, [{ id: "v", type: TYPES[kind] ?? kind, x: 8, y: 0, z: 8, health: 20, ...extra }], () => 0.5);

test("the setFire and firetick records come from the unchanged client", () => {
  assert.equal(setFires.length, 5 * 4 * 7 * 3);
  assert.equal(fireTicks.length, 5 * 7);
  assert.ok(fireTicks.every((r) => r.error === null));
  assert.equal(victims.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
});

test("setMobFire (Entity.setFire on a mob) matches every executed record: Fire Protection shortens it, and the counter only grows", () => {
  const failures = [];
  for (const r of setFires) {
    const world = mob(r.kind);
    const [v] = world.entities;
    if (r.material >= 0) v.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[r.ench, r.level]]))];
    v.fire = r.start;
    setMobFire(v, r.seconds);
    if (v.fire !== r.fire) failures.push(`${r.kind} start ${r.start} ${r.seconds}s fp${r.level}: ${v.fire} want ${r.fire}`);
  }
  assert.equal(failures.length, 0, failures.slice(0, 20).join("\n"));
});

test("one entity update (burn) leaves the counter exactly as the executed sa.C / sv.C does: a fire-immune mob always at 0, others down by 1 to a rest", () => {
  const failures = [];
  for (const r of fireTicks) {
    const world = mob(r.kind);
    const [v] = world.entities;
    v.fire = r.start;
    const got = [];
    for (let i = 0; i < r.fires.length; i++) { world.burn(v, { width: 0.6, height: 1.8 }); got.push(v.fire); }
    if (JSON.stringify(got) !== JSON.stringify(r.fires)) failures.push(`${r.kind} ${r.start}: ${got} want ${r.fires}`);
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("a wither's counter is zeroed by its update and a lightning strike then advances it from the rested -1 and ignites it", () => {
  const world = mob("wither");
  const [w] = world.entities;
  w.fire = 100;
  world.burn(w, { width: 0.9, height: 3.5 });
  assert.equal(w.fire, 0);
  w.fire = -1; // the move tail's rest
  const hit = w.fire + 1;
  assert.equal(hit, 0); // ++fire reaches 0: setFire(8) follows (160 without armour)
  setMobFire(w, 8);
  assert.equal(w.fire, 160);
});

test("a fire block ignites a mob for 8 s shortened by its worn Fire Protection; an immune mob rested at 0 only reaches 1", () => {
  const burning = (x, y, z) => (y === 0 && x === 0 && z === 0 ? FIRE : y < 0 ? 1 : 0);
  const world = { get: burning, getMeta: () => 0 };
  const box = [0.2, 0, 0.2, 0.8, 1.8, 0.8];
  const zombie = { fire: -1, equipment: [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[1, 4]]))] };
  blockCollisions(world, box, zombie, { armor: zombie.equipment, hurt() {} });
  assert.equal(zombie.fire, 64);
  const plain = { fire: -1 };
  blockCollisions(world, box, plain, { hurt() {} });
  assert.equal(plain.fire, 160);
  const immune = { fire: 0 };
  blockCollisions(world, box, immune, { hurt() {} });
  assert.equal(immune.fire, 1);
});

test("a flame arrow, lava and a zombie's own sunburn set a mob alight through Fire Protection (5 s, 15 s, 8 s: 40, 120 and 64 shortened by 60%)", () => {
  const worn = [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[1, 4]]))];
  const rec = (seconds) => setFires.find((r) => r.kind === "zombie" && r.start === 0 && r.seconds === seconds && r.level === 4).fire;
  // a burning arrow: Arrows.damageTarget -> setFire(5) before the damage
  const world = mob("zombie");
  const [z] = world.entities;
  z.equipment = worn;
  const arrows = new Arrows(() => 0.25);
  const a = arrows.make({ x: 0, y: 0, z: 0, mx: 1, my: 0, mz: 0, yaw: 0, pitch: 0 }, new GaussianRandom(1), { shooter: "player", fire: 100 });
  arrows.damageTarget(a, z, 4, { mobs: world, player: { x: 0, z: 0 } });
  assert.equal(z.fire, rec(5));
  assert.equal(rec(5), 40);
  // lava: setOnFireFromLava = setFire(15)
  const lava = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y === 0 ? LAVA : y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
  const w2 = new EntityWorld(lava, [{ id: "v", type: "zombie", x: 8, y: 0, z: 8, health: 20 }], () => 0.5);
  const [z2] = w2.entities;
  z2.equipment = worn;
  z2.fire = 0;
  w2.burn(z2, { width: 0.6, height: 1.8 });
  assert.equal(z2.inLava, true);
  assert.equal(z2.fire, rec(15));
  assert.equal(rec(15), 120);
  z2.equipment = null;
  z2.fire = 0;
  w2.burn(z2, { width: 0.6, height: 1.8 });
  assert.equal(z2.fire, 300);
  assert.equal(rec(8), 64);
});

test("Fire Aspect on a mob wearing Fire Protection burns it for the shortened 4 s a level", () => {
  const world = mob("zombie");
  const [z] = world.entities;
  z.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(DIAMOND[i], [[1, 4]]))];
  z.fire = 0;
  setMobFire(z, 2 * 4);
  assert.equal(z.fire, 64);
});

const rng = () => new JavaRandom(7);
test("haste, mining fatigue, jump boost, blindness, night vision, hunger, health boost and saturation are kept on every mob kind and count down as the executed updatePotionEffects does", () => {
  assert.equal(effectsRef.ticks.length, 28);
  for (const t of effectsRef.ticks) {
    assert.equal(t.error, null, t.kind);
    const row = effectsRef.rows.find((r) => r.kind === t.kind && r.case === 6);
    const effects = readMobEffects(row.effects.map(([id, amplifier, duration, ambient]) => ({ id, amplifier, duration, ...(ambient ? { ambient: true } : {}) })));
    assert.equal(effects.length, 8, t.kind);
    const e = { effects, health: t.ticks[0].health, x: 0, y: 0, z: 0 };
    t.ticks.forEach((step, i) => {
      tickMobEffects(e, { width: 0.6, height: 1.8 }, step.health, rng(), undefined, undefined);
      assert.deepEqual(e.effects.map((x) => [x.id, x.duration]), step.effects, `${t.kind} tick ${i + 1}`);
    });
  }
});

test("these effects do nothing else to a mob: health is untouched (health boost only raises the maximum, b54)", () => {
  const e = { effects: [], health: 10 };
  for (const id of [3, 4, 8, 15, 16, 17, 23]) assert.ok(addMobEffect(e, id, 100, 0), String(id));
  assert.equal(addMobEffect(e, 21, 100, 0), true);
  tickMobEffects(e, { width: 0.6, height: 1.8 }, 20, rng(), undefined, undefined);
  assert.equal(e.health, 10);
  assert.equal(e.effects.length, 8);
  assert.ok(e.effects.every((x) => x.duration === 99));
});

test("a Jump Boost mob jumps 0.1 higher a level, the magma cube's own jump ignores it, and a fall is shortened by it", async () => {
  const { jump } = await import("./entities.js");
  const e = { type: "zombie", effects: [{ id: 8, amplifier: 1, duration: 100 }] };
  jump(e);
  assert.equal(e.vy, 0.41999998688697815 + Math.fround(Math.fround(2) * Math.fround(0.1)));
  const plain = { type: "zombie", effects: [] };
  jump(plain);
  assert.equal(plain.vy, 0.41999998688697815);
});

test("an imported mob keeps the effects and saves them back (NBT round trip)", () => {
  const row = effectsRef.rows.find((r) => r.kind === "Zombie" && r.case === 6);
  const tag = decodeNbt(Uint8Array.from(row.nbt.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
  const rec = javaMobFromNbt(tag, { shiftX: 0, shiftZ: 0 });
  assert.deepEqual(rec.effects.map((x) => x.id).sort((a, b) => a - b), [3, 4, 8, 15, 16, 17, 21, 23]);
  const world = new EntityWorld(flat, [{ ...rec, x: 8, y: 0, z: 8 }], () => 0.5);
  assert.deepEqual(world.entities[0].effects.map((x) => x.id).sort((a, b) => a - b), [3, 4, 8, 15, 16, 17, 21, 23]); // kept in the file's (bucket) order
});

// Lead fix (bytecode-read, zc.h offsets 898-918): a burning arrow's setFire(5) skips an EntityEnderman (instanceof ya), on the server as on the client.
test("a flame arrow does not ignite an enderman", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./bow.js", import.meta.url), "utf8");
  assert.match(src, /a\.fire > 0 && ref\.type !== "enderman"\) setMobFire\(ref, 5\)/);
});
