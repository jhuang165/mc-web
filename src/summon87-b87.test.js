// Batch 87 summon87: Entity.readFromNBT/writeToNBT keys through /summon, the browser save, the Java export and the import (executed,
// public/research/summon87-reference.json from tools/probes/Summon87Probe.java): primed TNT and falling blocks keep Invulnerable, OnGround, a raw (negative)
// FallDistance, Air, Rotation, PortalCooldown, Dimension and UUID; an item keeps a negative Age and ages up from it; a summoned mob's head yaw is the
// EntityLivingBase constructor's random roll with renderYawOffset 0, whatever the Rotation tag says.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld, moveEntity } from "./entities.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { FallingBlocks } from "./falling.js";
import { Hanging } from "./hanging.js";
import { JavaRandom } from "./java-random.js";
import { NBT } from "./nbt.js";
import { primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { javaObjectFromNbt } from "./java-objects.js";
import { entityBaseOf, entityBaseSave, entityBaseRestore } from "./entity-base-nbt.js";
import { TrackerEntry } from "./entity-tracker.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/summon87-reference.json", import.meta.url), "utf8"));
const Y = 60;
const src = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

function game() {
  const world = new World("summon87", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1);
  const minecarts = new Minecarts({}), boats = new Boats({}), items = new ItemEntities(), orbs = new ExperienceOrbs([]), falling = new FallingBlocks(world, { drop() {} }, []), hanging = new Hanging(), primed = [];
  const holder = () => ({ serialize: () => [], load() {} });
  const hosts = { items, xpOrbs: orbs, primed, falling, boats, hanging, projectiles: holder(), arrows: holder(), eyes: { serialize: () => ({ random: 0, eyes: [] }), load() {} },
    mobs: { potions: holder(), fireballs: holder(), skulls: holder() }, dimension: 0 };
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 0.5, y: Y, z: 0.5 }), changed() {}, refreshInventory() {},
    stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {}, minecarts: () => minecarts, entityHosts: () => hosts, rockets: () => ({ rockets: [] }) };
  const host = createCommandHost(env); host.print = () => {};
  const runner = createCommandRunner(host);
  return { world, mobs, minecarts, boats, items, primed, falling, run(s) { runner.run(s); } };
}
const row = (name, tag) => ref.base.find((r) => r[0] === name && r[1] === tag)?.[2];
const fullTag = (name) => ref.base.find((r) => r[0] === name && r[1]?.includes("Rotation:[400.0f"))[1];
// NBTBase.toString forms: "-3.5f", "11s", "1b", "-1", "5L", "[0:40.0f,1:-200.0f,]".
const listOf = (s) => [...s.matchAll(/\d+:(-?[0-9.E]+)[fd]?,/g)].map((m) => Number(m[1]));
const nativeValue = (s) => (s.startsWith("[") ? listOf(s) : s.endsWith("L") ? BigInt(s.slice(0, -1)) : Number(s.replace(/[bsfd]$/, "")));
const KEYS = ["Rotation", "FallDistance", "Fire", "Air", "OnGround", "Dimension", "Invulnerable", "PortalCooldown", "UUIDMost", "UUIDLeast"];
const written = (n, k) => { const t = n.get(k); return t.type === NBT.LIST ? t.value.items.map(Math.fround) : t.value; };
const sameAsNative = (n, nat, at, keys = KEYS) => { for (const k of keys) assert.deepEqual(written(n, k), nativeValue(nat[k]), `${at}: ${k}`); };

async function exportChunk(state, dims = {}) {
  const { exportJavaSave } = await import("./region-export.js");
  const { regionSlot, readRegion, decodeRegionChunk, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files } = await exportJavaSave({ id: "s87", name: "S87", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, ...state, dimensions: dims }, { world: w });
  const read = async (prefix, cx, cz, hasSky = true) => { const a = regionAddress(cx, cz); return chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`${prefix}region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))), { hasSky }).entities; };
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const reimport = async () => (await (await import("./region-import.js")).importJavaRegionArea([{ filename: `r.${a.regionX}.${a.regionZ}.mca`, bytes: files.get(`region/r.${a.regionX}.${a.regionZ}.mca`) }], { seed: "17", area: { chunkX: cx, chunkZ: cz, width: 1, depth: 1 } })).record;
  return { overworld: await read("", cx, cz), nether: Object.keys(dims).length ? await read("DIM-1/", -1, -1, false) : [], reimport };
}
const find = (list, id) => list.filter((n) => n.get("id").value === id);
// main.js / away-entities.js / server-dispense.js save and load a primed TNT like this (checked against their source below).
const saveTnt = (e) => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse, fire: e.fire | 0, ...entityBaseSave(e) });
const loadTnt = (t) => Object.assign(primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse, random: () => 0 }), { vx: t.vx, vy: t.vy, vz: t.vz, fire: Number.isInteger(t.fire) ? t.fire : 0 }, entityBaseRestore(t));
const at = (rec, x) => ({ ...rec, x, y: 101, z: x });

test("executed: a summoned primed TNT and falling block keep every Entity.writeToNBT key through the save, the export and the import", async () => {
  const g = game(), tntTag = fullTag("PrimedTnt"), sandTag = fullTag("FallingSand");
  g.run(`/summon PrimedTnt 0.5 ${Y} 0.5 ${tntTag}`);
  g.run(`/summon FallingSand 0.5 ${Y} 0.5 ${sandTag}`);
  g.run(`/summon PrimedTnt 0.5 ${Y} 0.5`);
  g.run(`/summon FallingSand 0.5 ${Y} 0.5`);
  assert.equal(g.primed.length, 2);
  assert.equal(g.falling.entities.length, 2); // an id-only FallingSand (block 0) is sand in the port (fallingCellOf); native keeps it too (the untagged row)
  const [tnt, bare] = g.primed.map((e) => loadTnt(JSON.parse(JSON.stringify(saveTnt(e)))));
  const loaded = new FallingBlocks(g.world, { drop() {} }, []);
  for (const s of JSON.parse(JSON.stringify(g.falling.serialize()))) loaded.restoreEntity(s);
  const sand = loaded.entities[0];
  assert.equal(sand.fallDistance, -3.5); // a negative FallDistance is kept (the load clamped it to 0 before b87)
  const fallingRecord = (e) => ({ block: e.block, meta: e.meta, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, ticks: e.ticks, ...entityBaseSave(e), onGround: e.onGround, fallDistance: e.fallDistance, fire: e.fire });
  const first = await exportChunk({ tnt: [at(saveTnt(tnt), -4.5), at(saveTnt(bare), -6.5)], falling: [at(fallingRecord(sand), -8.5)] });
  const [t1, t0] = find(first.overworld, "PrimedTnt").sort((a, b) => a.get("Pos").value.items[0] - b.get("Pos").value.items[0]).reverse();
  sameAsNative(t1, row("PrimedTnt", tntTag), "PrimedTnt");
  sameAsNative(t0, row("PrimedTnt", null), "untagged PrimedTnt", KEYS.filter((k) => !k.startsWith("UUID"))); // Air 0, Dimension 0, Rotation 0 from the id-only compound
  sameAsNative(find(first.overworld, "FallingSand")[0], row("FallingSand", sandTag), "FallingSand");
  // The import reads the same keys back; a second export writes them again.
  const back = [t1, find(first.overworld, "FallingSand")[0]].map((n) => javaObjectFromNbt(n).record);
  assert.equal(back[0].fallDistance, -3.5);
  assert.equal(back[1].fallDistance, -3.5);
  assert.equal(back[1].fire, 7);
  const again = new FallingBlocks(g.world, { drop() {} }, []);
  again.restoreEntity(back[1]);
  const second = await exportChunk({ tnt: [at(saveTnt(loadTnt(back[0])), -4.5)], falling: [at(fallingRecord(again.entities[0]), -8.5)] });
  sameAsNative(find(second.overworld, "PrimedTnt")[0], row("PrimedTnt", tntTag), "PrimedTnt after import");
  sameAsNative(find(second.overworld, "FallingSand")[0], row("FallingSand", sandTag), "FallingSand after import");
});

test("the save, load and export paths of primed TNT and falling blocks use entity-base-nbt.js (source check)", () => {
  for (const file of ["./main.js", "./away-entities.js", "./multiplayer/server-dispense.js"]) {
    const text = src(file);
    assert.match(text, /fire: [et]\.fire \| 0, \.\.\.entityBaseSave\([et]\)/, `${file}: save`);
    assert.match(text, /fire: Number\.isInteger\(t\.fire\) \? t\.fire : 0 \}, entityBaseRestore\(t\)\)/, `${file}: load`);
  }
  assert.match(src("./falling.js"), /\.\.\.entityBaseSave\(e\)/);
  assert.match(src("./falling.js"), /entityBaseRestore\(/);
  assert.match(src("./java-objects.js"), /\.\.\.entityBaseSave\(entityBaseOf\(entity\)\)/);
});

test("Entity.readFromNBT's Rotation is setRotation's yaw % 360 and pitch % 360; an id-only tag reads 0 everywhere (executed rows)", () => {
  const t = (type, value) => ({ type, value }), rot = (a, b) => new Map([["Rotation", t(NBT.LIST, { elementType: NBT.FLOAT, items: [a, b] })]]);
  assert.deepEqual(entityBaseOf(rot(400, -200)).rotation, [40, -200]);
  assert.deepEqual(entityBaseOf(rot(-400, 725)).rotation, [-40, 5]);
  assert.deepEqual(entityBaseOf(new Map([["Rotation", t(NBT.LIST, { elementType: NBT.DOUBLE, items: [90, 0] })]])).rotation, [0, 0]); // getTagList(_, 5): another element type is empty
  const bare = entityBaseOf(new Map());
  assert.deepEqual([bare.air, bare.portalCooldown, bare.nbtDimension, bare.fallDistance, bare.onGround, bare.invulnerable, bare.uuid], [0, 0, 0, 0, false, false, undefined]);
  for (const name of ["PrimedTnt", "FallingSand", "Boat", "XPOrb", "Pig", "EnderCrystal"]) {
    const nat = row(name, null);
    assert.deepEqual([nat.Air, nat.Dimension, nat.PortalCooldown, nat.Rotation], ["0s", "0", "0", "[0:0.0f,1:0.0f,]"], name);
  }
});

test("bytecode-read Entity.updateFallState: a negative fallDistance on the ground is kept, a positive one lands", () => {
  const world = { get: () => 0, solid: () => false, getMeta: () => 0, height: 64 };
  const flat = { get: (x, y) => (y < 10 ? 1 : 0), solid: (x, y) => y < 10, getMeta: () => 0, height: 64 };
  const e = { x: 0.5, y: 10, z: 0.5, vx: 0, vy: -0.1, vz: 0, fallDistance: -3.5 };
  assert.equal(moveEntity(flat, e, 0.98, 0.98, 0, -0.1, 0), 0);
  assert.equal(e.onGround, true);
  assert.equal(e.fallDistance, -3.5);
  const up = { x: 0.5, y: 10, z: 0.5, vx: 0, vy: -0.1, vz: 0, fallDistance: 2 };
  assert.equal(moveEntity(flat, up, 0.98, 0.98, 0, -0.1, 0), 2);
  assert.equal(up.fallDistance, 0);
  const air = { x: 0.5, y: 30, z: 0.5, vx: 0, vy: -0.5, vz: 0, fallDistance: -3.5 };
  moveEntity(world, air, 0.98, 0.98, 0, -0.5, 0);
  assert.equal(air.fallDistance, Math.fround(-3.5 + 0.5));
});

test("executed: an item keeps a negative Age through /summon, the save, the export and the import, and ages up from it", async () => {
  // xk.h (bytecode-read): ++age, then age >= 6000 on the server is setDead. 1.7.10 has no -32768 never-despawn sentinel (that is 1.8).
  const ticks = Object.fromEntries(ref.ticks.map(([, tag, n, nbt, dead]) => [`${tag.match(/Age:(-?\d+)s/)[1]}x${n}`, [nativeValue(nbt.Age), dead]]));
  assert.deepEqual(ticks, { "-32768x1": [-32767, false], "-32768x3": [-32765, false], "-1x1": [0, false], "5999x1": [6000, true], "-32768x40": [-32728, false] });
  const g = game(), item = '{Item:{id:1s,Count:1b,Damage:0s},Age:-32768s}';
  g.run(`/summon Item 0.5 ${Y} 0.5 ${item}`);
  const e = g.items.items.at(-1);
  assert.equal(e.age, -32768); // clamped to 0 before b87
  const open = { get: () => 0, solid: () => false };
  for (let i = 0; i < 3; i++) g.items.tick(open);
  assert.equal(e.age, -32765);
  const restored = new ItemEntities();
  restored.load(JSON.parse(JSON.stringify(g.items.serialize())), (st) => st);
  assert.equal(restored.items[0].age, -32765);
  const { overworld, reimport } = await exportChunk({ drops: [{ stack: { id: 1, count: 1 }, x: -4.5, y: 101, z: -4.5, mx: 0, my: 0, mz: 0, age: -32768, delay: 0 }] });
  assert.equal(find(overworld, "Item")[0].get("Age").value, -32768);
  assert.equal((await reimport()).drops[0].age, -32768); // the region import clamped it to 0 before b87
  const doomed = new ItemEntities();
  doomed.load([{ stack: { id: 1, count: 1 }, x: 0.5, y: 10, z: 0.5, mx: 0, my: 0, mz: 0, age: 5999, delay: 0 }], (st) => st);
  doomed.tick(open);
  assert.equal(doomed.items.length, 0);
});

test("the export writes Dimension from the record (nbtDimension) or the region's dimension, and every kind's PortalCooldown", async () => {
  const boat = { x: -6.5, y: 101, z: -6.5, yaw: 0, pitch: 0, portalCooldown: 7 };
  const { overworld, nether } = await exportChunk({ boats: [boat] }, { [-1]: { edits: [], state: { tnt: [{ x: -5.5, y: 101, z: -5.5, vx: 0, vy: 0, vz: 0, fuse: 80, fire: 0 }, { x: -6.5, y: 101, z: -6.5, vx: 0, vy: 0, vz: 0, fuse: 80, fire: 0, nbtDimension: 0 }], entities: [{ type: "pig", x: -3.5, y: 101, z: -3.5, health: 10 }] } } });
  assert.equal(find(overworld, "Boat")[0].get("PortalCooldown").value, 7); // 0 before b87
  assert.equal(find(overworld, "Boat")[0].get("Dimension").value, 0);
  const tnt = find(nether, "PrimedTnt").map((n) => n.get("Dimension").value).sort();
  assert.deepEqual(tnt, [-1, 0]); // the constructor's provider id; a /summon tag without Dimension leaves 0
  assert.equal(find(nether, "Pig")[0].get("Dimension").value, -1);
});

test("executed: a summoned mob's rotationYawHead is the constructor's random degrees with renderYawOffset and prevRotationYawHead 0", () => {
  const MOBS = { Pig: "pig", Zombie: "zombie", Creeper: "creeper", Spider: "spider", Slime: "slime", Villager: "villager", EntityHorse: "horse", Blaze: "blaze" };
  const real = Math.random;
  try {
    for (const [name, tag, runs, fixed, lo, hi, headLo, headHi, equal] of ref.head) {
      assert.ok(fixed && runs === 300 && equal === 0 && lo >= 0 && hi < 2 * Math.PI && headLo === 0 && headHi === 4, `${name} ${tag}`);
      for (const r of [0, 0.5, 0.999]) {
        Math.random = () => r;
        const g = game();
        g.run(`/summon ${name} 0.5 ${Y} 0.5${tag ? " " + tag : ""}`);
        const e = g.mobs.entities.at(-1);
        assert.equal(e.type, MOBS[name]);
        const got = [e.rotationYaw, e.prevRotationYaw, e.rotationPitch, e.prevRotationPitch, e.renderYawOffset, e.prevRenderYawOffset, e.prevRotationYawHead];
        assert.deepEqual(got, fixed, `${name} ${tag}`);
        assert.equal(e.rotationYawHead, Math.fround(r * 3.1415927410125732 * 2.0), `${name} ${tag} head`);
        // EntityTrackerEntry's lastHeadMotion (my.i): floor(head * 256 / 360), 0 to 4 for any roll (the S0F head byte and the S19 baseline).
        const entry = new TrackerEntry(e, { range: 80 }, { player: null, watches: () => false });
        assert.ok(entry.lastHead >= headLo && entry.lastHead <= headHi, `${name} ${tag} lastHead ${entry.lastHead}`);
      }
    }
  } finally { Math.random = real; }
});
