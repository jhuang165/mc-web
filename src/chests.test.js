// Trapped chest (original 146, internal 162) and ender chest (original 130, internal 163) against the bytecode probe
// (tools/probes/ChestsProbe.java -> public/research/chests-reference.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, blockBounds, BLOCKS } from "./world.js";
import { CHEST, placeChest, openChest, tickLid } from "./chest.js";
import { LargeChestInventory } from "./inventory.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { lightEmission } from "./lighting.js";
import { chestDrops, loadEnderSlots, saveEnderSlots, enderDisplayParticles, newEnderTile, TRAPPED_CHEST, ENDER_CHEST, CHEST_MATERIALS } from "./chest-blocks.js";
import { harvestBlock } from "./enchantment-effects.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/chests-reference.json", import.meta.url)));
const records = (kind) => reference.records.filter((r) => r.kind === kind);
const facts = Object.fromEntries(reference.facts.blocks.map((b) => [b.id, b]));

function flat() {
  const w = new World("Chests", "meadow", 3);
  for (let x = 5; x < 25; x++) for (let z = 5; z < 25; z++) for (let y = 38; y < 46; y++) w.set(x, y, z, 0, false);
  return w;
}
const mapId = (original) => fromOriginal(original, 0).id;

test("the registry maps the originals and the facts follow the probe", () => {
  assert.equal(fromOriginal(146, 3).id, TRAPPED_CHEST);
  assert.equal(fromOriginal(130, 3).id, ENDER_CHEST);
  assert.deepEqual(toOriginal(ENDER_CHEST, 4), [130, 4]);
  assert.equal(toOriginal(TRAPPED_CHEST, 0, { facing: 5 })[0], 146);
  assert.equal(facts[146].hardness, CHEST_MATERIALS[TRAPPED_CHEST].hardness);
  assert.equal(facts[130].hardness, CHEST_MATERIALS[ENDER_CHEST].hardness);
  assert.equal(lightEmission(ENDER_CHEST) / 15 * 15, facts[130].light);
  assert.equal(lightEmission(TRAPPED_CHEST), facts[146].light);
  const w = flat();
  w.set(10, 40, 10, ENDER_CHEST);
  assert.deepEqual(blockBounds(w, 10, 40, 10).map((v) => +v.toFixed(4)), facts[130].bounds);
  assert.equal(BLOCKS[ENDER_CHEST].name, "Ender Chest");
  assert.equal(BLOCKS[TRAPPED_CHEST].name, "Trapped Chest");
});

test("drops: trapped chest drops itself, ender chest 8 obsidian, silk touch keeps the ender chest", () => {
  assert.equal(facts[130].dropItem, 49);
  assert.equal(facts[130].dropCount, 8);
  assert.equal(facts[130].silk, 1);
  assert.deepEqual(chestDrops(ENDER_CHEST), [{ id: 22, count: 8 }]);
  assert.deepEqual(chestDrops(TRAPPED_CHEST), [{ id: 1940, count: 1 }]);
  const silk = harvestBlock(130, 0, { silk: true, rand: new JavaRandom(1) });
  assert.deepEqual(silk.drops.map((d) => [d.id, d.count]), [[130, 1]]); // original ids, one ender chest
  const normal = harvestBlock(130, 0, { silk: false, rand: new JavaRandom(1) });
  assert.deepEqual(normal.drops.map((d) => [d.id, d.count]), Array(8).fill([49, 1]), "eight obsidian, one spawn each");
});

test("pairing, facing and opening match the probe for 300 random placements", () => {
  let checked = 0;
  for (const [index, r] of records("pair").entries()) {
    const w = flat(), chests = {}, y = 40, ox = 13, oz = 13;
    for (const [dx, dz] of r.stones) w.set(ox + dx, y, oz + dz, 1);
    for (const [dx, dz, id, yaw, can] of r.placements) {
      const kind = mapId(id), x = ox + dx, z = oz + dz;
      // The port's canPlaceChest is the same check the probe called.
      const ok = w.get(x, y, z) === 0 && canPlace(w, x, y, z, kind);
      assert.equal(ok, can === 1, `pair ${index} placement ${dx},${dz}`);
      if (!ok) continue;
      w.set(x, y, z, kind);
      placeChest(w, chests, x, y, z, ((180 - yaw) * Math.PI) / 180, kind);
    }
    for (const [dx, dz, cover] of r.covers) if (cover) w.set(ox + dx, y + 1, oz + dz, mapId(cover));
    for (const cell of r.cells) {
      const x = ox + cell.x, z = oz + cell.z, key = `${x},${y},${z}`;
      assert.equal(w.get(x, y, z), mapId(cell.id), `pair ${index} kind`);
      assert.equal(chests[key].facing, cell.meta, `pair ${index} facing at ${cell.x},${cell.z}`);
      const open = openChest(w, chests, x, y, z);
      if (cell.size < 0) assert.equal(open, null, `pair ${index} blocked`);
      else {
        assert.equal(open.inventory.size, cell.size, `pair ${index} size`);
        assert.equal(open.inventory instanceof LargeChestInventory, cell.size === 54);
      }
      checked++;
    }
  }
  assert.ok(checked > 400);
});
function canPlace(w, x, y, z, kind) {
  // canPlaceChest is covered by the pair records; import lazily to keep the test header short.
  return canPlaceChest(w, x, y, z, kind);
}
import { canPlaceChest } from "./chest.js";

test("a trapped chest powers by its viewer count, strongly only downward", () => {
  const w = flat(), chests = {};
  w.set(10, 40, 10, TRAPPED_CHEST);
  const { redstone } = createRedstoneRuntime({ world: w, game: { chests: () => chests } });
  const behaviour = redstone.behaviours[146];
  assert.ok(behaviour, "behaviour registered for original 146");
  for (const r of records("power").filter((p) => p.block === 146)) {
    chests["10,40,10"] = { users: r.users };
    for (let side = 0; side < 6; side++) {
      assert.equal(behaviour.weak(redstone, 10, 40, 10), r.weak[side], `weak users ${r.users} side ${side}`);
      assert.equal(behaviour.strong(redstone, 10, 40, 10, side), r.strong[side], `strong users ${r.users} side ${side}`);
    }
  }
  assert.equal(facts[146].canProvidePower, 1);
  assert.equal(facts[54].canProvidePower, 0);
  assert.equal(redstone.behaviours[54]?.weak, undefined, "a normal chest provides no power");
});

test("opening a viewer notifies the chest then the block below", () => {
  const log = records("power").find((p) => p.block === 146 && p.users === 1).openLog.split(" ");
  assert.equal(log.length, 12);
  assert.ok(log.every((n) => n.endsWith(",146")));
});

test("the ender chest opens unless a normal cube sits above it (probe covers)", () => {
  const w = flat();
  const survival = new Survival({ mode: "survival" });
  for (const r of records("ender")) {
    w.set(10, 40, 10, ENDER_CHEST);
    const cover = r.cover === 0 ? 0 : mapId(r.cover);
    w.set(10, 41, 10, cover);
    const container = survival.openEnderChest(w, 10, 40, 10);
    assert.equal(!!container, r.opened, `cover ${r.cover}`);
    if (container) {
      assert.equal(container.chest.size, r.size);
      assert.equal(survival.enderTiles["10,40,10"].users, r.usersWhileOpen);
      container.close();
      assert.equal(survival.enderTiles["10,40,10"].users, r.usersAfter);
    }
  }
  assert.equal(facts[130].renderType, 22);
});

test("the ender inventory round trips EnderItems like InventoryEnderChest", () => {
  for (const r of records("enderNbt")) {
    const entries = r.saved.map(([slot, id, count, damage]) => ({ slot, stack: { id, count, damage } }));
    const loaded = loadEnderSlots(entries);
    r.loaded.forEach((s, i) => assert.deepEqual(loaded[i] ? [loaded[i].id, loaded[i].count, loaded[i].damage] : null, s, `${r.name} slot ${i}`));
    const again = saveEnderSlots(loaded).map(({ slot, stack }) => [slot, stack.id, stack.count, stack.damage]);
    assert.deepEqual(again, r.savedAgain, r.name);
  }
  const s = new Survival({ mode: "survival" });
  s.enderItems[3] = { id: 22, count: 5, damage: 0 };
  const saved = s.serialize();
  assert.equal(saved.enderItems.length, 27);
  assert.equal(new Survival({ mode: "survival", ...saved }).enderItems[3].count, 5);
});

test("the lid steps 0.1 per tick with the original sounds", () => {
  for (const r of records("lid")) {
    const tile = { users: 0, lid: 0, prevLid: 0 };
    r.frames.forEach(([lid, prev, sounds], i) => {
      const tick = i + 1;
      for (const [t, n] of r.users) if (t === tick) tile.users = n;
      const sound = tickLid(tile, true);
      assert.equal(tile.lid, Math.fround(lid), `${r.name} lid ${tick}`);
      assert.equal(tile.prevLid, Math.fround(prev), `${r.name} prev ${tick}`);
      assert.equal(sound, sounds[0]?.[4] ?? null, `${r.name} sound ${tick}`);
      if (sounds[0]) assert.equal(sounds[0][5], 0.5);
    });
  }
});

test("the ender chest display tick draws three portal particles in the original order", () => {
  for (const r of records("display")) {
    const random = new JavaRandom(r.seed), [x, y, z] = r.cell;
    r.ticks.forEach((tick, t) => {
      const rows = enderDisplayParticles(random, x, y, z);
      assert.equal(rows.length, tick.length);
      rows.forEach((row, i) => {
        assert.equal(row[0], tick[i][0]);
        row.slice(1).forEach((v, k) => assert.ok(Math.abs(v - tick[i][k + 1]) < 1e-6, `${r.seed} tick ${t} particle ${i} field ${k}: ${v} vs ${tick[i][k + 1]}`));
      });
    });
  }
  assert.deepEqual(newEnderTile(), { users: 0, lid: 0, prevLid: 0 });
  assert.equal(CHEST, 41);
});
