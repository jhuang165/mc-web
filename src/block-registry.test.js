import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORIGINAL_BLOCK_IDS, ORIGINAL_RANDOM_TICK, ORIGINAL_CONTAINERS, isRegistered, toOriginal, fromOriginal, internalIdsFor } from "./block-registry.js";
import { BLOCKS } from "./world.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url)));
const registry = load("chunk-reference.json").records.find((r) => r.kind === "registry");

test("registered ids, random-tick and container flags equal Block.registerBlocks", () => {
  assert.deepEqual(ORIGINAL_BLOCK_IDS, registry.registered);
  assert.deepEqual(ORIGINAL_RANDOM_TICK, registry.ticking);
  assert.deepEqual(ORIGINAL_CONTAINERS, registry.containers.map(Number));
  assert.deepEqual(registry.materialAir, [0]);
  assert.deepEqual(registry.unregisteredNonAir, []);
  assert.equal(isRegistered(167), false);
  assert.equal(isRegistered(4095), false);
});

test("every internal block maps to a registered original id matching the shadow probe mapping", () => {
  const shadows = load("shadow-reference.json").blocks;
  for (let id = 0; id < BLOCKS.length; id++) {
    if (BLOCKS[id].reserved) { assert.equal(toOriginal(id, 0), null); continue; } // placeholders held for parallel tracks
    const [mc, meta] = toOriginal(id, 0);
    assert.ok(isRegistered(mc), `${BLOCKS[id].name} -> ${mc}`);
    assert.ok(meta >= 0 && meta <= 15);
    if (id && shadows[id]) assert.equal(mc, shadows[id].mc, BLOCKS[id].name); // shaped blocks (165-169) have no shadow-probe row; shaped-blocks.test.js covers them
  }
  assert.equal(toOriginal(BLOCKS.length, 0), null);
});

test("every internal cell state survives toOriginal -> fromOriginal", () => {
  for (let id = 0; id < BLOCKS.length; id++)
    for (let meta = 0; meta < 16; meta++) {
      if (BLOCKS[id].reserved) continue;
      const [mc, mm] = toOriginal(id, meta);
      const back = fromOriginal(mc, mm);
      assert.equal(back.id, id, `${id}:${meta}`);
      assert.ok(back.exact, `${id}:${meta} -> ${mc}:${mm}`);
      // Metadata is kept where the original stores the same meaning; else the original state is fixed.
      if (back.meta !== meta) assert.equal(back.meta, 0);
      const [mc2, mm2] = toOriginal(back.id, back.meta, back.state);
      assert.deepEqual([mc2, mm2], [mc, mm]);
    }
});

test("side state: fluids, farmland moisture, chest/furnace facing and lit furnaces", () => {
  assert.deepEqual(toOriginal(10, 0), [9, 0]);
  assert.deepEqual(toOriginal(10, 9, { flowing: true }), [8, 9]);
  assert.deepEqual(toOriginal(42, 2, { flowing: true }), [10, 2]);
  assert.deepEqual(fromOriginal(8, 9), { id: 10, meta: 9, exact: true, state: { flowing: true } });
  assert.deepEqual(fromOriginal(11, 0), { id: 42, meta: 0, exact: true });
  for (let m = 0; m < 8; m++) {
    const r = fromOriginal(60, m);
    assert.equal(r.id, m ? 30 : 29);
    assert.ok(r.exact);
    assert.deepEqual(toOriginal(r.id, r.meta, r.state), [60, m]);
  }
  assert.deepEqual(fromOriginal(60, 12), { id: 30, meta: 0, exact: false, state: { moisture: 7 } });
  assert.deepEqual(toOriginal(41, 0, { facing: 4 }), [54, 4]);
  assert.deepEqual(toOriginal(41, 0, { facing: 9 }), [54, 3]);
  assert.deepEqual(toOriginal(14, 0, { facing: 2, lit: true }), [62, 2]);
  assert.deepEqual(fromOriginal(62, 2), { id: 14, meta: 0, exact: true, state: { facing: 2, lit: true } });
  assert.equal(fromOriginal(54, 0).exact, false);
});

test("original states the port only approximates, and blocks it lacks", () => {
  assert.deepEqual(fromOriginal(50, 1), { id: 20, meta: 1, exact: true }); // wall torches keep their side
  assert.deepEqual(fromOriginal(50, 5), { id: 20, meta: 0, exact: true }); // standing torch
  assert.deepEqual(fromOriginal(50, 0), { id: 20, meta: 0, exact: false });
  for (let m = 0; m < 16; m++) assert.deepEqual(fromOriginal(66, m), { id: 61, meta: m <= 9 ? m : 0, exact: m <= 9 });
  assert.deepEqual(fromOriginal(85, 0), { id: 60, meta: 0, exact: true });
  assert.deepEqual(fromOriginal(52, 0), { id: 62, meta: 0, exact: true });
  assert.deepEqual(fromOriginal(31, 2), { id: 84, meta: 0, exact: true }); // fern
  assert.deepEqual(fromOriginal(3, 2), { id: 2, meta: 2, exact: true }); // podzol metadata retained
  assert.deepEqual(fromOriginal(59, 5), { id: 36, meta: 0, exact: true });
  assert.deepEqual(fromOriginal(59, 13), { id: 36, meta: 0, exact: false });
  assert.equal(fromOriginal(19, 0), null); // sponge
  assert.equal(fromOriginal(165, 0), null);
  assert.deepEqual(internalIdsFor(59), [31, 32, 33, 34, 35, 36, 37, 38]);
  assert.deepEqual(internalIdsFor(60), [29, 30]);
});
