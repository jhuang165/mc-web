// Replays public/research/biome-colors-reference.json (BiomeColorProbe on the unchanged 1.7.10 client): every biome slot's
// grass/foliage/sky colour at nine heights and positions, the swamp noise grid, and Block.colorMultiplier of grass, leaves, vines,
// reeds, tall grass, double plants, water, lava and the lily pad on a synthetic scatter biome map (the 3x3 average).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { setColormaps, biomeGrassColor, biomeFoliageColor, biomeWaterColor, BiomeColorField, floatTemperature, itemGrassColor, itemFoliageColor, PINE, BIRCH, FOLIAGE_BASIC, LILY_PAD_COLOR, MUTATED_PARENT, averageColors } from "./biome-colors.js";
import { BIOME_LIST } from "./java-biomes.js";
import { skyColorByTemp } from "./lighting.js";

function rgba(bytes) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), idat = [];
  assert.deepEqual([bytes[24], bytes[25], bytes[28]], [8, 6, 0]);
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString("latin1", at + 4, at + 8);
    if (kind === "IDAT") idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[y * stride + x - 4] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = x >= 4 && y ? data[(y - 1) * stride + x - 4] : 0,
        pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c),
        predict = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      data[y * stride + x] = raw[y * (stride + 1) + 1 + x] + predict;
    }
  }
  return data;
}
const ref = JSON.parse(readFileSync(new URL("../public/research/biome-colors-reference.json", import.meta.url), "utf8"));
const png = (name) => rgba(readFileSync(new URL(`../public/media/1.7.10/colormap/${name}.png`, import.meta.url)));
setColormaps(png("grass"), png("foliage"));
const of = (kind) => ref.records.filter((r) => r.kind === kind);

test("the probe ran against the shipped colormaps", () => {
  assert.equal(ref.records.length, 375);
  assert.equal(of("colormaps")[0].pine, PINE);
  assert.equal(of("colormaps")[0].birch, BIRCH);
  assert.equal(of("colormaps")[0].basic, FOLIAGE_BASIC);
});

test("item colours are ColorizerGrass/Foliage.getColor(0.5, 1.0)", () => {
  const c = of("colormaps")[0];
  assert.equal(itemGrassColor(), c.grassItem);
  assert.equal(itemFoliageColor(), c.foliageItem);
});

test("every biome slot: temperature at height, grass, foliage, water and sky colour match BiomeGenBase", () => {
  const biomes = of("biome");
  assert.equal(biomes.length, 61);
  let samples = 0;
  for (const r of biomes) {
    const b = BIOME_LIST[r.slot];
    assert.ok(b, `slot ${r.slot}`);
    assert.equal(biomeWaterColor(b), r.water, `${r.name} water`);
    for (const [x, y, z, temperature, grass, foliage, sky] of r.samples) {
      assert.equal(floatTemperature(b, x, y, z), Math.fround(temperature), `${r.name} temperature at ${x},${y},${z}`);
      assert.equal(biomeGrassColor(b, x, y, z), grass, `${r.name} grass at ${x},${y},${z}`);
      assert.equal(biomeFoliageColor(b, x, y, z), foliage, `${r.name} foliage at ${x},${y},${z}`);
      // BiomeGenEnd.getSkyColorByTemp returns 0; the End dimension draws its own sky (dimension-render.js).
      if (r.slot !== 9) assert.equal(skyColorByTemp(Math.fround(temperature)).reduce((a, v) => a * 256 + v, 0), sky, `${r.name} sky`);
      samples++;
    }
  }
  assert.equal(samples, 61 * 9);
});

test("mutated biomes hand (x, y, y) to the parent, as BiomeGenMutated does", () => {
  for (const r of of("biome").filter((b) => b.colorType === "mutated")) assert.equal(MUTATED_PARENT[r.slot], r.parent, r.name);
  // Swamp M reads the swamp noise at (x, y): its grass at (0, 63, 0) is the low-noise colour while plain swamp's is the high one.
  assert.equal(biomeGrassColor(BIOME_LIST[134], 0, 63, 0), 0x4C763C);
  assert.equal(biomeGrassColor(BIOME_LIST[6], 0, 63, 0), 0x6A7039);
});

test("BiomeGenSwamp grass noise grid (both colours occur)", () => {
  const grid = of("swamp")[0].cells, seen = new Set();
  for (const [x, z, color] of grid) { assert.equal(biomeGrassColor(BIOME_LIST[6], x, 70, z), color, `${x},${z}`); seen.add(color); }
  assert.deepEqual([...seen].sort(), [0x4C763C, 0x6A7039]);
});

// Block ids are the original ones; the metadata and blocks follow the colorMultiplier of each class.
test("Block.colorMultiplier on a scatter biome map: 3x3 averages, single positions and fixed colours", () => {
  const blocks = of("block");
  let checked = 0;
  for (const r of blocks) {
    const field = new BiomeColorField((x, z) => BIOME_LIST[r.biomes[(Math.max(-1, Math.min(1, z - r.pos[2])) + 1) * 3 + Math.max(-1, Math.min(1, x - r.pos[0])) + 1]]);
    const [x, y, z] = r.pos;
    let color;
    if (r.block === 2) color = field.grass(x, y, z);
    else if (r.block === 18) color = r.meta === 1 ? PINE : r.meta === 2 ? BIRCH : field.foliage(x, y, z);
    else if (r.block === 161) color = field.foliage(x, y, z);
    else if (r.block === 106) color = field.foliageAt(x, y, z);
    else if (r.block === 83) color = field.grassAt(x, y, z);
    else if (r.block === 31) color = r.meta === 0 ? 0xFFFFFF : field.grassAt(x, y, z);
    else if (r.block === 175) color = (r.meta & 7) === 2 || (r.meta & 7) === 3 ? field.grassAt(x, y, z) : 0xFFFFFF;
    else if (r.block === 8 || r.block === 9) color = field.water(x, z);
    else if (r.block === 10 || r.block === 11) color = 0xFFFFFF;
    else if (r.block === 111) color = LILY_PAD_COLOR;
    else assert.fail(`block ${r.block}`);
    assert.equal(color, r.color, `block ${r.block}:${r.meta} at ${r.pos}`);
    checked++;
  }
  assert.equal(checked, 288);
});

test("the 3x3 average is integer arithmetic (sum / 9, truncated)", () => {
  assert.equal(averageColors(new Int32Array([0x010101, 0, 0, 0, 0, 0, 0, 0, 0])), 0);
  assert.equal(averageColors(new Int32Array(9).fill(0x6A7039)), 0x6A7039);
  assert.equal(averageColors(new Int32Array([0x090000, 0x090000, 0x090000, 0x090000, 0x090000, 0x090000, 0x090000, 0x090000, 0x080000])), 0x080000);
});
