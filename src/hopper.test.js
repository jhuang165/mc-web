import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { replayHopperScenario } from "./hopper-replay.js";
import {
  hopperPlacedMeta, hopperPoweredMeta, hopperFacing, hopperEnabled, HOPPER_BOXES, HOPPER_BOUNDS, HOPPER_HARDNESS, HOPPER_BLAST,
  HopperContainer, HOPPER_SLOTS, newHopperTile,
} from "./hopper.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";

const ref = JSON.parse(await readFile(new URL("../public/research/hopper-reference.json", import.meta.url)));

test("hopper replay matches the original TileEntityHopper / BlockHopper per tick", () => {
  assert.ok(ref.scenarios.length >= 25);
  for (const s of ref.scenarios) {
    const { frames } = replayHopperScenario(s);
    assert.deepEqual(frames.slice(0, s.ticks), s.frames, s.name);
  }
});

test("block facts match the original", () => {
  const f = ref.facts;
  assert.equal(f.hardness, HOPPER_HARDNESS);
  assert.equal(f.resistance / 5, HOPPER_BLAST);
  assert.deepEqual(f.bounds, [...HOPPER_BOUNDS]);
  assert.deepEqual(f.collision.map((b) => b.map((v, i) => v - (i % 3 === 1 ? 1 : 0))), HOPPER_BOXES.map((b) => [...b]));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(hopperPlacedMeta), f.placed);
  assert.equal(f.comparatorOverride, 1);
});

test("power bit and facing", () => {
  assert.equal(hopperPoweredMeta(3, true), 11);
  assert.equal(hopperPoweredMeta(11, false), 3);
  assert.equal(hopperPoweredMeta(3, false), null);
  assert.equal(hopperFacing(13), 5);
  assert.equal(hopperEnabled(13), false);
});

test("hopper screen has five slots and shift-clicks", () => {
  const inv = new Survival({}).inventory, tile = newHopperTile();
  const c = new HopperContainer(inv, tile, () => {});
  assert.equal(HOPPER_SLOTS, 5);
  assert.deepEqual([c.slots[0].x, c.slots[0].y, c.slots[4].x], [44, 20, 116]);
  assert.equal(c.slots.length, 5 + 36);
  inv.main[0] = makeStack(1, 5, 0);
  const idx = c.slots.findIndex((s, i) => i >= 5 && s.stack === inv.main[0]);
  c.transfer(idx);
  assert.equal(tile.items[0]?.count, 5);
});

test("hopper tiles survive Survival save / restore with cooldown and name", () => {
  const p = new Survival({ hoppers: { "1,2,3": { items: [makeStack(1, 4, 0), null, null, null, makeStack(1, 2, 0)], cooldown: 5, name: "Sorter" }, "bad": {} } });
  const saved = p.serialize(), q = new Survival(saved);
  assert.deepEqual(Object.keys(q.hoppers), ["1,2,3"]);
  assert.equal(q.hoppers["1,2,3"].cooldown, 5);
  assert.equal(q.hoppers["1,2,3"].name, "Sorter");
  assert.equal(q.hoppers["1,2,3"].items[4].count, 2);
});
