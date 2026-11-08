import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { replay } from "../tools/inventory-replay.mjs";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { mobThornsOnPlayerHit } from "./thorns-live.js";
import { dropEquipment, equipmentExperience, totalArmor, readGear, saveGear } from "./mob-equipment.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { NBT } from "./nbt.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { itemStackFromNbt } from "./region-import.js";

// public/research/zero-stacks-reference.json: tools/probes/ZeroStacksProbe.java (tools/verify-zero-stacks.mjs) on the unchanged 1.7.10 classes.
// `cases` are tools/probes/zero-stack-scenarios.txt (container clicks, shift-clicks, number keys, drops, close, damage of zero-size stacks)
// through InventoryPlayer and ContainerPlayer; `records` are a real EntityZombie's Thorns wear, NBT, dropEquipment, getExperiencePoints and
// the anvil helmet rule on the zombie and on the EntityPlayerMP double.
const reference = JSON.parse(await readFile(new URL("../public/research/zero-stacks-reference.json", import.meta.url)));
const { mobThorns, mobNbt, mobDrop, mobXp, anvil } = reference.records;
const f = Math.fround;
const nativeJson = (s) => (s ? [s.id, s.count, s.damage] : null);
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1, height: 256 };
const liveZombie = (equipment) => new EntityWorld(flat, [{ type: "zombie", health: 20, x: 64.5, y: 1, z: 64.5, equipment, dropChances: Array(5).fill(f(0.085)), canPickUpLoot: false }], () => 0.5);

test("the reference is the unchanged 1.7.10 client with every record set", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual([reference.cases.length, mobThorns.length, mobNbt.length, mobDrop.length, mobXp.length, anvil.length], [42, 36, 3, 72, 12, 60]);
});

test("zero-size stacks in container clicks, shift-clicks, number keys, drops and close replay natively", () => {
  const actual = replay(reference.script);
  assert.equal(actual.length, reference.cases.length);
  for (let i = 0; i < actual.length; i++) assert.deepEqual(actual[i], reference.cases[i], reference.cases[i].case);
  const byName = Object.fromEntries(reference.cases.map((c) => [c.case, c]));
  assert.equal(byName["zero-held-tool-damage"].inventory[0], null, "the next use clears a zero-size tool in the main inventory");
  assert.deepEqual(byName["zero-cursor-drop-outside-right"].drops, [[307, 1, 0]], "native right-click outside with a zero cursor drops a whole piece");
});

test("a mob's Thorns piece breaks into a zero-size stack that keeps its armour, Thorns and wear; renderBrokenItemStack draws 15 floats", () => {
  let breaks = 0, kept = 0;
  for (const [t, unb, seed, before, log, after, events, particles, next, armour, seed2, log2, second, events2, next2] of mobThorns) {
    const row = JSON.stringify([t, unb, seed]);
    const enchantments = [{ id: 7, lvl: t }, ...(unb ? [{ id: 34, lvl: unb }] : [])];
    const mob = { equipment: before.map((s) => s && { id: s[0], count: s[1], damage: s[2], enchantments: enchantments.map((e) => ({ ...e })) }) };
    const run = (rand) => {
      const got = [], sounds = [];
      mobThornsOnPlayerHit(mob, rand, { hurt: (d) => got.push(["thorns", d]), sound: () => got.push(["damage.thorns", 0.5, 1]), breakSound: () => sounds.push("sound|random.break|0.8") });
      return { got, sounds };
    };
    let rand = new JavaRandom(BigInt(seed));
    const first = run(rand);
    assert.deepEqual(first.got, log, row);
    assert.deepEqual(mob.equipment.map(nativeJson), after, row);
    assert.deepEqual(first.sounds, events, row);
    assert.equal(rand.nextInt(), next, "Random after the break draws: " + row);
    assert.equal(2 + totalArmor(mob.equipment), armour, "getTotalArmorValue counts the zero-size piece: " + row);
    if (particles) breaks++; else kept++;
    rand = new JavaRandom(BigInt(seed2));
    const again = run(rand);
    assert.deepEqual(again.got, log2, row);
    assert.deepEqual(mob.equipment.map(nativeJson), second, row);
    assert.deepEqual(again.sounds, events2, row);
    assert.equal(rand.nextInt(), next2, row);
  }
  assert.ok(breaks >= 30 && kept >= 2, JSON.stringify({ breaks, kept }));
});

test("dropEquipment rolls for a zero-size piece but never drops it", () => {
  let dropped = 0, zero = 0;
  for (const [size, chance, hit, looting, seed, items, next] of mobDrop) {
    const gear = { equipment: [null, null, null, { id: 307, count: size, damage: 0 }, null], dropChances: [0.085, 0.085, 0.085, chance, 0.085].map(f) };
    const rand = new JavaRandom(BigInt(seed));
    const out = dropEquipment(gear, rand, { playerHit: hit, looting });
    const row = JSON.stringify([size, chance, hit, looting, seed]);
    assert.deepEqual(out.map(nativeJson), items, row);
    assert.equal(rand.nextInt(), next, row);
    dropped += items.length;
    if (size === 0) zero++;
  }
  assert.ok(dropped > 10 && zero === 36);
});

test("getExperiencePoints counts a zero-size piece like a whole one", () => {
  for (const [size, seed, points, next] of mobXp) {
    const gear = { equipment: [null, null, null, size >= 0 ? { id: 307, count: size, damage: 0 } : null, null], dropChances: Array(5).fill(f(0.085)) };
    const rand = new JavaRandom(BigInt(seed));
    assert.equal(5 + equipmentExperience(gear, rand), points, JSON.stringify([size, seed]));
    assert.equal(rand.nextInt(), next);
  }
});

test("mob Equipment keeps Count 0 through NBT (javaMobFromNbt, readGear, saveGear and a live EntityWorld)", () => {
  const short = (v) => ({ type: NBT.SHORT, value: v }), byte = (v) => ({ type: NBT.BYTE, value: v });
  for (const [variant, written, loaded, armour, again] of mobNbt) {
    // NBTTagList.toString: "[0:{...},1:{...},...]"; split the five top-level compounds by brace depth.
    const slots = [];
    for (let i = 1, depth = 0, start = 0; i < written.length - 1; i++) {
      if (written[i] === "{" && depth++ === 0) start = i + 1;
      else if (written[i] === "}" && --depth === 0) slots.push(written.slice(start, i));
    }
    assert.equal(slots.length, 5, written);
    const compounds = slots.map((body) => {
      const id = body.match(/id:(\d+)s/), count = body.match(/Count:(\d+)b/), damage = body.match(/Damage:(\d+)s/);
      return id ? new Map([["id", short(+id[1])], ["Count", byte(+count[1])], ["Damage", short(+damage[1])]]) : new Map();
    });
    assert.equal(written, again, "a load and a second write keep the Equipment list");
    const tag = new Map([["id", { type: NBT.STRING, value: "Zombie" }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5, 64, 0.5] } }],
      ["Health", { type: NBT.FLOAT, value: 20 }], ["Equipment", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: compounds } }]]);
    const record = javaMobFromNbt(tag, { convertItem: itemStackFromNbt });
    assert.deepEqual(record.equipment.map(nativeJson), loaded, "variant " + variant);
    const gear = readGear(saveGear({ ...readGear(record), canPickUpLoot: false }));
    assert.deepEqual(gear.equipment.map(nativeJson), loaded);
    assert.equal(2 + totalArmor(gear.equipment), armour);
    const e = liveZombie(record.equipment).entities[0];
    assert.deepEqual(e.equipment.map(nativeJson), loaded, "the live mob keeps the zero-size stacks");
  }
});

test("an anvil on a mob wears the helmet slot first: a broken helmet stays at size 0 and still counts; a player's is cleared after the hit", () => {
  let mobBreaks = 0, playerBreaks = 0;
  for (const [type, damage, amount, chestplate, ok, health, after, helmet, same, armour, events, particles] of anvil) {
    const row = JSON.stringify([type, damage, amount, chestplate]);
    if (type === "zombie") {
      const w = liveZombie([null, null, null, chestplate ? { id: 307, count: 1, damage: 0 } : null, { id: 298, count: 1, damage }]), e = w.entities[0];
      setEntityRandom(e, new JavaRandom(7n));
      w.events = [];
      assert.equal(w.attackEntityFrom(e, amount, { name: "anvil" }), ok, row);
      assert.ok(Math.abs(e.health - after) < 1e-4, `${row} health ${e.health} vs ${after}`);
      assert.deepEqual(nativeJson(e.equipment[4]), helmet, row);
      assert.equal(2 + totalArmor(e.equipment), armour, row);
      assert.equal(w.events.some((x) => x.sound === "random.break"), events.includes("sound|random.break|0.8"), row);
      if (particles) mobBreaks++;
    } else {
      const p = new Survival({ health, inventoryRandom: new JavaRandom(7n).save(), armor: [null, null, chestplate ? makeStack(409) : null, makeStack(400, 1, damage)] });
      assert.equal(p.anvilDamage(amount, "anvil"), ok, row);
      assert.ok(Math.abs(p.health - after) < 1e-4, `${row} health ${p.health} vs ${after}`);
      const live = p.inventory.armor[3];
      assert.deepEqual(live && [298, live.count, live.damage], helmet, row);
      if (particles) { playerBreaks++; assert.ok(p.broken, row); }
    }
  }
  assert.ok(mobBreaks >= 20 && playerBreaks >= 20, JSON.stringify({ mobBreaks, playerBreaks }));
});
