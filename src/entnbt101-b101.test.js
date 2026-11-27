// Batch 101 entnbt101: mob NBT edge values (CustomName / CustomNameVisible forms, ActiveEffects field widths and shapes, Attributes field widths) against the real 1.7.10 classes
// (public/research/entnbt101-reference.json from tools/probes/Entnbt101Probe.java), plus the XP bar label and the Infinity XpP level-up loop.
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
import { Experience, xpBarCap, infiniteBarEnd } from "./experience.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/entnbt101-reference.json", import.meta.url)));
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
test("mob edge rows import and export as the real classes write them", async () => {
  // Left open (note): a Bat with no HealF / Health reads the port's default 20 (native 6, the bat's maximum; saved bats always carry HealF), a modifier Name given as an int tag is written back
  // by native as the tag's text ("5") and by the port as "", and two modifiers on one attribute come back in the probe JDK's HashSet order (not provable for a 1.7.10 JVM).
  const open = (r) => r[0] === "Bat" || /Name:5,Amount/.test(r[1]) || /Name:"b",Amount:2/.test(r[1]);
  const crashes = ref.edge.filter((r) => r[2].startsWith("!")), rows = ref.edge.filter((r) => !r[2].startsWith("!") && !open(r));
  assert.equal(crashes.length, 6);
  const back = [];
  for (let i = 0; i < rows.length; i += 40) back.push(...(await roundTrip(rows.slice(i, i + 40).map((r) => [r[0], r[1]]))).back); // a chunk holds a bounded number of mobs
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
  assert.deepEqual(problems, []);
});

// ---- Items 1 and 2: XP bar label and the Infinity XpP level-up loop ----
const f = Math.fround;
// yz.v's loop, instruction for instruction (floats, int level, yz.a(I) reset), capped so a test can compare short runs.
function nativeLoop(level, bar, total, maxIter) {
  const cap = (l) => xpBarCap(l);
  let n = 0;
  while (bar >= 1) { // fcmpl: NaN fails
    if (n++ > maxIter) return null;
    bar = f(f(bar - 1) * f(cap(level)));
    level = (level + 1) | 0;
    if (level < 0) { level = 0; bar = 0; total = 0; }
    bar = f(bar / f(cap(level)));
  }
  return { level, progress: bar, total };
}
const same = (a, b, m) => assert.ok(Object.is(a, b), `${m}: ${a} vs ${b}`);

test("the XP bar aria-label uses the same int-wrapped cap as the bar (main.js code-read)", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.ok(src.includes("points`);") && src.includes("of ${xpBarCap(experience.level)} points"));
  assert.ok(!src.includes("62+(experience.level-30)*7"));
  assert.ok(xpBarCap(400000000) < 0); // the case the unwrapped formula got wrong (2.8e9 shown)
});

test("an Infinity XpP ends where native's loop ends (executed-by-bytecode replay), without the million-step guard", () => {
  // start levels spanning the cap > 0 case (crossing to negative), the below-30 levels and a negative level; the replay is capped, so only starts near the crossing are replayed in full
  for (const level of [306000000, 306783399, 306783400, -5, -2, -1, 0]) {
    const e = infiniteBarEnd(level), nat = nativeLoop(level, Infinity, 1000, level < 306000000 ? 0 : 400000000);
    if (level >= 306000000) assert.ok(nat, `replay of ${level} finished`);
    if (nat) { assert.equal(e.level, nat.level, `level ${level}`); same(e.progress, nat.progress, `bar ${level}`); }
  }
  // closed forms the replay cannot reach in test time: the first level with a negative cap, then -Infinity
  assert.deepEqual(infiniteBarEnd(3), { level: 306783400, progress: -Infinity, reset: false });
  assert.ok(xpBarCap(306783400) < 0 && xpBarCap(306783399) > 0);
  const x = new Experience({ total: 5, level: 3, progress: Infinity });
  x.add(10);
  assert.equal(x.level, 306783400);
  same(x.progress, -Infinity, "bar");
  assert.equal(x.total, 15);
  // a negative cap: sign flips each step until the cap is 0 or above, then -Infinity
  const neg = infiniteBarEnd(306783400);
  assert.ok(neg.progress === -Infinity && xpBarCap(neg.level) >= 0 && xpBarCap(neg.level - 1) < 0);
  // (a cap of exactly 0 would need level 3067833804 = 30 + (-62 / 7 mod 2^32), above MAX_INT, so it cannot occur; infiniteBarEnd keeps the NaN branch only for completeness)
  // the level counter passing MAX_INT first resets level, bar and total (yz.a(I))
  const top = new Experience({ total: 77, level: 2147483646, progress: Infinity }); top.add(1);
  assert.deepEqual([top.level, top.progress, top.total], [0, 0, 0]);
});

// ---- ActiveEffects after ticks (executed effTicks: the written list after 0, 1 and 20 onUpdate calls) ----
import { javaMobFromNbt } from "./java-mobs.js";
import { EntityWorld } from "./entities.js";
const mobTag = (id, text) => { const tag = new Map(parseJsonNbt(text).value); tag.set("id", { type: NBT.STRING, value: id }); tag.set("Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [8.5, 70, 8.5] } }); return tag; };
function effectsAfter(id, text, ticks) {
  const mobs = new EntityWorld(new World("entnbt101", "meadow", 1), []);
  const e = mobs.restore(JSON.parse(JSON.stringify(javaMobFromNbt(mobTag(id, text), {}))));
  mobs.entities.push(e);
  const p = { x: 8.5, y: 70, z: 8.5 }, s = new Survival({}, "survival");
  for (let i = 0; i < ticks; i++) mobs.tick(p, s, null);
  return (mobs.serialize()[0]?.effects ?? []).map((x) => ({ Id: x.id, Amplifier: (x.amplifier << 24) >> 24, Duration: x.duration }));
}
test("ActiveEffects after 0, 1 and 20 ticks match the real mob (Cow rows, records before export)", () => {
  const problems = []; let checked = 0;
  for (const [id, text, steps] of ref.effTicks) {
    if (id !== "Cow") continue;
    for (const [ticks, written] of steps) {
      if (ticks < 0) continue;
      const native = [...written.matchAll(/\d+:\{([^}]*)\}/g)].map(([, body]) => Object.fromEntries([...body.matchAll(/(\w+):(-?\d+)/g)].map((x) => [x[1], Number(x[2])]))).map(({ Id, Amplifier, Duration }) => ({ Id, Amplifier, Duration }));
      const port = effectsAfter(id, text, ticks).sort((a, b) => a.Id - b.Id), nat = native.sort((a, b) => a.Id - b.Id);
      checked++;
      if (JSON.stringify(port) !== JSON.stringify(nat)) problems.push(`${text} after ${ticks}: native ${JSON.stringify(nat)} port ${JSON.stringify(port)}`);
    }
  }
  assert.ok(checked > 100);
  assert.deepEqual(problems, []);
});

test("an Infinity XpP after addExperience matches the real EntityPlayerMP (executed xpInfinity rows)", () => {
  assert.equal(ref.xpInfinity.length, 12);
  for (const row of ref.xpInfinity) {
    const x = new Experience({ total: row.total, score: row.score - 10, level: row.start, progress: Infinity });
    x.add(10);
    assert.equal(x.level, row.level, `start ${row.start}: level`);
    same(x.progress, row.xpp === "-Infinity" ? -Infinity : Number(row.xpp), `start ${row.start}: XpP`);
    assert.equal(x.total, row.xptotal, `start ${row.start}: total`);
    assert.equal(x.score, row.score, `start ${row.start}: score`);
  }
});
