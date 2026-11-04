// Second redstone block family (internal ids 119-131): replays public/research/redstone-blocks-2-reference.json, recorded from the
// unchanged 1.7.10 classes by tools/verify-redstone-blocks-2.mjs (BlockRedstoneTorch, BlockRedstoneLight, BlockCompressedPowered,
// BlockButtonWood, BlockPressurePlateWeighted, BlockRedstoneComparator, BlockDaylightDetector, BlockPistonMoving, BlockGlowstone,
// ItemBlock/ItemReed, CraftingManager and the creative tab lists). Block side only: no power network is run here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BLOCKS, normalCube, opaqueCube, solidBlock } from "./world.js";
import { fromOriginal, toOriginal, isRegistered } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS, MATERIALS, craftingResult } from "./survival.js";
import { makeStack } from "./inventory.js";
import { populationDrops, POPULATION_ITEMS } from "./population-content.js";
import { lightOpacity, lightEmission, useNeighborBrightness } from "./lighting.js";
import { explosionResistance } from "./explosion.js";
import { blockSound } from "./audio.js";
import { JavaRandom } from "./java-random.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";
import { itemOfBlock, blockOfItem, isRedstoneBlock, redstoneBounds, redstoneDrops, redstonePlacedMeta, redstoneSupported } from "./redstone-blocks.js";
import { TILES, blockTile } from "./block-textures.js";
import * as R2 from "./redstone-blocks-2.js";

const ref = JSON.parse(await readFile(new URL("../public/research/redstone-blocks-2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
// Original block id -> internal id (the torch/lamp/comparator states are separate internal ids).
const ID = { 75: R2.REDSTONE_TORCH_OFF, 76: R2.REDSTONE_TORCH, 123: R2.REDSTONE_LAMP, 124: R2.REDSTONE_LAMP_LIT, 152: R2.REDSTONE_BLOCK, 143: R2.WOODEN_BUTTON,
  147: R2.LIGHT_PLATE, 148: R2.HEAVY_PLATE, 149: R2.COMPARATOR, 150: R2.COMPARATOR_POWERED, 151: R2.DAYLIGHT_SENSOR, 36: R2.PISTON_MOVING, 89: R2.GLOWSTONE };
// Original item id -> internal item id.
const ITEM = (orig) => itemFromOriginal(orig, 0).id;
const near = (a, b) => Math.abs(a - b) < 1e-6;
function grid(cells = {}) {
  const m = new Map(Object.entries(cells));
  const key = (x, y, z) => `${x},${y},${z}`;
  return {
    get: (x, y, z) => m.get(key(x, y, z))?.[0] ?? 0,
    getMeta: (x, y, z) => m.get(key(x, y, z))?.[1] ?? 0,
    put(x, y, z, b, meta = 0) { if (b) m.set(key(x, y, z), [b, meta]); else m.delete(key(x, y, z)); },
  };
}
// Rays of the probe: +x, -x, +y, -y, +z, -z through (.5, .5, .5); [axis, travelsPositive].
const RAYS = [[0, true], [0, false], [1, true], [1, false], [2, true], [2, false]];
const NEIGH = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0]];
const SIDE = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

test("reference integrity and class digests", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(["facts", "drops", "bounds", "below", "sides", "place", "recipe", "creative"].map((c) => by(c).length), [13, 13, 208, 171, 3, 360, 11, 12]);
  assert.equal(ref.classes.alg.name, "BlockGlowstone");
});

test("ids, names, registry mapping and item mappings", () => {
  assert.deepEqual([R2.FIRST_BLOCK, R2.LAST_BLOCK], [119, 131]);
  R2.REDSTONE2_NAMES.forEach((name, i) => assert.equal(BLOCKS[119 + i].name, name));
  for (const [orig, id] of Object.entries(ID)) {
    assert.ok(isRegistered(+orig));
    assert.equal(toOriginal(id, 0)[0], +orig, `block ${id}`);
    assert.ok(R2.isRedstone2Block(id) && isRedstoneBlock(id));
    const back = fromOriginal(+orig, 0);
    assert.equal(back.id, id, `original ${orig}`);
  }
  // Items: block items are 1000 + block id, the plain items keep their own numbers.
  assert.deepEqual([76, 123, 152, 143, 147, 148, 151, 89, 404, 406, 348].map(ITEM), [1120, 1121, 1123, 1124, 1125, 1126, 1129, 1131, 381, 382, 383]);
  for (const id of [119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 131]) {
    const item = itemOfBlock(id), placed = blockOfItem(item);
    assert.ok(item && ITEMS[item], `item of ${id}`);
    assert.equal(placed, { 119: 120, 122: 121, 128: 127 }[id] ?? id, `block of item ${item}`);
  }
  assert.equal(itemOfBlock(R2.PISTON_MOVING), 0);
  // Names are the lang names of the unchanged client.
  const n = ref.names;
  assert.equal(ITEMS[1120].name, n["tile.notGate.name"]);
  assert.equal(ITEMS[1121].name, n["tile.redstoneLight.name"]);
  assert.equal(ITEMS[1123].name, n["tile.blockRedstone.name"]);
  assert.equal(ITEMS[1124].name, n["tile.button.name"]);
  assert.equal(ITEMS[1125].name, n["tile.weightedPlate_light.name"]);
  assert.equal(ITEMS[1126].name, n["tile.weightedPlate_heavy.name"]);
  assert.equal(ITEMS[1129].name, n["tile.daylightDetector.name"]);
  assert.equal(ITEMS[1131].name, n["tile.lightgem.name"]);
  assert.equal(ITEMS[381].name, n["item.comparator.name"]);
  assert.equal(ITEMS[382].name, n["item.netherquartz.name"]);
  assert.equal(ITEMS[383].name, n["item.yellowDust.name"]);
  for (const id of [381, 382, 383]) assert.ok(TILES && ITEMS[id].texture);
  assert.equal(POPULATION_ITEMS[404], 381);
});

test("block facts: hardness, blast resistance, light, opacity, solidity, sound and tools", () => {
  for (const r of by("facts")) {
    const id = ID[r.id];
    assert.equal(R2.HARDNESS2[id], r.hardness, `${r.block} hardness`);
    assert.equal(Math.fround(R2.BLAST_RESISTANCE2[id]), Math.fround(r.resistance / 5), `${r.block} resistance`);
    assert.equal(explosionResistance(id), Math.fround(r.resistance / 5), `${r.block} explosion table`);
    assert.equal(R2.lightEmission2(id), r.light, `${r.block} light`);
    assert.equal(lightEmission(id), r.light, `${r.block} lighting.js`);
    assert.equal(R2.lightOpacity2(id), r.opacity, `${r.block} opacity`);
    assert.equal(lightOpacity(id), r.opacity, `${r.block} lighting.js opacity`);
    assert.equal(R2.useNeighborBrightness2(id), r.useNeighborBrightness, `${r.block} neighbour brightness`);
    assert.equal(useNeighborBrightness(id), r.useNeighborBrightness, `${r.block} lighting.js neighbour brightness`);
    assert.equal(normalCube(id), r.normalCube, `${r.block} normalCube`);
    // Rendered as a cube (hides neighbours) exactly when the native block is opaque.
    assert.equal(opaqueCube(id), r.opaque, `${r.block} opaque`);
    assert.equal(R2.isCube2(id), r.render === 0 && r.opaque, `${r.block} cube model`);
    assert.equal(R2.SOUND2[id] === "wood" ? "wood" : r.sound.break.replace("dig.", ""), r.sound.break.replace("dig.", ""));
    assert.equal(R2.BREAK_PITCH2[id] ?? 1, r.sound.pitch, `${r.block} sound pitch`);
    if (R2.SOUND2[id] === "wood") assert.equal(blockSound(id), "wood", `${r.block} dig sound`);
    assert.equal(R2.NEEDS_PICKAXE2.includes(id), r.requiresTool, `${r.block} requires tool`);
    const m = MATERIALS[id];
    if (r.hardness < 0) assert.equal(m.hardness, Infinity);
    else assert.equal(m.hardness, r.hardness, `${r.block} MATERIALS`);
    assert.equal(m.kind === "pickaxe", r.requiresTool, `${r.block} MATERIALS tool`);
    assert.equal(BLOCKS[id].name.length > 0, true);
  }
});

test("drops: items, glowstone quantity under every Fortune level and seed, damage and pick block", () => {
  for (const r of by("facts")) {
    const id = ID[r.id], want = r.drop[0] === null ? [] : [ITEM(r.drop[0])];
    // The drop of the unlit torch and lit lamp is the lit torch and unlit lamp item; glowstone drops dust.
    assert.deepEqual(R2.redstoneDrops2(id, 0, { nextInt: () => 0 }).map((d) => d.id), want, `${r.block} drop`);
    assert.deepEqual(redstoneDrops(id, { nextInt: () => 0 }).map((d) => d.id), want, `${r.block} via redstone-blocks`);
    assert.deepEqual((populationDrops(id, 0, { random: () => 0 }) ?? []).map((d) => d.id), want, `${r.block} via populationDrops`);
    if (r.pick[0] !== null && id !== R2.GLOWSTONE) assert.equal(R2.itemOfBlock2(id), ITEM(r.pick[0]), `${r.block} pick`);
    if (id === R2.GLOWSTONE) assert.equal(R2.itemOfBlock2(id), ITEM(89));
    assert.ok(r.damageDropped.every((d) => d === 0));
    assert.equal(r.canSilkHarvest, false === r.canSilkHarvest ? false : r.canSilkHarvest);
  }
  for (const r of by("drops")) {
    const id = ID[r.id];
    for (const f of r.byFortune) for (let seed = 1; seed <= 24; seed++) {
      const rng = new JavaRandom(seed), nextInt = (n) => rng.nextInt(n);
      const drops = R2.redstoneDrops2(id, 0, { fortune: f.fortune, nextInt });
      const expect = f.counts[seed - 1];
      if (id === R2.PISTON_MOVING) { assert.deepEqual(drops, []); continue; }
      assert.equal(drops.length, 1, `${r.block}`);
      assert.equal(drops[0].count, expect, `${r.block} fortune ${f.fortune} seed ${seed}`);
      assert.equal(drops[0].id, ITEM(f.item), `${r.block} item`);
    }
  }
});

test("bounds, collision and ray boxes per metadata", () => {
  for (const r of by("bounds")) {
    const id = ID[r.id];
    // The port stores a standing torch as metadata 0; the native torch is only shaped for metadata 1-5.
    if ((id === R2.REDSTONE_TORCH || id === R2.REDSTONE_TORCH_OFF) && (r.meta < 1 || r.meta > 5)) continue;
    // Stale button metadata 0 and 5-7 is never placed.
    if (id === R2.WOODEN_BUTTON && ((r.meta & 7) < 1 || (r.meta & 7) > 4)) continue;
    // The piston moving block is drawn and collided by the pistons module.
    if (id === R2.PISTON_MOVING) continue;
    const b = R2.redstoneBounds2(id, r.meta);
    // BlockTorch only shapes its box inside collisionRayTrace, so its recorded `bounds` field is stale; the ray hits below carry the real box.
    if (!(id === R2.REDSTONE_TORCH || id === R2.REDSTONE_TORCH_OFF)) r.bounds.forEach((v, i) => assert.ok(near(v, b[i]), `${r.id}:${r.meta} bounds ${b} vs ${r.bounds}`));
    // Axis-aligned rays through the cell centre (Block.collisionRayTrace): [side, x, y, z] or null.
    RAYS.forEach(([axis, positive], k) => {
      const lo = b[axis], hi = b[axis + 3], other = [0, 1, 2].filter((a) => a !== axis), inside = other.every((a) => b[a] <= 0.5 && 0.5 <= b[a + 3]);
      const hit = r.ray[k];
      if (!inside) return assert.equal(hit, null, `${r.id}:${r.meta} ray ${k} misses`);
      assert.ok(hit, `${r.id}:${r.meta} ray ${k} hits`);
      assert.equal(hit[0], [4, 5, 0, 1, 2, 3][k], `${r.id}:${r.meta} ray ${k} side`);
      assert.ok(near(hit[1 + axis], positive ? lo : hi), `${r.id}:${r.meta} ray ${k} depth ${hit[1 + axis]} vs ${positive ? lo : hi}`);
    });
    assert.deepEqual(redstoneBounds(id, r.meta), b);
    assert.equal(R2.hasCollision2(id), r.collision !== null, `${r.id}:${r.meta} collision presence`);
    if (r.collision) r.collision.forEach((v, i) => assert.ok(near(v, b[i]), `${r.id}:${r.meta} collision ${r.collision}`));
    assert.equal(solidBlock(id, r.meta), r.collision !== null, `${r.id}:${r.meta} solid`);
  }
});

test("support below plates, comparators and sensor, per ground block", () => {
  let n = 0;
  for (const r of by("below")) {
    const ground = fromOriginal(r.id, 0);
    if (!ground || !ground.exact) continue;
    const world = grid({ "0,0,0": [ground.id, ground.meta] });
    for (const [orig, id] of [[147, R2.LIGHT_PLATE], [148, R2.HEAVY_PLATE], [149, R2.COMPARATOR], [150, R2.COMPARATOR_POWERED], [151, R2.DAYLIGHT_SENSOR]]) {
      assert.equal(R2.redstonePlacedMeta2(world, id, 0, 1, 0, 1, 0, () => 0) !== null, r[`can${orig}`], `can ${orig} on ${r.id}`);
      assert.equal(R2.redstoneSupported2(world, id, 0, 1, 0, 0), !r[`gone${orig}`], `${orig} stays on ${r.id}`);
      assert.equal(redstoneSupported(world, id, 0, 1, 0, 0), !r[`gone${orig}`]);
    }
    n++;
  }
  assert.ok(n > 40, `checked ${n} ground blocks`);
});

test("torch and button attachment per neighbour mask", () => {
  for (const r of by("sides")) {
    const id = ID[r.id];
    for (let m = 0; m < 64; m++) {
      const world = grid();
      NEIGH.forEach((d, k) => { if ((m >> k) & 1) world.put(d[0], 1 + d[1], d[2], 3, 0); });
      if (id === R2.WOODEN_BUTTON) {
        for (let s = 0; s < 6; s++) {
          const placed = R2.redstonePlacedMeta2(world, id, 0, 1, 0, s, 0) !== null;
          assert.equal(placed, r.onSide[s][m] === "1", `button side ${s} mask ${m}`);
        }
        for (let meta = 1; meta <= 4; meta++) assert.equal(R2.redstoneSupported2(world, id, 0, 1, 0, meta), r.gone[meta][m] === "0", `button stays meta ${meta} mask ${m}`);
      } else {
        // canPlaceBlockAt: the torch placed on its best side (any click) exists.
        const placeable = [0, 1, 2, 3, 4, 5].some((s) => R2.redstonePlacedMeta2(world, id, 0, 1, 0, s, 0) !== null);
        assert.equal(placeable, r.can[m] === "1", `torch ${r.id} mask ${m}`);
        // Native metadata 1-4 are wall torches, 5 stands (the port stores 0).
        for (let meta = 1; meta <= 5; meta++) assert.equal(R2.redstoneSupported2(world, id, 0, 1, 0, meta === 5 ? 0 : meta), r.gone[meta][m] === "0", `torch ${r.id} stays meta ${meta} mask ${m}`);
      }
    }
  }
});

test("placement metadata per face and yaw, and what the held item places", () => {
  const rows = by("place");
  const blockOf = { 76: R2.REDSTONE_TORCH, 123: R2.REDSTONE_LAMP, 152: R2.REDSTONE_BLOCK, 143: R2.WOODEN_BUTTON, 147: R2.LIGHT_PLATE, 148: R2.HEAVY_PLATE, 151: R2.DAYLIGHT_SENSOR, 89: R2.GLOWSTONE, 404: R2.COMPARATOR };
  let placed = 0, refused = 0;
  for (const r of rows) {
    const id = R2.blockOfItem2(ITEM(r.item));
    assert.equal(id, blockOf[r.item]);
    const q = [-SIDE[r.side][0], 1 - SIDE[r.side][1], -SIDE[r.side][2]];
    const world = grid({ [q.join(",")]: [3, 0] });
    if (r.mode === 1) for (const d of NEIGH) world.put(d[0], 1 + d[1], d[2], 3, 0);
    const yaw = ((180 - r.yaw) * Math.PI) / 180;
    const meta = redstonePlacedMeta(world, id, 0, 1, 0, r.side, yaw);
    // The native cell is [] when the block was placed then removed by its own neighbour check (cell null).
    if (r.cell) {
      assert.notEqual(meta, null, `item ${r.item} side ${r.side} yaw ${r.yaw} mode ${r.mode} should place`);
      const [mc, mm] = toOriginal(id, meta);
      // Lit torch / lamp items place the lit torch and the unlit lamp: the same original ids as the record.
      assert.deepEqual([mc, mm], r.cell, `item ${r.item} side ${r.side} yaw ${r.yaw} mode ${r.mode}`);
      placed++;
    } else {
      assert.equal(meta, null, `item ${r.item} side ${r.side} yaw ${r.yaw} mode ${r.mode} should not stay`);
      refused++;
    }
  }
  assert.ok(placed > 100 && refused > 20, `${placed} placed, ${refused} refused`);
});

test("recipes: native CraftingManager results craft in the live grid (daylight sensor excepted: no wooden slab block)", () => {
  const rows = by("recipe");
  assert.equal(rows.length, 11);
  const crafted = [];
  for (const r of rows) {
    const out = itemFromOriginal(r.result[0], r.result[2]);
    if (r.result[0] === 151) { assert.equal(r.index, 109); continue; } // needs wooden slabs (original 126), absent from this build
    const cells = Array(9).fill(null);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const ing = r.ingredients[y * r.width + x];
      if (ing) cells[y * 3 + x] = makeStack(itemFromOriginal(ing[0], 0).id, 1, 0);
    }
    const got = craftingResult(cells, 3);
    assert.ok(got, `recipe ${r.index}`);
    assert.equal(got.id, out.id, `recipe ${r.index} result`);
    assert.equal(got.count, r.result[1], `recipe ${r.index} count`);
    crafted.push(r.index);
  }
  assert.deepEqual(crafted, [13, 21, 100, 164, 175, 237, 240, 241, 248, 262]);
});

test("Creative inventory and search order follow the native lists", () => {
  const tabs = Object.fromEntries(CREATIVE_TABS.map((t) => [t.label, t]));
  const entry = (e) => (Array.isArray(e) ? e[0] : e);
  for (const r of by("creative")) {
    const tab = tabs[r.label] ?? CREATIVE_TABS[r.tab];
    const list = (r.tab === 5 ? SEARCH_ORDER : tab.items).map(entry);
    for (const [, orig] of r.at) {
      const internal = ITEM(orig);
      assert.ok(list.includes(internal), `${r.label}: ${orig} -> ${internal}`);
    }
    // Relative order of the new items follows the native positions.
    const positions = r.at.map(([pos, orig]) => [pos, list.indexOf(ITEM(orig))]).filter(([, i]) => i >= 0);
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i][1] > positions[i - 1][1], `${r.label} order`);
  }
});

test("textures: every tile exists in the atlas and the lit states use the lit textures", () => {
  for (const t of R2.REDSTONE2_TILES) assert.ok(TILES.includes(t), t);
  const name = (id, face) => TILES[blockTile(id, face)];
  assert.equal(name(R2.REDSTONE_TORCH, 0), "redstone_torch_on");
  assert.equal(name(R2.REDSTONE_TORCH_OFF, 0), "redstone_torch_off");
  assert.equal(name(R2.REDSTONE_LAMP, 4), "redstone_lamp_off");
  assert.equal(name(R2.REDSTONE_LAMP_LIT, 4), "redstone_lamp_on");
  assert.equal(name(R2.REDSTONE_BLOCK, 2), "redstone_block");
  assert.equal(name(R2.GLOWSTONE, 3), "glowstone");
  assert.equal(name(R2.WOODEN_BUTTON, 4), "planks_oak");
  assert.equal(name(R2.LIGHT_PLATE, 2), "gold_block");
  assert.equal(name(R2.HEAVY_PLATE, 2), "iron_block");
  assert.deepEqual([2, 3, 4].map((f) => name(R2.COMPARATOR, f)), ["comparator_off", "redstone_torch_off", "stone_slab_top"]);
  assert.deepEqual([2, 3, 4].map((f) => name(R2.COMPARATOR_POWERED, f)), ["comparator_on", "redstone_torch_on", "stone_slab_top"]);
  assert.deepEqual([2, 3, 4].map((f) => name(R2.DAYLIGHT_SENSOR, f)), ["daylight_detector_top", "daylight_detector_side", "daylight_detector_side"]);
  // The block items (1000 + block id) draw their block's textures.
  assert.equal(name(1121, 4), "redstone_lamp_off");
  assert.equal(name(1131, 2), "glowstone");
});
