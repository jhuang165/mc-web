// Batch 24 interchange: the follow-range "Random spawn bonus" of EntityLiving.onSpawnWithEgg, imported Attributes lists taking effect, the
// baby speed boost on an adult, the never-saved held-item modifier, and the legacy Owner name conversion. Replays
// public/research/interchange-spawn-reference.json (tools/probes/InterchangeSpawnProbe.java, run natively against the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeNbt, NBT } from "./nbt.js";
import { javaMobFromNbt, importedMobType } from "./java-mobs.js";
import { livingAttributesNbt } from "./mob-attribute-list.js";
import { SPAWN_BONUS_NAME, BABY_BOOST_UUID, hasStoredBabyBoost } from "./mob-attributes.js";
import { attackDamage } from "./mob-effects.js";
import { attackBonus } from "./mob-equipment.js";
import { ownerFromNbt } from "./owner-links.js";
import { offlineUuid } from "./stats.js";
import { EntityWorld, ENTITY_TYPES, aiMoveSpeed, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(await readFile(new URL("../public/research/interchange-spawn-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const nbtOf = (r, id) => {
  const tag = decodeNbt(Uint8Array.from(Buffer.from(r.nbt, "hex"))).tag.value;
  if (id && !tag.has("id")) tag.set("id", { type: NBT.STRING, value: id });
  return tag;
};
const liveOf = (r) => Object.fromEntries(r.live.map((a) => [a.name, a.value]));
const world = (mobs = []) => new EntityWorld({ size: 128, height: 256 }, mobs, () => 0.5);
const load = (record) => world([{ ...record, x: 64.5, y: 1, z: 64.5 }]).entities[0];
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
import { maxHealthOf } from "./mob-riding.js";

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { spawnBonus: 87, modEffect: 84, babyBoost: 8, weapon: 36, legacyOwner: 30, wolfOwner: 5 });
  assert.equal(ref.records.length, 250);
  for (const c of ["sw", "sv", "yj", "tl", "tj", "nz", "ns", "tg", "yq", "xy"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

// ---- the spawn bonus ----
test("native onSpawnWithEgg: every living class but the cave spider takes the follow-range spawn bonus as its first Entity.rand draw", () => {
  for (const r of by("spawnBonus")) {
    assert.equal(r.error, null, r.id);
    const follow = r.attributes.find((a) => a.name === "generic.followRange");
    const bonus = follow.modifiers.filter((m) => m.name === SPAWN_BONUS_NAME);
    if (r.id === "CaveSpider") { assert.equal(bonus.length, 0); continue; }
    assert.equal(bonus.length, 1, r.id);
    assert.equal(bonus[0].operation, 1);
    assert.equal(bonus[0].amount, r.gauss, r.id);
    assert.equal(r.gauss, new JavaRandom(r.seed).nextGaussian() * 0.05, `${r.id} seed ${r.seed}`);
  }
});

test("port onSpawnWithEgg rolls the same spawn bonus on Entity.rand, exports it and applies it to followRange", () => {
  let checked = 0;
  for (const r of by("spawnBonus")) {
    const type = importedMobType(r.id);
    if (!type || !ENTITY_TYPES[type]) continue;
    const w = world();
    w.worldRandom = new JavaRandom(99);
    w.currentDate = () => new Date(2026, 5, 1);
    const e = w.create(type, 64.5, 1, 64.5);
    setEntityRandom(e, new JavaRandom(r.seed));
    w.onSpawnWithEgg(e);
    const mods = (e.modifiers ?? []).filter((m) => m.attribute === "generic.followRange" && m.name === SPAWN_BONUS_NAME);
    if (r.id === "CaveSpider") { assert.equal(mods.length, 0); assert.equal(e.followRange, undefined); continue; }
    assert.equal(mods.length, 1, r.id);
    assert.equal(mods[0].amount, r.gauss, r.id);
    assert.equal(mods[0].operation, 1);
    const base = r.live.find((a) => a.name === "generic.followRange").base;
    near(e.followRange, base * (1 + r.gauss), r.id, 1e-12);
    // Export writes the modifier in the followRange entry.
    const list = livingAttributesNbt(e, r.id).value.items, entry = list.find((a) => a.get("Name").value === "generic.followRange");
    const saved = entry.get("Modifiers")?.value.items.filter((m) => m.get("Name").value === SPAWN_BONUS_NAME) ?? [];
    assert.equal(saved.length, 1, r.id);
    assert.equal(saved[0].get("Amount").value, r.gauss);
    assert.equal(saved[0].get("Operation").value, 1);
    checked++;
  }
  assert.ok(checked >= 70, `checked ${checked}`);
});

test("native spawn NBT read back by the port keeps the spawn bonus and its followRange", () => {
  for (const r of by("spawnBonus")) {
    const type = importedMobType(r.id);
    if (!type || !ENTITY_TYPES[type] || r.id === "EnderDragon" || r.id === "WitherBoss") continue;
    const record = javaMobFromNbt(nbtOf(r, r.id), {});
    if (!record) continue;
    const want = liveOf(r)["generic.followRange"];
    near(record.followRange ?? 16, want, r.id, 1e-12);
    const e = load(record);
    near(e.followRange ?? 16, want, r.id, 1e-12);
  }
});

// ---- imported modifiers take effect ----
test("imported Attributes bases and modifiers give the native live followRange, knockback, speed, max health and health", () => {
  for (const r of by("modEffect")) {
    const record = javaMobFromNbt(nbtOf(r, r.id), {});
    assert.ok(record, `${r.id} ${r.kind}`);
    const e = load(record), L = liveOf(r), msg = `${r.id} ${r.kind}`;
    near(e.followRange ?? (r.id === "Zombie" || r.id === "PigZombie" ? 40 : 16), L["generic.followRange"], msg + " followRange", 1e-12);
    near(e.knockbackResistance ?? 0, L["generic.knockbackResistance"], msg + " knockback", 1e-12);
    // setAIMoveSpeed takes the float of the attribute value.
    near(aiMoveSpeed(e, 1), Math.fround(L["generic.movementSpeed"]), msg + " speed");
    // Wolves, slimes and horses too since batch 25 (their own base under the saved modifiers: mob-riding.js maxHealthOf).
    near(maxHealthOf(e, ENTITY_TYPES[e.type].health), L["generic.maxHealth"], msg + " maxHealth", 1e-12);
    near(e.health, r.health, msg + " health", 1e-12);
    const attack = r.input.find((a) => a.name === "generic.attackDamage");
    if (L["generic.attackDamage"] !== undefined) near(attackDamage(e, ENTITY_TYPES[e.type].damage ?? attack.base), Math.fround(L["generic.attackDamage"]), msg + " attackDamage");
  }
});

test("native: max health is not capped at 2048, follow range is, knockback stops at 1 and speed at 0; unknown names are dropped", () => {
  for (const r of by("modEffect").filter((x) => x.kind === "clamp")) {
    const L = liveOf(r);
    assert.ok(L["generic.maxHealth"] > 2048, r.id);
    assert.equal(L["generic.followRange"], 2048);
    assert.equal(L["generic.knockbackResistance"], 1);
    assert.equal(L["generic.movementSpeed"], 0);
  }
  for (const r of by("modEffect").filter((x) => x.kind === "unknownName")) {
    assert.ok(r.input.some((a) => a.name === "probe.unknown"));
    assert.ok(!r.attributes.some((a) => a.name === "probe.unknown"), r.id);
  }
});

test("an imported Attributes list survives export and import again with the same live values", () => {
  for (const r of by("modEffect")) {
    const record = javaMobFromNbt(nbtOf(r, r.id), {}), e = load(record);
    const tag = new Map(nbtOf(r, r.id));
    tag.set("Attributes", livingAttributesNbt(e, r.id));
    const again = load(javaMobFromNbt(tag, {})), msg = `${r.id} ${r.kind}`;
    assert.equal(again.followRange, e.followRange, msg);
    assert.equal(again.knockbackResistance, e.knockbackResistance, msg);
    assert.equal(again.maxHealth, e.maxHealth, msg);
    assert.equal(maxHealthOf(again, ENTITY_TYPES[again.type].health), maxHealthOf(e, ENTITY_TYPES[e.type].health), msg);
    assert.equal(aiMoveSpeed(again, 1), aiMoveSpeed(e, 1), msg);
    assert.equal(attackDamage(again, 2), attackDamage(e, 2), msg);
  }
});

// ---- the baby boost ----
test("baby boost: a baby always has it; an adult keeps a saved one (setChild runs only for IsBaby true) and the port moves it at 1.5x", () => {
  for (const r of by("babyBoost")) {
    const speed = r.live.find((a) => a.name === "generic.movementSpeed"), boosted = speed.modifiers.some((m) => m.uuid === BABY_BOOST_UUID);
    assert.equal(boosted, r.isBaby || r.modifier, `${r.id} ${r.isBaby} ${r.modifier}`);
    assert.equal(r.child, r.isBaby);
    const record = javaMobFromNbt(nbtOf(r, r.id), {}), e = load(record), msg = `${r.id} baby ${r.isBaby} saved ${r.modifier}`;
    assert.equal((e.growingAge ?? 0) < 0, r.isBaby, msg);
    near(aiMoveSpeed(e, 1), Math.fround(speed.value), msg); // the pigman's baby boost too since batch 25 (it inherits setChild)
    // Export writes the boost exactly when the native mob carries it.
    const list = livingAttributesNbt(e, r.id).value.items, entry = list.find((a) => a.get("Name").value === "generic.movementSpeed");
    const saved = (entry.get("Modifiers")?.value.items ?? []).filter((m) => m.get("Name").value === "Baby speed boost");
    assert.equal(saved.length, boosted ? 1 : 0, msg);
    if (!r.isBaby) assert.equal(hasStoredBabyBoost(e), r.modifier, msg);
  }
});

// ---- held items ----
test("native: the held item's Weapon/Tool modifier applies live, is never saved, and matches the port's live attack bonus", () => {
  const HELD = new Set(["Weapon modifier", "Tool modifier"]);
  for (const r of by("weapon")) {
    const msg = `${r.id} ${r.item}`;
    assert.equal(r.attributes.flatMap((a) => a.modifiers).filter((m) => HELD.has(m.name)).length, 0, msg);
    for (const a of r.backLive) assert.ok(!a.modifiers.some((m) => HELD.has(m.name)), msg);
    const live = r.live.find((a) => a.name === "generic.attackDamage"), mod = live.modifiers.find((m) => HELD.has(m.name));
    if (mod) assert.equal(mod.uuid, "cb3f55d3-645c-4f38-a497-9c13a33db5cf");
    assert.equal(live.value, live.base + (mod?.amount ?? 0), msg);
    assert.equal(attackBonus([{ id: r.item, count: 1, damage: 0 }]), mod?.amount ?? 0, msg);
    const e = world().create(importedMobType(r.id), 64.5, 1, 64.5);
    assert.equal(attackDamage(e, live.base, attackBonus([{ id: r.item, count: 1, damage: 0 }])), Math.fround(live.value), msg);
  }
  // The port keeps the bonus out of the export.
  const z = world().create("zombie", 64.5, 1, 64.5);
  z.equipment = [{ id: 267, count: 1, damage: 0 }, null, null, null, null];
  const list = livingAttributesNbt(z, "Zombie").value.items;
  assert.ok(!list.some((a) => (a.get("Modifiers")?.value.items ?? []).some((m) => HELD.has(m.get("Name").value))));
});

// ---- legacy owner names ----
test("legacy Owner: single player (an online-mode IntegratedServer with no network) converts a name of 1 to 16 characters to its offline UUID", () => {
  for (const r of by("legacyOwner")) {
    if (r.error) { assert.equal(r.name.trim(), ""); assert.match(r.error, /Name and ID cannot both be blank/); continue; }
    if (r.name.length === 0 || r.name.length > 16) { assert.equal(r.result, r.name, `${r.mode} ${r.name}`); assert.equal(r.lookups, 0); }
  }
  for (const r of by("legacyOwner").filter((x) => x.mode === "singleplayer" && !x.error)) {
    // A profile already in usercache.json wins (keyed in lower case); the port has no such cache.
    if (r.name.toLowerCase() === "cached") { assert.equal(r.result, "00000000-0000-0005-0000-000000000006"); continue; }
    const tag = new Map([["Owner", { type: NBT.STRING, value: r.name }]]);
    assert.equal(ownerFromNbt(tag, "wolf"), r.result, r.name);
    if (r.name.length && r.name.length <= 16) assert.equal(r.result, offlineUuid(r.name), r.name); // the name as written, not lower-cased
  }
  assert.equal(offlineUuid("Player"), by("legacyOwner").find((r) => r.mode === "singleplayer" && r.name === "Player").result);
  // A dedicated offline server builds the profile from the lower-cased name (PlayerProfileCache); an online one stores "" when the lookup fails.
  for (const r of by("legacyOwner").filter((x) => x.mode === "offlineServer" && !x.error && x.name.length && x.name.length <= 16)) assert.equal(r.result, offlineUuid(r.name.toLowerCase()), r.name);
  for (const r of by("legacyOwner").filter((x) => x.mode === "onlineServer" && !x.error && x.name.length && x.name.length <= 16)) assert.equal(r.result, r.name === "Notch" ? "00000000-0000-0007-0000-000000000008" : "", r.name);
});

test("wolf owner keys: Owner converts, OwnerUUID is kept as written (even ' ' or not a UUID) and tames; '' leaves it wild", () => {
  for (const r of by("wolfOwner")) {
    const tag = new Map([[r.key, { type: NBT.STRING, value: r.value }]]);
    assert.equal(ownerFromNbt(tag, "wolf"), r.owner, `${r.key} ${JSON.stringify(r.value)}`);
    assert.equal(ownerFromNbt(tag, "ocelot"), r.owner);
    assert.equal(r.tamed, r.owner.length > 0);
    assert.equal(r.written, r.owner);
    assert.equal(r.maxHealth, r.tamed ? 20 : 8);
  }
  // OwnerUUID wins even when empty: no fallback to Owner.
  const both = new Map([["OwnerUUID", { type: NBT.STRING, value: "" }], ["Owner", { type: NBT.STRING, value: "Player" }]]);
  assert.equal(ownerFromNbt(both, "wolf"), "");
});
