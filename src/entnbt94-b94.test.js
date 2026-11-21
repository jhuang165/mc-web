// Batch 94 entnbt94: DeathTime of immortal corpses / live mobs, and the edge-value NBT audit. Executed: public/research/entnbt94-reference.json (tools/probes/Entnbt94Probe.java).
// See .shared-memory/notes/entnbt94-b94-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { NBT, decodeNbt } from "./nbt.js";
import { parseJsonNbt } from "./json-nbt.js";
import { Chunk } from "./chunk-store.js";
import { chunkToNbt, chunkFromNbt } from "./chunk-nbt.js";
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress } from "./region-file.js";
import { importJavaRegionArea } from "./region-import.js";
import { importedRuntime } from "./world-import.js";
import { exportJavaSave } from "./region-export.js";
import { Survival } from "./survival.js";
import { World } from "./world.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { EntityWorld } from "./entities.js";

await populationBlockMapperReady;
const t = (type, value) => ({ type, value }), tagOf = (o) => new Map(Object.entries(o));
const cowTag = (health, death) => tagOf({ id: t(NBT.STRING, "Cow"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] }), HealF: t(NBT.FLOAT, health), Health: t(NBT.SHORT, Math.ceil(health)), ...(death === undefined ? {} : { DeathTime: t(NBT.SHORT, death) }) });
const reference = JSON.parse(readFileSync(new URL("../public/research/entnbt94-reference.json", import.meta.url)));
const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const flatten = (v, path, out) => {
  if (v instanceof Map) { for (const [k, x] of v) flatten(x, path ? `${path}.${k}` : k, out); return; }
  if (v.type === NBT.COMPOUND) { flatten(v.value, path, out); return; }
  if (v.type === NBT.LIST) { out[`${path}[]`] = v.value.items.length; v.value.items.forEach((x, i) => (x instanceof Map ? flatten(x, `${path}[${i}]`, out) : (out[`${path}[${i}]`] = String(x)))); return; }
  out[path] = String(v.value);
};
const flat = (map) => { const o = {}; flatten(map, "", o); return o; };
// The /summon double's own artifacts: a new mob's Air 0, a random horse's health and speeds, a zombie's random speed bonus, a Leash compound the double's empty world has no holder for.
const NOT_A_LOSS = /^(Pos\[\d\]|Motion\[\d\]|UUIDMost|UUIDLeast|TileX|TileY|TileZ|Rotation\[0\]|Fire|HurtTime|AttackTime|Air|HealF|Health|Leash\..*|Attributes\[.*)$/;

async function roundTrip(inputs) {
  const entities = inputs.map(([id, text], i) => {
    const tag = new Map(parseJsonNbt(text).value);
    tag.set("id", { type: NBT.STRING, value: id });
    if (!tag.has("Pos")) tag.set("Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + (i % 8) * 1.9, 70, 0.5 + Math.floor(i / 8) * 1.4] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: "r.0.0.mca", bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: "survival" });
  importedRuntime(JSON.parse(JSON.stringify(record)));
  const world = new World("94", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files: out } = await exportJavaSave({ ...record, id: "a94", name: "A", player, updated: 1700000000000 }, { world });
  const back = [];
  for (const [name, buf] of out) {
    if (!name.startsWith("region/")) continue;
    for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  }
  return { back, report, record };
}

test("edge values: the port imports and exports every edge row as the real 1.7.10 classes write it", async () => {
  const rows = reference.edge;
  const { back, report } = await roundTrip(rows.map((r) => [r[0], r[1]]));
  const byId = {}, seen = {}, problems = [];
  for (const e of back) (byId[e.get("id").value] ??= []).push(e);
  rows.forEach((r) => {
    const id = r[0], g = (byId[id] ?? [])[(seen[id] = (seen[id] ?? -1) + 1)];
    if (!g) { problems.push(`${id} ${r[1]}: not exported`); return; }
    const n = flat(new Map(decodeNbt(bytes(r[4])).tag.value)), x2 = flat(g);
    for (const k in n) {
      if (NOT_A_LOSS.test(k)) continue;
      if (!(k in x2)) problems.push(`${id} ${r[1]}: missing ${k}`);
      else if (n[k] !== x2[k]) problems.push(`${id} ${r[1]}: ${k} native ${n[k]} port ${x2[k]}`);
    }
    for (const k in x2) if (!(k in n) && !NOT_A_LOSS.test(k)) problems.push(`${id} ${r[1]}: extra ${k} ${x2[k]}`);
  });
  assert.deepEqual(problems, []);
});

// ---- DeathTime ----
const row = (name, tag) => reference.death.find((r) => r[0] === name && r[1] === tag)[2];
const dt = (steps) => steps.map(([n, v]) => [n, v && v.split(" ")[2]]);
const world = () => new EntityWorld(new World("entnbt94", "meadow", 1), []);
const tickN = (mobs, n) => { const p = { x: 8.5, y: 70, z: 8.5 }, s = new Survival({}, "survival"); for (let i = 0; i < n; i++) mobs.tick(p, s, null); };
const load = (mobs, health, death) => { const rec = javaMobFromNbt(cowTag(health, death), {}); const e = mobs.restore(JSON.parse(JSON.stringify(rec))); if (e) mobs.entities.push(e); return e; };

test("native (executed): Health 0 with DeathTime 25 counts on forever, -5 counts up and is removed at 20, a live mob and the dragon keep the value, a crystal has none", () => {
  assert.deepEqual(dt(row("Cow", "{HealF:0f,Health:0s,DeathTime:25s}")), [[0, "25"], [1, "26"], [5, "30"], [19, "44"], [20, "45"], [21, "46"], [40, "65"]]);
  assert.deepEqual(dt(row("Cow", "{HealF:0f,Health:0s,DeathTime:-5s}")).slice(0, 6), [[0, "-5"], [1, "-4"], [5, "0"], [19, "14"], [20, "15"], [21, "16"]]);
  assert.equal(row("Cow", "{HealF:0f,Health:0s,DeathTime:-5s}")[6][1], null);
  assert.equal(row("Cow", "{HealF:10f,Health:10s,DeathTime:-3s}")[6][1], "10.0 10 -3 false");
  assert.equal(row("Cow", "{HealF:10f,Health:10s,DeathTime:30s}")[6][1], "10.0 10 30 false");
  assert.equal(row("EnderDragon", "{DeathTime:9s}")[6][1], "200.0 200 9 false");
  assert.equal(row("EnderDragon", "{HealF:0f,Health:0s,DeathTime:9s}")[6][1], "0.0 0 9 false");
  assert.equal(row("EnderCrystal", "{DeathTime:9s,Health:0s}")[0][1], "nolive none false");
});

test("a Health 0 mob with DeathTime 25 loads as an immortal corpse that counts on and is saved with the count", async () => {
  const mobs = world(), cow = load(mobs, 0, 25);
  assert.ok(cow, "it loads");
  tickN(mobs, 30);
  assert.ok(mobs.entities.includes(cow), "never removed");
  const saved = mobs.serialize();
  assert.equal(saved.length, 1);
  const { files } = await exportJavaSave({ id: "b94", name: "A", mode: "survival", player: new Survival({}, "survival").serialize(), entities: saved, updated: 1700000000000 }, { world: new World("94", "javaStreamed", 12) });
  let found;
  for (const [name, buf] of files) if (name.startsWith("region/")) for (const [, data] of readRegion(buf)) for (const e of chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []) if (e.get("id").value === "Cow") found = e;
  assert.equal(found.get("DeathTime").value, 55, "25 + 30 updates, as native (65 at 40)");
  assert.equal(found.get("HealF").value, 0);
});

test("a Health 0 mob with a negative DeathTime counts up and is removed when it reaches 20", () => {
  const mobs = world(), cow = load(mobs, 0, -5);
  assert.ok(cow);
  tickN(mobs, 24);
  assert.ok(mobs.entities.includes(cow));
  tickN(mobs, 1);
  assert.equal(mobs.entities.includes(cow), false, "25 updates: executed row, not saved at 40 and still saved at 21");
});

test("a live mob keeps its DeathTime through load and export, and counts on from it when it dies", async () => {
  const rec = javaMobFromNbt(cowTag(10, 9), {});
  assert.equal(rec.deathKept, 9);
  const mobs = world(), cow = load(mobs, 10, 9);
  tickN(mobs, 5);
  assert.equal(mobs.serialize()[0].deathKept, 9);
  const { files } = await exportJavaSave({ id: "b94", name: "A", mode: "survival", player: new Survival({}, "survival").serialize(), entities: mobs.serialize(), updated: 1700000000000 }, { world: new World("94", "javaStreamed", 12) });
  let found;
  for (const [name, buf] of files) if (name.startsWith("region/")) for (const [, data] of readRegion(buf)) for (const e of chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []) if (e.get("id").value === "Cow") found = e;
  assert.equal(found.get("DeathTime").value, 9);
  mobs.kill(cow);
  tickN(mobs, 10);
  assert.ok(mobs.entities.includes(cow), "9 + 10 updates is 19");
  tickN(mobs, 1);
  assert.equal(mobs.entities.includes(cow), false, "removed when the count reaches 20");
});

test("the dragon keeps a loaded DeathTime and an ender crystal writes no DeathTime or Health", () => {
  const dragon = javaMobFromNbt(tagOf({ id: t(NBT.STRING, "EnderDragon"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] }), HealF: t(NBT.FLOAT, 200), Health: t(NBT.SHORT, 200), DeathTime: t(NBT.SHORT, 9) }), {});
  assert.equal(dragon.deathKept, 9);
  assert.equal(dragon.death, undefined);
});

test("export: the dragon writes its kept DeathTime (never its death sequence count) and the crystal no DeathTime", async () => {
  const entities = [{ type: "ender_dragon", x: 8.5, y: 70, z: 8.5, health: 100, death: 3, deathKept: 9, yaw: 0 }, { type: "ender_crystal", x: 12.5, y: 70, z: 8.5, health: 5, death: 7, yaw: 0 }];
  const { files } = await exportJavaSave({ id: "c94", name: "A", mode: "survival", player: new Survival({}, "survival").serialize(), entities, updated: 1700000000000 }, { world: new World("94", "javaStreamed", 12) });
  const found = {};
  for (const [name, buf] of files) if (name.startsWith("region/")) for (const [, data] of readRegion(buf)) for (const e of chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []) found[e.get("id").value] = e;
  assert.equal(found.EnderDragon.get("DeathTime").value, 9);
  assert.equal(found.EnderCrystal.has("DeathTime"), false);
  assert.equal(found.EnderCrystal.has("HealF"), false);
});
