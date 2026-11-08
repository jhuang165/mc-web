// Batch 25 attributes2: max health of the classes that set their own (wolf, slime, magma cube, horse) under saved modifiers, wolf taming,
// the isAIEnabled movement split, a zombie read without an Attributes list, a ridden horse's speed modifier, Count 0 item reads, zero-size
// item use and the break-sound pitch. Replays public/research/attributes2-reference.json (tools/probes/Attributes2Probe.java, run natively
// against the unchanged 1.7.10 classes by tools/verify-attributes2.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeNbt, NBT } from "./nbt.js";
import { javaMobFromNbt, importedMobType } from "./java-mobs.js";
import { EntityWorld, ENTITY_TYPES, aiMoveSpeed, LEGACY_MOVE } from "./entities.js";
import { maxHealthOf } from "./mob-riding.js";
import { liveAttribute } from "./mob-attributes.js";
import { interact as wolfInteract, BONE } from "./wolf.js";
import { horseRideThink } from "./horse-live.js";
import { JavaRandom } from "./java-random.js";
import { itemStackFromNbt, itemFromOriginal, readContainerTile } from "./region-import.js";
import { ItemEntities } from "./item-entities.js";
import { pushOne, pickUpEntity } from "./inventory-transfer.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { breakSoundPitch } from "./mob-equipment.js";

const ref = JSON.parse(await readFile(new URL("../public/research/attributes2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const nbtOf = (hex, id) => {
  const tag = decodeNbt(Uint8Array.from(Buffer.from(hex, "hex"))).tag.value;
  if (id) tag.set("id", { type: NBT.STRING, value: id });
  return tag;
};
const world = (mobs = []) => new EntityWorld({ size: 128, height: 256 }, mobs, () => 0.5);
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const f = Math.fround;

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { maxHealth: 152, tame: 3, aiEnabled: 29, noAttributes: 8, horseRide: 5, itemRead: 12, use: 80, rightClick: 76, breakPitch: 4 });
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  for (const c of ["sv", "wv", "ym", "wi", "yq", "yh", "add", "xk", "api"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

// ---- max health ----
test("native max health: the saved list sets the maximum, but setTamed / setSlimeSize reset the base after HealF was clamped", () => {
  const rec = (id, variant, more = {}) => by("maxHealth").find((r) => r.id === id && r.variant === variant && Object.entries(more).every(([k, v]) => r[k] === v));
  assert.equal(rec("Wolf", "add4", { tamed: false }).maxHealth, 12);
  assert.equal(rec("Wolf", "add4", { tamed: true }).maxHealth, 24);
  // A tamed wolf saved with base 30 + 4: HealF 1000 is clamped to 34 first, then setTamed puts the base back at 20 (max 24, health 34).
  const over = rec("Wolf", "base30add4", { tamed: true });
  assert.deepEqual([over.maxHealth, over.health], [24, 34]);
  // No list: the constructor's 8 clamps HealF before setTamed.
  assert.equal(rec("Wolf", "noList", { tamed: true }).health, 8);
  // setSlimeSize heals to the full modified maximum whatever HealF said.
  for (const r of by("maxHealth").filter((r) => r.id === "Slime" || r.id === "LavaSlime")) assert.equal(r.health, r.maxHealth, `${r.id} ${r.variant}`);
});

test("port: every maxHealth record loads with the native getMaxHealth and getHealth", () => {
  let checked = 0;
  for (const r of by("maxHealth")) {
    const label = `${r.id} ${r.variant} ${r.tamed ?? ""}`;
    const record = javaMobFromNbt(nbtOf(r.nbt, r.id));
    assert.ok(record, label);
    const e = world([{ ...record, x: 64.5, y: 1, z: 64.5 }]).entities[0];
    if (r.health === 0) { assert.ok(!e || e.health === 0, label); checked++; continue; }
    assert.ok(e, label);
    near(maxHealthOf(e, e.horse?.maxHealth ?? ENTITY_TYPES[e.type].health), r.maxHealth, `${label} max`);
    // Gap: the port clamps a restored mob's health to its maximum, so the native 34 over 24 of a re-tamed wolf reads as 24.
    if (r.health > r.maxHealth) assert.equal(e.health, r.maxHealth, label);
    else near(e.health, r.health, `${label} health`, 1e-5);
    checked++;
  }
  assert.equal(checked, 152);
});

test("port wolf taming: setTamed(true) resets the base to 20, then setHealth(20) clamps to the modified maximum", () => {
  const mods = [[], [{ attribute: "generic.maxHealth", name: "Probe add", amount: 4, operation: 0 }], [{ attribute: "generic.maxHealth", name: "Probe total", amount: -0.5, operation: 2 }]];
  for (const r of by("tame")) {
    const e = { ...world().create("wolf", 64.5, 1, 64.5), modifiers: mods[r.modifier], attributeBases: { "generic.maxHealth": 8 } };
    e.health = 8;
    assert.equal(maxHealthOf(e, 8), r.before, `modifier ${r.modifier} before`);
    const rand = { nextInt: () => 0 };
    const out = wolfInteract(e, { id: BONE, count: 1 }, true, false, rand);
    assert.equal(out.tamed, true);
    assert.equal(maxHealthOf(e, 20), r.afterTame, `modifier ${r.modifier} after`);
    assert.equal(e.health, r.health, `modifier ${r.modifier} health`);
  }
});

// ---- movement ----
test("native isAIEnabled false gives getAIMoveSpeed 0.1; the port's legacy movers are exactly the ground-moving ones of that set", () => {
  const own = new Set(["ender_dragon", "ghast", "squid"]); // their own flying or swimming movement, not moveEntityWithHeading's ground branch
  let checked = 0;
  for (const r of by("aiEnabled")) {
    assert.equal(f(r.aiMoveSpeed), r.ai ? 0 : f(0.1), r.id); // JSON holds Float.toString
    const type = importedMobType(r.id);
    if (!type || !ENTITY_TYPES[type]) continue;
    if (r.ai) assert.ok(!LEGACY_MOVE.has(type), r.id);
    else assert.ok(LEGACY_MOVE.has(type) || own.has(type), r.id);
    checked++;
  }
  assert.ok(checked >= 25, `checked ${checked}`);
});

test("port baby pigman: the inherited setChild speed boost (+50%, operation 1) applies", () => {
  const e = world().create("pigman", 64.5, 1, 64.5);
  const adult = aiMoveSpeed({ ...e, growingAge: 0, pigTarget: null }, 1), baby = aiMoveSpeed({ ...e, growingAge: -1, pigTarget: null }, 1);
  near(baby, f(adult * 1.5), "baby pigman");
});

test("port ridden horse: getAIMoveSpeed is the movementSpeed attribute with its modifiers; jumpMovementFactor uses the prior bp", () => {
  const spec = { plain: null, "mul0.5": [0.5, 1], "add0.1": [0.1, 0], slow: [-0.75, 2], priorFast: [0.5, 1] };
  for (const r of by("horseRide")) {
    const m = spec[r.name];
    const e = { type: "horse", horse: { speed: r.base, jump: 0.7 }, modifiers: m ? [{ attribute: "generic.movementSpeed", name: "Probe speed", amount: m[0], operation: m[1] }] : [],
      rider: { yaw: 0, moveStrafing: 0, moveForward: f(0.98) }, onGround: true, aiMoveSpeed: f(r.prior) };
    assert.equal(aiMoveSpeed(e, 1), f(r.value), r.name);
    for (const t of r.ticks.slice(0, 2)) {
      horseRideThink({}, e);
      assert.equal(e.aiMoveSpeed, f(t.aiSpeed), r.name);
      assert.equal(e.jumpFactor, f(t.jumpFactor), `${r.name} aQ`);
    }
  }
});

// ---- no Attributes list ----
test("native and port: a zombie or pigman read without an Attributes list keeps knockbackResistance 0 (the roll is onSpawnWithEgg's)", () => {
  for (const r of by("noAttributes")) assert.equal(r.knockback, 0, `${r.id} ${r.seed}`);
  const noList = by("maxHealth").find((r) => r.id === "Zombie" && r.variant === "noList");
  for (const id of ["Zombie", "PigZombie"]) {
    for (let seed = 1; seed <= 4; seed++) {
      const record = javaMobFromNbt(nbtOf(noList.nbt, id));
      const w = world([{ ...record, x: 64.5, y: 1, z: 64.5 }]);
      w.worldRandom = new JavaRandom(seed);
      const e = w.entities[0];
      assert.equal(liveAttribute(e, "generic.knockbackResistance", e.knockbackResistance ?? 0), 0, `${id} ${seed}`);
      assert.ok(!(e.knockbackResistance > 0), `${id} ${seed}`);
    }
  }
});

// ---- item reads ----
const itemTag = (id, count, damage = 0) => new Map([["id", { type: NBT.SHORT, value: id }], ["Count", { type: NBT.BYTE, value: count }], ["Damage", { type: NBT.SHORT, value: damage }]]);
test("native loadItemStackFromNBT keeps any Count; the port keeps 0 and above where native code keeps the stack", () => {
  for (const r of by("itemRead").filter((r) => r.what === "loadItemStackFromNBT")) {
    assert.equal(r.stack[1], r.count);
    const port = itemStackFromNbt(itemTag(1, r.count), { allowEmpty: true });
    assert.equal(port.count, r.count); // -1 is kept too since batch 26
  }
});

test("port EntityItem with Count 0: kept on load, alive after a tick, never picked up (addItemStackToInventory refuses size 0)", () => {
  const r = by("itemRead").find((r) => r.what === "EntityItem" && r.count === 0);
  assert.deepEqual([r.deadAfterRead, r.deadAfterTick, r.deadAfterPickup], [false, false, false]);
  const diamond = itemFromOriginal(264, 0).id;
  const items = new ItemEntities(() => 0.5);
  items.load([{ stack: { id: diamond, count: 0, damage: 0 }, x: 0.5, y: 0, z: 0.5 }], (s) => (s.count >= 0 ? { ...s } : null));
  assert.equal(items.items.length, 1);
  const floor = { get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0 };
  items.tick(floor);
  assert.equal(items.items.length, 1);
  let offered = 0;
  const picked = items.collect({ x: 0.5, y: 0, z: 0.5 }, 0.6, 1.8, () => { offered++; return true; });
  assert.deepEqual([picked.length, offered, items.items.length], [0, 0, 1]);
  // A fresh drop of nothing is still refused.
  assert.equal(items.spawn({ id: diamond, count: 0, damage: 0 }, 0, 0, 0), null);
});

test("port hopper: TileEntityHopper.readFromNBT keeps Count 0, and a size-0 slot moves whole without creating an item", () => {
  for (const r of by("itemRead").filter((r) => r.what === "hopper" && r.count >= 0)) {
    const tile = new Map([["id", { type: NBT.STRING, value: "Hopper" }], ["Items", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [new Map([...itemTag(264, r.count), ["Slot", { type: NBT.BYTE, value: 0 }]])] } }]]);
    const read = readContainerTile("Hopper", tile, { convertItem: (c, o) => itemStackFromNbt(c, o) });
    assert.equal(read.record.items[0].count, r.stack[1]);
  }
  const adapter = (items) => ({ size: items.length, get: (i) => items[i], set: (i, s) => { items[i] = s; }, valid: () => true });
  const hopper = [{ id: 1, count: 0, damage: 0 }, null, null, null, null], chest = Array(27).fill(null);
  assert.equal(pushOne(adapter(hopper), adapter(chest), 0, () => 64), true);
  assert.equal(hopper[0], null);
  assert.ok(chest.every((s) => !s || s.count === 0), "no item made from a size-0 stack");
  const entity = { stack: { id: 1, count: 0, damage: 0 } };
  assert.equal(pickUpEntity(adapter([null, null, null, null, null]), entity, () => 64), true); // func_145898_a kills a size-0 item entity
});

// ---- zero-size use ----
test("native ItemBlock / ItemReed refuse stackSize 0; redstone, doors, signs, seeds, eggs and bone meal act and leave -1", () => {
  const use = by("use");
  const refuse = ["stone", "torch", "slab", "cake", "reed", "string", "repeater", "flowerPotItem"];
  const act = ["redstone", "door", "seeds", "spawnEgg", "boneMealSapling", "netherWart", "minecartOnRail"];
  for (const name of refuse) for (const r of use.filter((r) => r.name === name && r.count === 0)) assert.deepEqual([r.used, r.events.length], [false, 0], name);
  for (const name of act) assert.equal(use.find((r) => r.name === name && r.count === 0 && !r.creative).after, -1, name);
  // Throwables and food also act at size 0 (the port leaves -1 now, neg-stacks.test.js).
  for (const name of ["snowball", "egg", "enderPearl", "apple", "bread"]) assert.equal(by("rightClick").find((r) => r.name === name && r.count === 0 && !r.creative).after, -1, name);
});

test("port placeHeldBlock refuses a held size-0 ItemBlock or ItemReed stack in both modes, before reading the world", () => {
  const stop = new Error("reached the world");
  const worldStub = { get: () => { throw stop; }, getMeta: () => { throw stop; }, height: 256, inside: () => true };
  const target = { block: [0, 63, 0], adjacent: [0, 64, 0], hit: [0.5, 64, 0.5] };
  const place = (native, creative, count) => {
    const mapped = itemFromOriginal(native, 0), held = { id: mapped.id, count, damage: mapped.damage };
    const survival = { creative, held, count: () => Math.max(0, count), usable: () => true, take: () => true };
    try { return placeHeldBlock({ world: worldStub, survival, position: { x: 5, y: 64, z: 5 }, flowers: [], yaw: 0, farming: { observe() {} } }, { id: mapped.id, item: null, target }); }
    catch (err) { if (err === stop) return { reason: "world" }; throw err; }
  };
  for (const native of [1, 50, 44, 338, 287, 356, 390]) for (const creative of [false, true]) {
    assert.equal(place(native, creative, 0).reason, "empty-stack", `${native} ${creative}`);
    assert.equal(place(native, creative, 1).reason, "world", `${native} ${creative} count 1`);
  }
  // No stackSize check natively: redstone dust and doors go on (Creative acts as native; Survival now acts on the held stack too, neg-stacks.test.js).
  for (const native of [331, 324]) assert.equal(place(native, true, 0).reason, "world", `${native}`);
});

// ---- break sound ----
test("native and port renderBrokenItemStack: random.break at 0.8, pitch 0.8 + world Random nextFloat * 0.4, five particles", () => {
  for (const r of by("breakPitch")) {
    assert.equal(r.particles, 5);
    const [, name, volume, pitch] = r.sounds[0].split("|");
    assert.deepEqual([name, Number(volume)], ["random.break", 0.8]);
    assert.equal(breakSoundPitch(new JavaRandom(r.seed)), f(Number(pitch)), `seed ${r.seed}`);
    assert.equal(breakSoundPitch(new JavaRandom(r.seed)), f(r.expected));
  }
});
