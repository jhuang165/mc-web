// Batch 50 (mobresist): the mob side of EntityLivingBase.damageEntity: armour (no durability loss for a mob), Resistance, the worn gear's enchantments and the
// absorption amount, and a player attacker (causePlayerDamage) against both a zombie and a player. Replays public/research/mob-resist-reference.json
// (tools/probes/MobResistProbe.java run by tools/verify-mob-resist.mjs, records tagged b50mr): the unchanged EntityZombie / EntityPlayerMP.attackEntityFrom.
// Bytecode-read: sv.d (armour, potion step, absorption via bs/m), sv.c (Resistance except outOfWorld), sv.h (damageArmor, empty), rr (Absorption potion: +/- 4 * (amplifier + 1)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, entityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { enchantmentRandom } from "./armor-enchantments.js";
import { addMobEffect, tickMobEffects, readMobEffects, RESISTANCE, ABSORPTION } from "./mob-effects.js";
const f = Math.fround;
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-resist-reference.json", import.meta.url)));
const zombies = reference.records.filter((r) => r.victim === "zombie"), players = reference.records.filter((r) => r.victim === "player");

const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const BASE = [[298, 299, 300, 301], [306, 307, 308, 309], [310, 311, 312, 313]]; // helmet, chestplate, leggings, boots of leather, iron, diamond
const stack = (id, damage = 0, enchantments) => ({ id, count: 1, damage, ...(enchantments ? { enchantments: enchantments.map(([id, lvl]) => ({ id, lvl })) } : {}) });
// The probe's source name -> the call a mob hit makes.
const PLAYER_HIT = { name: "player", player: true, from: { x: 10.5, z: 8.5 } };
function zombieWorld(r) {
  const world = new EntityWorld(flat, [{ id: "z", type: "zombie", x: 8, y: 0, z: 8, health: 20 }], () => 0.5);
  const [z] = world.entities;
  world.currentDate = () => new Date(2014, 5, 1);
  if (r.material >= 0) z.equipment = [null, ...[3, 2, 1, 0].map((i) => stack(BASE[r.material][i], 0, r.ench >= 0 ? [[r.ench, r.level]] : undefined))]; // held, boots first
  if (r.resistance >= 0) addMobEffect(z, RESISTANCE, 1000, r.resistance);
  if (r.absorption > 0) z.absorption = f(r.absorption);
  enchantmentRandom.setSeed(BigInt(r.seed));
  entityRandom(z).setSeed(7n); // the probe's mob Entity.rand: the anvil's helmet wear draws from it
  return { world, z };
}
const wornZombie = (z) => (z.equipment ? [1, 2, 3, 4].map((i) => z.equipment[i]?.damage ?? null) : [null, null, null, null]);

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.tag, "b50mr");
  assert.ok(zombies.length >= 700 && players.length >= 60, `${zombies.length} ${players.length}`);
  assert.ok(zombies.some((r) => r.source === "player") && players.some((r) => r.source === "player"));
});

test("every zombie record: health, worn-gear damage and absorption match the unchanged attackEntityFrom", () => {
  const failures = [];
  for (const r of zombies) {
    const { world, z } = zombieWorld(r);
    const key = r.source === "outOfWorld" ? "outOfWorld" : r.source;
    const accepted = world.attackEntityFrom(z, f(r.amount), r.source === "player" ? PLAYER_HIT : { name: key, from: { x: 10.5, z: 8.5 }, player: false });
    const got = { accepted, health: z.health, absorbed: f(z.absorption || 0), armor: wornZombie(z) };
    const want = { accepted: r.accepted, health: f(r.health), absorbed: f(r.absorbed), armor: r.armor };
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${r.case}/${r.source}/${r.amount}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
  assert.equal(failures.length, 0, failures.length + " of " + zombies.length + "\n" + failures.slice(0, 30).join("\n"));
});

test("every player record with a player or mob attacker (PvP on) matches", () => {
  const failures = [];
  for (const r of players) {
    const s = new Survival({}, "survival");
    s.protection = 0; s.difficulty = 2;
    if (r.material >= 0) for (let i = 0; i < 4; i++) s.inventory.armor[i] = makeStack(400 + [0, 2, 4][r.material] * 4 + (3 - i), 1, 0, undefined, r.ench >= 0 ? { enchantments: [{ id: r.ench, lvl: r.level }] } : {});
    if (r.resistance >= 0) s.effects.add({ id: 11, duration: 1000, amplifier: r.resistance });
    s.absorption = f(r.absorption);
    s.inventory.random = new JavaRandom(7n);
    enchantmentRandom.setSeed(BigInt(r.seed));
    const accepted = !!(r.source === "player" ? s.scaledDamage(f(r.amount), "a player") : s.scaledDamage(f(r.amount), "a zombie"));
    const got = { accepted, health: s.health, absorbed: s.absorption, armor: [0, 1, 2, 3].map((i) => s.inventory.armor[i]?.damage ?? null) };
    const want = { accepted: r.accepted, health: f(r.health), absorbed: f(r.absorbed), armor: r.armor };
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${r.case}/${r.source}/${r.amount}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
  assert.equal(failures.length, 0, failures.length + " of " + players.length + "\n" + failures.slice(0, 30).join("\n"));
});

test("Absorption on a mob: +4 per level on add, a re-add refills the shield, expiry takes it off and floors at 0", () => {
  const z = { type: "zombie", health: 20, effects: [] };
  addMobEffect(z, ABSORPTION, 3, 0);
  assert.equal(z.absorption, 4);
  z.absorption = 1; // spent down to 1
  addMobEffect(z, ABSORPTION, 3, 0); // onChangedPotionEffect: remove (floored at 0), apply again
  assert.equal(z.absorption, 4);
  addMobEffect(z, ABSORPTION, 3, 2);
  assert.equal(z.absorption, 12, "removed 12, applied 12 of the combined effect");
  z.effects = readMobEffects(JSON.parse(JSON.stringify(z.effects)));
  assert.deepEqual(z.effects.map((e) => [e.id, e.amplifier]), [[22, 2]]);
  const rand = new JavaRandom(1n), size = { width: 0.6, height: 1.8 };
  z.effects[0].duration = 1; z.absorption = 5;
  tickMobEffects(z, size, 20, rand, null);
  assert.equal(z.effects.length, 0);
  assert.equal(z.absorption, 0, "5 - 12 floors at 0");
});

test("Resistance applies to every source but the void, and not to an absolute one; armour never wears on a mob", () => {
  const hit = (name, amplifier) => { const { world, z } = zombieWorld({ material: 1, ench: -1, level: 0, resistance: amplifier, absorption: 0, seed: "1" }); world.damageEntity(z, 10, name); return [z.health, wornZombie(z)]; };
  assert.equal(hit("generic", 4)[0], 20, "Resistance V takes everything");
  assert.equal(hit("outOfWorld", 4)[0], 10, "outOfWorld ignores it");
  assert.equal(hit("starve", 4)[0], 10, "starvation is absolute");
  assert.deepEqual(hit("mob", 0)[1], [0, 0, 0, 0]);
});
