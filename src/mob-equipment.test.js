import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { zombieSpawnRolls, skeletonSpawnRolls } from "./difficulty.js";
import { nextLong, CREATURE_ATTRIBUTES } from "./enchantments.js";
import { enchantedDamage } from "./armor-enchantments.js";
import {
  totalArmor, attackBonus, dropEquipment, equipmentExperience, pickUpItem, bowEffects, meleeEffects, emptyGear, saveGear, readGear,
  armorPoints, weaponModifier, HELD, HELMET,
} from "./mob-equipment.js";
import { toLiveStack, fromLiveStack } from "./mob-equipment-live.js";
import { EntityWorld } from "./entities.js";

// EquipmentProbe on the unchanged 1.7.10 classes; see tools/verify-mob-equipment.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-equipment-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const f = Math.fround;
const native = (s) => (s ? { id: s[0], count: 1, damage: s[1], ...(s[2].length ? { enchantments: s[2].map(([id, lvl]) => ({ id, lvl })) } : {}) } : null);
const record = (s) => (s ? [s.id, s.damage, (s.enchantments ?? []).map((e) => [e.id, e.lvl])] : null);
const records5 = (equipment) => equipment.map(record);
const gearOf = (r, chances = r.dropChances) => ({ equipment: r.equipment.map(native), dropChances: chances.map(f), canPickUpLoot: false });
const BASE_ATTACK = { zombie: 3, pigman: 5, witherSkeleton: 4 };

test("the spawn rolls give the original equipment, drop chances and random streams", () => {
  const all = records("spawn");
  assert.equal(all.length, 5760);
  const seen = { armored: 0, enchanted: 0, pumpkin: 0, lit: 0, wither: 0, bow: 0, sword: 0 };
  for (const r of all) {
    const at = JSON.stringify(r), date = { month: r.month, day: r.day }, local = f(r.local);
    const rand = new JavaRandom(r.seed), world = new JavaRandom(r.worldSeed);
    let stacks, chances, loot, wither = false, followRange;
    if (r.kind === "zombie" || r.kind === "pigman") {
      const out = zombieSpawnRolls(rand, world, r.difficulty, local, date, r.kind === "pigman");
      ({ stacks, dropChances: chances, loot, followRange } = out);
      assert.equal(world.nextInt(), r.worldNext, `world stream ${at}`);
    } else {
      const out = skeletonSpawnRolls(rand, r.difficulty, local, date, r.kind === "skeletonNether");
      ({ stacks, dropChances: chances, loot, wither, followRange } = out);
      assert.equal(new JavaRandom(r.worldSeed).nextInt(), r.worldNext, "the skeleton leaves World.rand alone");
    }
    assert.deepEqual(records5(stacks), r.equipment, at);
    assert.deepEqual(chances, r.dropChances.map(f), at);
    assert.equal(loot, r.loot, at);
    assert.equal(wither ? 1 : 0, Math.max(0, r.skeletonType), at);
    assert.equal(followRange === undefined || r.kind === "zombie" || r.kind === "pigman" ? r.followRange : followRange, r.followRange, at);
    assert.equal(rand.nextInt(), r.randNext, `entity stream ${at}`);
    // The attack attribute with the equipment's modifiers and the armour value.
    const base = r.kind === "zombie" || r.kind === "pigman" ? BASE_ATTACK[r.kind] : wither ? BASE_ATTACK.witherSkeleton : 2;
    assert.equal(base + attackBonus(stacks), r.attack, at);
    assert.equal(totalArmor(stacks) + (r.kind === "zombie" || r.kind === "pigman" ? 2 : 0), r.armor, at);
    if (stacks.slice(1).some(Boolean)) seen.armored++;
    if (stacks.some((s) => s?.enchantments?.length)) seen.enchanted++;
    if (stacks[HELMET]?.id === 86) seen.pumpkin++;
    if (stacks[HELMET]?.id === 91) seen.lit++;
    if (wither) seen.wither++;
    if (stacks[HELD]?.id === 261) seen.bow++;
    if (stacks[HELD]?.id === 267 || stacks[HELD]?.id === 256) seen.sword++;
  }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 5, `${k} ${n}`);
});

test("worn armour and enchantments reduce a hit exactly as damageEntity does", () => {
  const all = records("armor");
  assert.equal(all.length, 864);
  let reduced = 0;
  for (const r of all) {
    const stacks = r.equipment.map(native), at = JSON.stringify(r);
    const armor = Math.min(20, totalArmor(stacks) + (r.kind === "skeleton" ? 0 : 2));
    assert.equal(Math.min(20, totalArmor(stacks) + (r.kind === "skeleton" ? 0 : 2)), r.total, at);
    const helper = new JavaRandom(r.seed * 7 + 1);
    let amount = r.amount;
    if (r.source === "mob") amount = f(f(amount * (25 - armor)) / 25); // generic damage bypasses armour
    amount = enchantedDamage(stacks, r.source, amount, helper);
    assert.equal(f(20 - amount), f(r.health), at);
    assert.equal(helper.nextInt(), r.enchantNext, at);
    if (amount < r.amount) reduced++;
  }
  assert.ok(reduced > 400, String(reduced));
});

test("the held item's attribute modifier, Sharpness, Smite, Bane, Knockback and Fire Aspect on a mob's melee hit", () => {
  const all = records("attack");
  assert.equal(all.length, 168);
  let fires = 0, knocks = 0;
  for (const r of all) {
    const stacks = r.equipment.map(native), at = JSON.stringify(r);
    assert.equal(BASE_ATTACK[r.kind] + attackBonus(stacks), r.attribute, at);
    const creature = r.target === "spider" ? CREATURE_ATTRIBUTES[2] : CREATURE_ATTRIBUTES[1];
    const effects = meleeEffects(stacks[HELD], creature);
    assert.equal(f(r.attribute + effects.damage), r.amount, at);
    assert.equal(effects.fire * 20, r.targetFire, at);
    assert.equal(effects.knockback > 0, r.targetMotion[2] !== 0, at);
    fires += effects.fire > 0;
    knocks += effects.knockback > 0;
  }
  assert.ok(fires > 0 && knocks > 0);
  assert.equal(weaponModifier(267), 6);
  assert.equal(weaponModifier(283), 4);
  assert.equal(weaponModifier(256), 3);
  assert.equal(weaponModifier(261), 0);
  assert.equal(armorPoints(310) + armorPoints(311) + armorPoints(312) + armorPoints(313), 20);
});

test("a skeleton's bow adds Power damage, Punch knockback and Flame fire to its arrows", () => {
  const all = records("arrow");
  assert.equal(all.length, 144);
  const plain = new Map(all.filter((r) => !r.equipment[0][2].length).map((r) => [`${r.difficulty}${r.wither}${r.seed}`, r.arrow[0]]));
  for (const r of all) {
    const at = JSON.stringify(r), bow = native(r.equipment[0]), effects = bowEffects(bow, r.wither);
    const base = plain.get(`${r.difficulty}${r.wither}${r.seed}`);
    assert.ok(Math.abs(r.arrow[0] - (base + effects.damage)) < 1e-9, at);
    assert.equal(r.arrow[1], effects.knockback, at);
    assert.equal(r.arrow[2], effects.fire, at);
  }
});

test("dropEquipment and getExperiencePoints follow the chances, looting and damage rolls", () => {
  const all = records("drop");
  assert.equal(all.length, 1440);
  let dropped = 0, whole = 0;
  for (const r of all) {
    const at = JSON.stringify(r), gear = gearOf(r), rand = new JavaRandom(r.seed);
    const drops = dropEquipment(gear, rand, { playerHit: r.hit, looting: r.looting });
    assert.deepEqual(drops.map(record), r.drops, at);
    assert.equal(Number(nextLong(rand)), r.randNext, at);
    assert.equal(5 + equipmentExperience(gear, new JavaRandom(r.seed + 500)), r.xp, at);
    dropped += drops.length;
    whole += r.dropChances.filter((c) => c > 1).length;
  }
  assert.ok(dropped > 500 && whole > 0);
});

test("a canPickUpLoot mob takes a better item, drops the old one by chance and keeps it", () => {
  const all = records("pickup");
  assert.equal(all.length, 2560);
  let taken = 0, swapped = 0;
  for (const r of all) {
    const at = JSON.stringify(r), gear = gearOf({ equipment: r.before, dropChances: [0.085, 0.085, 0.085, 0.085, 0.085] }), rand = { nextFloat: () => f(r.roll) }; // every draw before the loop is on Entity.rand too: the probe pins nextFloat
    let result = null;
    if (r.loot) result = pickUpItem(gear, native(r.item), rand);
    assert.deepEqual(records5(gear.equipment), r.after, at);
    assert.deepEqual(gear.dropChances, r.dropChances.map(f), at);
    assert.equal(!!result, r.persistence, at);
    assert.deepEqual(result?.dropped ? [record(result.dropped)] : [], r.dropped, at);
    taken += !!result;
    swapped += !!result?.dropped;
  }
  assert.ok(taken > 100 && swapped > 20, `${taken} ${swapped}`);
});

test("equipment saves as Equipment, DropChances and CanPickUpLoot and reads back", () => {
  const gear = emptyGear();
  gear.equipment[0] = { id: 267, count: 1, damage: 12, enchantments: [{ id: 16, lvl: 3 }] };
  gear.equipment[4] = { id: 310, count: 1, damage: 0 };
  gear.dropChances[4] = 2;
  gear.canPickUpLoot = true;
  const saved = JSON.parse(JSON.stringify(saveGear(gear)));
  assert.deepEqual(readGear(saved), gear);
  assert.deepEqual(readGear(null), emptyGear());
  assert.equal(readGear({ equipment: [{ id: -4 }, { id: 99999 }], dropChances: ["x", 0.5], canPickUpLoot: 1 }).equipment.filter(Boolean).length, 0);
  const live = toLiveStack(gear.equipment[0]);
  assert.deepEqual(fromLiveStack(live), gear.equipment[0]);
});


// --- the live EntityWorld ---------------------------------------------------------------------------------
const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
const newWorld = (mobs = []) => new EntityWorld(flat, mobs, () => 0.5);
const stack = (id, damage = 0, enchantments) => ({ id, count: 1, damage, ...(enchantments ? { enchantments } : {}) });

test("worn armour lowers the damage a mob takes", () => {
  const world = newWorld([{ id: "bare", type: "zombie", x: 8, y: 0, z: 8, health: 20 }, { id: "iron", type: "zombie", x: 12, y: 0, z: 8, health: 20 }]);
  const [bare, iron] = world.entities;
  iron.equipment = [stack(267), stack(309), stack(308), stack(307), stack(306)];
  world.damageEntity(bare, 10, "mob");
  world.damageEntity(iron, 10, "mob");
  assert.equal(bare.health, f(20 - f(f(10 * 23) / 25)));
  assert.equal(iron.health, f(20 - f(f(10 * (25 - 17)) / 25)));
});

test("natural spawns roll their gear, a Halloween pumpkin only on October 31, and keep it through a save", () => {
  const spawn = (date, type = "zombie") => {
    const world = newWorld();
    world.currentDate = () => date;
    world.localDifficulty = () => 3;
    const made = [];
    for (let i = 0; i < 300; i++) made.push(world.spawnNatural(type, 8.5, 0, 8.5));
    return { world, made };
  };
  const halloween = spawn(new Date(2026, 9, 31)).made, ordinary = spawn(new Date(2026, 5, 1));
  const heads = halloween.filter((e) => e.equipment[HELMET]?.id === 86 || e.equipment[HELMET]?.id === 91);
  assert.ok(heads.length > 10 && heads.every((e) => e.dropChances[HELMET] === 0), String(heads.length));
  assert.ok(ordinary.made.every((e) => e.equipment[HELMET]?.id !== 86 && e.equipment[HELMET]?.id !== 91));
  assert.ok(ordinary.made.some((e) => e.equipment.slice(1).some(Boolean)), "some zombies wear armour");
  assert.ok(ordinary.made.every((e) => e.equipment.length === 5 && e.dropChances.length === 5));
  const skeletons = spawn(new Date(2026, 5, 1), "skeleton").made;
  assert.ok(skeletons.every((e) => e.equipment[HELD].id === 261 && Number.isFinite(e.followRange)));
  assert.ok(skeletons.some((e) => e.equipment[HELD].enchantments?.length), "some bows are enchanted");
  assert.equal(spawn(new Date(2026, 5, 1), "wither_skeleton").made[0].equipment[HELD].id, 272);
  // Pigmen carry the golden sword and nothing else here.
  assert.equal(spawn(new Date(2026, 5, 1), "pigman").made[0].equipment[HELD].id, 283);

  const worn = ordinary.made.find((e) => e.equipment.slice(1).some(Boolean));
  worn.canPickUpLoot = true;
  const saved = JSON.parse(JSON.stringify(ordinary.world.serialize()));
  const restored = newWorld(saved).entities.find((e) => e.id === worn.id);
  assert.deepEqual(restored.equipment, worn.equipment);
  assert.deepEqual(restored.dropChances, worn.dropChances);
  assert.equal(restored.canPickUpLoot, true);
  // A save from before this build has no equipment: a skeleton gets its bow back, a zombie nothing.
  const legacy = newWorld([{ id: "s", type: "skeleton", x: 8, y: 0, z: 8, health: 20 }, { id: "z", type: "zombie", x: 9, y: 0, z: 8, health: 20 }]).entities;
  assert.equal(legacy[0].equipment[HELD].id, 261);
  assert.ok(legacy[1].equipment.every((s) => s === null));
});

test("a killed mob drops its enchanted gear with its chance, and always the item it picked up", () => {
  const world = newWorld([{ id: "z", type: "zombie", x: 8, y: 0, z: 8, health: 20 }]);
  const [zombie] = world.entities;
  zombie.equipment = [stack(267, 0, [{ id: 16, lvl: 3 }]), null, null, null, null];
  zombie.dropChances = [2, f(0.085), f(0.085), f(0.085), f(0.085)];
  world.onDeath(zombie, { player: true, looting: 0 });
  const drops = world.drain().filter((e) => e.drop);
  const sword = drops.find((e) => e.enchantments);
  assert.ok(sword, "the Sharpness III sword drops");
  assert.deepEqual(sword.enchantments, [{ id: 16, lvl: 3 }]);
  assert.equal(sword.damage ?? 0, 0, "a chance above 1 keeps the item undamaged");
});

test("a canPickUpLoot mob takes a better item lying within reach, once", () => {
  const world = newWorld([{ id: "z", type: "zombie", x: 8, y: 0, z: 8, health: 20 }]);
  const [zombie] = world.entities;
  const live = toLiveStack(stack(267));
  const item = { stack: { id: live.id, count: 1, damage: 0 }, x: 8, y: 0, z: 8, dead: false };
  world.lootItems = { items: [item], box: (i) => [i.x - 0.125, i.y, i.z - 0.125, i.x + 0.125, i.y + 0.25, i.z + 0.125] };
  world.lootPickup();
  assert.equal(zombie.equipment[HELD], null, "without canPickUpLoot nothing happens");
  zombie.canPickUpLoot = true;
  world.lootPickup();
  assert.equal(zombie.equipment[HELD].id, 267);
  assert.equal(zombie.dropChances[HELD], 2);
  assert.equal(zombie.persistent, true);
  assert.equal(item.dead, true);
});

test("a held weapon's modifier and Sharpness add to a mob's melee hit on the player", () => {
  const world = newWorld([{ id: "z", type: "zombie", x: 8, y: 0, z: 8, health: 20 }]);
  const [zombie] = world.entities;
  const hits = [];
  const survival = { scaledDamage: (n) => (hits.push(n), true), setFire: (s) => hits.push(["fire", s]), effects: null, difficulty: 2 };
  world.hitPlayer(zombie, survival);
  zombie.equipment[HELD] = stack(267, 0, [{ id: 16, lvl: 2 }, { id: 20, lvl: 1 }]);
  world.hitPlayer(zombie, survival);
  assert.equal(hits[0], 3);
  assert.equal(hits[1], f(3 + 6 + 1.25 * 2 + 0));
  assert.deepEqual(hits[2], ["fire", 4]);
});

test("the renderer draws worn armour on a zombie's head, body and limbs and the held item in its hand", async () => {
  globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
  const THREE = await import("three");
  const { MobRenderer } = await import("./mob-renderer.js");
  const uniforms = { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } };
  const view = new MobRenderer(new THREE.Scene(), { lighting: { uniforms }, brightness: () => 0 });
  const e = { id: "z", type: "zombie", x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0,
    rotationPitch: 0, prevRotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, age: 0, death: 0, hurt: 0, growingAge: 0, lastActive: 0, fuseTime: 0, color: 0,
    equipment: [stack(267), stack(309), stack(308), stack(307), stack(306)] };
  view.update([e], 0, 1);
  const rig = view.rigs.get("z");
  // Helmet: head + hat; chestplate: body + 2 arms; leggings: body + 2 legs; boots: 2 legs; plus the sword.
  assert.equal(rig.gearNodes.length, 2 + 3 + 3 + 2 + 1);
  const count = rig.gearNodes.length;
  view.update([e], 0, 1);
  assert.equal(rig.gearNodes.length, count, "an unchanged outfit is not rebuilt");
  e.equipment = [null, null, null, null, null];
  view.update([e], 0, 1);
  assert.equal(rig.gearNodes.length, 0);
});
