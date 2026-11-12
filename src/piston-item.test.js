// The piston and dispenser inventory items are unit cubes in 1.7.10: RenderBlocks.renderItemIn3d accepts render type 16, and renderBlockAsItem draws the block at metadata 1
// (dispenser 3) with getIcon(side, 1): the executed ItemRenderProbe records (item-render-reference.json, ids 33, 29, 23) have the stone cube's six quads with these icons.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TILES, blockTile } from "./block-textures.js";
import { itemSpec } from "./item-boxes.js";
import { PISTON_ITEM, STICKY_PISTON_ITEM, DISPENSER_ITEM } from "./dispenser-piston.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/item-render-reference.json", import.meta.url), "utf8"));
const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
// The native draw order is -Y, +Y, -Z, +Z, -X, +X; the port's face index runs +x, -x, +y, -y, +z, -z.
const PORT_FACE = [3, 2, 5, 4, 1, 0];
const recorded = (id) => ref.items.find((e) => e.id === id).events.filter((e) => e[0] === "D").map((e) => ref.icons[Math.floor(fl(e[2][3]) / 2)]);

test("pistons and the dispenser draw as cubes with the executed per-face icons", () => {
  for (const [orig, item] of [[33, PISTON_ITEM], [29, STICKY_PISTON_ITEM], [23, DISPENSER_ITEM]]) {
    assert.equal(ref.items.find((e) => e.id === orig).type, orig === 23 ? 0 : 16);
    assert.equal(itemSpec(item, 0, () => 0), null, "no box table: a unit cube");
    assert.deepEqual(PORT_FACE.map((f) => TILES[blockTile(item, f, false, 0)]), recorded(orig), `item ${item}`);
  }
});
