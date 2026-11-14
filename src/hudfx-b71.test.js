// Batch 71 hudfx71: GuiIngame vignette smoothing, brewing stand shared bounds, glowstone Fortune, witchMagic particles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { Vignette, vignetteStep, vignetteTarget, VIGNETTE_START } from "./vignette.js";
import { brewingShared, brewingSelection } from "./brewing.js";
import { blockBounds, collisionBoxes } from "./world.js";
import { harvestBlock, enchantedBreakDrops } from "./enchantment-effects.js";
import { itemFromOriginal } from "./region-import.js";
import { witchMagicParticles } from "./witch-magic.js";
import { copyStatus } from "./copy-status.js";
import { Fx } from "./fx.js";

const reference = JSON.parse(await readFile(new URL("../public/research/brewing-bounds-reference.json", import.meta.url), "utf8"));
const f = Math.fround;

test("vignette: starts at 1, targets 1 - brightness clamped, moves 1 % per drawn frame, Fast graphics skip", () => {
  assert.equal(VIGNETTE_START, 1);
  assert.equal(vignetteTarget(0.25), 0.75);
  assert.equal(vignetteTarget(-3), 1);
  assert.equal(vignetteTarget(4), 0);
  const v = new Vignette();
  assert.equal(v.frame(false, 0), 0);
  assert.equal(v.level, 1);
  assert.equal(v.frame(true, 1), f(1 + f(0 - 1) * 0.01)); // full light: 0.99
  assert.equal(v.level, f(0.99));
  let p = 1;
  for (let i = 0; i < 500; i++) p = vignetteStep(p, 1);
  assert.ok(p < 0.01 && p > 0, "converges toward the bright target without reaching it in a few hundred frames");
  let d = 0;
  for (let i = 0; i < 700; i++) d = vignetteStep(d, 0);
  assert.ok(d > 0.99, "and toward darkness");
});

test("brewing stand bounds follow the executed shared-Block state", () => {
  const by = (step) => reference.records.find((r) => r.step?.startsWith(step));
  const fresh = by("fresh"), after = by("after one"), second = by("after a second");
  assert.deepEqual(fresh.bounds, [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(after.bounds, [0, 0, 0, 1, 0.125, 1]);
  assert.deepEqual(second.bounds, after.bounds);
  const world = { get: () => 134, getMeta: () => 0, solid: () => true };
  brewingShared.passed = false;
  assert.deepEqual(blockBounds(world, 1, 2, 3), fresh.bounds); // the first selection query, before any collision pass
  assert.deepEqual(brewingSelection(), fresh.bounds);
  collisionBoxes(world, 1, 2, 3); // a collision pass touches the stand: pole and slab, then the slab stays
  assert.deepEqual(blockBounds(world, 1, 2, 3), after.bounds);
  assert.deepEqual(after.list.map((b) => b.map((v, i) => v - [5, 6, 7, 5, 6, 7][i])), [[0.4375, 0, 0.4375, 0.5625, 0.875, 0.5625], [0, 0, 0, 1, 0.125, 1]]);
  brewingShared.passed = false;
});

test("glowstone Fortune: 2 + nextInt(3) + nextInt(fortune + 1), clamped to 1..4 (BlockGlowstone, executed)", () => {
  const [head, ...rows] = reference.glowstone;
  assert.equal(head.class, "alg");
  assert.equal(head.dropsGlowstoneDustItem, true);
  const dust = itemFromOriginal(348, 0), block = itemFromOriginal(89, 0);
  for (const r of rows) {
    const out = harvestBlock(89, 0, { fortune: r.fortune, rand: new JavaRandom(r.seed) });
    assert.equal(out.drops.reduce((a, d) => a + d.count, 0), r.count, `fortune ${r.fortune} seed ${r.seed}`);
    assert.ok(out.drops.every((d) => d.id === 348));
    const live = enchantedBreakDrops(131, 0, { id: 278, enchantments: [{ id: 35, lvl: r.fortune }] }, new JavaRandom(r.seed));
    if (r.fortune > 0) {
      assert.equal(live.silk, false);
      assert.equal(live.drops.reduce((a, d) => a + d.count, 0), r.count);
      assert.ok(live.drops.every((d) => d.id === dust.id));
    } else assert.equal(live, null); // no enchantment: the caller's plain drop path (explosion.js / population drops, 2..4)
  }
  const silk = enchantedBreakDrops(131, 0, { id: 278, enchantments: [{ id: 33, lvl: 1 }] }, new JavaRandom(1));
  assert.equal(silk.silk, true);
  assert.deepEqual(silk.drops.map((d) => d.id), [block.id]);
});

test("witchMagic: the bound is redrawn each pass, three gaussians per particle around the head, zero velocity", () => {
  const seen = [], at = { x: 10, y: 64, z: 20, height: 1.8 };
  const n = witchMagicParticles((...a) => seen.push(a), at, new JavaRandom(7));
  const rand = new JavaRandom(7);
  let expected = 0;
  for (let i = 0; i < rand.nextInt(35) + 10; i++) { rand.nextGaussian(); rand.nextGaussian(); rand.nextGaussian(); expected++; }
  assert.equal(n, expected);
  assert.equal(seen.length, expected);
  assert.ok(expected >= 10 && expected <= 44);
  const probe = new JavaRandom(7);
  probe.nextInt(35);
  const first = seen[0];
  assert.equal(first[0], "witchMagic");
  assert.equal(first[1], 10 + probe.nextGaussian() * 0.12999999523162842);
  assert.equal(first[2], 64 + 1.8 + 0.5 + probe.nextGaussian() * 0.12999999523162842);
  assert.equal(first[3], 20 + probe.nextGaussian() * 0.12999999523162842);
  assert.deepEqual(first.slice(4), [0, 0, 0]);
  // copyStatus on a witch copy draws exactly as before whether or not particles are wanted.
  const a = new JavaRandom(3), b = new JavaRandom(3), c = { x: 1, y: 2, z: 3, height: 1.8 }, got = [];
  copyStatus(c, { type: "witch" }, 15, a, null);
  copyStatus(c, { type: "witch" }, 15, b, { spawn: (...x) => got.push(x) });
  assert.equal(a.nextInt(1000), b.nextInt(1000));
  assert.ok(got.length >= 10);
});

test("witchMagic particle is a purple EntitySpellParticleFX on texture base 144", () => {
  const fx = new Fx({ worldRandom: new JavaRandom(5), entityRandom: () => new JavaRandom(9) });
  const expected = f(f(new JavaRandom(5).nextFloat() * f(0.5)) + f(0.35));
  const p = fx.make("witchMagic", 0, 70, 0, 0, 0, 0);
  assert.equal(p.kind, "spell");
  assert.equal(p.baseTex, 144);
  assert.equal(p.r, expected);
  assert.equal(p.b, expected);
  assert.equal(p.g, 0);
});
