// Batch 93 entnbt93: DeathTime. A mob saved inside its death animation is written with Health 0 and its DeathTime, imported again as a dying mob that finishes the animation.
// Executed: public/research/entnbt93-reference.json (tools/probes/Entnbt93Probe.java). See .shared-memory/notes/entnbt93-b93-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { NBT } from "./nbt.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { exportJavaSave } from "./region-export.js";
import { Chunk } from "./chunk-store.js";
import { chunkFromNbt } from "./chunk-nbt.js";
import { readRegion, decodeRegionChunk } from "./region-file.js";
import { Survival } from "./survival.js";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";

await populationBlockMapperReady;
const t = (type, value) => ({ type, value }), tagOf = (o) => new Map(Object.entries(o));
const cowTag = (health, death) => tagOf({ id: t(NBT.STRING, "Cow"), Pos: t(NBT.LIST, { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] }), HealF: t(NBT.FLOAT, health), Health: t(NBT.SHORT, Math.ceil(health)), ...(death === undefined ? {} : { DeathTime: t(NBT.SHORT, death) }) });
const reference = JSON.parse(readFileSync(new URL("../public/research/entnbt93-reference.json", import.meta.url)));

test("native (executed): a dying mob is saved with HealF 0 and a counting DeathTime until deathTime 20 removes it", () => {
  const row = (tag) => reference.rows.find((r) => r[1] === tag)[2];
  assert.deepEqual(row("{HealF:0f,Health:0s,DeathTime:7s}").map(([n, s]) => [n, s && s.split(" ")[2]]), [[0, "7"], [1, "8"], [5, "12"], [19, null], [20, null], [21, null]]);
  assert.equal(row("{HealF:0f,Health:0s}")[3][1], "0.0 0 19 false", "a Health 0 record without DeathTime loads dying from 0");
  assert.equal(row("{HealF:0f,Health:0s}")[4][1], null, "setDead at 20: not saved");
});

test("import reads DeathTime of a Health 0 mob; restore keeps it dying; the save and the export write it", async () => {
  const rec = javaMobFromNbt(cowTag(0, 7), {});
  assert.equal(rec.health, 0);
  assert.equal(rec.death, 7);
  assert.equal(rec.deathTime, undefined);
  const mobs = new EntityWorld(new World("entnbt93", "meadow", 1), []);
  const cow = mobs.restore(JSON.parse(JSON.stringify(rec)));
  assert.ok(cow, "a Health 0 record with DeathTime < 20 loads (it used to be refused)");
  assert.equal(cow.death, 7);
  mobs.entities.push(cow);
  const saved = mobs.serialize();
  assert.equal(saved.length, 1, "the dying mob is in the save");
  assert.deepEqual([saved[0].health, saved[0].death], [0, 7]);
  // it finishes the animation: native removes it at deathTime 20
  const p = { x: 8.5, y: 70, z: 8.5 }, s = new Survival({}, "survival");
  for (let i = 0; i < 14 && mobs.entities.includes(cow); i++) mobs.tick(p, s, null);
  assert.ok(cow.death >= 12, "death counter ran: " + cow.death);
  assert.equal(mobs.entities.includes(cow), false, "gone after the animation");
  // exported DeathTime
  const world = new World("93", "javaStreamed", 12);
  const { files } = await exportJavaSave({ id: "a93", name: "A", mode: "survival", player: new Survival({}, "survival").serialize(), entities: [{ type: "cow", x: 8.5, y: 70, z: 8.5, health: 0, death: 7, yaw: 0 }], updated: 1700000000000 }, { world });
  let found;
  for (const [name, buf] of files) if (name.startsWith("region/")) for (const [, data] of readRegion(buf)) for (const e of chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []) if (e.get("id").value === "Cow") found = e;
  assert.ok(found, "the dying cow is exported");
  assert.equal(found.get("DeathTime").value, 7);
  assert.equal(found.get("HealF").value, 0);
});

test("a Health 0 mob with DeathTime 20 or more, and an ender crystal, still do not load", () => {
  assert.equal(javaMobFromNbt(cowTag(0, 25), {}).death, undefined);
  const mobs = new EntityWorld(new World("entnbt93", "meadow", 1), []);
  assert.equal(mobs.restore({ type: "cow", x: 8.5, y: 70, z: 8.5, health: 0, death: 25 }), null);
  assert.equal(mobs.restore({ type: "cow", x: 8.5, y: 70, z: 8.5, health: 0 }), null);
});
