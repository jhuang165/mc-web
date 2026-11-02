import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  replayScenario,
  blockProperties,
  chunkPositionHash,
  ChunkPositionSet,
  isEqualTo,
  RedstoneWorld,
  WIRE,
  LEVER,
  TORCH,
  UNLIT_TORCH,
  LAMP,
  LIT_LAMP,
  REPEATER,
  POWERED_REPEATER,
  FENCE,
  GLOWSTONE,
  NETHER_FENCE,
  GLASS,
  COBBLE_WALL,
  REDSTONE_ITEM,
  STONE,
  REDSTONE_BLOCK,
} from "./redstone.js";

// Recorded by tools/verify-redstone.mjs from the unchanged 1.7.10 classes.
const reference = JSON.parse(readFileSync(new URL("../public/research/redstone-reference.json", import.meta.url)));

test("block property table and Blocks ids match the original registry", () => {
  assert.deepEqual(blockProperties(), reference.blocks.props);
  const f = reference.blocks.fields;
  assert.deepEqual(
    [f.af, f.aN, f.aR, f.aS, f.aJ, f.bk, f.w, f.bK, f.az, f.aA, f.bu, f.bv, reference.blocks.items.redstone],
    [WIRE, GLOWSTONE, REPEATER, POWERED_REPEATER, FENCE, NETHER_FENCE, GLASS, COBBLE_WALL, UNLIT_TORCH, TORCH, LAMP, LIT_LAMP, REDSTONE_ITEM],
  );
});

for (const s of reference.scenarios)
  test(`native replay: ${s.name}`, () => {
    const mine = replayScenario(s);
    for (let t = 0; t < s.ticks; t++) {
      assert.equal(mine.calls[t], s.calls[t], `call log at tick ${t + 1}`);
      assert.deepEqual(mine.frames[t], s.frames[t], `block changes at tick ${t + 1}`);
    }
    assert.equal(mine.final, s.final);
    assert.deepEqual(mine.pending, s.pending);
    assert.deepEqual(
      mine.sounds,
      s.sounds.map(([t, x, y, z, name, volume, pitch]) => [t, x, y, z, name, Math.fround(volume), Math.fround(pitch)]),
    );
    assert.deepEqual(mine.drops, s.drops);
    assert.equal(mine.rng, s.rng);
  });

test("reference covers the required behaviours", () => {
  const names = reference.scenarios.map((s) => s.name);
  for (const n of ["line-lever", "branches", "loop", "stairs-up-down", "dust-over-under-block", "lamp-delay", "torch-inverter", "torch-clock-burnout", "torch-burnout-window", "line-break-mid", "buttons"])
    assert.ok(names.includes(n), n);
  const fizz = reference.scenarios.flatMap((s) => s.sounds).filter((x) => x[4] === "random.fizz");
  assert.ok(fizz.length >= 2, "burnout recorded");
});

test("ChunkPosition hash and Java 8 HashSet iteration order", () => {
  assert.equal(chunkPositionHash(1, 2, 3), 1 * 8976890 + 2 * 981131 + 3);
  assert.equal(chunkPositionHash(-300, 255, 300), (Math.imul(-300, 8976890) + 255 * 981131 + 300) | 0);
  const set = new ChunkPositionSet();
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]]) set.add(x, y, z);
  assert.equal(set.add(0, 0, 0), false);
  const order = set.toArray().map((p) => [p.x, p.y, p.z]);
  // Bucket = (h ^ h >>> 16) & 15, insertion order inside a bucket.
  const bucket = ([x, y, z]) => {
    const h = chunkPositionHash(x, y, z);
    return (h ^ (h >>> 16)) & 15;
  };
  for (let i = 1; i < order.length; i++) assert.ok(bucket(order[i - 1]) <= bucket(order[i]));
  set.clear();
  assert.deepEqual(set.toArray(), []);
});

test("pending-tick identity pairs lit and unlit torches", () => {
  assert.ok(isEqualTo(TORCH, UNLIT_TORCH));
  assert.ok(isEqualTo(REPEATER, POWERED_REPEATER));
  assert.ok(!isEqualTo(LAMP, LIT_LAMP));
  const w = new RedstoneWorld({ seed: 1 });
  w.setRaw(0, 0, 0, STONE, 0);
  w.setBlock(0, 1, 0, TORCH, 5, 3);
  w.scheduleBlockUpdate(0, 1, 0, UNLIT_TORCH, 2);
  w.scheduleBlockUpdate(0, 1, 0, TORCH, 5);
  assert.equal(w.pendingTicks().length, 1);
});

test("redstone block powers a 15-long line down to 1", () => {
  const w = new RedstoneWorld({ seed: 0 });
  for (let x = 0; x <= 16; x++) w.setRaw(x, 0, 0, STONE, 0);
  for (let x = 1; x <= 16; x++) w.setBlock(x, 1, 0, WIRE, 0, 3);
  w.setBlock(0, 1, 0, REDSTONE_BLOCK, 0, 3);
  assert.deepEqual(
    Array.from({ length: 16 }, (_, i) => w.getBlockMetadata(i + 1, 1, 0)),
    Array.from({ length: 16 }, (_, i) => Math.max(0, 15 - i)),
  );
  w.setBlockToAir(0, 1, 0);
  for (let x = 1; x <= 16; x++) assert.equal(w.getBlockMetadata(x, 1, 0), 0);
});
