// Batch 86 summon86: CommandSummon's onSpawnWithEgg order (executed, public/research/summon86-reference.json from tools/probes/Summon86Probe.java) and the save/load
// round-trip of the Entity.readFromNBT/writeToNBT keys /summon sets (Invulnerable on every kind; an item's and an orb's Health; an orb's Age; an item's Owner/Thrower).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCommandRunner } from "./commands.js";
import { createCommandHost } from "./command-host.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { FallingBlocks } from "./falling.js";
import { Hanging } from "./hanging.js";
import { JavaRandom } from "./java-random.js";
import { NBT } from "./nbt.js";
import { javaObjectFromNbt } from "./java-objects.js";
import { boatFromNbt, cartFromNbt, hangingFromNbt } from "./region-import.js";
import { javaMobFromNbt, summonedMobRecord } from "./java-mobs.js";
import { invulnerableFields } from "./entity-uuid.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/summon86-reference.json", import.meta.url), "utf8"));
const Y = 60; // the harness world is 64 high

function game() {
  const world = new World("summon86", "meadow", 1), survival = new Survival({}, "creative"), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1);
  const minecarts = new Minecarts({}), boats = new Boats({}), items = new ItemEntities(), orbs = new ExperienceOrbs([]), falling = new FallingBlocks(world, { drop() {} }, []), hanging = new Hanging(), primed = [];
  const holder = () => ({ serialize: () => [], load() {} });
  const hosts = { items, xpOrbs: orbs, primed, falling, boats, hanging, projectiles: holder(), arrows: holder(), eyes: { serialize: () => ({ random: 0, eyes: [] }), load() {} },
    mobs: { potions: holder(), fireballs: holder(), skulls: holder(), knotSummon: (...a) => mobs.knotSummon?.(...a) }, dimension: 0 };
  const lines = [];
  const env = { world: () => world, survival: () => survival, mobs: () => mobs, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 0.5, y: Y, z: 0.5 }), changed() {}, refreshInventory() {},
    stackName: () => "stack", giveDrop() {}, updateBlock() {}, destroyBlock() {}, minecarts: () => minecarts, entityHosts: () => hosts, rockets: () => ({ rockets: [] }) };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { world, mobs, minecarts, boats, items, orbs, hanging, run(s) { lines.length = 0; runner.run(s); return [...lines]; } };
}
const nextLong = (r) => { const a = r.next(32), b = r.next(32); return BigInt.asIntN(64, (BigInt(a) << 32n) + BigInt(b)).toString(); };
const CLASS = { wn: "ocelot", yn: "spider", yl: "skeleton", yq: "zombie", yh: "pigman", wg: "chicken", wp: "sheep", yv: "villager", wi: "horse", wo: "pig" };
const idNum = (e) => Number(String(e.id).slice(4));

test("executed: an untagged /summon's extras (kittens, the jockey skeleton, the jockey chicken) join the world list before the summoned mob, with the later ids", () => {
  const multi = Object.fromEntries(ref.order.map(([n, , rows]) => [n, rows.filter((r) => r[1].length > 1).length]));
  assert.ok(multi.Ozelot > 20 && multi.Spider > 5 && multi.Zombie > 3 && multi.PigZombie > 3, JSON.stringify(multi));
  for (const [name, , rows] of ref.order) for (const [seed, spawned, after] of rows) {
    const g = game();
    g.mobs.worldRandom = new JavaRandom(BigInt(seed));
    const before = g.mobs.entities.length;
    g.run(`/summon ${name} 0.5 ${Y} 0.5`);
    const got = g.mobs.entities.slice(before), at = `${name} seed ${seed}`;
    assert.deepEqual(got.map((e) => e.type), spawned.map((s) => CLASS[s[0]]), `${at}: list order`);
    const low = Math.min(...got.map(idNum));
    assert.deepEqual(got.map((e) => idNum(e) - low), spawned.map((s) => s[1]), `${at}: entity ids`);
    assert.deepEqual(got.map((e) => (e.ridingEntity ? got.indexOf(e.ridingEntity) : -1)), spawned.map((s) => s[2]), `${at}: riding`);
    assert.equal(nextLong(g.mobs.worldRandom), after, `${at}: World.rand after the command`);
    // The World.rand fields (Entity.rand ones such as CanPickUpLoot or a horse's colour are not seedable natively).
    for (const [i, [cls, , , nbt]] of spawned.entries()) {
      const e = got[i];
      if (nbt.Color !== undefined) assert.equal(`${e.color}b`, nbt.Color, `${at}: fleece`);
      if (nbt.Profession !== undefined) assert.equal(String(e.profession), nbt.Profession, `${at}: profession`);
      if (nbt.IsBaby !== undefined) assert.equal(e.growingAge < 0, nbt.IsBaby === "1b", `${at}: child`);
      if (cls === "yq" || cls === "yh") assert.equal(!!e.villager, nbt.IsVillager === "1b", `${at}: villager`);
      if (cls === "wn") assert.equal(String(e.growingAge), nbt.Age, `${at}: kitten age`);
      if (cls === "wg" && i < spawned.length - 1) assert.equal(!!e.chickenJockey, true, `${at}: jockey flag`);
      if (cls === "yl") assert.equal(e.type, "skeleton", `${at}: SkeletonType ${nbt.SkeletonType}`);
    }
  }
});

test("natural spawns and spawn eggs keep spawnEntityInWorld before onSpawnWithEgg (the summoned mob first)", () => {
  const g = game();
  for (let s = 0; s < 400; s++) {
    g.mobs.worldRandom = new JavaRandom(BigInt(s) * 0x9e3779b97f4a7c15n);
    const before = g.mobs.entities.length, e = g.mobs.spawnNatural("ocelot", 0.5, Y, 0.5);
    if (g.mobs.entities.length - before === 3) { assert.equal(g.mobs.entities[before], e); return; }
  }
  assert.fail("no litter in 400 seeds");
});

const tagFrom = (obj) => new Map(Object.entries(obj));
const b = (v) => ({ type: NBT.BYTE, value: v }), s = (v) => ({ type: NBT.SHORT, value: v }), i = (v) => ({ type: NBT.INT, value: v }), str = (v) => ({ type: NBT.STRING, value: v });

test("Invulnerable survives the browser save of items, orbs, paintings, frames, boats and carts (Entity.writeToNBT writes it for every kind)", () => {
  const g = game();
  g.run(`/summon Item 0.5 ${Y} 0.5 {Item:{id:264s,Count:1b,Damage:0s},Invulnerable:1b,Health:3s,Owner:"Alex",Thrower:"Steve"}`);
  g.run(`/summon XPOrb 0.5 ${Y} 0.5 {Value:5s,Invulnerable:1b,Health:200s,Age:-100s}`);
  g.run(`/summon Painting 0.5 ${Y} 0.5 {Direction:0b,TileX:0,TileY:${Y},TileZ:0,Motive:"Kebab",Invulnerable:1b}`);
  g.run(`/summon ItemFrame 2.5 ${Y} 0.5 {Direction:0b,TileX:2,TileY:${Y},TileZ:0,Invulnerable:1b}`);
  g.run(`/summon Boat 0.5 ${Y} 3.5 {Invulnerable:1b}`);
  g.run(`/summon MinecartRideable 0.5 ${Y} 5.5 {Invulnerable:1b}`);
  const item = g.items.items.at(-1), orb = g.orbs.orbs.at(-1);
  assert.equal(item.invulnerable, true); assert.equal(item.health, 3); assert.equal(item.owner, "Alex"); assert.equal(item.thrower, "Steve");
  assert.equal(orb.invulnerable, true); assert.equal(orb.health, 200); assert.equal(orb.age, -100);
  assert.equal(g.hanging.entities.length, 2);
  // Save and load each kind.
  const items = new ItemEntities(); items.load(JSON.parse(JSON.stringify(g.items.serialize())), (x) => x);
  const loaded = items.items.at(-1);
  assert.equal(loaded.invulnerable, true); assert.equal(loaded.health, 3); assert.equal(loaded.owner, "Alex");
  const orbs = new ExperienceOrbs(JSON.parse(JSON.stringify(g.orbs.serialize())));
  assert.equal(orbs.orbs.at(-1).invulnerable, true); assert.equal(orbs.orbs.at(-1).health, 200);
  const hanging = Hanging.fromJSON(JSON.parse(JSON.stringify(g.hanging.toJSON())));
  assert.deepEqual(hanging.entities.map((e) => e.invulnerable), [true, true]);
  assert.equal(hanging.attack(hanging.entities[0]), false, "the loaded painting still refuses a hit");
  const boats = Boats.fromJSON(JSON.parse(JSON.stringify(g.boats.toJSON())));
  assert.equal(boats.carts.at(-1).invulnerable, true);
  const carts = Minecarts.fromJSON(JSON.parse(JSON.stringify(g.minecarts.toJSON())));
  assert.equal(carts.carts.at(-1).invulnerable, true);
  // A loaded item keeps the summoned Health: one 4-point hit kills a 3-health item (5 was the old reload default).
  items.hurt(loaded, 4); assert.equal(!!loaded.dead, false, "invulnerable");
  loaded.invulnerable = false; items.hurt(loaded, 4); assert.equal(loaded.dead, true);
  // Records without the flag stay as they were.
  const plain = new ItemEntities(); plain.spawn({ id: 1, count: 1 }, 0.5, Y, 0.5, { motion: [0, 0, 0] });
  const rec = plain.serializeOne(plain.items[0]);
  assert.equal(rec.invulnerable, undefined); assert.equal(rec.health, undefined);
  assert.equal(g.hanging.toJSON().length, 2);
  assert.equal(new Hanging().toJSON().length, 0);
});

test("the Java import reads Invulnerable for items, orbs, hanging, boats, carts and mobs", () => {
  const pos = { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5, 64, 0.5] } };
  assert.deepEqual(invulnerableFields(tagFrom({ Invulnerable: b(1) })), { invulnerable: true });
  assert.deepEqual(invulnerableFields(tagFrom({ Invulnerable: b(0) })), {});
  assert.equal(javaObjectFromNbt(tagFrom({ id: str("XPOrb"), Pos: pos, Value: s(3), Invulnerable: b(1) })).record.invulnerable, true);
  assert.equal(boatFromNbt(tagFrom({ Pos: pos, Invulnerable: b(1) })).invulnerable, true);
  assert.equal(cartFromNbt(tagFrom({ Pos: pos, Invulnerable: b(1) }), 0).invulnerable, true);
  assert.equal(hangingFromNbt(tagFrom({ TileX: i(0), TileY: i(64), TileZ: i(0), Direction: b(0), Motive: str("Kebab"), Invulnerable: b(1) }), "Painting").invulnerable, true);
  assert.equal(javaMobFromNbt(tagFrom({ id: str("Pig"), Pos: pos, Invulnerable: b(1) }))?.invulnerable, true);
  // /summon no longer reports Invulnerable as ignored for a mob (it was always honoured).
  const parsed = summonedMobRecord("pig", tagFrom({ Invulnerable: b(1) }));
  assert.equal(parsed.record.invulnerable, true);
  assert.ok(!parsed.ignored.includes("Invulnerable"));
});

test("an invulnerable summoned leash knot refuses a hit (EntityHanging.attackEntityFrom)", () => {
  const g = game();
  g.run(`/summon LeashKnot 0.5 ${Y} 0.5 {Invulnerable:1b}`);
  g.run(`/summon LeashKnot 2.5 ${Y} 0.5`);
  const knots = g.mobs.knotList;
  assert.equal(knots.length, 2);
  assert.equal(g.mobs.knotAttack(knots.at(-2)), false);
  assert.equal(g.mobs.knotAttack(knots.at(-1)), true);
});

test("the Java export writes each record's Invulnerable and an item's and orb's Health as (short)(byte)health", async () => {
  const { exportJavaSave } = await import("./region-export.js");
  const { regionSlot, readRegion, decodeRegionChunk, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files } = await exportJavaSave({ id: "s86", name: "S86", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000,
    drops: [{ stack: { id: 1, count: 1 }, x: -4.5, y: 101, z: -4.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0, invulnerable: true, health: 200 }],
    xpOrbs: [{ x: -5.5, y: 101, z: -5.5, value: 3, age: 0, health: 0, invulnerable: true }],
    hanging: [{ kind: "painting", dir: 0, tx: -3, ty: 101, tz: -3, x: -2.5, y: 101, z: -2.9, art: "Kebab", invulnerable: true }],
    entities: [{ type: "pig", x: -2.5, y: 101, z: -6.5, health: 10, invulnerable: true }, { type: "cow", x: -6.5, y: 101, z: -2.5, health: 10 }] }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const by = (id) => chunk.entities.find((e) => e.get("id").value === id);
  for (const id of ["Item", "XPOrb", "Painting", "Pig"]) assert.equal(by(id)?.get("Invulnerable").value, 1, id);
  assert.equal(by("Cow").get("Invulnerable").value, 0);
  assert.equal(by("Item").get("Health").value, -56); // (short)(byte)200; readEntityFromNBT's & 255 gives 200 back
  assert.equal(by("XPOrb").get("Health").value, 0);
});
