import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, BLOCKS, WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE, FENCE, blockBounds, selectionBounds, collisionBounds, collisionBoxes } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS, MATERIALS, Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { JavaRandom } from "./java-random.js";
import { digSpeed, canHarvest } from "./mining.js";
import { explosionResistance } from "./explosion.js";
import { lightOpacity } from "./lighting.js";
import { hasSilkTouchDrop } from "./enchantment-effects.js";
import { populationDrops, POPULATION_ITEMS } from "./population-content.js";
import { CREATIVE_TABS } from "./creative.js";
import { interceptBox } from "./stairs.js";
import { breakPlayerBlock } from "./block-break-simulation.js";
import {
  WOODEN_DOOR_ITEM, IRON_DOOR_ITEM, GLASS_PANE_ITEM, blockItemId, paneItemBlock, doorItem, doorFlags, doorPassable, activateDoor, setDoorOpen, useDoorItem, canPlaceDoor, doorPlacedFacing,
  Doors, doorNeighbourChange, paneConnectsTo, paneSideRendered, doorRotationYaw,
} from "./doors-panes.js";
import { fenceConnectsTo } from "./fences.js";

const ref = JSON.parse(await readFile(new URL("../public/research/doors-panes-reference.json", import.meta.url)));
const by = (c, kind) => ref.records.filter((r) => r.case === c && (kind === undefined || r.kind === kind));
const X = 8, Y = 30, Z = 8, f = Math.fround;
const world = new World("doors-panes");
const dropped = [];
new Doors(world, { drop: (stacks, x, y, z) => dropped.push(...stacks.map((s) => ({ ...s, x, y, z }))) }).watch();

const clear = () => { for (let x = 3; x <= 13; x++) for (let y = Y - 4; y <= Y + 5; y++) for (let z = 3; z <= 13; z++) world.put(x, y, z, 0, 0, false); dropped.length = 0; };
const exact = (id, meta = 0) => { const m = fromOriginal(id, meta); return m?.exact ? m : null; };
const put = (x, y, z, id, meta = 0) => { const m = exact(id, meta); if (!m) return false; world.put(x, y, z, m.id, m.meta, false); return true; };
const cell = (x, y, z) => { const o = toOriginal(world.get(x, y, z), world.getMeta(x, y, z)); return o ? [o[0], o[1]] : [-1, -1]; };
const cells = (list) => list.map((p) => cell(...p));
const near = (a, b, m) => assert.equal(a.length, b.length, m) || a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${m}: ${a} vs ${b}`));
const stackIds = (arr) => arr.map((s) => `${s.id}x${s.count ?? 1}`).sort();
const nativeDrops = (rows) => rows.map((d) => `${itemFromOriginal(d[0], d[2]).id}x${d[1]}`).sort();
const internal = (orig) => fromOriginal(orig, 0).id;
function doorWorld(id, lower, upper) {
  clear();
  put(X, Y - 1, Z, 1, 0);
  put(X, Y, Z, id, lower); put(X, Y + 1, Z, id, upper);
}
const RAYS = (() => {
  const r = [], off = [0.1, 0.3, 0.5, 0.7, 0.9];
  for (const o of off) r.push([-1, .5, o, 2, .5, o], [2, .5, o, -1, .5, o], [o, .5, -1, o, .5, 2], [o, .5, 2, o, .5, -1]);
  r.push([.5, -1, .5, .5, 2, .5], [.5, 2, .5, .5, -1, .5], [.1, 2, .5, .1, -1, .5], [.9, 2, .5, .9, -1, .5]);
  return r;
})();
function checkShape(s, x, y, z, label) {
  near(blockBounds(world, x, y, z), s.bounds, `${label} bounds`);
  near(selectionBounds(world, x, y, z), s.selection, `${label} selection`);
  const boxes = collisionBoxes(world, x, y, z);
  // One-box callers get the union of the arms (the native single collision box is the full bounds, which only
  // matters for panes: movement itself reads the arm boxes).
  const union = s.boxes.length ? [0, 1, 2].map((i) => Math.min(...s.boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...s.boxes.map((b) => b[i])))) : s.collision;
  near(collisionBounds(world, x, y, z), union, `${label} collision`);
  assert.equal(boxes.length, s.boxes.length, `${label} box count`);
  boxes.forEach((b, i) => near(b, s.boxes[i], `${label} box ${i}`));
  RAYS.forEach((r, i) => {
    const hit = interceptBox(selectionBounds(world, x, y, z), r.slice(0, 3), r.slice(3)), want = s.rays[i];
    if (!want) return assert.equal(hit, null, `${label} ray ${i}`);
    assert.ok(hit, `${label} ray ${i} hit`);
    assert.equal(hit.side, want[0], `${label} ray ${i} side`);
    near(hit.vec.map((v) => Math.round(v * 1e6) / 1e6), want.slice(1), `${label} ray ${i}`);
  });
}

test("registry, items, creative listing, recipes and block facts match the native classes", () => {
  assert.deepEqual([WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE], [97, 98, 99, 100]);
  assert.deepEqual([doorItem(WOODEN_DOOR), doorItem(IRON_DOOR)], [WOODEN_DOOR_ITEM, IRON_DOOR_ITEM]);
  assert.equal(itemFromOriginal(324, 0).id, WOODEN_DOOR_ITEM);
  assert.equal(itemFromOriginal(330, 0).id, IRON_DOOR_ITEM);
  assert.equal(POPULATION_ITEMS[101], IRON_BARS);
  assert.equal(POPULATION_ITEMS[102], GLASS_PANE_ITEM);
  assert.equal(itemFromOriginal(102, 0).id, 1100);
  assert.equal(ITEMS[1100].block, true);
  assert.equal(blockItemId(GLASS_PANE), 1100);
  assert.equal(paneItemBlock(1100), GLASS_PANE);
  const facts = by("facts");
  assert.equal(facts.length, 4);
  const tools = [0, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 256, 257, 258, 359];
  for (const r of facts) {
    const b = internal(r.id), m = MATERIALS[b];
    assert.equal(f(m.hardness), f(r.hardness), `hardness ${r.id}`);
    assert.equal(explosionResistance(b), f(r.resistance), `resistance ${r.id}`);
    assert.equal(lightOpacity(b), r.lightOpacity, `light opacity ${r.id}`);
    assert.equal(hasSilkTouchDrop(r.id), r.canSilk, `silk ${r.id}`);
    for (const [t, speed] of r.speeds) {
      const tool = t ? ITEMS[itemFromOriginal(t, 0).id] : null;
      assert.equal(digSpeed(b, tool), speed, `speed ${r.id} tool ${t}`);
    }
    for (const [t, ok] of r.harvest) {
      const tool = t ? ITEMS[itemFromOriginal(t, 0).id] : null;
      assert.equal(canHarvest(b, m, tool), ok, `harvest ${r.id} tool ${t}`);
    }
    for (let meta = 0; meta < 16; meta++) {
      const want = r.drops[meta] ? [`${itemFromOriginal(r.drops[meta][0], r.drops[meta][1]).id}x${r.drops[meta][2]}`] : [];
      const got = populationDrops(b, meta) ?? (m.drop === undefined ? [{ id: b, count: 1 }] : m.drop ? [{ id: m.drop, count: 1 }] : []);
      assert.deepEqual(stackIds(got), want, `drops ${r.id}:${meta}`);
    }
  }
  assert.equal(ITEMS[WOODEN_DOOR_ITEM].stack, 1);
  assert.equal(ITEMS[IRON_DOOR_ITEM].stack, 1);
  const tab = (n) => CREATIVE_TABS[n].items.map((s) => (Array.isArray(s) ? s[0] : s));
  for (const id of [IRON_BARS, GLASS_PANE_ITEM]) assert.ok(tab(1).includes(id));
  for (const id of [WOODEN_DOOR_ITEM, IRON_DOOR_ITEM]) assert.ok(tab(2).includes(id));
  assert.deepEqual(BLOCKS.slice(97, 101).map((b) => b.name.toLowerCase()), ["wooden door", "iron door", "iron bars", "glass pane"]);
});

test("door bounds, selection, collision and ray traces for every orientation, open state and hinge", () => {
  const rows = by("door");
  assert.equal(rows.length, 64);
  for (const r of rows) {
    doorWorld(r.id, r.lower, r.upper);
    const b = internal(r.id);
    assert.equal(world.get(X, Y, Z), b);
    r.combined.forEach((c, i) => assert.equal(doorFlags(world, X, Y + i, Z), c));
    r.facing.forEach((v, i) => assert.equal(doorFlags(world, X, Y + i, Z) & 3, v));
    r.movement.forEach((v, i) => assert.equal(doorPassable(world, X, Y + i, Z), v));
    checkShape(r.lowerShape, X, Y, Z, `door ${r.id} ${r.lower}/${r.upper} lower`);
    checkShape(r.upperShape, X, Y + 1, Z, `door ${r.id} ${r.lower}/${r.upper} upper`);
  }
  for (const r of by("doorAlone")) {
    clear();
    put(X, Y, Z, r.id, r.meta);
    assert.equal(doorFlags(world, X, Y, Z), r.combined);
    checkShape(r.shape, X, Y, Z, `alone ${r.meta}`);
  }
});

test("right-click toggling and setOpen follow BlockDoor, iron doors ignore hands", () => {
  const rows = by("toggle");
  assert.equal(rows.length, 128);
  for (const r of rows) {
    doorWorld(r.id, r.lower, r.upper);
    const res = activateDoor(world, X, Y + r.half, Z, () => 0.25);
    assert.equal(res.handled, r.result);
    assert.equal(res.changed, r.log.length > 0, `${r.id} ${r.lower}`);
    assert.deepEqual(cells([[X, Y, Z], [X, Y + 1, Z]]), r.cells.map((c) => (c[0] === 64 ? [64, c[1]] : [71, c[1]])).map((c, i) => [r.id, c[1]]));
    if (res.changed) { assert.equal(res.sound.event, "random.door_open"); assert.ok(res.sound.pitch >= 0.9 && res.sound.pitch < 1.0); }
  }
  assert.equal(activateDoor(world, X, Y - 1, Z, Math.random).handled, false);
  const sets = by("setOpen");
  assert.equal(sets.length, 32);
  for (const r of sets) {
    doorWorld(r.id, r.lower, 8);
    assert.equal(setDoorOpen(world, X, Y + r.half, Z, r.open), r.log.length > 0);
    assert.deepEqual(cells([[X, Y, Z], [X, Y + 1, Z]]).map((c) => c[1]), r.cells.map((c) => c[1]));
  }
});

test("ItemDoor placement: yaw facing, hinge, side, support, occupancy and height", () => {
  const item = (o) => itemFromOriginal(o, 0).id, put2 = (r) => [[X, Y, Z], [X, Y + 1, Z]];
  const place = (o, yaw, side = 1) => useDoorItem(world, item(o), X, Y - 1, Z, side, yaw);
  let n = 0;
  for (const r of by("place", "yaw")) {
    clear(); put(X, Y - 1, Z, 1, 0);
    assert.equal(!!place(r.item, r.yaw), r.result);
    assert.deepEqual(cells(put2()), r.cells, `yaw ${r.yaw}`); n++;
  }
  assert.equal(n, 75);
  const dir = [[0, 1], [-1, 0], [0, -1], [1, 0]], facingOf = [1, 2, 3, 0], yaws = [0, 90, 180, 270];
  const column = (kind, x, z) => {
    if (kind === 1) { put(x, Y, z, 1, 0); put(x, Y + 1, z, 1, 0); }
    if (kind === 2) { put(x, Y - 1, z, 1, 0); put(x, Y, z, 64, 0); put(x, Y + 1, z, 64, 8); }
    if (kind === 3) put(x, Y, z, 1, 0);
    if (kind === 4) put(x, Y + 1, z, 1, 0);
    if (kind === 5) put(x, Y, z, 20, 0);
    if (kind === 6) put(x, Y, z, 18, 0);
  };
  for (const r of by("place", "hinge")) {
    const yi = yaws.indexOf(r.yaw), [dx, dz] = dir[facingOf[yi]];
    clear(); put(X, Y - 1, Z, 1, 0);
    column(r.left, X - dx, Z - dz); column(r.right, X + dx, Z + dz);
    assert.equal(!!place(r.item, r.yaw), r.result);
    assert.deepEqual(cells([[X, Y, Z], [X, Y + 1, Z], [X - dx, Y, Z - dz], [X - dx, Y + 1, Z - dz], [X + dx, Y, Z + dz], [X + dx, Y + 1, Z + dz]]), r.cells, `hinge ${yi} ${r.left} ${r.right}`);
  }
  for (const r of by("place", "side")) {
    clear(); put(X, Y - 1, Z, 1, 0);
    assert.equal(!!place(r.item ?? 324, 0, r.side), r.result);
    assert.deepEqual(cells(put2()), r.cells);
  }
  let skipped = 0;
  for (const r of by("place", "support")) {
    clear(); put(X, Y - 2, Z, 1, 0);
    if (!put(X, Y - 1, Z, r.below, r.belowMeta)) { skipped++; continue; }
    assert.equal(!!place(324, 0), r.result, `support ${r.below}:${r.belowMeta}`);
  }
  assert.ok(skipped < 10);
  skipped = 0;
  for (const r of by("place", "occupied")) {
    clear(); put(X, Y - 1, Z, 1, 0);
    if (!put(X, Y + r.level, Z, r.block, r.meta)) { skipped++; continue; }
    assert.equal(!!place(324, 0), r.result, `occupied ${r.block}:${r.meta}@${r.level}`);
  }
  assert.ok(skipped < 10);
  for (const r of by("place", "height")) {
    const grid = new Map([[`${X},${r.y - 1},${Z}`, 1]]);
    const fake = { height: 256, get: (x, y, z) => grid.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0 };
    assert.equal(canPlaceDoor(fake, X, r.y, Z), r.result, `height ${r.y}`);
  }
  assert.equal(doorPlacedFacing(0), 1);
  assert.equal(doorRotationYaw(0), 180);
});

function breakState(mode, tool) {
  const survival = new Survival({ slots: tool ? [makeStack(tool)] : [] }, mode);
  return { world, survival, items: new ItemEntities(() => 0.5), xpOrbs: new ExperienceOrbs([], () => 0.5), farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(9) }), heldTool: survival.inventory.held?.id ?? 0 };
}
test("breaking doors, bars and panes: one drop, creative upper half, watcher drops", () => {
  const pick = itemFromOriginal(257, 0).id;
  let ran = 0;
  for (const r of by("break")) {
    const door = r.id === 64 || r.id === 71, creative = r.creative;
    // The probe's canHarvest is an input; a wooden door is always harvestable in Survival, so that row has no live twin.
    if (!creative && r.id === 64 && !r.canHarvest) continue;
    if (door) doorWorld(r.id, r.lower, r.upper); else { clear(); put(X, Y, Z, r.id, 0); }
    const state = breakState(creative ? "creative" : "survival", r.canHarvest && !creative ? pick : 0);
    const sink = dropped; const before = sink.length;
    assert.equal(breakPlayerBlock(state, [X, Y + (door ? r.half : 0), Z], { creative }), true);
    const got = [...state.items.items.map((e) => e.stack), ...sink.slice(before)];
    assert.deepEqual(stackIds(got), creative ? [] : nativeDrops(r.drops), `break ${JSON.stringify(r)}`);
    assert.deepEqual(cells([[X, Y - 1, Z], [X, Y, Z], [X, Y + 1, Z]]), r.cells, `cells ${JSON.stringify(r)}`);
    ran++;
  }
  assert.ok(ran > 100);
});

test("door neighbour updates: support loss, orphaned halves, power hooks", () => {
  for (const r of by("neighbour", "support")) {
    doorWorld(r.id, r.lower, 8);
    if (!exact(r.below, r.belowMeta)) continue;
    const m = exact(r.below, r.belowMeta);
    world.set(X, Y - 1, Z, m.id, true, m.meta);
    assert.deepEqual(cells([[X, Y - 1, Z], [X, Y, Z], [X, Y + 1, Z]]), r.cells, `support ${r.below}`);
    assert.deepEqual(stackIds(dropped.map((d) => ({ id: d.id, count: d.count }))), nativeDrops(r.drops));
  }
  for (const r of by("neighbour", "lone")) {
    clear(); put(X, Y - 1, Z, 1, 0);
    const b = internal(r.id);
    if (r.half === 0) world.put(X, Y, Z, b, r.meta, false); else world.put(X, Y + 1, Z, b, 8 | (r.meta & 1), false);
    const drops = doorNeighbourChange(world, X, Y + r.half, Z, 1);
    assert.deepEqual(cells([[X, Y, Z], [X, Y + 1, Z]]), r.cells, `lone ${r.half}`);
    assert.deepEqual(stackIds(drops.map((d) => d.stack)), nativeDrops(r.drops));
  }
  const options = (set) => ({ powered: (x, y, z) => set.has(`${y}`), providesPower: (c) => [55, 69, 76, 77].includes(c) });
  for (const r of by("neighbour", "power")) {
    const set = new Set();
    if (r.powered & 1) set.add(`${Y}`);
    if (r.powered & 2) set.add(`${Y + 1}`);
    for (const [from, want] of [[0, r.fromLower], [1, r.fromUpper]]) {
      doorWorld(r.id, r.lower, 8);
      doorNeighbourChange(world, X, Y + from, Z, r.changed, options(set));
      assert.deepEqual(cells([[X, Y, Z], [X, Y + 1, Z]]), want, `power ${JSON.stringify(r)} from ${from}`);
    }
  }
});

test("pane and bar shapes, neighbour connections, render sides and the connect table", () => {
  const masks = by("pane").filter((r) => r.kind === undefined);
  assert.equal(masks.length, 32);
  const arms = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const r of masks) {
    clear(); put(X, Y, Z, r.id, 0);
    for (let i = 0; i < 4; i++) if (r.mask >> i & 1) put(X + arms[i][0], Y, Z + arms[i][1], 1, 0);
    checkShape(r, X, Y, Z, `pane ${r.id} mask ${r.mask}`);
  }
  for (const r of by("pane", "neighbour")) {
    clear(); put(X, Y, Z, r.id, 0);
    if (!put(X + 1, Y, Z, r.neighbour, 0)) continue;
    put(X - 1, Y, Z, 1, 0);
    checkShape(r, X, Y, Z, `pane ${r.id} next to ${r.neighbour}`);
  }
  for (const r of by("paneRender")) {
    const self = internal(r.id);
    for (const [nb, sides] of r.sides) {
      const m = exact(nb, 0);
      if (!m) continue;
      assert.ok(sides.every((v) => v === sides[0]));
      assert.equal(paneSideRendered(self, m.id), sides[0], `render ${r.id} vs ${nb}`);
    }
  }
  let compared = 0;
  for (const r of by("connect")) {
    const m = exact(r.id, 0);
    if (!m || m.id === 0 || (m.id > 100 && m.id < 119)) continue;
    assert.equal(paneConnectsTo(m.id), r.pane, `connect ${r.id}`);
    assert.equal(r.pane, r.bars);
    compared++;
  }
  assert.ok(compared > 60);
  // Panes and bars never join fences, and fences do not join panes by the pane rule.
  assert.equal(paneConnectsTo(FENCE), false);
  assert.equal(paneConnectsTo(WOODEN_DOOR), false);
  assert.equal(fenceConnectsTo(GLASS_PANE), false);
});

test("held items place through the live path: door items on the top face, pane item 1100 as block 100", async () => {
  const { placeHeldBlock } = await import("./block-placement-simulation.js");
  const state = (held) => ({ world, survival: new Survival({ slots: [makeStack(held, 2)] }, "survival"), position: { x: 12, y: Y + 8, z: 12 }, flowers: null, farming: new Farming(world), yaw: 0 });
  clear(); put(X, Y - 1, Z, 1, 0);
  let s = state(1100);
  let r = placeHeldBlock(s, { id: 1100, item: ITEMS[1100], target: { block: [X, Y - 1, Z], adjacent: [X, Y, Z] } });
  assert.deepEqual([r.placed, r.block, world.get(X, Y, Z), s.survival.count(1100)], [true, GLASS_PANE, GLASS_PANE, 1]);
  clear(); put(X, Y - 1, Z, 1, 0);
  s = state(WOODEN_DOOR_ITEM);
  r = placeHeldBlock(s, { id: WOODEN_DOOR_ITEM, item: ITEMS[WOODEN_DOOR_ITEM], target: { block: [X, Y - 1, Z], adjacent: [X, Y, Z] } });
  assert.equal(r.placed, true);
  assert.deepEqual([world.get(X, Y, Z), world.get(X, Y + 1, Z), s.survival.count(WOODEN_DOOR_ITEM)], [WOODEN_DOOR, WOODEN_DOOR, 0]);
  r = placeHeldBlock(state(WOODEN_DOOR_ITEM), { id: WOODEN_DOOR_ITEM, item: ITEMS[WOODEN_DOOR_ITEM], target: { block: [X, Y - 1, Z], adjacent: [X + 1, Y - 1, Z] } });
  assert.equal(r.placed, false);
});
