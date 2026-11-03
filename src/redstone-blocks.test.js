// Redstone component blocks (inert, no power network): replays public/research/redstone-blocks-reference.json,
// recorded from the unchanged 1.7.10 classes by tools/verify-redstone-blocks.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, BLOCKS, blockBounds, selectionBounds, collisionBounds, collisionBoxes, normalCube, opaqueCube, FENCE } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS, MATERIALS, craftingResult } from "./survival.js";
import { makeStack } from "./inventory.js";
import { populationDrops, POPULATION_ITEMS } from "./population-content.js";
import { lightOpacity } from "./lighting.js";
import { explosionResistance } from "./explosion.js";
import { blockSound } from "./audio.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import {
  REDSTONE_WIRE, LEVER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, REPEATER, TRIPWIRE_HOOK, TRIPWIRE,
  ITEM_REDSTONE, ITEM_STRING, ITEM_REPEATER, ITEM_LEVER, ITEM_STONE_PLATE, ITEM_WOODEN_PLATE, ITEM_STONE_BUTTON, ITEM_TRIPWIRE_HOOK,
  isRedstoneBlock, redstoneBounds, redstonePlacedMeta, redstoneSupported, redstoneActivate, buttonRelease, providesPowerOrWire,
  wireArms, wireClimbs, wireTint, itemOfBlock, blockOfItem, redstoneDrops, RedstoneBlocks, yawQuadrant,
} from "./redstone-blocks.js";

const ref = JSON.parse(await readFile(new URL("../public/research/redstone-blocks-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const ORIGINAL = { 55: REDSTONE_WIRE, 69: LEVER, 70: STONE_PRESSURE_PLATE, 72: WOODEN_PRESSURE_PLATE, 77: STONE_BUTTON, 93: REPEATER, 94: REPEATER, 131: TRIPWIRE_HOOK, 132: TRIPWIRE };
const ITEM_BLOCK = { 331: REDSTONE_WIRE, 69: LEVER, 70: STONE_PRESSURE_PLATE, 72: WOODEN_PRESSURE_PLATE, 77: STONE_BUTTON, 356: REPEATER, 131: TRIPWIRE_HOOK, 287: TRIPWIRE };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const nearBox = (a, b) => a.every((v, i) => near(v, b[i]));
// A minimal world: a cell map with get/getMeta/set.
function grid(cells = {}) {
  const m = new Map(Object.entries(cells));
  const key = (x, y, z) => `${x},${y},${z}`;
  return {
    get: (x, y, z) => m.get(key(x, y, z))?.[0] ?? 0,
    getMeta: (x, y, z) => m.get(key(x, y, z))?.[1] ?? 0,
    put(x, y, z, b, meta = 0) { if (b) m.set(key(x, y, z), [b, meta]); else m.delete(key(x, y, z)); },
    set(x, y, z, b, track = true, meta = 0) { const old = this.get(x, y, z); this.put(x, y, z, b, meta); if (track) this.onChange?.(x, y, z, old, b); return true; },
  };
}

test("ids, names and item mappings", () => {
  assert.deepEqual([REDSTONE_WIRE, LEVER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, REPEATER, TRIPWIRE_HOOK, TRIPWIRE], [107, 108, 109, 110, 111, 112, 113, 114]);
  assert.deepEqual([107, 108, 109, 110, 111, 112, 113, 114].map((i) => BLOCKS[i].name), ["Redstone wire", "Lever", "Stone pressure plate", "Wooden pressure plate", "Stone button", "Redstone repeater", "Tripwire hook", "Tripwire"]);
  for (const [original, id] of Object.entries(ORIGINAL)) assert.equal(isRedstoneBlock(id), true, original);
  assert.equal(isRedstoneBlock(106) || isRedstoneBlock(115), false);
  // Tools own item ids 100-127, so block items are 1000 + block id; dust, repeater and string keep the build's items.
  assert.deepEqual([ITEM_LEVER, ITEM_STONE_PLATE, ITEM_WOODEN_PLATE, ITEM_STONE_BUTTON, ITEM_TRIPWIRE_HOOK, ITEM_REDSTONE, ITEM_REPEATER, ITEM_STRING], [1108, 1109, 1110, 1111, 1113, 360, 356, 321]);
  for (const id of [107, 108, 109, 110, 111, 112, 113, 114]) assert.equal(blockOfItem(itemOfBlock(id)), id);
  assert.deepEqual([69, 70, 72, 77, 131, 356].map((o) => POPULATION_ITEMS[o]), [1108, 1109, 1110, 1111, 1113, 356]);
  assert.equal(itemFromOriginal(331, 0).id, 360);
  assert.equal(itemFromOriginal(287, 0).id, 321);
  assert.equal(itemFromOriginal(69, 0).id, 1108);
  assert.equal(itemFromOriginal(356, 0).id, 356);
  for (const id of [1108, 1109, 1110, 1111, 1113, 356, 360, 321]) assert.ok(ITEMS[id], `item ${id}`);
  for (const id of [1108, 1109, 1110, 1111, 1113]) assert.equal(ITEMS[id].block, true);
});

test("registry maps the original ids, with the powered repeater kept in state", () => {
  for (const [o, id] of Object.entries(ORIGINAL)) {
    const r = fromOriginal(+o, 0);
    assert.equal(r.id, id, `original ${o}`);
    assert.equal(r.exact, true);
  }
  assert.equal(fromOriginal(94, 6).state?.powered, true);
  assert.equal(fromOriginal(93, 6).state?.powered, undefined);
  assert.deepEqual(toOriginal(REPEATER, 6, undefined), [93, 6]);
  assert.deepEqual(toOriginal(REPEATER, 6, { powered: true }), [94, 6]);
  for (const [o, id] of [[69, LEVER], [77, STONE_BUTTON], [131, TRIPWIRE_HOOK], [132, TRIPWIRE], [55, REDSTONE_WIRE]]) for (let m = 0; m < 16; m++) assert.deepEqual(toOriginal(id, m), [o, m]);
});

test("block facts match the unchanged classes", () => {
  const facts = by("facts");
  assert.equal(facts.length, 9);
  for (const f of facts) {
    const id = ORIGINAL[f.id];
    assert.ok(MATERIALS[id], f.block);
    const hardness = MATERIALS[id].hardness;
    assert.equal(hardness, f.hardness, `${f.block} hardness`);
    assert.equal(blockSound(id), f.sound.break === "dig.wood" ? "wood" : "stone", `${f.block} sound`);
    assert.equal(normalCube(id), false, `${f.block} is not a normal cube`);
    assert.equal(lightOpacity(id), f.opacity, `${f.block} opacity`);
    assert.equal(explosionResistance(id), f.resistance / 5, `${f.block} resistance`);
    // Drops: the original ids map to the build's items.
    const drop = f.drop[0], expected = drop === 331 ? ITEM_REDSTONE : drop === 287 ? ITEM_STRING : drop === 356 ? ITEM_REPEATER : drop === 94 ? ITEM_REPEATER : POPULATION_ITEMS[drop];
    assert.deepEqual(redstoneDrops(id).map((d) => d.id), [expected], `${f.block} drop`);
    assert.deepEqual(populationDrops(id, 0).map((d) => d.id), [expected]);
    assert.equal(MATERIALS[id].drop, expected);
    assert.equal(f.damageDropped.every((d) => d === 0), true);
  }
  assert.equal(MATERIALS[STONE_PRESSURE_PLATE].kind, "pickaxe"); // Material.rock requires a tool
  assert.equal(by("facts").find((f) => f.id === 70).requiresTool, true);
});

test("bounds, selection and collision per metadata", () => {
  const rows = by("bounds");
  assert.equal(rows.length, 144);
  let checked = 0;
  for (const r of rows) {
    const id = ORIGINAL[r.id];
    if (id === STONE_BUTTON && ((r.meta & 7) < 1 || (r.meta & 7) > 4)) continue; // metadata 0 and 5-7 never occur on a placed button
    const w = grid({ "0,0,0": [id, r.meta] });
    assert.ok(nearBox(redstoneBounds(id, r.meta), r.bounds), `${r.id}:${r.meta} bounds ${redstoneBounds(id, r.meta)} vs ${r.bounds}`);
    assert.ok(nearBox(redstoneBounds(id, r.meta), r.selection), `${r.id}:${r.meta} selection`);
    void w;
    checked++;
  }
  assert.ok(checked > 120);
  // Through the real world: blockBounds / selectionBounds / collision.
  const world = new World("redstone-blocks");
  for (const r of rows) {
    const id = ORIGINAL[r.id];
    if (id === STONE_BUTTON && ((r.meta & 7) < 1 || (r.meta & 7) > 4)) continue;
    world.set(5, 20, 5, id, false, r.meta);
    assert.ok(nearBox(blockBounds(world, 5, 20, 5), r.bounds));
    assert.ok(nearBox(selectionBounds(world, 5, 20, 5), r.selection));
    if (r.collision) {
      assert.ok(nearBox(collisionBounds(world, 5, 20, 5), r.collision));
      assert.equal(collisionBoxes(world, 5, 20, 5).length, 1);
      assert.equal(world.solid(5, 20, 5), true);
    } else assert.equal(world.solid(5, 20, 5), false, `${r.id}:${r.meta} has no collision`);
  }
  assert.ok(rows.filter((r) => r.collision).every((r) => r.id === 93 || r.id === 94));
});

test("placement metadata per face and yaw", () => {
  const rows = by("place");
  assert.ok(rows.length >= 400);
  let n = 0;
  for (const r of rows) {
    const id = ITEM_BLOCK[r.item];
    const cells = { "0,2,0": [1, 0], "0,0,0": [1, 0] };
    delete cells["0,0,0"];
    const SIDE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]], NEIGH = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0]];
    const q = [0 - SIDE[r.side][0], 1 - SIDE[r.side][1], 0 - SIDE[r.side][2]];
    const world = grid({ [q.join(",")]: [1, 0] });
    if (r.mode === 1) for (const d of NEIGH) world.put(d[0], 1 + d[1], d[2], 1, 0);
    // rotationYaw -> camera yaw in radians (rotationYaw = 180 - yaw * 180 / pi)
    const yaw = ((180 - r.yaw) * Math.PI) / 180;
    const meta = redstonePlacedMeta(world, id, 0, 1, 0, r.side, yaw);
    if (r.cell) assert.equal(meta, r.cell[1], `item ${r.item} side ${r.side} yaw ${r.yaw} mode ${r.mode}: ${meta} vs ${r.cell}`);
    else assert.equal(meta, null, `item ${r.item} side ${r.side} yaw ${r.yaw} mode ${r.mode} should fail`);
    n++;
  }
  assert.equal(n, rows.length);
  assert.equal(yawQuadrant((180 - 44.9) * Math.PI / 180), 0);
  assert.equal(yawQuadrant((180 - 45.1) * Math.PI / 180), 1);
});

test("the neighbour that holds a lever, button or hook is the one named by the side", () => {
  const sides = by("sides");
  assert.equal(sides.length, 3);
  const SIDE = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
  for (const r of sides) {
    const id = ORIGINAL[r.id];
    assert.equal(r.can.length, 64);
    for (let s = 0; s < 6; s++) for (let k = 0; k < 64; k++) {
      const world = grid();
      // bit (5 - s) of k: the block the face-s placement would attach to is solid
      if ((k >> (5 - s)) & 1) world.put(SIDE[s][0], 1 + SIDE[s][1], SIDE[s][2], 1, 0);
      const placed = redstonePlacedMeta(world, id, 0, 1, 0, s, 0) !== null;
      assert.equal(placed, r.onSide[s][k] === "1", `${r.id} side ${s} mask ${k}`);
    }
  }
});

test("support below dust, plates, repeaters and tripwire, per ground block", () => {
  let n = 0;
  for (const r of by("below")) {
    const ground = fromOriginal(r.id, 0);
    if (!ground || !ground.exact) continue;
    const world = grid({ "0,0,0": [ground.id, ground.meta] });
    const at = (id, meta) => redstoneSupported(world, id, 0, 1, 0, meta);
    assert.equal(at(REDSTONE_WIRE, 0), !!(r.can55 & 1) || r.id === 89, `wire on ${r.id}`);
    assert.equal(at(REDSTONE_WIRE, 0), !(r.gone55 & 1), `wire stays on ${r.id}`);
    assert.equal(at(REPEATER, 0), !(r.gone93 & 1), `repeater stays on ${r.id}`);
    assert.equal(at(STONE_PRESSURE_PLATE, 0), !(r.gone70 & 1), `plate stays on ${r.id}`);
    assert.equal(at(WOODEN_PRESSURE_PLATE, 0), !(r.gone72 & 1), `plate stays on ${r.id}`);
    assert.equal(at(TRIPWIRE, 0), !(r.gone132 & 1), `tripwire stays on ${r.id}`);
    assert.equal(at(TRIPWIRE, 2), !((r.gone132d >> 2) & 1) && !((r.gone132d >> 2) & 1) ? true : !((r.gone132d >> 2) & 1), `suspended tripwire over ${r.id}`);
    n++;
  }
  assert.ok(n > 40, `checked ${n} ground blocks`);
});

test("lever, button and repeater right-clicks and the button release", () => {
  const rows = by("activate");
  assert.equal(rows.length, 64);
  for (const r of rows) {
    const id = ORIGINAL[r.id];
    if (id === STONE_BUTTON && ((r.meta & 7) < 1 || (r.meta & 7) > 4)) continue;
    const used = redstoneActivate(id, r.meta);
    assert.equal(used.meta, r.after, `${r.id}:${r.meta}`);
    const sound = r.events.find((e) => e.startsWith("sound:"));
    assert.equal(used.sound ? `sound:${used.sound[0]}:${used.sound[1]}:${used.sound[2]}` : undefined, sound, `${r.id}:${r.meta} sound`);
    const sched = r.events.find((e) => e.startsWith("schedule:"));
    assert.equal(used.release, sched ? 20 : undefined, `${r.id}:${r.meta} release`);
  }
  for (const r of by("buttonTick")) {
    if ((r.meta & 7) < 1 || (r.meta & 7) > 4) continue;
    const released = buttonRelease(r.meta);
    assert.equal(released ? released.meta : r.meta, r.after);
    assert.equal(released ? `sound:${released.sound.join(":")}` : undefined, r.events.find((e) => e.startsWith("sound:")));
  }
});

test("a pressed button releases on the 20th tick and a lever toggles in the live edit", () => {
  const world = grid({ "0,0,0": [1, 0], "0,1,0": [STONE_BUTTON, 3] });
  world.put(0, 0, -1, 1, 0);
  const sounds = [], changes = [];
  const rs = new RedstoneBlocks(world, { apply: (c) => changes.push(...c), sound: (...a) => sounds.push(a) });
  world.set(0, 1, 0, STONE_BUTTON, true, 11);
  rs.schedule(0, 1, 0, 20);
  for (let i = 0; i < 19; i++) rs.tick();
  assert.equal(world.getMeta(0, 1, 0), 11);
  rs.tick();
  assert.equal(world.getMeta(0, 1, 0), 3);
  assert.deepEqual(sounds[0].slice(0, 3), ["random.click", 0.3, 0.5]);
  assert.equal(rs.pending.length, 0);
});

test("dust connection masks (f and g) and the connection shape", () => {
  for (const r of by("wireConnect")) {
    const id = ORIGINAL[r.id];
    if (!id) continue;
    for (let m = 0; m < 16; m++) {
      for (let k = 0; k < 5; k++) assert.equal(providesPowerOrWire(id, m, k - 1), !!((r.f[k] >> m) & 1), `${r.id} meta ${m} dir ${k - 1}`);
      for (let k = 0; k < 4; k++) assert.equal(providesPowerOrWire(id, m, k), !!((r.g[k] >> m) & 1));
    }
  }
  // Dust beside a lever, down a step, and over a step.
  const w = grid({ "0,0,0": [1, 0], "0,1,0": [REDSTONE_WIRE, 0], "1,1,0": [LEVER, 4], "-1,0,0": [1, 0] });
  assert.deepEqual(wireArms(w, 0, 1, 0), { w: false, e: true, n: false, s: false });
  w.put(-1, 0, 0, 0); w.put(-1, -1, 0, 1, 0); w.put(-1, 0, 0, REDSTONE_WIRE, 0);
  assert.equal(wireArms(w, 0, 1, 0).w, true, "dust one step down connects");
  w.put(-1, 0, 0, 0); w.put(-1, 1, 0, 1, 0); w.put(-1, 2, 0, REDSTONE_WIRE, 0);
  assert.equal(wireArms(w, 0, 1, 0).w, true, "dust one step up over a solid block connects");
  assert.equal(wireClimbs(w, 0, 1, 0).w, true);
  w.put(0, 2, 0, 1, 0);
  assert.equal(wireArms(w, 0, 1, 0).w, false, "a solid block above cuts the step up");
  assert.deepEqual(wireTint(0).map((v) => Math.fround(v)), [Math.fround(0.3), 0, 0]);
  assert.ok(near(wireTint(15)[0], 1) && near(wireTint(15)[1], 0.2) && near(wireTint(15)[2], 0));
});

test("unsupported components drop when the support goes", () => {
  const drops = [], world = grid({ "0,0,0": [1, 0], "0,1,0": [REDSTONE_WIRE, 0], "3,1,0": [LEVER, 5], "3,0,0": [1, 0], "6,1,0": [STONE_BUTTON, 1], "5,1,0": [1, 0] });
  new RedstoneBlocks(world, { drop: (s, x, y, z) => drops.push([s[0].id, x, y, z]) }).watch();
  world.set(0, 0, 0, 0);
  world.set(3, 0, 0, 0);
  world.set(5, 1, 0, 0);
  assert.deepEqual(drops, [[ITEM_REDSTONE, 0, 1, 0], [ITEM_LEVER, 3, 1, 0], [ITEM_STONE_BUTTON, 6, 1, 0]]);
  assert.equal(world.get(0, 1, 0), 0);
  // Tripwire needs support exactly when it is not suspended.
  const t = grid({ "0,0,0": [1, 0] });
  assert.equal(redstoneSupported(t, TRIPWIRE, 0, 1, 0, 0), true);
  assert.equal(redstoneSupported(t, TRIPWIRE, 0, 1, 0, 2), false);
  // A plate stands on a fence as well.
  t.put(4, 0, 0, FENCE, 0);
  assert.equal(redstoneSupported(t, STONE_PRESSURE_PLATE, 4, 1, 0, 0), true);
  assert.equal(redstoneSupported(t, REDSTONE_WIRE, 4, 1, 0, 0), false);
});

test("placing the held items in a real world and the recipes", () => {
  const world = new World("redstone-place");
  const base = [10, 20, 10];
  world.set(...base, 1, false, 0);
  const survival = { creative: true, count: () => 1, take() {}, held: { damage: 0 }, chests: new Map() };
  const state = { world, survival, position: { x: 0, y: 60, z: 0 }, flowers: {}, farming: { observe() {} }, yaw: 0 };
  const place = (itemId, adj, here = base) => placeHeldBlock(state, { id: itemId, item: ITEMS[itemId], target: { block: here, adjacent: adj } }, { collides: () => false });
  for (const c of [[10, 21, 10], [11, 20, 10], [11, 19, 10], [11, 20, 12], [11, 19, 12], [10, 19, 10]]) world.set(...c, 0, false, 0);
  let r = place(ITEM_LEVER, [10, 21, 10]);
  assert.equal(r.placed, true);
  assert.deepEqual([world.get(10, 21, 10), world.getMeta(10, 21, 10)], [LEVER, 5]);
  r = place(ITEM_REDSTONE, [11, 20, 10], [11, 19, 10]);
  assert.equal(r.placed, false, "dust needs a solid top below its cell");
  world.set(11, 19, 10, 1, false, 0);
  r = place(ITEM_REDSTONE, [11, 20, 10], [11, 19, 10]);
  assert.equal(r.placed, true);
  assert.equal(world.get(11, 20, 10), REDSTONE_WIRE);
  r = place(ITEM_REPEATER, [11, 20, 12], [11, 19, 12]);
  assert.equal(r.placed, false, "no support below");
  // Recipes (CraftingManager): lever, plates, button, hook.
  const cell = (id) => (id ? makeStack(id, 1, 0) : null);
  assert.equal(craftingResult([cell(300), null, cell(12), null], 2)?.id, ITEM_LEVER);
  assert.equal(craftingResult([cell(3), cell(3), null, null], 2)?.id, ITEM_STONE_PLATE);
  assert.equal(craftingResult([cell(7), cell(7), null, null], 2)?.id, ITEM_WOODEN_PLATE);
  assert.equal(craftingResult([cell(3), null, null, null], 2)?.id, ITEM_STONE_BUTTON);
  const hook = craftingResult([cell(302), null, null, cell(300), null, null, cell(7), null, null], 3);
  assert.equal(hook?.id, ITEM_TRIPWIRE_HOOK);
  assert.equal(hook?.count, 2);
});
