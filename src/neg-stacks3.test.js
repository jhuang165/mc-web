// Batch 28 negstacks3: negative and zero stacks in /give, container clicks, furnace and brewing ticks, dispensers and droppers (and hoppers).
// Replays public/research/neg-stacks3-reference.json (tools/probes/NegStacks3Probe.java and HopperProbe, run natively on the unchanged 1.7.10 classes by
// tools/verify-neg-stacks3.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { Dispensing, dispenserBehaviour, ITEM, DROPPER_BLOCK } from "./dispense.js";
import { itemFromOriginal } from "./region-import.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { BrewingStand } from "./brewing.js";
import { ItemEntities } from "./item-entities.js";
import { createCommandHost } from "./command-host.js";
import { replay } from "../tools/inventory-replay.mjs";
import { negStackScript } from "../tools/neg-stacks3-scripts.mjs";
import { replayHopperScenario } from "./hopper-replay.js";
import { hopperScenarios } from "../tools/neg-stacks3-hopper.mjs";

const ref = JSON.parse(await readFile(new URL("../public/research/neg-stacks3-reference.json", import.meta.url)));
const X = 10, Y = 64, Z = 10;
const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const TO_INTERNAL = { 262: ITEM.ARROW, 344: ITEM.EGG, 332: ITEM.SNOWBALL, 373: ITEM.POTION, 328: ITEM.MINECART, 342: ITEM.CHEST_MINECART, 325: ITEM.BUCKET, 326: ITEM.WATER_BUCKET, 327: ITEM.LAVA_BUCKET, 259: ITEM.FLINT_AND_STEEL, 46: ITEM.TNT };
const TO_ORIGINAL = Object.fromEntries(Object.entries(TO_INTERNAL).map(([o, i]) => [i, Number(o)]));
const parse = (s) => { if (s === null) return null; const [id, count, damage] = s.split(":").map(Number); return { id: TO_INTERNAL[id] ?? id, count, damage }; };
const enc = (s) => (s ? [TO_ORIGINAL[s.id] ?? s.id, s.count, s.damage ?? 0] : null);
class Fake {
  constructor(seed) { this.rand = new JavaRandom(seed); this.blocks = new Map(); this.metas = new Map(); this.log = []; this.spawned = []; this.powered = new Set(); }
  put(x, y, z, id, meta = 0) { this.blocks.set(`${x},${y},${z}`, id); this.metas.set(`${x},${y},${z}`, meta); }
  getBlock(x, y, z) { return this.blocks.get(`${x},${y},${z}`) ?? 0; }
  getBlockMetadata(x, y, z) { return this.metas.get(`${x},${y},${z}`) ?? 0; }
  setBlockMetadataWithNotify(x, y, z, m, f) { this.log.push(`meta,${x},${y},${z},${m},${f}`); this.metas.set(`${x},${y},${z}`, m); }
  scheduleBlockUpdate(x, y, z, id, d) { this.log.push(`tick,${x},${y},${z},${id},${d}`); }
  setBlock(x, y, z, id, m, f) { this.log.push(`set,${x},${y},${z},${id},${m},${f}`); this.put(x, y, z, id, m); }
  setBlockToAir(x, y, z) { this.log.push(`air,${x},${y},${z}`); this.blocks.delete(`${x},${y},${z}`); }
  isBlockIndirectlyGettingPowered(x, y, z) { return this.powered.has(`${x},${y},${z}`); }
  isNormalCube(id) { return id === 1; }
  primeTnt(x, y, z) { this.log.push("entitySound,game.tnt.primed,1.0,1.0"); this.spawned.push({ class: "xw", x: x + 0.5, y: y + 0.5, z: z + 0.5 }); }
}
function hostFor(w, tile) {
  const mk = (class_, e, extra = {}) => w.spawned.push({ class: class_, x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, ...extra });
  return {
    tile: () => tile,
    aux: (id, x, y, z, data) => w.log.push(`aux,${id},${x},${y},${z},${data}`),
    spawnItem: (s, x, y, z, mx, my, mz) => mk("xk", { x, y, z, mx, my, mz }, { stack: enc(s) }),
    arrow: (e) => mk("zc", e),
    thrown: (kind, e) => mk({ egg: "zl", snowball: "zj", potion: "zo" }[kind], e),
    cart: (type, x, y, z) => w.spawned.push({ class: type ? "xm" : "xs", x, y, z }),
    breakBlock: (x, y, z) => w.log.push(`break,${x},${y},${z},true`),
    spawnTnt: (x, y, z) => w.spawned.push({ class: "xw", x: x + 0.5, y: y + 0.5, z: z + 0.5 }),
    maxStack: () => 64,
  };
}
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);

// Original (Minecraft) item id for a port stack, found by probing itemFromOriginal (the port stores internal ids).
const ORIG = new Map();
for (let id = 1; id < 500; id++) { const m = itemFromOriginal(id, 0); if (m && !ORIG.has(m.id)) ORIG.set(m.id, id); }
const origId = (s) => ORIG.get(s.id) ?? TO_ORIGINAL[s.id] ?? s.id;
const encAny = (s) => (s ? [origId(s), s.count, s.damage ?? 0] : null);
const stackOf = (spec) => { if (spec === "x") return null; const [id, count, damage] = spec.split(":").map(Number); const m = itemFromOriginal(id, damage); return makeStack(m.id, count, m.damage ?? damage); };
const sparse = (list) => list.flatMap((v, i) => (v === null ? [] : [[i, v]]));
const mismatches = (rows, run, label) => {
  const bad = [];
  for (const r of rows) { const got = run(r); try { assert.deepEqual(got.actual, got.expected); } catch { bad.push(got.name + " " + JSON.stringify(got.actual) + " vs " + JSON.stringify(got.expected)); } }
  assert.equal(bad.length, 0, `${label}: ${bad.length} mismatches, first: ${bad[0]}`);
};

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { give: 180, inventory: 5400, furnace: 1500, brewing: 720, dispense: 302, hopper: 13 });
  for (const c of ["at", "yz", "xk", "apg", "aov", "apb", "akm", "zs"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("/give drops the whole stack along the view with pickup delay 0 and the player as owner; the inventory is untouched (180 records)", () => {
  mismatches(ref.give, (r) => {
    const rnd = new JavaRandom(BigInt(r.seed)), items = new ItemEntities(() => rnd.nextFloat());
    let dropped = null;
    const survival = new Survival(), env = {
      survival: () => survival, stackName: () => "x", refreshInventory() {},
      giveDrop: (s, owner) => { const e = items.dropPlayer(s, { x: 10.5, y: 64, z: -3.25 }, Math.PI - (r.yaw * Math.PI) / 180, (-r.pitch * Math.PI) / 180); if (e) { e.delay = 0; e.owner = owner; dropped = e; } },
    };
    const host = createCommandHost(env);
    host.give(264, r.count, 0, null);
    const e = dropped, near6 = (v) => Math.round(v * 1e6) / 1e6, near4 = (v) => Math.round(v * 1e4) / 1e4; // motion: the original uses float and table sine (~1e-5 off the port double trig)
    const actual = { n: items.items.length, x: near6(e.x), y: near6(e.y + 0.125), z: near6(e.z), m: [e.mx, e.my, e.mz], delay: e.delay, owner: e.owner, count: e.stack.count, empty: survival.inventory.main.every((s) => !s) && survival.inventory.armor.every((s) => !s) };
    const expected = { n: r.spawned, x: near6(r.x), y: near6(r.y), z: near6(r.z), m: [r.mx, r.my, r.mz], delay: r.delay, owner: r.owner, count: r.stack[1], empty: r.inventoryEmpty };
    // motion within 1e-4 (float and table sine natively); snap the port value onto the native one when close, so deepEqual still checks every other field
    actual.m = actual.m.map((v, i) => (Math.abs(v - expected.m[i]) < 1e-4 ? expected.m[i] : v));
    return { name: `give ${r.count} seed ${r.seed} yaw ${r.yaw} pitch ${r.pitch}`, actual, expected };
  }, "give");
});

test("container clicks, shift-clicks, number keys, drops, drags and closes with -n and 0 stacks (5400 records)", () => {
  const { script } = negStackScript(), actual = replay(script);
  assert.equal(actual.length, ref.inventory.length);
  const pack = (c) => [c.case, sparse(c.inventory), c.cursor, sparse(c.armor), c.current, sparse(c.slots), c.results, c.drops, c.broken];
  mismatches(ref.inventory, (r) => { const i = ref.inventory.indexOf(r); return { name: r[0], actual: pack(actual[i]), expected: r }; }, "inventory");
});

test("hopper transfers and pickups with -n and 0 stacks replay the native frames (13 scenarios)", () => {
  assert.equal(ref.hopper.length, hopperScenarios.length);
  for (const [i, native] of ref.hopper.entries()) {
    const s = hopperScenarios[i];
    assert.equal(native.name, s.name);
    const mine = replayHopperScenario(s);
    for (let t = 0; t < s.ticks; t++) assert.equal(JSON.stringify(mine.frames[t]), JSON.stringify(native.frames[t]), `${s.name} tick ${t + 1}`);
  }
});

test("furnace updateEntity with -2..2 stacks in input, fuel and output (1500 records)", () => {
  mismatches(ref.furnace, (r) => {
    const s = new Survival(), key = "0,0,0", items = r.slots.map(stackOf);
    s.furnaces[key] = { items, burn: r.hot ? 30 : 0, burnTotal: r.hot ? 50 : 0, cook: r.hot ? 5 : 0 };
    const snaps = [];
    for (let tick = 1; tick <= 206; tick++) {
      s.tickFurnaces();
      if (tick <= 3 || (tick >= 200 && tick <= 206) || tick === 100) { const f = s.furnaces[key]; snaps.push([tick, f.items.map(encAny), f.burn, f.burnTotal, f.cook, 0]); }
    }
    return { name: `furnace ${r.slots} hot ${r.hot}`, actual: snaps, expected: r.snaps.map(([t, sl, burn, cur, cook]) => [t, sl, burn, cur, cook, 0]) };
  }, "furnace");
});

test("brewing stand updateEntity with -2..2 stacks in the ingredient and bottle slots (720 records)", () => {
  mismatches(ref.brewing, (r) => {
    const stand = new BrewingStand();
    r.slots.forEach((sp, i) => (stand.slots[i] = stackOf(sp)));
    if (r.start) stand.brewTime = 5;
    stand.lastBits = stand.bottleBits(); // the native lastBits (l) field starts at 0 and the first tick writes the metadata: only the stack contents and the timer are compared
    const snaps = [];
    for (let tick = 1; tick <= 403; tick++) {
      stand.tick();
      if (tick <= 3 || (tick >= 398 && tick <= 403) || tick === 6) snaps.push([tick, stand.slots.map(encAny), stand.brewTime]);
    }
    return { name: `brewing ${r.slots} start ${r.start}`, actual: snaps, expected: r.snaps.map(([t, sl, k]) => [t, sl, k]) };
  }, "brewing");
});

test("dispenser and dropper rows with -2, -1 and 0 stacks replay in order", () => {
  const engine = new Dispensing({});
  mismatches(ref.dispense.filter((r) => r.kind === "dispense"), (r) => {
    const w = new Fake(r.seed), tile = { items: Array(9).fill(null) };
    r.slots.forEach((s, i) => (tile.items[i] = parse(s)));
    w.put(X, Y, Z, r.block, r.facing);
    const [fx, fy, fz] = FACE[r.facing];
    for (const c of r.cells) { const [dx, dy, dz, id, meta] = c.split(",").map(Number); w.put(X + fx + dx, Y + fy + dy, Z + fz + dz, id, meta); }
    engine.host = hostFor(w, tile);
    engine.slotRandom = new JavaRandom(555);
    dispenserBehaviour(engine, r.block === 158).updateTick(w, X, Y, Z);
    const strip = (e) => ({ c: e.class, stack: e.stack });
    return { name: `${r.name} ${r.block} f${r.facing} ${r.slots}`, actual: [tile.items.map(enc), w.log, w.rand.nextInt(1000000), w.spawned.map((e) => strip({ ...e, stack: e.stack }))], expected: [r.after, r.log, r.worldNext, r.spawned.map((e) => strip(e))] };
  }, "dispense");
  const INTERNAL = { 23: 115, 61: 14, 54: 41, 154: 133 };
  mismatches(ref.dispense.filter((r) => r.kind === "dropperInto"), (r) => {
    const w = new Fake(7), tile = { items: Array(9).fill(null) }, [fx, fy, fz] = FACE[r.facing], tx = X + fx, ty = Y + fy, tz = Z + fz;
    r.slots.forEach((s, i) => (tile.items[i] = parse(s)));
    w.put(X, Y, Z, 158, r.facing);
    const cells = new Map([[`${X},${Y},${Z}`, DROPPER_BLOCK], [`${tx},${ty},${tz}`, INTERNAL[r.target]]]);
    const dispensers = {}, chests = {}, furnaces = {}, hoppers = {};
    const targetKey = `${tx},${ty},${tz}`, targetItems = r.targetSlots.map(parse);
    if (r.target === 23) dispensers[targetKey] = { items: Array(9).fill(null).map((_, i) => targetItems[i] ?? null) };
    if (r.target === 61) furnaces[targetKey] = { items: [null, null, null].map((_, i) => targetItems[i] ?? null), burn: 0, burnTotal: 0, cook: 0 };
    if (r.target === 154) hoppers[targetKey] = { items: [null, null, null, null, null].map((_, i) => targetItems[i] ?? null), cooldown: 0, name: null };
    if (r.target === 54) chests[targetKey] = { facing: 3, items: Array(27).fill(null).map((_, i) => targetItems[i] ?? null) };
    const transfer = { world: { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0 }, chests: () => chests, furnaces: () => furnaces, dispensers: () => dispensers, hoppers: () => hoppers, maxStack: () => 64, burnTime: (s) => (s.id === 263 ? 1600 : 0), changed() {} };
    const host = { ...hostFor(w, tile), transfer: () => transfer };
    const engine2 = new Dispensing(host, { slotRandom: new JavaRandom(555) });
    dispenserBehaviour(engine2, true).updateTick(w, X, Y, Z);
    const got = (r.target === 23 ? dispensers[targetKey].items : r.target === 61 ? furnaces[targetKey].items : r.target === 154 ? hoppers[targetKey].items : chests[targetKey].items).slice(0, r.targetAfter.length);
    return { name: `${r.name} f${r.facing} ${r.slots} -> ${r.targetSlots}`, actual: [tile.items.map(enc), got.map(enc), w.log, w.spawned.length], expected: [r.after, r.targetAfter, r.log, r.spawned.length] };
  }, "dropperInto");
});
