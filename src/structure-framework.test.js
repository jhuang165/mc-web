import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import {
  StructureBoundingBox, StructureComponent, StructureMap, isAirMaterial, isLiquid,
  isOpaqueAtConstruction, isBlockDirectional, DIRECTION_ROTATE_OPPOSITE, FACING_OPPOSITE, randomLong,
} from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import { MINESHAFT_LOOT, mineshaftLootWithBook } from "./mineshaft-generator.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/mineshaft-reference.json", import.meta.url)));
const records = (kind) => ref.records.filter((r) => r.kind === kind);

test("GEN-05 structure framework: native Material/Block property tables and rotation arrays", () => {
  for (const [id, air, liquid, opaque, directional] of ref.config.materials) {
    assert.equal(isAirMaterial(id), air, `air ${id}`);
    assert.equal(isLiquid(id), liquid, `liquid ${id}`);
    assert.equal(isOpaqueAtConstruction(id), opaque, `opaque ${id}`);
    assert.equal(isBlockDirectional(id), directional, `directional ${id}`);
  }
  assert.deepEqual(DIRECTION_ROTATE_OPPOSITE, ref.config.direction);
  assert.deepEqual(FACING_OPPOSITE, ref.config.facing);
  assert.deepEqual(MINESHAFT_LOOT, ref.config.loot);
});

test("GEN-05 structure framework: getComponentToAddBoundingBox, sizes and centres for every mode", () => {
  const [r] = records("boxes");
  assert.equal(r.values.length, 28);
  for (const [mode, args, box, ...sizes] of r.values) {
    const b = StructureBoundingBox.componentBox(...args, mode);
    assert.deepEqual(b.toArray(), box, JSON.stringify([mode, args]));
    assert.deepEqual([b.xSize, b.ySize, b.zSize, b.centerX, b.centerY, b.centerZ], sizes);
  }
});

class Probe extends StructureComponent {
  constructor(mode, bb) { super(0); this.coordBaseMode = mode; this.boundingBox = bb; }
  addComponentParts() { return true; }
}

test("GEN-05 structure framework: getMetadataWithOffset over all IDs, metadata and modes", () => {
  const [r] = records("metadata");
  const expected = new Map(r.changed.map(([mode, id, meta, v]) => [`${mode},${id},${meta}`, v]));
  let changed = 0;
  for (let mode = -1; mode <= 3; mode++) {
    const p = new Probe(mode, new StructureBoundingBox(0, 0, 0, 1, 1, 1));
    for (let id = 0; id < 256; id++) for (let meta = 0; meta < 16; meta++) {
      const v = p.getMetadataWithOffset(id, meta), k = `${mode},${id},${meta}`;
      assert.equal(v, expected.has(k) ? expected.get(k) : meta, k);
      if (v !== meta) changed++;
    }
  }
  assert.equal(changed, r.changed.length);
});

// Mirrors MineshaftProbe.framework.
function framework(seed, mode) {
  const w = new RecordingWorld("pockets"), bb = StructureBoundingBox.componentBox(37, 30, -21, -1, -1, 0, 9, 7, 11, mode < 0 ? 0 : mode);
  const t = new Probe(mode, bb), ox = mode < 0 ? bb.minX : 0, oy = mode < 0 ? bb.minY : 0, oz = mode < 0 ? bb.minZ : 0;
  const clip = StructureBoundingBox.xz(bb.minX - 2, bb.minZ + 3, bb.minX + 6, bb.maxZ + 1); clip.minY = 28; clip.maxY = 34;
  const r = new JavaRandom(BigInt(seed)), res = [t.isLiquidInStructureBoundingBox(w, clip)];
  t.fillWithBlocks(w, clip, ox, oy, oz, ox + 8, oy, oz + 10, 3, 4, true);
  t.fillWithBlocks(w, clip, ox + 1, oy + 1, oz + 1, ox + 7, oy + 3, oz + 9, 5, 0, false, 2, 0);
  t.fillWithAir(w, clip, ox + 2, oy + 2, oz + 2, ox + 5, oy + 4, oz + 6);
  const selector = { select: (random, x, y, z, edge) => (edge ? [4, 0] : random.nextFloat() < Math.fround(0.4) ? [51, random.nextInt(3)] : [0, 0]) };
  t.fillWithRandomizedBlocks(w, clip, ox, oy + 1, oz, ox + 8, oy + 4, oz + 10, true, r, selector);
  t.randomlyFillWithBlocks(w, clip, r, 0.35, ox, oy + 2, oz, ox + 8, oy + 5, oz + 10, 43, 0, true);
  for (let i = 0; i < 12; i++) t.randomlyPlaceBlock(w, clip, r, 0.5, ox + (i % 9), oy + 3, oz + i, 50, i & 7);
  t.randomlyRareFillWithBlocks(w, clip, ox, oy + 3, oz, ox + 8, oy + 6, oz + 10, 0, false);
  t.randomlyRareFillWithBlocks(w, clip, ox, oy + 1, oz, ox + 8, oy + 6, oz + 10, 30, true);
  for (let i = 0; i < 9; i++) t.clearCurrentPositionBlocksUpwards(w, ox + i, oy + 2, oz + i, clip);
  for (let i = 0; i < 9; i++) t.fillCurrentPositionBlocksDownwards(w, 4, i, ox + i, oy, oz + 10 - i, clip);
  const loot = mineshaftLootWithBook(r);
  for (let i = 0; i < 6; i++) res.push(t.generateStructureChestContents(w, clip, r, ox + i, oy + 1, oz + 2 * i, loot, 3 + i));
  res.push(t.isLiquidInStructureBoundingBox(w, clip));
  const offsets = [];
  for (let x = -1; x <= 9; x += 5) for (let z = -1; z <= 11; z += 6) offsets.push([t.getXWithOffset(x, z), t.getYWithOffset(x), t.getZWithOffset(x, z)]);
  return { bb: bb.toArray(), clip: clip.toArray(), res, offsets, w, next: randomLong(r).toString() };
}

test("GEN-05 structure framework: fill/random/ellipsoid/upward/downward/chest helpers replay native writes, calls and RNG", () => {
  const rs = records("framework");
  assert.equal(rs.length, 15);
  for (const r of rs) {
    const label = `${r.seed} mode ${r.mode}`, o = framework(r.seed, r.mode);
    assert.deepEqual(o.bb, r.bb, label); assert.deepEqual(o.clip, r.clip, label);
    assert.deepEqual(o.res, r.results, label); assert.deepEqual(o.offsets, r.offsets, label);
    assert.equal(o.w.writeCount, r.writeCount, label); assert.equal(o.w.writes.digest("hex"), r.writesSha1, label);
    assert.equal(o.w.callCount, r.callCount, label); assert.equal(o.w.calls.digest("hex"), r.callsSha1, label);
    assert.deepEqual(o.w.tileList(), r.tiles, label);
    assert.equal(o.next, r.nextLong, label);
  }
  assert.ok(rs.every((r) => r.tiles.length > 0 && r.tiles.every((t) => t[1] === "chest")));
  assert.ok(rs.some((r) => r.results.slice(1, 7).some((v) => !v)) && rs.some((r) => r.writeCount > 0));
});

test("GEN-05 structure framework: Java 8+ HashMap<Long> iteration order model", () => {
  const m = new StructureMap();
  // x ^ z collisions keep insertion order inside a bucket; growth re-buckets by the wider mask.
  for (const [x, z] of [[1, 0], [0, 1], [17, 0], [3, 3], [-1, -1], [16, 0], [0, 0]]) m.set(x, z, `${x},${z}`);
  // Buckets (x ^ z spread, mask 15): 0 holds 3,3 / -1,-1 / 16,0 / 0,0 in insertion order; 1 holds 1,0 / 0,1 / 17,0.
  assert.deepEqual(m.values(), ["3,3", "-1,-1", "16,0", "0,0", "1,0", "0,1", "17,0"]);
  for (let i = 0; i < 20; i++) m.set(i * 5, -i, i);
  assert.equal(m.capacity, 64);
  assert.equal(m.size, 26); // i = 0 re-sets 0,0 in place
});
