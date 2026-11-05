// Replays public/research/sapling-types-reference.json (tools/verify-sapling-types.mjs, tools/probes/SaplingTypesProbe.java):
// BlockSapling.func_149878_d for all six types and the BlockOldLeaf/BlockNewLeaf drop loops, from the unchanged 1.7.10 classes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { JavaRandom } from "./lighting.js";
import { Trees } from "./trees.js";
import { treeRegistryReady } from "./tree-growth.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { harvestBlock } from "./enchantment-effects.js";
import { leafDrops } from "./trees.js";

const ref = JSON.parse(await readFile(new URL("../public/research/sapling-types-reference.json", import.meta.url)));
const sha = (s) => createHash("sha256").update(s).digest("hex");
await treeRegistryReady;

// A flat 256-high world in this build's ids whose cells are written through the browser World's put/set API.
class Cells {
  constructor(fx) {
    this.height = 256;
    this.generationVersion = 11;
    this.fx = fx;
    this.fixed = new Map();
    for (const [x, y, z, id, meta] of fx.edits) this.fixed.set(`${x},${y},${z}`, [id, meta]);
    this.cells = new Map();
    this.memo = new Map();
  }
  mcBase(x, y, z) {
    const f = this.fixed.get(`${x},${y},${z}`);
    if (f) return f;
    const g = this.fx.ground;
    return [y < g - 3 ? 1 : y < g ? 3 : y === g ? this.fx.top : 0, 0];
  }
  internal(x, y, z) {
    const [id, meta] = this.mcBase(x, y, z), key = id * 16 + meta;
    let v = this.memo.get(key);
    if (!v) {
      const m = fromOriginal(id, meta);
      assert.ok(m?.exact, `${id}:${meta}`);
      this.memo.set(key, (v = [m.id, m.meta]));
    }
    return v;
  }
  cell(x, y, z) { return this.cells.get(`${x},${y},${z}`) ?? this.internal(x, y, z); }
  get(x, y, z) { return y < 0 || y > 255 ? 0 : this.cell(x, y, z)[0]; }
  getMeta(x, y, z) { return y < 0 || y > 255 ? 0 : this.cell(x, y, z)[1]; }
  put(x, y, z, id, meta = 0) { if (y < 0 || y > 255) return false; this.cells.set(`${x},${y},${z}`, [id, meta]); return true; }
  set(x, y, z, id, tracked = true, meta = 0) { const old = this.get(x, y, z); this.put(x, y, z, id, meta); if (tracked) this.onChange?.(x, y, z, old, id); return true; }
  state() {
    const lines = [];
    const keys = [...this.cells.keys()].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const [x, y, z] of keys) {
      const [vid, vmeta] = toOriginal(...this.cells.get(`${x},${y},${z}`)), [oid, ometa] = this.mcBase(x, y, z);
      const vm = vid === 0 ? 0 : vmeta, om = oid === 0 ? 0 : ometa;
      if (vid !== oid || vm !== om) lines.push(`${x},${y},${z},${vid},${vm}`);
    }
    return sha(lines.join("\n"));
  }
}

test("the reference records the unchanged 1.7.10 classes", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.equal(ref.classes.anj.name, "BlockSapling");
  assert.equal(ref.classes.amh.name, "BlockNewLeaf");
  assert.equal(ref.rows.length, 1296);
});

test("BlockSapling.func_149878_d: every sapling type, 1x1, 2x2, L and mixed layouts, big oak roll, roof and soil failures", () => {
  const stats = { grew: 0, kept: 0 }, byType = {};
  for (const row of ref.rows) {
    const fx = ref.fixtures[row.f], world = new Cells(fx);
    for (const [x, z, meta] of row.cells) world.fixed.set(`${x},${fx.ground + 1},${z}`, [6, meta]);
    const random = new JavaRandom(row.seed), trees = new Trees(world, { random, maxY: 256 }).watch();
    // The tick's mark step has already set bit 8 on the clicked sapling in the reference; growTree does the grow call.
    trees.growTree(0, fx.ground + 1, 0);
    const label = `${fx.name} type ${row.type} cells ${JSON.stringify(row.cells)} seed ${row.seed}`;
    assert.equal(world.state(), row.state, label);
    assert.equal(random.nextInt(1000000), row.next, label);
    const grew = [...world.cells.values()].some(([id]) => id === 4 || id === 70);
    (byType[row.type] ??= { grew: 0, kept: 0 })[grew ? "grew" : "kept"]++;
    stats[grew ? "grew" : "kept"]++;
  }
  // Every type both grows and refuses somewhere in the set.
  for (let t = 0; t < 6; t++) assert.ok(byType[t].grew > 10 && byType[t].kept > 5, `type ${t} ${JSON.stringify(byType[t])}`);
  assert.ok(stats.grew > 400);
});

test("BlockOldLeaf/BlockNewLeaf drops: sapling damage by leaf type, apples (oak and dark oak), jungle 1/40, fortune 0 to 3", () => {
  let total = 0;
  for (const d of ref.leafDrops) {
    const random = new JavaRandom(d.seed), drops = [];
    const id = d.block === 18 ? 18 : 161;
    for (let i = 0; i < d.calls; i++) {
      const r = harvestBlock(id, d.meta, { fortune: d.fortune, rand: random });
      for (const s of r.drops) drops.push([i, s.id, s.damage]);
    }
    const label = `block ${d.block} meta ${d.meta} fortune ${d.fortune}`;
    assert.equal(drops.filter((s) => s[1] === 6).length, d.saplings, label);
    assert.equal(drops.filter((s) => s[1] === 260).length, d.apples, label);
    assert.equal(drops.length, d.saplings + d.apples + d.other, label);
    assert.equal(sha(drops.map((s) => s.join(",") + "\n").join("")), d.digest, label);
    assert.equal(random.nextInt(1000000), d.next, label);
    total++;
  }
  assert.equal(total, 40);
  // trees.js's leafDrops (the decay path) agrees with the fortune 0 rows.
  for (const d of ref.leafDrops.filter((x) => x.fortune === 0)) {
    const random = new JavaRandom(d.seed), drops = [];
    for (let i = 0; i < d.calls; i++) for (const s of leafDrops(random, d.meta, d.block === 18 ? 5 : 71)) drops.push([i, s.id === 48 ? 6 : 260, s.damage]);
    assert.equal(sha(drops.map((s) => s.join(",") + "\n").join("")), d.digest, `${d.block}:${d.meta}`);
    assert.equal(random.nextInt(1000000), d.next, `${d.block}:${d.meta}`);
  }
});
