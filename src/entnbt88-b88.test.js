// Batch 88 entnbt88: the Entity base keys of the object entities and mobs (executed, public/research/entnbt88-reference.json from
// tools/probes/Entnbt88Probe.java; bytecode-read sa.<init>, sa.f, sa.e, sa.C, xi.a(DZ)). A /summon in the Nether writes Dimension 0 and Air 0 (readFromNBT
// on the id-only compound) while a constructed entity writes the provider id -1 and Air 300; PortalCooldown loads raw (5000 and -7 kept) on every kind;
// an entity without a UUID tag keeps one random UUID; a mob save keeps Fire, OnGround, FallDistance and Rotation pitch; EntityBoat.updateFallState.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { World, WATER } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { FallingBlocks } from "./falling.js";
import { Hanging } from "./hanging.js";
import { Arrows } from "./bow.js";
import { Projectiles } from "./projectiles.js";
import { JavaRandom } from "./java-random.js";
import { NBT } from "./nbt.js";
import { javaProjectileFromNbt } from "./java-projectiles.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { EntityPortals, entityDeparture } from "./entity-portal.js";
import { keptBaseOf, keptBaseSave, keptBaseRestore, keptBaseImport, tickPortalCooldown, mobBaseSave, mobBaseRestore, entityBaseOf } from "./entity-base-nbt.js";
import { isUuid, uuidLongs } from "./entity-uuid.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/entnbt88-reference.json", import.meta.url), "utf8"));
const Y = 60;
const json = (v) => JSON.parse(JSON.stringify(v));
const t = (type, value) => ({ type, value });
const tagOf = (o) => new Map(Object.entries(o));
// NBTBase.toString forms: "-3.5f", "11s", "1b", "-1", "5L", "[0:40.0f,1:-200.0f,]".
const nativeValue = (s) => (s.startsWith("[") ? [...s.matchAll(/\d+:(-?[0-9.E]+)[fd]?,/g)].map((m) => Number(m[1])) : s.endsWith("L") ? BigInt(s.slice(0, -1)) : Number(s.replace(/[bsfd]$/, "")));

function game(dimension = 0) {
  const world = new World("entnbt88", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1);
  const minecarts = new Minecarts({}), boats = new Boats({}), items = new ItemEntities(), orbs = new ExperienceOrbs([]), falling = new FallingBlocks(world, { drop() {} }, []), hanging = new Hanging(), primed = [];
  const arrows = new Arrows(() => 0.5), projectiles = new Projectiles(() => 0.5), holder = () => ({ serialize: () => [], load() {} });
  const hosts = { items, xpOrbs: orbs, primed, falling, boats, hanging, projectiles, arrows, eyes: { serialize: () => ({ random: 0, eyes: [] }), load() {} },
    mobs: { potions: holder(), fireballs: holder(), skulls: holder() }, dimension };
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 0.5, y: Y, z: 0.5 }), changed() {}, refreshInventory() {},
    stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {}, minecarts: () => minecarts, entityHosts: () => hosts, rockets: () => ({ rockets: [] }) };
  const host = createCommandHost(env); host.print = () => {};
  const runner = createCommandRunner(host);
  return { world, mobs, minecarts, boats, items, orbs, hanging, arrows, projectiles, run(s) { runner.run(s); } };
}

async function exportChunk(state, dims = {}) {
  const { exportJavaSave } = await import("./region-export.js");
  const { regionSlot, readRegion, decodeRegionChunk, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files } = await exportJavaSave({ id: "e88", name: "E88", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, ...state, dimensions: dims }, { world: w });
  const read = async (prefix, cx, cz, hasSky = true) => { const a = regionAddress(cx, cz), file = files.get(`${prefix}region/r.${a.regionX}.${a.regionZ}.mca`), slot = file && readRegion(file).get(regionSlot(a.x, a.z)); if (!slot) return []; return chunkFromNbt(await decodeRegionChunk(slot), { hasSky }).entities ?? []; };
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16;
  return { overworld: await read("", cx, cz), nether: Object.keys(dims).length ? await read("DIM-1/", -1, -1, false) : [] };
}
const find = (list, id) => list.filter((n) => n.get("id").value === id);
const at = (rec, x) => ({ ...rec, x, y: 101, z: x, ...(rec.posY !== undefined ? { posY: 101 } : {}), ...(rec.tx !== undefined ? { tx: Math.floor(x), ty: 101, tz: Math.floor(x) - 1 } : {}) });
const uuidOfNbt = (n) => [n.get("UUIDMost").value, n.get("UUIDLeast").value];

test("executed: a /summon in the Nether writes Dimension 0 and Air 0; a constructed entity the provider id -1 and Air 300", async () => {
  const nat = Object.fromEntries(ref.nether.map(([name, tag, nbt]) => [`${name} ${tag}`, nbt]));
  for (const k of ["Pig null", "Pig {}", "Zombie null", "XPOrb {Value:3s}", "Boat null", "MinecartRideable null", "Arrow null", "Snowball null", "PrimedTnt null"])
    assert.deepEqual([nat[k].Dimension, nat[k].Air, nat[k].PortalCooldown], ["0", "0s", "0"], k);
  assert.equal(nat["Pig {Dimension:1}"].Dimension, "1");
  for (const n of ["Pig", "Item", "Boat", "Arrow"]) assert.deepEqual([nat[`new:${n} null`].Dimension, nat[`new:${n} null`].Air], ["-1", "300s"], n);

  const g = game(-1);
  g.run(`/summon Item 0.5 ${Y} 0.5 {Item:{id:1s,Count:1b,Damage:0s}}`);
  g.run(`/summon XPOrb 0.5 ${Y} 0.5 {Value:3s}`);
  g.run(`/summon Boat 0.5 ${Y} 0.5`);
  g.run(`/summon Arrow 0.5 ${Y} 0.5`);
  g.run(`/summon Snowball 0.5 ${Y} 0.5`);
  g.run(`/summon Pig 0.5 ${Y} 0.5`);
  g.run(`/summon Pig 0.5 ${Y} 0.5 {Dimension:1}`);
  g.items.spawn({ id: 1, count: 1 }, 0.5, Y, 0.5); // a dropped item: the plain constructor, no readFromNBT
  const drops = json(g.items.serialize()), orbs = json(g.orbs.serialize()), boats = json(g.boats.toJSON()), arrows = json(g.arrows.serialize()), balls = json(g.projectiles.serialize()), mobs = json(g.mobs.serialize());
  assert.equal(drops.length, 2);
  for (const r of [...drops, ...orbs, ...boats, ...arrows, ...balls]) assert.ok(isUuid(r.uuid), "every saved object entity has its UUID");
  assert.notEqual(drops[0].uuid, drops[1].uuid); // two items at one position: no position-derived UUID
  const pigs = mobs.filter((m) => m.type === "pig");
  const state = { drops: drops.map((d, i) => at(d, -2.5 - i)), xpOrbs: orbs.map((o) => at(o, -4.5)), boats: boats.map((b) => at(b, -5.5)), arrows: arrows.map((a) => at(a, -6.5)), projectiles: balls.map((b) => at(b, -7.5)), entities: pigs.map((m, i) => at(m, -8.5 - i)) };
  const { nether } = await exportChunk({}, { [-1]: { edits: [], state } });
  const dimAir = (n) => [n.get("Dimension").value, n.get("Air").value, n.get("PortalCooldown").value];
  const items = find(nether, "Item").sort((a, b) => b.get("Pos").value.items[0] - a.get("Pos").value.items[0]);
  assert.deepEqual(dimAir(items[0]), [0, 0, 0], "summoned Item");
  assert.deepEqual(dimAir(items[1]), [-1, 300, 0], "dropped Item (new:Item)");
  for (const id of ["XPOrb", "Boat", "Arrow", "Snowball"]) assert.deepEqual(dimAir(find(nether, id)[0]), [0, 0, 0], id);
  const pigDims = find(nether, "Pig").map((n) => [n.get("Dimension").value, n.get("Air").value]).sort();
  assert.deepEqual(pigDims, [[0, 0], [1, 0]]); // -1 before b88
  // The stored UUID is the exported one, the same on every export (it was derived from the position before b88).
  assert.deepEqual(uuidOfNbt(items[0]), Object.values(uuidLongs(drops[0].uuid)));
  const again = await exportChunk({}, { [-1]: { edits: [], state: { drops: state.drops.map((d) => ({ ...d, x: d.x - 0.25 })) } } });
  assert.deepEqual(uuidOfNbt(find(again.nether, "Item").sort((a, b) => b.get("Pos").value.items[0] - a.get("Pos").value.items[0])[0]), uuidOfNbt(items[0]));
});

test("executed: PortalCooldown loads raw (5000 and -7) on items, orbs, boats, carts, projectiles, hanging entities and mobs; Air stays as read on the non-living kinds", () => {
  for (const [name, tag, , nbt] of ref.ticks) {
    const cd = Number(tag.match(/PortalCooldown:(-?\d+)/)[1]);
    assert.equal(nativeValue(nbt.PortalCooldown), cd, `${name} ${tag}: the non-WorldServer double never counts it down`);
    if (name !== "Pig") assert.equal(nbt.Air, /Air:11s/.test(tag) ? "11s" : "0s", `${name} Air`);
    else assert.equal(nbt.Air, "300s"); // only EntityLivingBase.onEntityUpdate puts 300 back
  }
  const items = new ItemEntities();
  items.load([{ stack: { id: 1, count: 1 }, x: 0.5, y: 10, z: 0.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0, portalCooldown: 5000, air: 11 }, { stack: { id: 1, count: 1 }, x: 0.5, y: 10, z: 0.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0, portalCooldown: -7 }], (s) => s);
  assert.deepEqual(items.items.map((e) => [e.portalCooldown, e.air]), [[5000, 11], [-7, undefined]]); // 300 and dropped before b88
  assert.deepEqual(json(items.serialize()).map((r) => r.portalCooldown), [5000, -7]);
  const orbs = new ExperienceOrbs([{ x: 0.5, y: 10, z: 0.5, value: 3, portalCooldown: 5000, air: 11 }]);
  assert.deepEqual([orbs.orbs[0].portalCooldown, json(orbs.serialize())[0].portalCooldown, json(orbs.serialize())[0].air], [5000, 5000, 11]);
  const boats = Boats.fromJSON([{ x: 0.5, y: 10, z: 0.5, yaw: 0, pitch: 0, portalCooldown: -7, air: 11 }], {});
  assert.deepEqual([boats.carts[0].portalCooldown, boats.carts[0].air], [-7, 11]);
  const carts = Minecarts.fromJSON({ version: 1, carts: [{ type: "rideable", x: 0.5, y: 10, z: 0.5, yaw: 0, pitch: 0, portalCooldown: 5000, air: 11 }] }, {});
  assert.deepEqual([carts.carts[0].portalCooldown, carts.carts[0].air, carts.toJSON().carts[0].portalCooldown], [5000, 11, 5000]);
  // The mob's restore kept 1..300 before b88.
  const w = new World("entnbt88", "meadow", 1), mobs = new EntityWorld(w, []);
  const pig = mobs.restore({ type: "pig", x: 8.5, y: 70, z: 8.5, health: 10, portalCooldown: 5000 }), cold = mobs.restore({ type: "pig", x: 8.5, y: 70, z: 8.5, health: 10, portalCooldown: -7 });
  assert.deepEqual([pig.portalCooldown, cold.portalCooldown], [5000, -7]);
  // The portal walk's timeUntilPortal: sa.C's `if (am > 0) --am` counts 5000 down and leaves -7 alone.
  const portals = new EntityPortals();
  portals.step(pig, "mob", { dim: 0, getId: () => 0 });
  portals.step(cold, "mob", { dim: 0, getId: () => 0 });
  assert.deepEqual([pig.portalCooldown, cold.portalCooldown], [4999, -7]);
  const arrow = { portalCooldown: 2 };
  tickPortalCooldown(arrow); tickPortalCooldown(arrow); tickPortalCooldown(arrow);
  assert.equal(arrow.portalCooldown, undefined);
});

test("a departing entity's record loses its read Dimension: travelToDimension sets Entity.dimension to the destination", () => {
  const owner = { serializeOne: (e) => ({ ...e }) }, portals = new EntityPortals();
  const { rec } = entityDeparture(portals, "item", { x: 0.5, y: 10, z: 0.5, nbtDimension: 0, portalCooldown: 0 }, { arg: -1, endPortal: false, direction: 0 }, owner);
  assert.equal(rec.nbtDimension, undefined);
  assert.equal(rec.portalCooldown, 300);
});

test("executed: a mob save keeps Fire, OnGround, FallDistance and Rotation pitch, and the export writes them", async () => {
  const w = new World("entnbt88", "meadow", 1), mobs = new EntityWorld(w, []);
  const pig = mobs.restore({ type: "pig", x: 8.5, y: 70, z: 8.5, health: 10 });
  Object.assign(pig, { fire: -20, onGround: true, fallDistance: Math.fround(-2), rotationPitch: 25, prevRotationPitch: 25 });
  const saved = json(mobs.serializeOne(pig));
  assert.deepEqual([saved.fire, saved.onGround, saved.fallDistance, saved.rotationPitch], [-20, true, -2, 25]); // all dropped before b88
  const back = mobs.restore(saved);
  assert.deepEqual([back.fire, back.onGround, back.fallDistance, back.rotationPitch, back.prevRotationPitch], [-20, true, -2, 25, 25]);
  // Defaults are left out, so older records keep their shape.
  assert.deepEqual(mobBaseSave({ fire: 0, onGround: false, fallDistance: 0, rotationPitch: 0 }), {});
  assert.deepEqual(mobBaseRestore({}), {});
  const { overworld } = await exportChunk({ entities: [at(saved, -3.5)] });
  const n = find(overworld, "Pig")[0];
  assert.deepEqual([n.get("Fire").value, n.get("OnGround").value, n.get("FallDistance").value, n.get("Rotation").value.items[1]], [-20, 1, -2, 25]);
  // The chunk import reads them back (javaMobFromNbt), with Dimension.
  const rec = javaMobFromNbt(n, {});
  assert.deepEqual([rec.onGround, rec.fallDistance, rec.rotationPitch, rec.nbtDimension], [true, -2, 25, 0]);
  // The executed tick row: one AI update rests Fire at -1, keeps FallDistance -2 and the yaw, and the look helper puts pitch back to 0.
  const row = ref.ticks.find((r) => r[0] === "Pig" && r[1].includes("Rotation"))[3];
  assert.deepEqual([row.Fire, row.FallDistance, row.Rotation], ["-1s", "-2.0f", "[0:10.0f,1:0.0f,]"]);
});

test("executed: projectiles and hanging entities keep Air, UUID, PortalCooldown and Dimension through the import, the save and the export", async () => {
  const uuid = new Map([["UUIDMost", t(NBT.LONG, 5n)], ["UUIDLeast", t(NBT.LONG, 6n)]]);
  const arrowTag = tagOf({ id: t(NBT.STRING, "Arrow"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [0.5, 70, 0.5] }), Motion: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [0, 0, 0] }),
    PortalCooldown: t(NBT.INT, 9), Air: t(NBT.SHORT, 11), Dimension: t(NBT.INT, -1), ...Object.fromEntries(uuid) });
  const made = javaProjectileFromNbt(arrowTag, {});
  assert.deepEqual([made.record.portalCooldown, made.record.air, made.record.nbtDimension, made.record.uuid], [9, 11, -1, "00000000-0000-0005-0000-000000000006"]);
  const arrows = new Arrows(() => 0.5);
  arrows.load([made.record]);
  const savedArrow = json(arrows.serialize())[0];
  assert.deepEqual([savedArrow.portalCooldown, savedArrow.air, savedArrow.nbtDimension, savedArrow.uuid], [9, 11, -1, made.record.uuid]);
  const snowTag = new Map(arrowTag); snowTag.set("id", t(NBT.STRING, "Snowball"));
  const snow = javaProjectileFromNbt(snowTag, {}).record, balls = new Projectiles(() => 0.5);
  balls.load([snow]);
  const savedBall = json(balls.serialize())[0];
  assert.deepEqual([savedBall.portalCooldown, savedBall.air, savedBall.nbtDimension], [9, 11, -1]);
  // A painting: EntityHanging.onUpdate never calls onEntityUpdate, so PortalCooldown is only kept (the executed tick row writes 9 after 2 updates).
  const hanging = new Hanging();
  hanging.load([{ kind: "painting", dir: 0, tx: 0, ty: 64, tz: 0, x: 0.5, y: 64.5, z: 0.0625, art: "Kebab", portalCooldown: 9, air: 11, nbtDimension: -1, uuid: made.record.uuid }]);
  const savedPainting = json(hanging.toJSON())[0];
  assert.deepEqual([savedPainting.portalCooldown, savedPainting.air, savedPainting.nbtDimension, savedPainting.uuid], [9, 11, -1, made.record.uuid]);
  const { overworld } = await exportChunk({ arrows: [at(savedArrow, -3.5)], projectiles: [at(savedBall, -4.5)], hanging: [at(savedPainting, -6.5)] });
  for (const id of ["Arrow", "Snowball", "Painting"]) {
    const n = find(overworld, id)[0];
    assert.deepEqual([n.get("PortalCooldown").value, n.get("Air").value, n.get("Dimension").value], [9, 11, -1], id); // 0, 300 and the region's 0 before b88
  }
  assert.deepEqual(uuidOfNbt(find(overworld, "Arrow")[0]), [5n, 6n]);
  // A natural (unsummoned) painting has no stored keys: Air 300 and the region's dimension, as the constructor's.
  const fresh = new Hanging();
  fresh.load([{ kind: "painting", dir: 0, tx: 0, ty: 64, tz: 0, x: 0.5, y: 64.5, z: 0.0625, art: "Kebab" }]);
  const plain = json(fresh.toJSON())[0];
  assert.ok(isUuid(plain.uuid));
  assert.equal(plain.air, undefined);
});

test("keptBaseOf is readFromNBT on the kept keys: an id-only tag reads Air 0, Dimension 0, PortalCooldown 0 and keeps a random UUID", () => {
  const bare = keptBaseOf(new Map());
  assert.deepEqual([bare.air, bare.nbtDimension, bare.portalCooldown], [0, 0, 0]);
  assert.ok(isUuid(bare.uuid));
  assert.notEqual(keptBaseOf(new Map()).uuid, bare.uuid);
  assert.ok(isUuid(entityBaseOf(new Map()).uuid)); // TNT and falling blocks too
  const read = keptBaseOf(tagOf({ Air: t(NBT.SHORT, 11), PortalCooldown: t(NBT.INT, -7), Dimension: t(NBT.INT, 1), UUIDMost: t(NBT.LONG, 5n), UUIDLeast: t(NBT.LONG, 6n) }));
  assert.deepEqual(read, { air: 11, uuid: "00000000-0000-0005-0000-000000000006", portalCooldown: -7, nbtDimension: 1 });
  assert.deepEqual(keptBaseRestore(json(keptBaseSave(read))), read);
  assert.deepEqual(keptBaseImport(new Map()), { air: 0, nbtDimension: 0 }); // the UUID is drawn on the first save
});

test("executed: EntityBoat.updateFallState (xi.a(DZ)) in boats.js matches the probe rows", () => {
  const boats = new Boats({});
  const WATER_ID = WATER; // the port id of still water (9 natively)
  const world = (water) => ({ get: (x, y, z) => (water && x === 0 && y === 68 && z === 0 ? WATER_ID : 0) });
  for (const [name, tag, where, dy, nbt, dead] of ref.fall) {
    if (name !== "Boat") continue;
    const fd = Math.fround(Number(tag.match(/FallDistance:(-?[0-9.]+)f/)[1]));
    const boat = { x: 0.5, posY: where === "water" ? 69.25 : where === "ground" ? Math.fround(0.3) : 70, z: 0.5, fallDistance: fd, dead: false };
    boats.drops = [];
    boats.updateFallState(world(where === "water"), boat, dy, where === "ground");
    assert.equal(boat.fallDistance, nativeValue(nbt.FallDistance), `${tag} ${where}`);
    assert.equal(boat.dead, dead, `${tag} ${where} dead`);
  }
});
