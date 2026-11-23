// Batch 98 entnbt98: generic entity NBT (Fire, Air, PortalCooldown, Invulnerable, Dimension) on mobs and object entities against the real 1.7.10 classes
// (public/research/entnbt98-reference.json from tools/probes/Entnbt98Probe.java), plus the player XP and NaN/ability-speed edges.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { NBT } from "./nbt.js";
import { parseJsonNbt } from "./json-nbt.js";
import { Chunk } from "./chunk-store.js";
import { chunkToNbt, chunkFromNbt } from "./chunk-nbt.js";
import { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress } from "./region-file.js";
import { importJavaRegionArea } from "./region-import.js";
import { importedRuntime } from "./world-import.js";
import { exportJavaSave } from "./region-export.js";
import { Survival } from "./survival.js";
import { World } from "./world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/entnbt98-reference.json", import.meta.url)));
const KEEP = new Set(["Fire", "Air", "PortalCooldown", "Invulnerable", "Dimension"]);
const text = (v) => (v.type === NBT.SHORT ? `${v.value}s` : v.type === NBT.BYTE ? `${v.value}b` : String(v.value));
const slimOf = (map) => [...map].filter(([k]) => KEEP.has(k)).map(([k, v]) => `${k}=${text(v)}`).sort().join(";");
const sorted = (s) => s.split(";").sort().join(";");

async function roundTrip(inputs) {
  const entities = inputs.map(([id, tagText], i) => {
    const tag = new Map(parseJsonNbt(tagText).value);
    tag.set("id", { type: NBT.STRING, value: id });
    tag.set("Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + (i % 8) * 1.9, 70, 0.5 + Math.floor(i / 8) * 1.4] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: "r.0.0.mca", bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: "survival" });
  if (process.env.DUMP) console.log(JSON.stringify(report.entities));
  importedRuntime(JSON.parse(JSON.stringify(record)));
  const world = new World("98", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const { files: out } = await exportJavaSave({ ...record, id: "a98", name: "A", player, updated: 1700000000000 }, { world });
  const back = [];
  for (const [name, buf] of out) {
    if (!name.startsWith("region/")) continue;
    for (const [, data] of readRegion(buf)) back.push(...(chunkFromNbt(await decodeRegionChunk(data), { hasSky: true }).entities ?? []));
  }
  return back;
}

// Hanging entities need a wall block tile (entnbt88 and entnbt92 cover them); a mob with no numeric Air reads 0 and the first EntityLivingBase update sets 300 (sv.C, bytecode-read), the port's untouched 300.
const MOBS = new Set(["Zombie", "Cow", "Creeper", "Pig", "Skeleton"]);
const IDS = [...new Set(ref.edge.map((r) => r[0]))].filter((id) => id !== "ItemFrame" && id !== "Painting");
for (const id of IDS) {
  test(`${id}: Fire, Air, PortalCooldown, Invulnerable and Dimension import and export as the real classes write them`, async () => {
    const rows = ref.edge.filter((r) => r[0] === id);
    const back = await roundTrip(rows.map((r) => [r[0], r[1]]));
    if (process.env.DUMP) console.log(id, back.length, rows.length);
    const got = back.filter((e) => e.get("id").value === id), problems = [];
    rows.forEach((r, i) => {
      const g = got[i];
      if (!g) { problems.push(`${r[1]}: not exported`); return; }
      let want = sorted(r[2]), have = slimOf(g);
      if (!/Air:-?\d/.test(r[1]) && (MOBS.has(id) || !/Air:/.test(r[1]))) { want = want.split(";").filter((x) => !x.startsWith("Air=")).join(";"); have = have.split(";").filter((x) => !x.startsWith("Air=")).join(";"); } // the summon double's own Air is skipped when the tag has none
      if (want !== have) problems.push(`${r[1]}: native ${want} port ${have}`);
    });
    assert.deepEqual(problems.slice(0, 10), []);
  });
}

// ---- player side: rows from the batch 97 reference (executed EntityPlayerMP load and save) and the batch 98 player rows ----
import { levelNbt } from "./region-export.js";
import { Experience } from "./experience.js";
import { rawFloat, jsonFloat } from "./player-nbt.js";
import { importedRuntime as imported } from "./world-import.js";
import { setAbilitySpeeds, flySpeed, moveSpeed, groundAccel, fovMultiplier } from "./player-movement.js";
import { javaPlayerFromNbt } from "./level-dat.js";
import { keptBaseSave, keptBaseRestore, keptBaseImport } from "./entity-base-nbt.js";

const ref97 = JSON.parse(readFileSync(new URL("../public/research/entnbt97-reference.json", import.meta.url)));
const nrow = (name) => (ref97.players.find((r) => r.name === name).re ?? ref97.players.find((r) => r.name === name).out);
const nval = (name, re) => { const m = nrow(name).match(re)[1]; return m === "NaN" ? NaN : Number(m); };
const prow = (name) => (ref.players.find((r) => r.name === name) ?? ref97.players.find((r) => r.name === name)).out;
const pv = (name, re) => { const m = prow(name).match(re)[1]; return m === "NaN" ? NaN : Number(m); };
const plain = (t) => { const v = t.value; if (t.type === NBT.COMPOUND) return Object.fromEntries([...v].map(([k, x]) => [k, plain(x)])); if (t.type === NBT.LIST) return v.items.map((i) => plain({ type: v.elementType, value: i })); return v; };
const PW = { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) };
const saved = (rec) => plain(levelNbt({ mode: "survival", player: { health: 20 }, worldSpawn: [0, 64, 0], ...rec }, PW).tag.value.get("Data").value.get("Player"));
const same = (a, b, msg) => assert.ok(Object.is(a, b), `${msg}: ${a} vs ${b}`);
const viaJson = (v) => JSON.parse(JSON.stringify(v));

test("XpP, XpLevel and XpTotal out of range are kept as the real player keeps them (written back unchanged, through JSON too)", () => {
  const cases = [];
  for (const v of ["-1.0", "0.0", "0.999", "1.0", "5.0", "NaN", "Infinity"]) cases.push([`xpp-${v}`, { total: 120, level: 7, progress: Number(v) }]);
  for (const l of [-3, 0, 30, 100, 1000000, 2147483647]) cases.push([`xplevel-${l}`, { total: 120, level: l, progress: 0.25 }]);
  for (const t of [-100, 0, 2147483647]) cases.push([`xptotal-${t}`, { total: t, level: 7, progress: 0.25 }]);
  for (const [row, exp] of cases) {
    const xp = new Experience(viaJson(new Experience(exp).serialize())), p = saved({ experience: viaJson(xp.serialize()) });
    same(p.XpP, Math.fround(nval(row, /XpP=(-?[\d.]+|NaN|-?Infinity)f/)), `${row} XpP`);
    assert.equal(p.XpLevel, nval(row, /XpLevel=(-?\d+)/), `${row} XpLevel`);
    assert.equal(p.XpTotal, nval(row, /XpTotal=(-?\d+)/), `${row} XpTotal`);
  }
  // the importer's record (level-dat.js) builds the same Experience
  const tag = new Map([["XpP", { type: NBT.FLOAT, value: Math.fround(5) }], ["XpLevel", { type: NBT.INT, value: -3 }], ["XpTotal", { type: NBT.INT, value: -100 }]]);
  const rec = javaPlayerFromNbt(new Map([...tag, ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0, 64, 0] } }]])).experience;
  assert.deepEqual([rec.level, rec.progress, rec.total], [-3, 5, -100]);
  assert.equal(new Experience(rec).level, -3);
  // an old record without level and progress still derives them from the total
  const old = new Experience({ total: 120 });
  assert.deepEqual([old.level, old.total], [7, 120]);
});

test("adding experience to a loaded out-of-range bar follows addExperience (no total clamp, NaN stays NaN, no endless loop)", () => {
  const nan = new Experience({ total: 5, level: 3, progress: NaN });
  nan.add(10);
  same(nan.progress, NaN, "NaN bar");
  assert.equal(nan.total, 15);
  const inf = new Experience({ total: 5, level: 3, progress: Infinity });
  inf.add(10);
  assert.equal(inf.level, 3);
  const big = new Experience({ total: 2147483647, level: 7, progress: 0.25 });
  big.add(1);
  assert.equal(big.total, -2147483648);
  const over = new Experience({ total: 0, level: 0, progress: 5 });
  over.add(0);
  assert.ok(over.progress < 1 && over.level > 0);
});

test("NaN HealF, saturation and exhaustion (and infinite food values) are kept and written back as the real player writes them", () => {
  const rows = [["healf-NaN", "health", NaN], ["food-sat-nan", "saturation", NaN], ["food-exh-nan", "exhaustion", NaN], ["food-exh-inf", "exhaustion", Infinity], ["food-sat-inf", "saturation", Infinity], ["food-sat-neginf", "saturation", -Infinity]];
  for (const [row, field, v] of rows) {
    const s = new (Survival)({ [field]: v });
    same(s[field], v, row);
    const back = new Survival(viaJson(s.serialize()));
    same(back[field], v, `${row} via JSON`);
    const p = saved({ player: viaJson(s.serialize()) });
    if (field === "health") { same(p.HealF, pv(row, /HealF=(NaN|-?[\d.]+)f/), row); assert.equal(p.Health, 0); assert.equal(prow(row).includes("Health=0s"), true); }
    else if (field === "saturation") same(p.foodSaturationLevel, pv(row, /foodSaturationLevel=(NaN|-?[\d.]+|-?Infinity)f/), row);
    else same(p.foodExhaustionLevel, pv(row, /foodExhaustionLevel=(NaN|-?[\d.]+|-?Infinity)f/), row);
  }
  // HealF -Infinity reads 0 (executed healf-neginf); the level-dat import of NaN HealF gives NaN
  assert.equal(new Survival({ health: -Infinity }).health, 0); // executed healf-neginf: HealF=0.0f
  assert.equal(new Survival({ health: Infinity }).health, 20); // executed healf-Infinity: capped at the maximum
  const rec = javaPlayerFromNbt(new Map([["HealF", { type: NBT.FLOAT, value: NaN }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0, 64, 0] } }]]));
  same(rec.player.health, NaN, "import");
  assert.equal(rawFloat("x", 7), 7);
  assert.equal(jsonFloat(NaN), "NaN");
  // the arithmetic of the food tick is the same as Java's: NaN exhaustion never reaches 4, NaN saturation never drops
  const s = new Survival({ exhaustion: NaN, saturation: 5, food: 10 });
  s.exhaust(1);
  same(s.exhaustion, NaN, "exhaust");
});

test("a loaded walkSpeed and flySpeed change the movement speed (EntityPlayer.onLivingUpdate sets movementSpeed from walkSpeed; flying uses flySpeed)", () => {
  try {
    assert.equal(flySpeed(), Math.fround(0.05));
    const base = groundAccel(false, Math.fround(0.546));
    setAbilitySpeeds({ fly: Math.fround(0.5), walk: Math.fround(0.3) });
    assert.equal(flySpeed(), Math.fround(0.5));
    assert.ok(Math.abs(groundAccel(false, Math.fround(0.546)) / base - 3) < 1e-6);
    assert.ok(Math.abs(moveSpeed(true) / moveSpeed(false) - 1.3) < 1e-6);
    assert.ok(Math.abs(fovMultiplier({ sprinting: true }) - 1.15) < 1e-6);
    setAbilitySpeeds({ fly: NaN, walk: -1 });
    assert.equal(flySpeed(), Math.fround(0.05));
    assert.equal(moveSpeed(false), 0);
  } finally { setAbilitySpeeds(undefined); }
  assert.equal(flySpeed(), Math.fround(0.05));
  assert.equal(moveSpeed(false), 0.10000000149011612);
});

test("importedRuntime keeps playerState and abilitySpeeds (both were dropped by the whitelist, so a real import lost the loaded Motion and speeds)", () => {
  const kept = imported({ playerState: { motion: [null, 0.5, 0], onGround: true, fallDistance: 2, hurtTime: 3, junk: 1 }, abilitySpeeds: { fly: 0.5, walk: 0.3 }, evil: 1 });
  assert.deepEqual(kept, { playerState: { onGround: true, fallDistance: 2, hurtTime: 3, motion: [null, 0.5, 0] }, abilitySpeeds: { fly: 0.5, walk: 0.3 } });
  assert.deepEqual(imported({ playerState: 5, abilitySpeeds: { fly: "x" } }), {});
  assert.deepEqual(saved({ ...kept }).abilities.flySpeed, 0.5);
});

test("Invulnerable survives the browser save of every projectile record (keptBase helpers) and the import", () => {
  const tag = new Map([["Invulnerable", { type: NBT.BYTE, value: 1 }]]);
  assert.equal(keptBaseImport(tag).invulnerable, true);
  assert.equal(keptBaseImport(new Map()).invulnerable, undefined);
  const e = { invulnerable: true, air: 3 };
  assert.equal(keptBaseSave(e).invulnerable, true);
  assert.equal(keptBaseRestore(viaJson(keptBaseSave(e))).invulnerable, true);
  assert.equal(keptBaseSave({}).invulnerable, undefined);
});
