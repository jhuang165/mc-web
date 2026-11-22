// Batch 95 tiles95: tile entity NBT against the unchanged 1.7.10 classes (public/research/tiles95-reference.json, tools/probes/Tiles95Probe.java): the
// sign, note block, jukebox (any stack), command block and cart, mob spawner entries, skull bytes and furnace times replay the written compounds; an away run that stops
// idle counts the ticks it never ran under the rule as it stands. Notes: .shared-memory/notes/tiles95-b95-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NBT } from "./nbt.js";
import { populationBlockMapperReady } from "./population-world.js";
import { readSignTile, readContainerTile, cartFromNbt, itemStackFromNbt } from "./region-import.js";
import { readNoteTile } from "./note-blocks.js";
import { readJukeboxStack, writeJukeboxTile, installJukeboxes } from "./jukebox.js";
import { readCommandBlock, writeCommandBlock } from "./command-block.js";
import { makeSpawner, readNBT as readSpawnerNBT } from "./mob-spawner.js";
import { spawnerRecord, summonCart } from "./cart-summon.js";
import { spawnerPairs } from "./spawner-data.js";
import { skullBytes } from "./skull-profile.js";
import { Skulls } from "./skull.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tiles95-reference.json", import.meta.url), "utf8"));
const cases = (id) => ref.records.filter((r) => r.id === id);
const unq = (s) => s.slice(1, -1).replace(/\\(["\\])/g, "$1");
const parse = (j) => {
  switch (j.t) {
    case 10: return { type: 10, value: new Map(Object.entries(j.v).map(([k, v]) => [k, parse(v)])) };
    case 9: return { type: 9, value: { elementType: j.v.length ? 10 : 0, items: j.v.map((x) => parse(x).value) } };
    case 8: return { type: 8, value: unq(j.v) };
    case 4: return { type: 4, value: BigInt(j.v.replace("L", "")) };
    default: return { type: j.t, value: parseInt(j.v) };
  }
};
const num = (t) => parseInt(t.v), str = (t) => unq(t.v);
const input = (r) => parse(r.in).value;

test("reference has the audited tiles", () => {
  for (const id of ["Furnace", "Music", "RecordPlayer", "Sign", "Skull", "Comparator", "Control", "MobSpawner", "EnchantTable", "EnderChest", "Beacon"]) assert.ok(cases(id).length > 0, id);
  assert.ok(ref.records.length >= 80);
});

test("sign, note block, furnace times read as the native tile writes them", () => {
  for (const r of cases("Sign")) assert.deepEqual(readSignTile(input(r)).map((l) => l.replace(/\ud83d$/, "?")), [1, 2, 3, 4].map((i) => str(r.nbt.v[`Text${i}`]).replace(/\ud83d$/, "?")), r.label);
  for (const r of cases("Music")) assert.equal(readNoteTile(input(r)).note, num(r.nbt.v.note), r.label);
  for (const r of cases("Furnace")) {
    const rec = readContainerTile("Furnace", input(r)).record;
    assert.equal(rec.burn, num(r.nbt.v.BurnTime), r.label);
    assert.equal(rec.cook, num(r.nbt.v.CookTime), r.label);
  }
});

const convert = (c) => { const st = itemStackFromNbt(c, { allowEmpty: true }); return st ? { id: st.id, count: st.count, damage: st.damage } : null; };
test("jukebox keeps any stack: read and written as the native tile does", () => {
  for (const r of cases("RecordPlayer")) {
    const { record } = readJukeboxStack(input(r), convert);
    const native = r.nbt.v.RecordItem;
    if (!native) { assert.equal(record, null, r.label); continue; }
    if (num(r.nbt.v.Record) === 0) { assert.equal(record.ghost, true, r.label); continue; } // b96 tiles96: native keeps a null-item stack for an unregistered Record int (written Record 0, RecordItem id 0); this row had expected none
    assert.ok(record, r.label);
    const out = writeJukeboxTile({ record }, 1, 2, 3);
    assert.equal(out.get("Record").value, num(r.nbt.v.Record), r.label);
    assert.equal(out.get("RecordItem").value.get("id").value, num(native.v.id), r.label);
    assert.equal(out.get("RecordItem").value.get("Count").value, parseInt(native.v.Count.v), r.label);
  }
});

test("jukebox store restores and ejects a non-disc stack", () => {
  const spawned = [];
  const world = { getBlock: () => 84, getBlockMetadata: () => 1, setBlockMetadataWithNotify() {}, rand: { nextFloat: () => 0.5 }, registerBehaviour() {}, loaded: () => true };
  const j = installJukeboxes(world, { spawn: (s) => spawned.push(s) });
  const stone = convert(parse({ t: 10, v: { id: { t: 2, v: "4s" }, Count: { t: 1, v: "3b" }, Damage: { t: 2, v: "0s" } } }).value);
  j.restore([{ x: 1, y: 2, z: 3, record: stone }]);
  assert.deepEqual(j.save(), [{ x: 1, y: 2, z: 3, record: stone }]);
  assert.equal(j.eject(1, 2, 3), true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].count, 3);
  j.restore([{ x: 1, y: 2, z: 3, record: { ...stone, count: 0 } }]);
  assert.equal(j.eject(1, 2, 3), true);
  assert.equal(spawned.length, 1, "a Count 0 stack has nothing to drop");
});

test("command block tile and cart read through one logic (TrackOutput byte only, CustomName kept empty, Command any tag)", () => {
  const pos = { type: 9, value: { elementType: NBT.DOUBLE, items: [0, 64, 0] } };
  for (const r of cases("Control")) {
    const tag = input(r), want = r.nbt.v;
    const tile = readCommandBlock(tag), out = writeCommandBlock(tile, 1, 2, 3);
    assert.equal(out.get("Command").value, str(want.Command), r.label);
    assert.equal(out.get("CustomName").value, str(want.CustomName), r.label);
    assert.equal(out.get("SuccessCount").value, num(want.SuccessCount), r.label);
    assert.equal(out.get("TrackOutput").value, parseInt(want.TrackOutput.v), r.label);
    assert.equal(out.get("LastOutput")?.value ?? null, want.LastOutput ? str(want.LastOutput) : null, r.label);
    const withPos = new Map(tag); withPos.set("Pos", pos);
    const cart = cartFromNbt(withPos, 6, {}).command;
    assert.equal(cart.command, str(want.Command), `cart ${r.label}`);
    assert.equal(cart.customName ?? "@", str(want.CustomName), `cart ${r.label}`);
    assert.equal(cart.trackOutput ?? true, parseInt(want.TrackOutput.v) !== 0, `cart ${r.label}`);
    assert.equal(cart.successCount, num(want.SuccessCount), `cart ${r.label}`);
    let made = null;
    summonCart({ spawnCart: (type, record) => (made = record) }, 6, 0, 64, 0, tag); // /summon MinecartCommandBlock reads the same logic
    assert.equal(made.command.command, str(want.Command), `summon ${r.label}`);
    assert.equal(made.command.customName ?? "@", str(want.CustomName), `summon ${r.label}`);
    assert.equal(made.command.trackOutput ?? true, parseInt(want.TrackOutput.v) !== 0, `summon ${r.label}`);
  }
});

test("mob spawner fields and SpawnPotentials entries follow the native read (a missing Type is \"\")", () => {
  const keys = ["Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"];
  for (const r of cases("MobSpawner")) {
    const s = makeSpawner(0, 0, 0);
    readSpawnerNBT(s, spawnerRecord(input(r)));
    const p = spawnerPairs(s);
    assert.equal(p.EntityId[1], str(r.nbt.v.EntityId), r.label);
    for (const k of keys) assert.equal(p[k][1], num(r.nbt.v[k]), `${r.label} ${k}`);
    const nat = r.nbt.v.SpawnPotentials?.v ?? [];
    const mine = p.SpawnPotentials?.[2] ?? [];
    assert.equal(mine.length, nat.length, r.label);
    nat.forEach((e, i) => { assert.equal(mine[i].Type[1], str(e.v.Type), `${r.label} entry ${i}`); assert.equal(mine[i].Weight[1], num(e.v.Weight), `${r.label} weight ${i}`); });
  }
});

test("skull keeps the raw SkullType and Rot bytes; the port draws type 0 outside 0-4", () => {
  for (const r of cases("Skull")) {
    const tag = input(r), t = tag.get("SkullType"), rot = tag.get("Rot");
    const b = skullBytes(t ? t.value : 0, rot ? rot.value : 0);
    assert.equal(b.rawType ?? b.type, parseInt(r.nbt.v.SkullType.v), r.label);
    assert.equal(b.rawRot ?? b.rot, parseInt(r.nbt.v.Rot.v), r.label);
  }
  const s = new Skulls(), tile = s.create(1, 2, 3, 7, 20);
  assert.equal(tile.type, 0);
  assert.equal(tile.rot, 4);
  const again = Skulls.fromJSON(JSON.parse(JSON.stringify(s.toJSON()))).tile(1, 2, 3);
  assert.equal(again.rawType, 7);
  assert.equal(again.rawRot, 20);
  assert.equal(s.create(1, 2, 3, -1, -1).rawType, -1);
  assert.equal(s.create(1, 2, 3, 2, 5).rawType, undefined);
  assert.match(readFileSync(new URL("./region-export.js", import.meta.url), "utf8"), /SkullType:byte\(e\.rawType\?\?e\.type\?\?0\),Rot:byte\(e\.rawRot\?\?e\.rot\?\?0\)/);
});

const STONE = 3, COMMAND_BLOCK = 139;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const runIdle = (command, rules, ticks, at) => {
  const root = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 }, ...(rules ? { rules } : {}),
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, at, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: "" }] };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  plan.chunks.find((k) => k.x === 0 && k.z === 0).blocks[((3 & 15) * 16 + 3) * 256 + 11] = COMMAND_BLOCK;
  return runAway(plan, { budgetMs: 1e9 });
};
test("idle stop: ticks never run follow the rule the run ended with", async () => {
  const off = await runIdle("gamerule doDaylightCycle false", null, 3000, 1300);
  assert.equal(off.stats.stopped, "idle");
  assert.ok(off.timeShift <= -1696 && off.timeShift >= -1702, `shift ${off.timeShift}`);
  const same = await runIdle("say x", null, 3000, 1300);
  assert.equal(same.stats.stopped, "idle");
  assert.equal(same.timeShift, 0, "the rule never changed: the trip's assumption stands");
});
