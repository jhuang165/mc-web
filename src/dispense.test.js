import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { Dispensing, dispenserBehaviour, chooseSlot, addItemStack, ITEM, DISPENSER_ID, DROPPER_ID } from "./dispense.js";

const ref = JSON.parse(await readFile(new URL("../public/research/dispense-reference.json", import.meta.url)));
const X = 10, Y = 64, Z = 10;
const FACE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
// Original item ids of the probe -> this build's item ids (everything else is an inert item that keeps its id).
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

test("slot choice replays TileEntityDispenser.func_146017_i", () => {
  const rows = ref.rows.filter((r) => r.kind === "slotChoice");
  assert.ok(rows.length >= 30);
  for (const r of rows) {
    const items = r.pattern.map((p) => (p === null ? null : { id: 1, count: p })), rand = new JavaRandom(r.seed);
    assert.deepEqual(r.picks.map(() => chooseSlot(items, rand)), r.picks, JSON.stringify(r));
  }
});
test("addItemStack takes the first empty slot", () => {
  const items = Array(9).fill(null);
  for (const r of ref.rows.filter((r) => r.kind === "addItemStack")) assert.equal(addItemStack(items, { id: 1, count: 1 }), r.slot);
  assert.equal(addItemStack(items, { id: 1, count: 1 }), -1);
});
test("onBlockAdded and onNeighborBlockChange replay both blocks", () => {
  for (const r of ref.rows.filter((r) => r.kind === "added")) {
    const w = new Fake(1), b = dispenserBehaviour(new Dispensing({}), r.block === 158);
    w.put(X, Y, Z, r.block, 0);
    if (r.mask & 1) w.put(X, Y, Z - 1, 1); if (r.mask & 2) w.put(X, Y, Z + 1, 1); if (r.mask & 4) w.put(X - 1, Y, Z, 1); if (r.mask & 8) w.put(X + 1, Y, Z, 1);
    b.onBlockAdded(w, X, Y, Z);
    assert.equal(w.getBlockMetadata(X, Y, Z), r.meta, JSON.stringify(r));
  }
  for (const r of ref.rows.filter((r) => r.kind === "neighbour")) {
    const w = new Fake(1), b = dispenserBehaviour(new Dispensing({}), r.block === 158);
    w.put(X, Y, Z, r.block, r.meta);
    if (r.mode & 1) w.powered.add(`${X},${Y},${Z}`);
    if (r.mode & 2) w.powered.add(`${X},${Y + 1},${Z}`);
    b.onNeighborBlockChange(w, X, Y, Z);
    assert.deepEqual(w.log, r.log, JSON.stringify(r));
    assert.equal(w.getBlockMetadata(X, Y, Z), r.metaAfter);
  }
  assert.equal(ref.rows.find((r) => r.kind === "tickRate").dispenser, 4);
});

test("every dispense row replays in order (sticky flint and bone meal flags included)", () => {
  const engine = new Dispensing({}), rows = ref.rows.filter((r) => r.kind === "dispense");
  assert.equal(rows.length, 216);
  let projectiles = 0;
  for (const r of rows) {
    const w = new Fake(r.seed), tile = { items: Array(9).fill(null) };
    r.slots.forEach((s, i) => (tile.items[i] = parse(s)));
    w.put(X, Y, Z, r.block, r.facing);
    const [fx, fy, fz] = FACE[r.facing];
    for (const c of r.cells) { const [dx, dy, dz, id, meta] = c.split(",").map(Number); w.put(X + fx + dx, Y + fy + dy, Z + fz + dz, id, meta); }
    engine.host = hostFor(w, tile);
    engine.slotRandom = new JavaRandom(555);
    dispenserBehaviour(engine, r.block === 158).updateTick(w, X, Y, Z);
    const label = `${r.name} f${r.facing} s${r.seed} ${r.slots}`;
    assert.deepEqual(tile.items.map(enc), r.after, label);
    assert.deepEqual(w.log, r.log, label);
    assert.equal(w.rand.nextInt(1000000), r.worldNext, label);
    assert.equal(w.spawned.length, r.spawned.length, label);
    r.spawned.forEach((e, i) => {
      const g = w.spawned[i];
      assert.equal(g.class, e.class, label);
      for (const k of ["x", "y", "z"]) near(g[k], e[k], `${label} ${k}`);
      if (e.class === "xk") { for (const k of ["mx", "my", "mz"]) assert.equal(g[k], e[k], `${label} ${k}`); assert.deepEqual(g.stack, e.stack, label); }
      if (e.class === "zc" || e.class === "zl" || e.class === "zj" || e.class === "zo") { projectiles++; assert.ok(Math.hypot(g.mx, g.my, g.mz) > 0.5 && Math.hypot(g.mx, g.my, g.mz) < 1.8, label); }
    });
  }
  assert.ok(projectiles >= 20);
});

test("projectile headings replay with a seeded entity Random", () => {
  const rows = ref.rows.filter((r) => r.kind === "heading" && r.projectile);
  assert.equal(rows.length, 54);
  const engine = new Dispensing({});
  for (const r of rows) {
    const w = new Fake(1), tile = { items: Array(9).fill(null) };
    tile.items[0] = parse(r.item);
    w.put(X, Y, Z, 23, r.facing);
    engine.host = hostFor(w, tile);
    engine.entityRandom = () => new JavaRandom(r.seed);
    engine.slotRandom = new JavaRandom(1);
    dispenserBehaviour(engine, false).updateTick(w, X, Y, Z);
    const e = r.entity, g = w.spawned.at(-1);
    assert.equal(g.class, e.class);
    for (const k of ["mx", "my", "mz"]) near(g[k], e[k], `${r.item} f${r.facing} s${r.seed} ${k}`);
    for (const k of ["yaw", "pitch"]) assert.equal(Math.fround(g[k]), Math.fround(e[k]), `${r.item} f${r.facing} s${r.seed} ${k}`);
  }
});

test("dropper replays BlockDropper.dispense into containers and the default drop", async () => {
  const { DROPPER_BLOCK } = await import("./dispense.js");
  const INTERNAL = { 23: 115, 61: 14, 54: 41, 154: 133 };
  const rows = ref.rows.filter((r) => r.kind === "dropperInto");
  assert.equal(rows.length, 36);
  for (const r of rows) {
    const w = new Fake(7), tile = { items: Array(9).fill(null) }, [fx, fy, fz] = FACE[r.facing], tx = X + fx, ty = Y + fy, tz = Z + fz;
    r.slots.forEach((s, i) => (tile.items[i] = parse(s)));
    w.put(X, Y, Z, 158, r.facing);
    const store = { [`${tx},${ty},${tz}`]: null }, cells = new Map([[`${X},${Y},${Z}`, DROPPER_BLOCK], [`${tx},${ty},${tz}`, INTERNAL[r.target]]]);
    const dispensers = {}, chests = {}, furnaces = {}, hoppers = {};
    const targetKey = `${tx},${ty},${tz}`, targetItems = r.targetSlots.map(parse);
    if (r.target === 23) dispensers[targetKey] = { items: Array(9).fill(null).map((_, i) => targetItems[i] ?? null) };
    if (r.target === 61) furnaces[targetKey] = { items: [null, null, null].map((_, i) => targetItems[i] ?? null), burn: 0, burnTotal: 0, cook: 0 };
    if (r.target === 154) hoppers[targetKey] = { items: [null, null, null, null, null].map((_, i) => targetItems[i] ?? null), cooldown: 0, name: null };
    if (r.target === 54) chests[targetKey] = { facing: 3, items: Array(27).fill(null).map((_, i) => targetItems[i] ?? null) };
    const transfer = { world: { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0 }, chests: () => chests, furnaces: () => furnaces, dispensers: () => dispensers, hoppers: () => hoppers, maxStack: () => 64, burnTime: (s) => (s.id === 263 ? 1600 : 0), changed() {} };
    const host = { ...hostFor(w, tile), transfer: () => transfer };
    const engine = new Dispensing(host, { slotRandom: new JavaRandom(555) });
    dispenserBehaviour(engine, true).updateTick(w, X, Y, Z);
    const label = `${r.name} f${r.facing}`;
    assert.deepEqual(tile.items.map(enc), r.after, label);
    const got = (r.target === 23 ? dispensers[targetKey].items : r.target === 61 ? furnaces[targetKey].items : r.target === 154 ? hoppers[targetKey].items : chests[targetKey].items).slice(0, r.targetAfter.length);
    assert.deepEqual(got.map(enc), r.targetAfter, label);
    assert.deepEqual(w.log, r.log, label);
    assert.equal(w.spawned.length, r.spawned.length, label);
  }
});

test("live runtime: a powered dropper fires after four ticks into a chest-less cell and a dispenser throws an item", async () => {
  const { World } = await import("./world.js");
  const { fromOriginal } = await import("./block-registry.js");
  const { createRedstoneRuntime } = await import("./redstone-runtime.js");
  for (const [orig, name] of [[23, "dispenser"], [158, "dropper"]]) {
    const world = new World(`dispense-${name}`, "meadow"), O = [20, 20, 20], dispensers = {}, thrown = [], clicks = [];
    for (let x = -3; x <= 3; x++) for (let y = -2; y <= 3; y++) for (let z = -3; z <= 3; z++) world.put(O[0] + x, O[1] + y, O[2] + z, 0, 0, false);
    const put = (dx, dy, dz, id, meta) => { const m = fromOriginal(id, meta); world.put(O[0] + dx, O[1] + dy, O[2] + dz, m.id, m.meta, false); };
    put(0, 0, 0, orig, 3);
    dispensers[`${O[0]},${O[1]},${O[2]}`] = { items: [{ id: 280, count: 2, damage: 0 }, ...Array(8).fill(null)] };
    const runtime = createRedstoneRuntime({ world, game: {
      dispensers: () => dispensers, maxStack: () => 64, sound: (n) => clicks.push(n),
      dispense: { spawnItem: (s, x, y, z, mx, my, mz) => thrown.push({ s, x, y, z, mz }) },
    } });
    put(1, 0, 0, 152, 0); // redstone block beside it
    runtime.redstone.placed(O[0] + 1, O[1], O[2]);
    runtime.flush();
    assert.equal(thrown.length, 0, "not before the 4-tick delay");
    for (let i = 0; i < 6; i++) runtime.tick();
    assert.equal(thrown.length, 1, name);
    assert.equal(dispensers[`${O[0]},${O[1]},${O[2]}`].items[0].count, 1);
    assert.ok(thrown[0].mz > 0, "facing south throws toward +z");
    assert.ok(clicks.includes("random.click"));
    runtime.dispose();
  }
});
