// Batch 53 (tag b53lc): the item colours of the 1.7.10 client, executed (Item.getColorFromItemStack, adb.a(add, int), next to Block.getRenderColor, aji.i(int), over every item id and damage).
// Render paths (bytecode-read, RenderItem bny and ItemRenderer bly): a block item whose render type draws in 3D (blm.a(int)) is drawn by renderBlockAsItem (useInventoryTint on), whose colour is
// Block.getRenderColor(meta) in the held, dropped, GUI and item frame paths (the stack colour set before it is overwritten); a flat item is drawn with getColorFromItemStack.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PINE, BIRCH, FOLIAGE_BASIC, LILY_PAD_COLOR, setColormaps, itemGrassColor } from "./biome-colors.js";
import { displayTint, STEM_TINT } from "./cart-display-shape.js";

const ref = JSON.parse(await readFile(new URL("../public/research/leafcolor-reference.json", import.meta.url), "utf8"));
const rec = ref.records[0], byId = new Map(rec.items.map((i) => [i.id, i]));
const src = await readFile(new URL("./block-textures.js", import.meta.url), "utf8");

test("the reference is the executed item colour sweep", () => {
  assert.equal(ref.tag, "b53lc");
  for (const c of ["adb", "add", "aji", "blm", "aha", "agx"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.ok(rec.swept > 150);
  assert.equal(rec.foliage, 0x5bab46, "the colormap's (0.5, 1.0) foliage is not what leaves answer");
  assert.deepEqual([rec.basic, rec.pine, rec.birch], [FOLIAGE_BASIC, PINE, BIRCH]);
});

test("leaves: the stack colour and the block colour are the basic, pine and birch constants for every damage", () => {
  for (const id of [18, 161]) {
    const it = byId.get(id);
    assert.ok(it.in3d, "leaves draw as 3D blocks, so their colour is getRenderColor");
    for (let m = 0; m < 16; m++) {
      const want = id === 18 ? [FOLIAGE_BASIC, PINE, BIRCH, FOLIAGE_BASIC][m & 3] : FOLIAGE_BASIC;
      assert.equal(it.pass0[m], want, `item ${id}:${m}`);
      assert.equal(it.pass1[m], want);
      assert.equal(it.blockTint[m], want);
      assert.equal(it.pass0[m], it.blockTint[m]);
    }
  }
});

test("the grass block item is white as a stack; the 3D draw tints only its top with i(meta)", () => {
  const it = byId.get(2);
  assert.ok(it.in3d);
  assert.ok(it.pass0.every((c) => c === 0xffffff));
  assert.ok(it.blockTint.every((c) => c === rec.grass));
});

test("flat plant items: tall grass, vine, lily pad and the double plants", () => {
  const tall = byId.get(31);
  assert.equal(tall.in3d, false);
  assert.deepEqual(tall.pass0, tall.blockTint);
  assert.equal(tall.pass0[0], 0xffffff);
  assert.ok(tall.pass0.slice(1).every((c) => c === rec.grass), "tall grass 1 and fern 2 take ColorizerGrass(0.5, 1.0)");
  assert.ok(byId.get(106).pass0.every((c) => c === FOLIAGE_BASIC), "the vine item is the basic foliage colour, not the grass colour");
  assert.ok(byId.get(111).pass0.every((c) => c === LILY_PAD_COLOR));
  const dbl = byId.get(175);
  assert.deepEqual(dbl.pass0.slice(0, 6), [0xffffff, 0xffffff, rec.grass, rec.grass, 0xffffff, 0xffffff], "only double tall grass and the large fern are tinted");
  assert.ok(dbl.blockTint.every((c) => c === 0xffffff), "the double plant block itself is white; the item colour tints it");
});

test("no stem has a block item (the stems keep their meta colour only as display blocks)", () => {
  assert.equal(byId.has(104) || byId.has(105), false);
  assert.equal(STEM_TINT(7) >>> 0, ((7 * 32) << 16 | (255 - 56) << 8 | 28) >>> 0);
});

test("the item atlas bakes the executed colours: basic foliage for leaves and vine, no grass side overlay", () => {
  setColormaps(new Int32Array(65536).fill(rec.grass), new Int32Array(65536).fill(rec.foliage));
  assert.ok(src.includes("name==='vine'?FOLIAGE_BASIC:name.startsWith('leaves_')?(name==='leaves_spruce'?PINE:name==='leaves_birch'?BIRCH:FOLIAGE_BASIC)"));
  assert.ok(src.includes("foliage=col(FOLIAGE_BASIC)"));
  assert.ok(!src.includes("itemFoliageColor"), "the colormap foliage colour is no longer baked into any item tile");
  assert.ok(!/GRASS_TILES=\[[^\]]*'vine'/.test(src));
  assert.ok(!/name==='grass_side'&&!terrainMode/.test(src), "renderBlockAsItem draws no overlay on the sides");
  const [r, g, b] = displayTint(18, 0);
  assert.deepEqual([r, g, b], [0x48 / 255, 0xb5 / 255, 0x18 / 255]);
  assert.equal(itemGrassColor(), rec.grass);
});
