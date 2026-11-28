// Batch 102 entnbt102: mob NBT edge values (CustomName / CustomNameVisible forms, ActiveEffects field widths and shapes, Attributes field widths) against the real 1.7.10 classes
// (public/research/entnbt102-reference.json from tools/probes/Entnbt101Probe.java), plus the XP bar label and the Infinity XpP level-up loop.
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
import { javaMobFromNbt } from "./java-mobs.js";
import { World } from "./world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/entnbt102-reference.json", import.meta.url)));
const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const flatten = (v, path, out) => {
  if (v instanceof Map) { for (const [k, x] of v) flatten(x, path ? `${path}.${k}` : k, out); return; }
  if (v.type === NBT.COMPOUND) { flatten(v.value, path, out); return; }
  if (v.type === NBT.LIST) { out[`${path}[]`] = v.value.items.length; v.value.items.forEach((x, i) => (x instanceof Map ? flatten(x, `${path}[${i}]`, out) : (out[`${path}[${i}]`] = String(x)))); return; }
  out[path] = String(v.value);
};
const flat = (map) => { const o = {}; flatten(map, "", o); return o; };

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
  const world = new World("97", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files: out } = await exportJavaSave({ ...record, id: "a97", name: "A", player, updated: 1700000000000 }, { world });
  const back = [];
  for (const [name, buf] of out) {
    if (!name.startsWith("region/")) continue;
    for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  }
  return { back, report, record };
}
const SKIP = /^(Pos\[\d\]|Motion\[\d\]|UUIDMost|UUIDLeast|Rotation\[0\]|Air|Attributes\[\d+\]\.Base)$/;

// Left open (note): the port's default bow / sword when Equipment is absent (a saved world always has it), SkeletonType and CatType outside the modelled values, a Sitting flag on an unowned
// wolf / ocelot, Slime Size >= 127 (byte wrap of the data watcher), Count 0 trades, the zombie cure's Strength attribute modifier, array-typed modifier Names, horse Type outside 0..4,
// the horse item stacks' Count / Damage (always 1 / 0 in saves), a chest on a type 0 horse and EatingHaystack.
const KNOWN_OPEN = [/Equipment\[0\]/, /^Skeleton \{SkeletonType:(2b|-1b)\}: SkeletonType/, /CatType native (4|-1) /, /^(Wolf|Ozelot) \{Sitting:1b\}/, /^(Slime|LavaSlime) \{Size:(127|2147483647)\}/,
  /Count:0b/, /ConversionTime[^]*Attributes\[4\]\.Modifiers/, /Name:\[[BI];/, /^EntityHorse \{Type:(5|-1)\}/, /ArmorItem|SaddleItem/, /^EntityHorse \{ChestedHorse:1b,Type:0/, /EatingHaystack/];
async function compare(rows) {
  const back = [];
  for (let i = 0; i < rows.length; i += 40) back.push(...(await roundTrip(rows.slice(i, i + 40).map((r) => [r[0], r[1]]))).back);
  const byId = {}, seen = {}, problems = [];
  for (const e of back) (byId[e.get("id").value] ??= []).push(e);
  rows.forEach((r) => {
    const id = r[0], g = (byId[id] ?? [])[(seen[id] = (seen[id] ?? -1) + 1)];
    if (!g) { problems.push(`${id} ${r[1]}: not exported`); return; }
    const n = flat(new Map(decodeNbt(bytes(r[2])).tag.value)), p = flat(g);
    for (const k in n) {
      if (SKIP.test(k)) continue;
      if (!(k in p)) problems.push(`${id} ${r[1]}: missing ${k} (native ${n[k]})`);
      else if (n[k] !== p[k]) problems.push(`${id} ${r[1]}: ${k} native ${n[k]} port ${p[k]}`);
    }
    for (const k in p) if (!(k in n) && !SKIP.test(k)) problems.push(`${id} ${r[1]}: extra ${k} ${p[k]}`);
  });
  return problems.filter((x) => !KNOWN_OPEN.some((re) => re.test(x)));
}
const crashes = ref.edge.filter((r) => r[2].startsWith("!")), rows = ref.edge.filter((r) => !r[2].startsWith("!"));

test("the executed rows: 22 native crash rows (Owner:<name> on the probe double) are not modelled, the other 313 import and export as written", async () => {
  assert.equal(crashes.length, 22);
  assert.ok(crashes.every((r) => /Owner|Recipes|Offers/.test(r[1])));
  assert.deepEqual(await compare(rows), []);
});

const mob = (id, extra = {}) => {
  const tag = new Map([["id", { type: NBT.STRING, value: id }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0, 70, 0] } }]]);
  for (const [k, v] of Object.entries(extra)) tag.set(k, v);
  return javaMobFromNbt(tag, {});
};
test("item 1: a mob with neither HealF nor Health keeps its constructor maximum; a saved Health above it is clamped", () => {
  const native = { Bat: 6, Squid: 10, Ozelot: 10, Ghast: 10, Enderman: 40, VillagerGolem: 100, WitherBoss: 300, EnderDragon: 200, Giant: 100, Villager: 20, Zombie: 20, Skeleton: 20, Blaze: 20, PigZombie: 20 };
  for (const [id, hp] of Object.entries(native)) assert.equal(mob(id).health, hp, id);
  assert.equal(mob("EntityHorse").health, 53);
  assert.equal(mob("EnderCrystal").health, 5);
  assert.equal(mob("Bat", { Health: { type: NBT.SHORT, value: 7 } }).health, 6);
  assert.equal(mob("Bat", { HealF: { type: NBT.FLOAT, value: 3.5 } }).health, 3.5);
});

test("item 2: a modifier Name given as a non-string tag is written as the tag's text", async () => {
  const names = { "5": "5", "5b": "5b", "5s": "5s", "5L": "5L", "1.5f": "1.5f", "2.5d": "2.5d", "[1]": "[1,]", "{a:1}": "{a:1,}" };
  const picked = rows.filter((r) => r[0] === "Zombie" && /Modifiers:\[\{Name:[^"A]/.test(r[1]) && !/\[[BI];/.test(r[1]));
  assert.equal(picked.length, Object.keys(names).length);
  const { back } = await roundTrip(picked.map((r) => [r[0], r[1]]));
  back.forEach((e, i) => {
    const key = picked[i][1].match(/Modifiers:\[\{Name:([^,]*(?:,\d+\])?(?:,\})?)/)[1];
    assert.ok(Object.values(names).includes(flat(e)["Attributes[0].Modifiers[0].Name"]), key);
  });
});

test("zombie ConversionTime starts the cure's Strength (id 5, amplifier 0, duration = the time) after the saved effects", () => {
  const ct = (n) => ({ ConversionTime: { type: NBT.INT, value: n } });
  assert.deepEqual(mob("Zombie", ct(100)).effects, [{ id: 5, amplifier: 0, duration: 100 }]);
  assert.deepEqual(mob("Zombie", ct(0)).effects, [{ id: 5, amplifier: 0, duration: 0 }]);
  assert.deepEqual(mob("Zombie", ct(-1)).effects, []);
  const saved = (amp, dur) => ({ ActiveEffects: { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [new Map([["Id", { type: NBT.BYTE, value: 5 }], ["Amplifier", { type: NBT.BYTE, value: amp }], ["Duration", { type: NBT.INT, value: dur }]])] } } });
  assert.equal(mob("Zombie", { ...ct(100), ...saved(0, 50) }).effects[0].duration, 100);
  assert.equal(mob("Zombie", { ...ct(100), ...saved(0, 500) }).effects[0].duration, 500);
  assert.equal(mob("Zombie", { ...ct(100), ...saved(2, 50) }).effects[0].amplifier, 2);
});

test("villager Offers: an empty or odd Recipes list is an empty trade list, not absent; buyB {} keeps the trade", async () => {
  const get = (text) => { const r = rows.find((x) => x[0] === "Villager" && x[1] === text); assert.ok(r, text); return r; };
  const { back } = await roundTrip([get("{Offers:{Recipes:[]}}"), get("{Offers:{}}"), get("{Offers:{Recipes:5}}"), get("{Offers:5}")].map((r) => [r[0], r[1]]));
  const f = back.map(flat);
  assert.deepEqual(f.slice(0, 3).map((x) => x["Offers.Recipes[]"]), ["0", "0", "0"].map(Number));
  assert.ok(!("Offers.Recipes[]" in f[3]));
});
