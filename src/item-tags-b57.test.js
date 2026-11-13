// Replays public/research/item-tags-reference.json (tools/probes/ItemTagsProbe.java, tools/verify-item-tags.mjs): the executed 1.7.10
// ItemStack tags display.Lore, SkullOwner, CustomPotionEffects and map_is_scaling, and EntityPotion.onImpact.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { itemStackFromNbt } from "./region-import.js";
import { stackNbtText } from "./item-component.js";
import { stackName, liveNativeName } from "./item-names.js";
import { tooltipLines } from "./gui.js";
import { potionColor } from "./potions.js";
import { stackPotionEffects, readItemTags, hasItemTags } from "./item-tags.js";
import { copyStack, sameStackItem, makeStack } from "./inventory.js";
import { splashImpact } from "./witch.js";
import { Survival } from "./survival.js";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { usePotion, finishPotion } from "./potion-use.js";
import { WitchPotions } from "./witch-potions.js";
import { addMobEffect, isPotionApplicable } from "./mob-effects.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/item-tags-reference.json", import.meta.url)));
const tag = (type, value) => ({ type, value });
const TYPE = { b: NBT.BYTE, h: NBT.SHORT, i: NBT.INT, s: NBT.STRING };
function build([k, v]) {
  if (k === "c") return tag(NBT.COMPOUND, new Map(Object.entries(v).map(([n, d]) => [n, build(d)])));
  if (k === "l") { const items = v.map(build); return tag(NBT.LIST, { elementType: items.length ? items[0].type : NBT.END, items: items.map((t) => t.value) }); }
  return tag(TYPE[k], v);
}
const live = (id, damage) => ORIGINAL_ITEMS[`${id}:${damage}`] ?? ORIGINAL_ITEMS[id];
const CODE = { purple: "§5", gray: "§7", blue: "§9", dark_purple: "§5", red: "§c", aqua: "§b", yellow: "§e", light_purple: "§d" };
const fmt = (l) => (l.color ? CODE[l.color] ?? "" : "") + (l.italic ? "§o" : "") + l.text;
// the attribute modifier rows come out of a HashMultimap: their order is not deterministic when effects repeat, so compare them sorted
const sortModifiers = (lines) => { const at = lines.indexOf("§5When Applied:") + 1; return at ? [...lines.slice(0, at), ...lines.slice(at).sort()] : lines; };
function importRow(row) {
  // The probe sets a custom name with setStackDisplayName (not part of the descriptor): it is the display.Name in the executed NBT text.
  const named = /display:\{[^}]*?Name:"([^"]*)"/.exec(row.nbt ?? "")?.[1];
  if (named !== undefined) {
    row = { ...row, tag: row.tag ? structuredClone(row.tag) : ["c", {}] };
    const d = (row.tag[1].display ??= ["c", {}]); d[1].Name = ["s", named];
  }
  const compound = new Map([["id", tag(NBT.SHORT, row.id)], ["Count", tag(NBT.BYTE, 1)], ["Damage", tag(NBT.SHORT, row.damage)], ...(row.tag ? [["tag", build(row.tag)]] : [])]);
  return itemStackFromNbt(compound);
}
const strip = (l) => l.replace(/§./g, "");

test("every executed tag row: name, tooltip, effects, glint, colour and NBT text match", () => {
  let checked = 0;
  for (const row of ref.tags) {
    if (row.error) { assert.equal(row.name, "skullOwnerCompoundNoName"); continue; } // a native NPE (compound SkullOwner without a Name); the port shows "Head"
    const stack = importRow(row);
    assert.ok(stack, row.name);
    stack.count = 1;
    const item = { id: stack.id, name: liveNativeName(stack.id, stack.damage) ?? "x", ...(row.id === 276 ? { attack: Number(/\+([\d.]+) Attack/.exec(row.tooltip.at(-1))?.[1] ?? 7) } : {}) }; // the attack value is the sword table's, not this track's
    const nameOf = (s) => stackName(s, { [s.id]: item });
    if (row.id !== 358) {
      // enchantment lines carry no code in the executed strings (the renderer draws every later line gray); keep the others exact
      const lines = tooltipLines(item, stack, false).map(fmt).map((l, i) => (i > 0 && l.startsWith("§7") && !row.tooltip[i]?.startsWith("§7") ? l.slice(2) : l));
      assert.equal(strip(lines[0]), strip(row.tooltip[0]), `${row.name} name`);
      const sort = sortModifiers;
      assert.deepEqual(sort(lines.slice(1)), sort(row.tooltip.slice(1)), `${row.name} tooltip`);
    }
    if (row.display !== undefined && row.id !== 358) assert.equal(nameOf(stack), row.display, `${row.name} display`);
    if (row.effects) {
      const have = (stackPotionEffects(stack) ?? []).map((e) => [e.id, e.amplifier, e.duration, e.ambient ? 1 : 0]);
      const sort = (a) => a.map(String).sort();
      assert.deepEqual(sort(have), sort(row.effects), `${row.name} effects`);
      assert.equal(have.length > 0, row.hasEffect, `${row.name} hasEffect`);
      assert.equal(potionColor(stack.damage), row.color, `${row.name} colour`);
    }
    // NBTTagCompound.toString (Java HashMap key order) of the stack the port rebuilds from the same tag. Known gaps (see the track note): a Lore list that is not
    // strings, extra SkullOwner / effect fields and the malformed custom lists are not kept as raw NBT.
    if (!/^(loreInts|loreString|loreTopLevel|skullOwnerCompound|skullOwnerInt|custom)/.test(row.name) || row.name === "customStrength") assert.equal(stackNbtText(stack), row.nbt, `${row.name} nbt`);
    checked++;
  }
  assert.ok(checked >= 46, `checked ${checked}`);
});

test("a compound SkullOwner without a Name shows the plain head name", () => {
  const stack = importRow(ref.tags.find((t) => t.name === "skullOwnerCompoundNoName"));
  assert.equal(stackName(stack, { [stack.id]: { id: stack.id, name: "Head" } }), "Head");
});

test("custom effects with their NBT text round-trip (well-formed rows)", () => {
  for (const row of ref.tags.filter((t) => t.name === "customStrength" || t.name === "customSplash" || t.name === "customReplaces")) {
    const stack = importRow(row);
    assert.equal(stackNbtText(stack), row.nbt, row.name);
  }
});

test("tags survive copy, merge checks and the inventory fields", () => {
  const a = makeStack(276, 1, 0, undefined, { lore: ["a", "b"], skullOwner: "x", customPotionEffects: [{ id: 5, amplifier: 1, duration: 100, ambient: false }], mapScaling: true });
  const b = copyStack(a);
  assert.deepEqual(b.lore, ["a", "b"]);
  assert.notEqual(b.lore, a.lore);
  assert.notEqual(b.customPotionEffects[0], a.customPotionEffects[0]);
  assert.ok(sameStackItem(a, b));
  b.lore[1] = "c";
  assert.ok(!sameStackItem(a, b));
  b.lore[1] = "b"; b.customPotionEffects[0].duration = 101;
  assert.ok(!sameStackItem(a, b));
  assert.ok(hasItemTags(a) && !hasItemTags({ id: 1 }));
  assert.ok(!sameStackItem(makeStack(1, 1, 0, undefined, { lore: [] }), makeStack(1)));
  assert.deepEqual(readItemTags({ lore: ["x", 3], customPotionEffects: [{ id: 99, amplifier: 0, duration: 1 }, { id: 1, amplifier: 300, duration: 9.7 }] }), { customPotionEffects: [{ id: 1, amplifier: 44, duration: 9, ambient: false }] });
});

test("map_is_scaling reads and writes as a byte", () => {
  for (const name of ["mapScaling", "mapScalingZero"]) {
    const row = ref.tags.find((t) => t.name === name), stack = importRow(row);
    assert.equal(stack.mapScaling, name === "mapScaling");
    assert.equal(stackNbtText(stack), row.nbt, name);
  }
  assert.equal(importRow(ref.tags.find((t) => t.name === "mapPlain")).mapScaling, undefined);
});

// ---- EntityPotion.onImpact ----
const TYPE_OF = { Pig: "pig", Zombie: "zombie", Skeleton: "skeleton", Spider: "spider", CaveSpider: "cave_spider", Villager: "villager", PigZombie: "pigman", WitherBoss: "wither" };
const MAX = { Pig: 10, Zombie: 20, Skeleton: 20, Spider: 16, CaveSpider: 12, Villager: 20, PigZombie: 20, WitherBoss: 300 };
const CUSTOM = /^\{id:373s,Count:1b,tag:\{CustomPotionEffects:/;
function customOf(row) { // the CustomPotionEffects the stack carries (Id/Amplifier/Duration from the executed `effects` rows)
  return CUSTOM.test(row.stack) ? row.effects.map(([id, amplifier, duration, ambient]) => ({ id, amplifier, duration, ambient: !!ambient })) : undefined;
}
test("EntityPotion.onImpact: every executed splash row (instant health / harm 0..3, distances, direct hits, undead, timed effects)", () => {
  let rows = 0, hurtRows = 0;
  for (const row of ref.splash) {
    const targets = row.targets.map((t, i) => ({ x: t.x, y: t.y, z: t.z, width: t.width, height: t.height, undead: t.undead, ref: i, direct: row.direct === i,
      applicable: (id) => t.kind !== "WitherBoss" && isPotionApplicable({ type: TYPE_OF[t.kind] }, id) })); // EntityWither.addPotionEffect is empty
    const custom = customOf(row);
    const results = splashImpact(row.damage, { x: 0, y: 64, z: 0 }, targets, row.thrower ? { thrower: true } : null, custom);
    const by = new Map(results.map((r) => [r.ref, r]));
    row.targets.forEach((t, i) => {
      const r = by.get(i);
      let health = Math.min(row.health, MAX[t.kind]);
      const mob = { type: TYPE_OF[t.kind], effects: [] };
      if (r) {
        // Potion.affectEntity in effect order; a second hit inside the invulnerability window only counts above the first (EntityLivingBase.attackEntityFrom)
        let last = 0;
        for (const s of r.steps) {
          if (health <= 0) break;
          if (s.hurt !== undefined && row.thrower && t.kind === "WitherBoss") continue; // EntityWither.attackEntityFrom ignores damage from an undead attacker (the probe's thrower is a zombie)
          if (s.hurt !== undefined) { if (s.hurt > last) { health -= s.hurt - last; last = s.hurt; } } else health = Math.min(MAX[t.kind], health + s.heal);
        }
        for (const e of r.effects) addMobEffect(mob, e.id, e.duration, e.amplifier); // PotionEffect.combine for a repeated id
        if (r.hurt > 0) hurtRows++;
      }
      assert.equal(Math.max(health, 0), Math.max(t.health, 0), `${row.name} ${JSON.stringify(row.offset)} direct ${row.direct} ${t.kind} health`);
      const effects = mob.effects.map((e) => [e.id, e.amplifier, e.duration, e.ambient ? 1 : 0]);
      assert.deepEqual(effects.map(String).sort(), t.effects.map(String).sort(), `${row.name} ${t.kind} effects`);
    });
    rows++;
  }
  assert.equal(rows, ref.splash.length);
  assert.ok(hurtRows > 20);
});

// ---- drink and throw ----
const survivalWith = (stack) => { const s = new Survival({ time: 0, slots: [] }, "survival"); s.inventory.main[0] = stack; s.inventory.current = 0; return s; };
test("drinking applies CustomPotionEffects instead of the damage value's, with the ambient flag", () => {
  const s = survivalWith(makeStack(385, 1, 8193, undefined, { customPotionEffects: [{ id: 5, amplifier: 2, duration: 3600, ambient: true }] })); // regeneration damage, strength custom
  assert.equal(usePotion({ survival: s, eating: null }), "drink");
  finishPotion(s);
  assert.equal(s.effects.has(5), true);
  assert.equal(s.effects.has(10), false);
  assert.equal(s.effects.get(5).amplifier, 2);
  assert.equal(s.inventory.main[0].id, 384);
});
test("a thrown splash potion carries its custom effects through flight, save and impact", () => {
  const custom = [{ id: 7, amplifier: 1, duration: 1, ambient: false }];
  const s = survivalWith(makeStack(385, 1, 16384, undefined, { customPotionEffects: custom }));
  const w = new WitchPotions({ joined() {} }, () => 0.5), state = { survival: s, position: { x: 0, y: 60, z: 0 }, yaw: 0, pitch: 0, mobs: { potions: w } };
  assert.equal(usePotion(state), "throw");
  const saved = w.serialize();
  assert.deepEqual(saved[0].custom, custom);
  const w2 = new WitchPotions({ joined() {} }, () => 0.5);
  w2.load(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(w2.projectiles.balls[0].custom, custom);
  // impact: harm II (12 at full strength) on a direct target, from the stack and not from damage 16384 (no effects)
  const r = splashImpact(16384, { x: 0, y: 64, z: 0 }, [{ x: 0, y: 64, z: 0, width: 0.6, height: 1.8, undead: false, ref: 1, direct: true }], null, custom);
  assert.equal(r[0].hurt, 12);
  assert.equal(splashImpact(16384, { x: 0, y: 64, z: 0 }, [{ x: 0, y: 64, z: 0, width: 0.6, height: 1.8, undead: false, ref: 1, direct: true }]).length, 0);
});
test("a player splash potion with no tag uses the damage value's PotionHelper effects", () => {
  const r = splashImpact(16421, { x: 0, y: 64, z: 0 }, [{ x: 0, y: 64, z: 0, width: 0.6, height: 1.8, undead: false, ref: 1, direct: true }]);
  assert.equal(r[0].heal, 8); // instant health II splash
});

test("/give dataTag keeps Lore, SkullOwner, CustomPotionEffects and map_is_scaling", () => {
  const world = new World("item-tags-b57", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []), lines = [];
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 10.8, y: 60.6, z: 10.1 }),
    changed() {}, refreshInventory() {}, stackName: (s) => s.displayName ?? "stack", giveDrop: (s) => survival.inventory.add(s), updateBlock() {}, destroyBlock() {} };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  assert.ok(runner.run('/give @p diamond_sword 1 0 {display:{Lore:["a","b"]}}'));
  assert.ok(runner.run('/give @p skull 1 3 {SkullOwner:"Notch"}'));
  assert.ok(runner.run('/give @p potion 1 0 {CustomPotionEffects:[{Id:5b,Amplifier:1b,Duration:600}]}'));
  const main = survival.inventory.main.filter(Boolean);
  assert.deepEqual(main.find((s) => s.lore)?.lore, ["a", "b"]);
  assert.equal(main.find((s) => s.skullOwner)?.skullOwner, "Notch");
  assert.deepEqual(main.find((s) => s.customPotionEffects)?.customPotionEffects, [{ id: 5, amplifier: 1, duration: 600, ambient: false }]);
  assert.ok(!lines.some((l) => /Not kept/.test(l)), lines.join("|"));
});
