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
  COMPARATOR,
  HEAVY_PLATE,
  LIGHT_PLATE,
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
      assert.deepEqual(mine.tiles[t], s.tiles?.[t] ?? [], `comparator outputs at tick ${t + 1}`);
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
  for (const n of [
    "repeater-delays", "repeater-chain", "repeater-clock", "repeater-lock", "repeater-pulses", "repeater-solid", "repeater-mixed", "repeater-placement",
    "comparator-modes", "comparator-container", "comparator-clock", "comparator-mixed", "comparator-placement", "pressure-plates", "pressure-plate-support",
  ])
    assert.ok(names.includes(n), n);
  assert.equal(reference.scenarios.length, 36);
  const outputs = new Set(reference.scenarios.flatMap((s) => s.tiles?.flat() ?? []).map((t) => t[3]));
  for (const v of [0, 1, 2, 3, 9, 12, 13, 15]) assert.ok(outputs.has(v), `comparator output ${v} recorded`);
  const clicks = reference.scenarios.flatMap((s) => s.sounds).filter((x) => x[4] === "random.click" && x[6] === 0.55);
  assert.ok(clicks.length >= 2, "comparator mode click recorded");
  const dropped = new Set(reference.scenarios.flatMap((s) => s.drops).map((d) => d[4]));
  for (const item of [356, 404, 70, 72, 147]) assert.ok(dropped.has(item), `item ${item} dropped`);
});

// ---- Unit checks of the diode, comparator and plate rules (the replays above carry the native evidence) ----
const floor = (w, x0, x1, z0, z1) => {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) w.setRaw(x, 0, z, STONE, 0);
};
const run = (w, n) => {
  for (let i = 0; i < n; i++) {
    w.time++;
    w.tickUpdates();
  }
};

test("repeater delay metadata gives 2/4/6/8 ticks", () => {
  for (let d = 0; d < 4; d++) {
    const w = new RedstoneWorld({ seed: 1 });
    floor(w, 0, 3, 0, 2);
    w.setRaw(1, 1, 1, REPEATER, 1 | (d << 2));
    w.setBlock(0, 1, 1, LEVER, 5, 3);
    w.activate(0, 1, 1);
    let lit = 0;
    for (let t = 1; t <= 12 && !lit; t++) {
      run(w, 1);
      if (w.getBlock(1, 1, 1) === POWERED_REPEATER) lit = t;
    }
    assert.equal(lit, (d + 1) * 2, `delay setting ${d}`);
  }
});

test("a side repeater facing a repeater locks it", () => {
  const w = new RedstoneWorld({ seed: 1 });
  floor(w, 0, 4, 0, 6);
  w.setRaw(2, 1, 3, REPEATER, 1); // target, input from -x
  w.setRaw(2, 1, 2, REPEATER, 2); // side repeater whose front is the target
  w.setBlock(1, 1, 3, LEVER, 5, 3);
  w.setBlock(2, 1, 1, LEVER, 5, 3);
  w.activate(2, 1, 1);
  run(w, 4);
  assert.equal(w.getBlock(2, 1, 2), POWERED_REPEATER);
  w.activate(1, 1, 3);
  run(w, 10);
  assert.equal(w.getBlock(2, 1, 3), REPEATER, "locked off stays off with its input on");
  w.activate(2, 1, 1);
  run(w, 10);
  assert.equal(w.getBlock(2, 1, 3), POWERED_REPEATER, "unlocks and follows its input");
});

test("comparator compares and subtracts with a side wire", () => {
  for (const [subtract, expected] of [[false, 15], [true, 0]]) {
    const w = new RedstoneWorld({ seed: 1 });
    floor(w, 0, 5, 0, 4);
    w.setRaw(1, 1, 2, WIRE, 0);
    w.setRaw(2, 1, 2, COMPARATOR, 1 | (subtract ? 4 : 0));
    w.setBlock(0, 1, 2, LEVER, 5, 3);
    w.setRaw(2, 1, 1, WIRE, 0); // side input: dust, read as its power level
    w.setBlock(2, 1, 0, LEVER, 5, 3);
    w.activate(0, 1, 2);
    w.activate(2, 1, 0);
    run(w, 6);
    assert.equal(w.comparatorTile(2, 1, 2).signal, expected, subtract ? "15 - 15" : "15 >= 15");
    assert.equal(w.getBlock(2, 1, 2), COMPARATOR, "1.7.10 keeps block id 149; the powered state is metadata bit 8");
    assert.equal((w.getBlockMetadata(2, 1, 2) & 8) !== 0, expected > 0);
  }
});

test("weighted plates convert entity counts to 1..15", () => {
  for (const [id, counts] of [[LIGHT_PLATE, [[1, 1], [5, 5], [20, 15]]], [HEAVY_PLATE, [[1, 1], [11, 2], [31, 4], [151, 15]]]]) {
    for (const [n, strength] of counts) {
      const w = new RedstoneWorld({ seed: 1 });
      floor(w, 0, 2, 0, 2);
      w.setRaw(1, 1, 1, id, 0);
      for (let i = 0; i < n; i++) w.entities.push({ kind: "item", cell: [1, 1, 1], box: [1.375, 1, 1.375, 1.625, 1.25, 1.625] });
      w.collide(1, 1, 1);
      assert.equal(w.getBlockMetadata(1, 1, 1), strength > 0 ? strength : 0, `${id} with ${n}`);
    }
  }
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
