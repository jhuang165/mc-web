// Batch 92 entnbt92: the entnbt91 audit again with the exemptions removed that batch 91 left open (HurtTime / AttackTime, a witch's Equipment[1..4] / DropChances / CanPickUpLoot,
// a fireball's in-ground state, the firework item's Explosions list, hanging Fire) plus unit tests for each fix. See .shared-memory/notes/entnbt92-b92-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { readFileSync } from "node:fs";
import { decodeNbt, NBT } from "./nbt.js";
import { Chunk } from "./chunk-store.js";
import { chunkToNbt, chunkFromNbt } from "./chunk-nbt.js";
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress } from "./region-file.js";
import { importJavaRegionArea, itemStackFromNbt } from "./region-import.js";
import { importedRuntime } from "./world-import.js";
import { exportJavaSave } from "./region-export.js";
import { Survival } from "./survival.js";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Fireballs } from "./fireballs.js";
import { readFireworkNbt, writeFireworkTags } from "./fireworks-nbt.js";

await populationBlockMapperReady;
// ---- NBT round-trip audit: native tag (entnbt91-reference.json, executed) -> the port's import -> the port's export, compared tag by tag ----
const reference = JSON.parse(readFileSync(new URL("../public/research/entnbt91-reference.json", import.meta.url)));
const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const flatten = (v, path, out) => {
  if (v instanceof Map) { for (const [k, x] of v) flatten(x, path ? `${path}.${k}` : k, out); return; }
  if (v.type === NBT.COMPOUND) { flatten(v.value, path, out); return; }
  if (v.type === NBT.LIST) { out[`${path}[]`] = v.value.items.length; v.value.items.forEach((x, i) => (x instanceof Map ? flatten(x, `${path}[${i}]`, out) : (out[`${path}[${i}]`] = String(x)))); return; }
  out[path] = String(v.value);
};
const flatMap91 = (map) => { const o = {}; flatten(map, "", o); return o; };
// Keys that differ for a reason that is not a port loss: the position-shifting import (tile coordinates, hanging Rotation and Fire come from CommandSummon's own setup), values the
// /summon double has no natural value for (a missing xTile reads 0 where a thrown entity starts at -1), the fireball's in-ground state (never entered in 1.7.10) and the
// firework item tag, which the port rewrites with an empty Explosions list. HurtTime and AttackTime are per-tick counters (open, see the track note).
// b92: the fireball rows (executed with xTile 3, yTile 4, zTile 5, inTile 1, inGround 1), Fire, HurtTime, AttackTime, the witch's gear and the rocket's Explosions list are compared now.
const NOT_A_LOSS = /^(Pos\[\d\]|Motion\[\d\]|UUIDMost|UUIDLeast|xTile|zTile|TileX|TileZ|Rotation\[0\])$/;
const THROWN_TILE = /^(xTile|yTile|zTile|inTile|inData|inGround)$/; // a thrown entity's /summon without them reads 0 where a natural one starts at -1; arrows keep their own record (batch 91)
const FIREBALLS = new Set(["Fireball", "SmallFireball", "WitherSkull"]);
const WITCH_SLOT0 = /^Equipment\[0\]/; // slot 0 is the witch's held potion (its own model); a sword there is still not kept

test("every EntityList id the probe summoned survives import then export tag for tag", async () => {
  const rows = reference.rows.filter((r) => r[3] && !r[3].startsWith("!"));
  assert.equal(rows.length, 84, "88 probe rows less Mob and Monster, which are not entities");
  const entities = rows.map((r, i) => {
    const tag = new Map(decodeNbt(bytes(r[3])).tag.value);
    tag.set("Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + (i % 8) * 1.9, 70, 0.5 + Math.floor(i / 8) * 1.4] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: "r.0.0.mca", bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: "survival" });
  importedRuntime(JSON.parse(JSON.stringify(record)));
  assert.deepEqual(report.entities.lost, [], "nothing is lost on import");
  assert.ok(record.drops.length > 0 && record.drops.every((d) => d.delay === 0), "EntityItem.readEntityFromNBT reads no PickupDelay: the field starts at 0");
  const world = new World("92", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files: out } = await exportJavaSave({ ...record, id: "a92", name: "A", player, updated: 1700000000000 }, { world });
  const back = [];
  for (const [name, buf] of out) {
    if (!name.startsWith("region/")) continue;
    for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  }
  const byId = {}, seen = {}, problems = [];
  for (const e of back) (byId[e.get("id").value] ??= []).push(e);
  rows.forEach((r, i) => {
    const id = r[0], g = (byId[id] ?? [])[(seen[id] = (seen[id] ?? -1) + 1)];
    if (id === "LeashKnot") return; // dies on load without a fence (not an entity the port keeps)
    if (!g) { problems.push(`${id} ${r[2]}: not exported`); return; }
    const n = flatMap91(entities[i]), x2 = flatMap91(g), rich = r[2] === "rich";
    for (const k in n) {
      if (NOT_A_LOSS.test(k) || (THROWN_TILE.test(k) && !FIREBALLS.has(id)) || (id === "Witch" && rich && WITCH_SLOT0.test(k)) || (!rich && k === "Air")) continue;
      if (!(k in x2)) problems.push(`${id} ${r[2]}: missing ${k}`);
      else if (n[k] !== x2[k]) problems.push(`${id} ${r[2]}: ${k} ${n[k]} -> ${x2[k]}`);
    }
    for (const k in x2) if (!(k in n) && !NOT_A_LOSS.test(k) && !(THROWN_TILE.test(k) && !FIREBALLS.has(id))) problems.push(`${id} ${r[2]}: extra ${k}`);
  });
  assert.deepEqual(problems, []);
});

// ---- unit tests ----
import { javaMobFromNbt } from "./java-mobs.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";

const t = (type, value) => ({ type, value });
const tagOf = (o) => new Map(Object.entries(o));
const compound = (o) => t(NBT.COMPOUND, tagOf(o));
const mobs0 = () => new EntityWorld(new World("entnbt92", "meadow", 1), []);
const shortOf = (v) => t(NBT.SHORT, v), byteOf = (v) => t(NBT.BYTE, v);

test("HurtTime and AttackTime: the import reads both shorts, restore keeps them, the save writes the live values", () => {
  const tag = tagOf({ id: t(NBT.STRING, "Zombie"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] }), Health: shortOf(20), HurtTime: shortOf(7), AttackTime: shortOf(5), DeathTime: shortOf(0) });
  const rec = javaMobFromNbt(tag, {});
  assert.deepEqual([rec.hurt, rec.attackTime], [7, 5]);
  const mobs = mobs0(), z = mobs.restore(JSON.parse(JSON.stringify(rec)));
  assert.deepEqual([z.hurt, z.attackTime], [7, 5], "restore used to reset hurt to 0");
  const saved = JSON.parse(JSON.stringify(mobs.serializeOne(z)));
  assert.deepEqual([saved.hurt, saved.attackTime], [7, 5]);
  // a legacy mob keeps AttackTime in its own state (sv.e counts it down there); the save reads the state
  const spider = mobs.restore({ type: "spider", x: 8.5, y: 70, z: 8.5, health: 16, attackTime: 9, hurt: 3 });
  assert.equal(mobs.silverfishState(spider).attackTime, 9);
  mobs.silverfishState(spider).attackTime = 4;
  assert.deepEqual([mobs.serializeOne(spider).attackTime, mobs.serializeOne(spider).hurt], [4, 3]);
  const none = mobs.restore({ type: "cow", x: 8.5, y: 70, z: 8.5, health: 10 });
  assert.equal(mobs.serializeOne(none).attackTime, undefined);
});

test("a witch keeps Equipment[1..4], DropChances and CanPickUpLoot on import, restore and save; slot 0 stays the held potion", () => {
  const stack = (id) => compound({ id: shortOf(id), Count: byteOf(1), Damage: shortOf(0) });
  const tag = tagOf({ id: t(NBT.STRING, "Witch"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] }), Health: shortOf(26),
    CanPickUpLoot: byteOf(1), Equipment: t(NBT.LIST, { elementType: NBT.COMPOUND, items: [tagOf({}), tagOf({}), tagOf({}), tagOf({ id: shortOf(299), Count: byteOf(1), Damage: shortOf(0) }), stack(298).value] }),
    DropChances: t(NBT.LIST, { elementType: NBT.FLOAT, items: [0.5, 0.1, 0.1, 0.3, 0.2].map(Math.fround) }) });
  const rec = javaMobFromNbt(tag, { convertItem: itemStackFromNbt });
  assert.equal(rec.canPickUpLoot, true);
  assert.deepEqual(rec.equipment.map((s) => s && s.id), [null, null, null, 299, 298]);
  assert.deepEqual(rec.dropChances, [0.5, 0.1, 0.1, 0.3, 0.2].map(Math.fround));
  const w = mobs0().restore(JSON.parse(JSON.stringify(rec)));
  assert.equal(w.canPickUpLoot, true);
  assert.deepEqual(w.equipment.map((s) => s && s.id), [null, null, null, 299, 298]);
  // DropChances alone (all else default) is kept too
  const only = tagOf({ id: t(NBT.STRING, "Witch"), Pos: tag.get("Pos"), Health: shortOf(26), DropChances: t(NBT.LIST, { elementType: NBT.FLOAT, items: [0, 0, 0, 0, 1].map(Math.fround) }) });
  assert.deepEqual(javaMobFromNbt(only, {}).dropChances, [0, 0, 0, 0, 1]);
});

test("fireball in-ground state: import, record, Fireballs.stick and export agree with EntityFireball.readEntityFromNBT / writeEntityToNBT", () => {
  const entity = tagOf({ id: t(NBT.STRING, "Fireball"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [10.5, 20, 10.5] }), direction: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [0.1, 0.2, 0.3] }),
    xTile: shortOf(3), yTile: shortOf(4), zTile: shortOf(5), inTile: byteOf(1), inGround: byteOf(1), ExplosionPower: t(NBT.INT, 3) });
  const { record } = javaProjectileFromNbt(entity, { shiftX: 0, shiftZ: 0 });
  assert.equal(record.inGround, true);
  assert.deepEqual([record.tile.x, record.tile.y, record.tile.z, record.tile.orig], [3, 4, 5, 1]);
  const mobs = mobs0(), fb = new Fireballs(mobs);
  fb.load([record], 0);
  const ball = fb.list[0];
  assert.equal(ball.inGround, true);
  const { x, y, z, id } = ball.tile;
  mobs.world.put(x, y, z, id, 0, false);
  assert.equal(fb.stick(ball), true, "the stored block is still there: only ticksAlive counts");
  assert.equal(ball.ticksAlive, 1);
  const again = JSON.parse(JSON.stringify(fb.serialize(0)[0]));
  assert.deepEqual([again.inGround, again.tile.x, again.tile.y, again.tile.z], [true, 3, 4, 5]);
  const out = javaProjectileToNbt("fireballs", again, { ox: 0, oz: 0 }).fields;
  assert.deepEqual([out.xTile.value, out.yTile.value, out.zTile.value, out.inTile.value, out.inGround.value], [3, 4, 5, 1, 1]);
  mobs.world.put(x, y, z, 0, 0, false);
  assert.equal(fb.stick(ball), false, "the block is gone: it lets go");
  assert.equal(ball.inGround, false);
  // a fresh ball writes the -1 defaults
  const plain = javaProjectileToNbt("fireballs", { kind: "fireball", vx: 0, vy: 0, vz: 0 }, {}).fields;
  assert.deepEqual([plain.xTile.value, plain.inTile.value, plain.inGround.value], [-1, 0, 0]);
  // a block the port lacks never matches: the ball lets go on its first update, the byte survives the save
  const odd = javaProjectileFromNbt(new Map([...entity, ["inTile", byteOf(250)]]), {}).record;
  assert.equal(javaProjectileToNbt("fireballs", odd, {}).fields.inTile.value, (250 << 24) >> 24);
});

test("a rocket's Fireworks tag without Explosions is written without it; a crafted one keeps its (possibly empty) list", () => {
  const nbt = (fw) => new Map([["Fireworks", compound(fw)]]);
  const bare = {}; readFireworkNbt(bare, nbt({ Flight: byteOf(2) }));
  assert.equal(bare.fireworks.unlisted, true);
  const e1 = {}; writeFireworkTags(bare, e1);
  assert.deepEqual([...e1.Fireworks.value.keys()], ["Flight"]);
  const listed = {}; readFireworkNbt(listed, nbt({ Flight: byteOf(1), Explosions: t(NBT.LIST, { elementType: NBT.END, items: [] }) }));
  const e2 = {}; writeFireworkTags(listed, e2);
  assert.deepEqual([...e2.Fireworks.value.keys()], ["Flight", "Explosions"]);
  const crafted = { fireworks: { explosions: [], flight: 1 } }, e3 = {}; writeFireworkTags(crafted, e3);
  assert.deepEqual([...e3.Fireworks.value.keys()], ["Flight", "Explosions"]);
});

test("executed: a natural painting or item frame saves Fire 0 at every step (no moveEntity rests it at -1), so a record without fire exports 0", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/entnbt92-reference.json", import.meta.url), "utf8"));
  assert.equal(ref.rows.length, 4);
  for (const row of ref.rows) for (const [step, fire] of row.steps) assert.equal(fire, "0", `${row.name} ${step}`);
});
