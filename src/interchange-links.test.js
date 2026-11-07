// Batch 21 interchange: owner and leash links and the Attributes list of every living class in Java region export/import. Replays
// public/research/interchange-links-reference.json (tools/probes/InterchangeLinkProbe.java, run natively against the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeNbt, NBT } from "./nbt.js";
import { decodeCompressedNbt } from "./nbt-compression.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { exportJavaSave } from "./region-export.js";
import { importJavaRegionArea } from "./region-import.js";
import { readLevelData } from "./level-dat.js";
import { readRegion, decodeRegionChunk } from "./region-file.js";
import { chunkFromNbt } from "./chunk-nbt.js";
import { javaMobFromNbt, JAVA_MOBS, JAVA_SUMMON_MOBS } from "./java-mobs.js";
import { livingAttributes, livingAttributesNbt, JAVA_ATTRIBUTE_BASES, BABY_BOOST } from "./mob-attribute-list.js";
import { ownerFromNbt, relinkMobs, exportPlayerUuid } from "./owner-links.js";
import { offlineUuid } from "./stats.js";
import { uuidLongs, newUuid } from "./entity-uuid.js";
import { EntityWorld } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/interchange-links-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const nbtOf = (r) => decodeNbt(Uint8Array.from(Buffer.from(r.nbt, "hex"))).tag.value;
const PLAYER = "00000000-0000-0001-0000-000000000002"; // the probe player's UUID (new UUID(1, 2))
const TYPE_OF = { ...JAVA_MOBS, ...JAVA_SUMMON_MOBS };

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { owner: 6, ownerRead: 9, leashWrite: 4, notLiving: 26, attrs: 29, attrsError: 2, attrVariant: 49 });
  assert.equal(ref.records.length, 125);
  for (const c of ["tg", "wv", "wi", "sw", "sv", "nz", "sg", "tj", "yq"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(by("attrsError").map((r) => r.id).sort(), ["Mob", "Monster"]); // the two abstract EntityList names
});

// ---- owner ----
test("native owner NBT: OwnerUUID is a String holding the UUID text, no Owner key, empty when wild", () => {
  for (const r of by("owner")) {
    assert.equal(r.keys.OwnerUUID, NBT.STRING, r.kind);
    assert.equal(r.keys.Owner, undefined);
    assert.equal(r.ownerUUID, r.tamed ? PLAYER : "", r.kind);
    assert.equal(r.nbt, r.rewrite, `${r.kind} re-writes the same bytes`);
  }
});
test("owner read rules: OwnerUUID when the key exists, the legacy Owner name only for tameables", () => {
  const read = (kind, entity) => by("ownerRead").find((r) => r.kind === kind && r.entity === entity);
  const tag = (o) => new Map(Object.entries(o).map(([k, v]) => [k, { type: NBT.STRING, value: v }]));
  assert.equal(ownerFromNbt(tag({ OwnerUUID: PLAYER }), "wolf"), read("uuid", "Wolf").result.owner);
  assert.equal(ownerFromNbt(tag({ OwnerUUID: PLAYER, Owner: "Player" }), "wolf"), read("both", "Wolf").result.owner);
  assert.equal(ownerFromNbt(tag({ OwnerUUID: "" }), "wolf"), "");
  assert.equal(read("empty", "Wolf").result.owner, "");
  assert.equal(ownerFromNbt(tag({ Owner: "A-name-longer-than-sixteen-chars" }), "wolf"), read("legacyNameLong", "Wolf").result.owner);
  assert.equal(ownerFromNbt(tag({ OwnerUUID: PLAYER }), "ocelot"), read("uuid", "Ozelot").result.owner);
  assert.equal(ownerFromNbt(tag({ OwnerUUID: PLAYER }), "horse"), read("uuid", "EntityHorse").result.owner);
  assert.equal(ownerFromNbt(tag({ Owner: "Player" }), "horse"), read("legacyName", "EntityHorse").result.owner); // a horse has no legacy path
  // Bytecode-read, not probed (nz.a needs a MinecraftServer): a short legacy name becomes the offline-mode UUID of that name.
  assert.equal(read("legacyName", "Wolf").result, null);
  assert.equal(ownerFromNbt(tag({ Owner: "Player" }), "wolf"), offlineUuid("Player"));
});

// ---- leash ----
test("native leash NBT: a player holder writes UUIDMost/UUIDLeast, a knot X/Y/Z, on every EntityLiving", () => {
  for (const r of by("leashWrite")) {
    assert.deepEqual(r.playerKeys, { UUIDLeast: NBT.LONG, UUIDMost: NBT.LONG });
    assert.deepEqual([r.most, r.least], [1, 2]);
    assert.deepEqual(r.knotKeys, { X: NBT.INT, Y: NBT.INT, Z: NBT.INT });
    assert.deepEqual([r.x, r.y, r.z], [5, 0, 0]);
  }
});

// ---- the shared export harness ----
async function exported(entities, extra = {}) {
  const w = new World("17", "javaStreamed", 12);
  w.restore([]);
  const record = { id: "x", name: "X", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player: new Survival({}, "survival").serialize(), position: { x: 3.5, y: 70.4, z: 5.5, yaw: 0, pitch: 0 }, entities, ...extra };
  const { files } = await exportJavaSave(record, { world: w });
  const data = (await decodeCompressedNbt(files.get("level.dat"))).tag.value.get("Data").value;
  const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
  const compounds = [];
  for (const { bytes } of regions) for (const entry of readRegion(bytes).values()) compounds.push(...chunkFromNbt(await decodeRegionChunk(entry)).entities);
  return { data, regions, compounds, files };
}
const mob = (type, extra = {}) => ({ id: "mob-1", type, x: 3.5, y: 70, z: 5.5, health: 10, yaw: 0, uuid: newUuid(), ...extra });
const byId = (compounds, id) => compounds.filter((c) => c.get("id").value === id);
const importBack = async (x) => (await importJavaRegionArea(x.regions, { level: readLevelData(x.data), area: undefined })).record;
const uuidOfTag = (compound) => { const { most, least } = uuidLongs(PLAYER); return [most, least]; };

test("export: owners and leads point at the exported Player UUID, which equals level.dat's", async () => {
  const entities = [mob("wolf", { owner: "player", sitting: true }), mob("ocelot", { owner: "player", catType: 2 }), mob("wolf", { owner: "" }),
    mob("pig", { leash: { holder: "player" } }), mob("cow", { leash: { knot: { x: 5, y: 70, z: 6 } } }),
    mob("horse", { health: 20, horse: { type: 0, variant: 0, temper: 10, tame: true, owner: "player", maxHealth: 22, speed: 0.25, jump: 0.8 } })];
  const { data, compounds } = await exported(entities, { playerUuid: PLAYER });
  const player = data.get("Player").value;
  assert.deepEqual([player.get("UUIDMost").value, player.get("UUIDLeast").value], uuidOfTag());
  const owners = (id) => byId(compounds, id).map((c) => c.get("OwnerUUID").value);
  assert.deepEqual(owners("Wolf").sort(), ["", PLAYER]);
  assert.deepEqual(owners("Ozelot"), [PLAYER]);
  assert.deepEqual(owners("EntityHorse"), [PLAYER]);
  const pig = byId(compounds, "Pig")[0], leash = pig.get("Leash").value;
  assert.deepEqual([leash.get("UUIDMost").value, leash.get("UUIDLeast").value], uuidOfTag());
  assert.equal(pig.get("Leashed").value, 1);
  assert.deepEqual(["X", "Y", "Z"].map((k) => byId(compounds, "Cow")[0].get("Leash").value.get(k).type), [NBT.INT, NBT.INT, NBT.INT]);
});
test("export: without an imported UUID the Player and the links use the offline-mode UUID of Player (as stats/<uuid>.json)", async () => {
  const { data, compounds, files } = await exported([mob("wolf", { owner: "player" })]);
  const want = offlineUuid("Player");
  assert.equal(exportPlayerUuid({}), want);
  assert.equal(byId(compounds, "Wolf")[0].get("OwnerUUID").value, want);
  const { most, least } = uuidLongs(want);
  assert.deepEqual([data.get("Player").value.get("UUIDMost").value, data.get("Player").value.get("UUIDLeast").value], [most, least]);
  assert.ok([...files.keys()].includes(`stats/${want}.json`));
});

test("import: a foreign owner string is kept and written back; the player's own needs no stored string", async () => {
  const foreign = "11111111-2222-4333-8444-555555555555";
  const { data, regions } = await exported([mob("wolf", { owner: "player", ownerUuid: foreign }), mob("ocelot", { owner: "player" })], { playerUuid: PLAYER });
  const record = await importBack({ data, regions });
  const wolf = record.entities.find((e) => e.type === "wolf"), cat = record.entities.find((e) => e.type === "ocelot");
  assert.equal(wolf.owner, "player");
  assert.equal(wolf.ownerUuid, foreign);
  assert.equal(cat.owner, "player");
  assert.equal(cat.ownerUuid, undefined, "the player's own UUID is re-linked, not stored");
  assert.equal(record.playerUuid, PLAYER);
});
test("import: a lead held by another UUID is dropped when the player's UUID is known (native playerWrongUuid), the player's own is kept", () => {
  const mobs = [{ type: "pig", leash: { holder: "player", holderUuid: PLAYER } }, { type: "cow", leash: { holder: "player", holderUuid: "9".repeat(8) + "-0000-4000-8000-000000000000" } }, { type: "sheep", leash: { knot: { x: 1, y: 2, z: 3 } } }];
  assert.equal(relinkMobs(mobs, PLAYER), 1);
  assert.deepEqual(mobs[0].leash, { holder: "player" });
  assert.equal(mobs[1].leash, undefined);
  assert.deepEqual(mobs[2].leash, { knot: { x: 1, y: 2, z: 3 } });
});

// ---- attributes ----
const sameList = (got, want, label, { approx = false } = {}) => {
  assert.deepEqual(got.map((a) => a.name), want.map((a) => a.name), `${label} order`);
  got.forEach((a, i) => {
    const w = want[i];
    assert.equal(a.base, w.base, `${label} ${a.name} base`);
    assert.equal(a.modifiers.length, w.modifiers.length, `${label} ${a.name} modifier count`);
    a.modifiers.forEach((m, k) => {
      assert.equal(m.name, w.modifiers[k].name, label);
      assert.equal(m.operation, w.modifiers[k].operation, label);
      if (approx) assert.ok(Math.abs(m.amount - w.modifiers[k].amount) < 1e-12, `${label} amount ${m.amount} vs ${w.modifiers[k].amount}`);
      else assert.equal(m.amount, w.modifiers[k].amount, label);
      if (!approx) assert.equal(m.uuid, w.modifiers[k].uuid, label);
    });
  });
};
// Native record -> imported browser record -> the list the exporter would write: must equal the native list.
const roundList = (r) => {
  const tag = nbtOf(r), record = javaMobFromNbt(tag, {});
  assert.ok(record, r.id);
  return { record, list: livingAttributes(record, r.id) };
};
const nativeList = (r) => r.attributes.map((a) => ({ name: a.name, base: a.base, modifiers: a.modifiers.map((m) => ({ ...m, uuid: undefined })) }));
const fromLive = (r) => r.live.filter((a) => r.attributes.some((n) => n.name === a.name));

test("native: every constructible living class writes the same four-to-six entry list, in this order", () => {
  const orders = new Set(by("attrs").map((r) => r.attributes.map((a) => a.name).join()));
  assert.equal(orders.size, 4);
  for (const r of by("attrs")) assert.equal(r.hasAttributes, true);
  assert.equal(by("attrs").length, Object.keys(JAVA_ATTRIBUTE_BASES).length);
});
for (const r of by("attrs")) test(`attributes ${r.id}: the exporter writes the native list`, () => {
  const { record, list } = roundList(r);
  assert.ok(TYPE_OF[r.id], r.id);
  const want = nativeList(r);
  // Defaults the probe's constructor leaves out: a Slime/LavaSlime size, the zombie reinforcement roll (random per instance).
  sameList(list.map((a) => ({ ...a, modifiers: a.modifiers.map((m) => ({ ...m, uuid: undefined })) })), want.map((w) => ({ ...w })), r.id);
  assert.equal(record.attributeBases, undefined, `${r.id}: a default list needs no stored override`);
  assert.equal(r.stable, true, `${r.id}: native write, read, write is stable`);
});
for (const r of by("attrVariant")) test(`attribute variant ${r.kind}: native list replays through import and export`, () => {
  const { record, list } = roundList(r);
  const want = nativeList(r);
  const horse = r.id === "EntityHorse";
  sameList(list.map((a) => ({ ...a, modifiers: a.modifiers.map((m) => ({ ...m, uuid: undefined })) })), want, r.kind, { approx: horse });
  if (r.kind.startsWith("baby")) assert.ok(record.growingAge < 0, "the baby boost is the flag");
  if (r.kind.startsWith("baby")) assert.equal((record.modifiers ?? []).some((m) => m.name === BABY_BOOST.name), false);
  assert.equal(r.stable, true);
  // The modifier UUID of the baby boost is native (probed, `live` list).
  if (r.kind === "babyZombie") assert.equal(fromLive(r).find((a) => a.name === "generic.movementSpeed").modifiers[0].uuid, BABY_BOOST.uuid);
});
test("native: potion effect modifiers are not saved (AttributeModifier.isSaved is false), so effects add nothing to the list", () => {
  const effects = by("attrVariant").filter((r) => /Effect|Speed|Slow|Strength/.test(r.kind) && !r.kind.startsWith("baby"));
  assert.ok(effects.length >= 14);
  for (const r of effects) assert.equal(r.attributes.some((a) => a.modifiers.length), false, r.kind);
});
test("horse list: rolled health, speed and jump with the follow range spawn bonus, as the native horse writes them", () => {
  for (const r of by("attrVariant").filter((x) => x.id === "EntityHorse")) {
    const { record } = roundList(r);
    const h = record.horse, a = Object.fromEntries(r.attributes.map((x) => [x.name, x]));
    assert.equal(h.maxHealth, a["generic.maxHealth"].base);
    assert.equal(h.speed, a["generic.movementSpeed"].base);
    assert.equal(h.jump, a["horse.jumpStrength"].base);
    assert.equal(record.modifiers[0].name, "Random spawn bonus");
    assert.equal(record.followRange, 16 * (1 + a["generic.followRange"].modifiers[0].amount));
  }
});
test("slimes: maxHealth is size squared; a tamed wolf writes 20; an unknown base survives import and export", () => {
  assert.equal(livingAttributes({ type: "slime", size: 4 }, "Slime")[0].base, 16);
  assert.equal(livingAttributes({ type: "magma_cube", size: 2 }, "LavaSlime")[0].base, 4);
  assert.equal(livingAttributes({ type: "wolf", owner: "player" }, "Wolf")[0].base, 20);
  assert.equal(livingAttributes({ type: "wolf", owner: "" }, "Wolf")[0].base, 8);
  const pig = by("attrs").find((r) => r.id === "Pig"), tag = nbtOf(pig);
  tag.get("Attributes").value.items[0].set("Base", { type: NBT.DOUBLE, value: 25 });
  tag.get("Attributes").value.items[2].set("Base", { type: NBT.DOUBLE, value: 0.3125 });
  const record = javaMobFromNbt(tag, {});
  assert.deepEqual(record.attributeBases, { "generic.maxHealth": 25, "generic.movementSpeed": 0.3125 });
  const again = livingAttributesNbt(record, "Pig").value.items.map((a) => [a.get("Name").value, a.get("Base").value]);
  assert.deepEqual(again.slice(0, 3), [["generic.maxHealth", 25], ["generic.knockbackResistance", 0], ["generic.movementSpeed", 0.3125]]);
});
test("import applies follow range, knockback resistance and leader health from the saved modifiers", () => {
  const zombie = by("attrs").find((r) => r.id === "Zombie"), tag = nbtOf(zombie);
  const list = tag.get("Attributes").value.items;
  const mod = (name, amount, operation) => new Map([["Name", { type: NBT.STRING, value: name }], ["Amount", { type: NBT.DOUBLE, value: amount }], ["Operation", { type: NBT.INT, value: operation }], ["UUIDMost", { type: NBT.LONG, value: 5n }], ["UUIDLeast", { type: NBT.LONG, value: BigInt(operation) }]]);
  const withMods = (i, ...mods) => list[i].set("Modifiers", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: mods } });
  withMods(0, mod("Leader zombie bonus", 1.5, 2));
  withMods(1, mod("Random spawn bonus", 0.03, 0));
  withMods(3, mod("Random spawn bonus", 0.1, 1));
  const record = javaMobFromNbt(tag, {});
  assert.equal(record.maxHealth, 50);
  assert.equal(record.knockbackResistance, 0.03);
  assert.ok(Math.abs(record.followRange - 44) < 1e-9);
  assert.equal(record.modifiers.length, 3);
  const live = new EntityWorld({ size: 128, height: 256 }, [{ ...record, x: 64.5, y: 1, z: 64.5 }], () => 0.5).entities[0];
  assert.equal(live?.knockbackResistance, 0.03);
  assert.ok(Math.abs(live?.followRange - 44) < 1e-9);
});

// ---- export -> import -> export ----
test("round trip: export, import, export again keeps every link and attribute list byte for byte", async () => {
  const foreign = "11111111-2222-4333-8444-555555555555";
  const slime = mob("slime", { size: 4, health: 16 });
  const entities = [
    mob("wolf", { owner: "player", sitting: true, health: 20, collar: 3, leash: { holder: "player" } }),
    mob("wolf", { owner: "player", ownerUuid: foreign, health: 20 }),
    mob("wolf", { owner: "", health: 8 }),
    mob("ocelot", { owner: "player", catType: 1 }),
    mob("horse", { health: 22, horse: { type: 0, variant: 1, temper: 20, tame: true, owner: "player", maxHealth: 22, speed: 0.2578, jump: 0.9648, saddled: false, armor: 0 }, followRange: 16.5 }),
    mob("pig", { leash: { knot: { x: 5, y: 70, z: 6 } } }),
    mob("zombie", { health: 20, growingAge: -1, reinforcement: 0.05, knockbackResistance: 0.02, followRange: 41 }),
    mob("pigman", { health: 20, growingAge: -1 }),
    mob("zombie", { health: 34, maxHealth: 34, modifiers: [{ attribute: "generic.maxHealth", name: "Leader zombie bonus", amount: 0.7, operation: 2, uuid: newUuid() }] }),
    slime, mob("cow"), mob("villager", { health: 20 }), mob("creeper", { health: 20 }), mob("spider", { health: 16 }), mob("enderman", { health: 40 }),
  ];
  const first = await exported(entities, { playerUuid: PLAYER });
  const record = await importBack(first);
  assert.equal(record.entities.length, entities.length);
  const second = await exported(record.entities, { playerUuid: record.playerUuid });
  const keyed = (compounds) => compounds.map((c) => c).sort((a, b) => (a.get("UUIDMost").value < b.get("UUIDMost").value ? -1 : a.get("UUIDMost").value > b.get("UUIDMost").value ? 1 : 0));
  const a = keyed(first.compounds), b = keyed(second.compounds);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    for (const key of ["OwnerUUID", "Leashed", "Leash", "Attributes", "UUIDMost", "UUIDLeast", "Sitting", "Tame"]) assert.deepEqual(a[i].get(key), b[i].get(key), `${a[i].get("id").value} ${key}`);
  }
  // every exported living mob carries a list (the cow, pig, wolf, ... all now do, not only zombie and horse)
  for (const c of a) assert.ok(c.get("Attributes")?.value.items.length >= 4, c.get("id").value);
  // the third export is the same bytes as the second (the record itself is a fixed point)
  const third = await exported((await importBack(second)).entities, { playerUuid: record.playerUuid });
  assert.deepEqual(keyed(third.compounds).map((c) => c.get("Attributes")), b.map((c) => c.get("Attributes")));
});
