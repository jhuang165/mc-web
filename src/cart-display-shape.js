// Batch 50: what RenderBlocks.renderBlockAsItem (blm.a(aji, meta, brightness)) draws for a minecart's custom display block, by the block's render type
// (bytecode-read, `javap -c -p` on blm and boi). RenderMinecart.func_147910_a only calls it (no render-type test besides -1 in doRender), so a block whose render
// type renderBlockAsItem has no branch for draws NOTHING: fluids 4, fire 3, doors 7, rails 9, ladders 8, vines 20, redstone wire 5, levers 12, repeaters 15, signs, beds 14,
// panes and bars 18, the lily pad 23 (its branch only begins and draws an empty tessellator), cauldrons 24, brewing stands 25, cocoa 28, tripwire 29/30, pots 33, double
// plants 40, comparators 36, pistons' arms 17. Branches: 0, 31, 39, 16, 26 turned boxes (blockItemGeometry / blockCubeGeometry), 13 cactus, 10 stairs, 11 fences, 21 gates,
// 27 dragon egg, 32 walls, 34 beacon, 35 anvil, 22 chests, 38 hopper, plus the flat plant shapes built here: 1 crossed squares (scale 1 at -0.5), 6 crops (two pairs of
// planes), 19 stems (renderBlockStemSmall, height 0.25 from BlockStem.setBlockBoundsForItemRender) and 2 torches (upright).
import * as THREE from "three";
import { blockTile, tileRect, TILES } from "./block-textures.js";
import { trackUvArray } from "./uv-rebake.js";
import { crossedSquares, stemSmall } from "./render-vessels.js";
import { hasColormaps, itemGrassColor, rgbFloats, PINE, BIRCH, FOLIAGE_BASIC } from "./biome-colors.js";

const CROSS = new Set([6, 30, 31, 32, 37, 38, 39, 40, 83]), CROPS = new Set([59, 115, 141, 142]), STEMS = new Set([104, 105]), TORCHES = new Set([50, 75, 76]);
const NOTHING = new Set([8, 9, 10, 11, 26, 27, 28, 34, 36, 51, 55, 63, 64, 65, 66, 68, 69, 71, 93, 94, 101, 102, 106, 111, 117, 118, 119, 127, 131, 132, 140, 144, 149, 150, 157, 160, 175]);
// RenderBlocks.renderBlockAsItem for the hopper (render type 38), EXECUTED (b53dq, display-quads-reference.json id 154): 17 quads, no rotation, at the block's 0..1 corner (the -0.5 translate is applied in displayQuads).
// Each row: icon (0 hopper_outside, 1 hopper_top, 2 hopper_inside) then four vertices of x y z u v (icon fractions, v from the top): the bowl's underside and rim at 5/8..1, the four outer sides, the four inner walls, the floor, and the funnel box 0.25..0.75 (top at 0.623).
const HOPPER_ICONS = ["hopper_outside", "hopper_top", "hopper_inside"];
const HOPPER_ROWS = [
  [0, 0, 0.625, 1, 0, 1, 0, 0.625, 0, 0, 0, 1, 0.625, 0, 1, 0, 1, 0.625, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1],
  [0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0.625, 0, 0, 0.375, 0, 0.625, 0, 1, 0.375],
  [0, 0, 1, 1, 0, 0, 0, 0.625, 1, 0, 0.375, 1, 0.625, 1, 1, 0.375, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0.625, 0, 0, 0.375, 0, 0.625, 1, 1, 0.375],
  [0, 1, 0.625, 1, 0, 0.375, 1, 0.625, 0, 1, 0.375, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0],
  [0, 0.125, 0.625, 1, 0, 0.375, 0.125, 0.625, 0, 1, 0.375, 0.125, 1, 0, 1, 0, 0.125, 1, 1, 0, 0],
  [0, 0.875, 1, 1, 1, 0, 0.875, 1, 0, 0, 0, 0.875, 0.625, 0, 0, 0.375, 0.875, 0.625, 1, 1, 0.375],
  [0, 0, 1, 0.125, 0, 0, 0, 0.625, 0.125, 0, 0.375, 1, 0.625, 0.125, 1, 0.375, 1, 1, 0.125, 1, 0],
  [0, 0, 1, 0.875, 1, 0, 1, 1, 0.875, 0, 0, 1, 0.625, 0.875, 0, 0.375, 0, 0.625, 0.875, 1, 0.375],
  [2, 1, 0.625, 1, 1, 1, 1, 0.625, 0, 1, 0, 0, 0.625, 0, 0, 0, 0, 0.625, 1, 0, 1],
  [0, 0.75, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75, 0.623, 0.25, 0.75, 0.377, 0.75, 0.623, 0.75, 0.25, 0.377],
  [0, 0.25, 0.623, 0.75, 0.75, 0.377, 0.25, 0.623, 0.25, 0.25, 0.377, 0.25, 0.25, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75],
  [0, 0.25, 0.623, 0.75, 0.25, 0.377, 0.25, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.75, 0.75, 0.75, 0.75, 0.623, 0.75, 0.75, 0.377],
  [0, 0.25, 0.623, 0.25, 0.75, 0.377, 0.75, 0.623, 0.25, 0.25, 0.377, 0.75, 0.25, 0.25, 0.25, 0.75, 0.25, 0.25, 0.25, 0.75, 0.75],
  [0, 0.75, 0.623, 0.75, 0.75, 0.75, 0.75, 0.623, 0.25, 0.75, 0.25, 0.25, 0.623, 0.25, 0.25, 0.25, 0.25, 0.623, 0.75, 0.25, 0.75],
  [0, 0.25, 0.25, 0.75, 0.25, 0.75, 0.25, 0.25, 0.25, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.75, 0.75],
];
// "none" | "cross" | "crops" | "stem" | "torch" | "hopper" | "item" (the existing box / cube / chest paths) by ORIGINAL block id.
export function displayShape(id) {
  if (!id || id < 0 || id > 175 || (id >= 165 && id <= 169)) return "none"; // 1.7.10 has no block 165-169 or above 175: Block.getBlockById gives air, which draws nothing (b56dl sweep)
  if (NOTHING.has(id)) return "none";
  if (CROSS.has(id)) return "cross";
  if (CROPS.has(id)) return "crops";
  if (STEMS.has(id)) return "stem";
  if (TORCHES.has(id)) return "torch";
  if (id === 154) return "hopper";
  return "item";
}

// Executed (b53dq, public/research/display-quads-reference.json, the real blm.a with a stub GL11): the quads below match renderBlockAsItem vertex for vertex, in order.
// Quads { verts: [[x, y, z] x4], uv: [[fu, fv] x4] } (fu, fv in icon fractions, v from the top) of the flat shapes, centred on the origin as renderBlockAsItem does.
export function displayQuads(shape) {
  const origin = -0.5;
  if (shape === "cross") return crossedSquares(origin, origin, origin, 1, null, 0);
  if (shape === "hopper") return HOPPER_ROWS.map((row) => ({ tile: HOPPER_ICONS[row[0]], verts: [0, 1, 2, 3].map((i) => [row[1 + i * 5] - 0.5, row[2 + i * 5] - 0.5, row[3 + i * 5] - 0.5]), uv: [0, 1, 2, 3].map((i) => [row[4 + i * 5], row[5 + i * 5]]) }));
  if (shape === "stem") return stemSmall(origin, origin, origin, 0.25, null);
  if (shape === "crops") { // renderBlockCropsImpl at -0.5 (executed, b53dq): the planes x = -0.25, +0.25 then z = -0.25, +0.25, each one block tall from the origin (the 1/16 drop is the world path's, not the item path's), drawn from both sides; the +0.25 planes run the other way
    const out = [], y0 = origin, y1 = origin + 1, q = (l) => ({ verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3], v[4]]) }), xa = origin, xb = origin + 1;
    for (const [o, from, to] of [[0.25, xa, xb], [0.75, xb, xa]]) {
      const x = origin + o;
      out.push(q([[x, y1, from, 0, 0], [x, y0, from, 0, 1], [x, y0, to, 1, 1], [x, y1, to, 1, 0]]), q([[x, y1, to, 0, 0], [x, y0, to, 0, 1], [x, y0, from, 1, 1], [x, y1, from, 1, 0]]));
    }
    for (const [o, from, to] of [[0.25, xa, xb], [0.75, xb, xa]]) {
      const z = origin + o;
      out.push(q([[from, y1, z, 0, 0], [from, y0, z, 0, 1], [to, y0, z, 1, 1], [to, y1, z, 1, 0]]), q([[to, y1, z, 0, 0], [to, y0, z, 0, 1], [from, y0, z, 1, 1], [from, y1, z, 1, 0]]));
    }
    return out;
  }
  if (shape === "torch") { // renderTorchAtAngle upright (dx = dz = 0) at the block's -0.5 corner: 2x2 top at 10/16, 2x2 bottom, four sides 1/16 from the centre
    const r = 0.0625, h = 0.625, cx = 0, cz = 0, py = origin, x0 = -0.5, x1 = 0.5, z0 = -0.5, z1 = 0.5;
    const q = (l) => ({ verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3] / 16, v[4] / 16]) });
    return [
      q([[cx - r, py + h, cz - r, 7, 6], [cx - r, py + h, cz + r, 7, 8], [cx + r, py + h, cz + r, 9, 8], [cx + r, py + h, cz - r, 9, 6]]),
      q([[cx + r, py, cz - r, 9, 13], [cx + r, py, cz + r, 9, 15], [cx - r, py, cz + r, 7, 15], [cx - r, py, cz - r, 7, 13]]),
      q([[cx - r, py + 1, z0, 0, 0], [cx - r, py, z0, 0, 16], [cx - r, py, z1, 16, 16], [cx - r, py + 1, z1, 16, 0]]),
      q([[cx + r, py + 1, z1, 0, 0], [cx + r, py, z1, 0, 16], [cx + r, py, z0, 16, 16], [cx + r, py + 1, z0, 16, 0]]),
      q([[x0, py + 1, cz + r, 0, 0], [x0, py, cz + r, 0, 16], [x1, py, cz + r, 16, 16], [x1, py + 1, cz + r, 16, 0]]),
      q([[x1, py + 1, cz - r, 0, 0], [x1, py, cz - r, 0, 16], [x0, py, cz - r, 16, 16], [x0, py + 1, cz - r, 16, 0]]),
    ];
  }
  return [];
}

// The geometry of a flat shape for the port's cell `{ id, meta }`, its texture the cell's side tile.
export function displayGeometry(shape, cell) {
  const sideTile = blockTile(cell.id, 0, false, cell.meta), quads = displayQuads(shape), positions = [], indices = [];
  const uvsOf = () => { // re-run on a terrain relayout (uv-rebake.js)
    const uvs = [], side = tileRect(sideTile);
    for (const q of quads) { const r = q.tile ? tileRect(TILES.indexOf(q.tile)) : side; q.verts.forEach((v, i) => uvs.push(r.u0 + (r.u1 - r.u0) * q.uv[i][0], r.v1 - (r.v1 - r.v0) * q.uv[i][1])); }
    return uvs;
  };
  for (const q of quads) {
    const base = positions.length / 3;
    q.verts.forEach((v) => positions.push(v[0], v[1], v[2]));
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  if (shape === "hopper") g.computeVertexNormals(); // the hopper's quads carry their face normals (executed, equal to the winding normals)
  else g.setAttribute("normal", new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? -1 : 0)), 3)); // every flat vertex carries the item normal (0, -1, 0) (executed, b53dq); with the standard item lighting (bytecode-read: blt.a enables RenderHelper bam.b around renderEntities) that is a constant 0.4 diffuse, not the face-normal shading the port computed before
  return trackUvArray(g, uvsOf);
}

// Batch 51/52: renderBlockAsItem (blm.a(aji, meta, brightness), useInventoryTint on) multiplies the colour by Block.getRenderColor(meta) (aji.i(int)) before drawing; for the grass block
// (ajn.c) that first colour is white, and only its top face takes i(meta) (displayTopTint). Executed (b52dx, public/research/displayfx-reference.json, every id 1..255 x meta 0..15 on the real Block.getRenderColor): grass block 7cbd6b (on its top face only,
// see displayTopTint), leaves 18 by meta & 3 basic 0x48B518 / pine 0x619961 / birch 0x80A755 / basic, leaves2 161 basic, tall grass 31 white for meta 0 else ColorizerGrass(0.5, 1.0),
// stems 104 / 105 (meta * 32, 255 - meta * 8, meta * 4); the vine 106 and lily pad 111 are tinted too but draw nothing here; everything else is white.
// The port's item atlas (`textures.texture`) already bakes the item colours into the grass, tall grass, fern, vine, lily and leaf tiles (not the reed tile since b54: BlockReed has no render colour) (D(), 0x5BAB46 for the oak foliage, not
// i(meta)), so a tinted display block is drawn from the grey `terrain` atlas instead (displayTerrain) with the native colour as the material colour. Returns [r, g, b] floats or null (white).
// The grass block's own branch (bytecode-read, blm.a offsets 237-364): with useInventoryTint on it sets glColor to i(meta) * brightness just before renderFaceYPos and back to white
// after it, so the top face alone is tinted (7cbd6b, the executed i(meta) above). Returns [r, g, b] floats for the +y face, or null.
export const displayTopTint = (id) => (id === 2 && hasColormaps() ? rgbFloats(itemGrassColor()) : null);
export const STEM_TINT = (meta) => (((meta * 32) & 255) << 16) | ((255 - meta * 8) & 255) << 8 | ((meta * 4) & 255);
export function displayTint(id, meta) {
  const m = meta & 15;
  if (id === 18) return rgbFloats((m & 3) === 1 ? PINE : (m & 3) === 2 ? BIRCH : FOLIAGE_BASIC);
  if (id === 161) return rgbFloats(FOLIAGE_BASIC);
  if (id === 31 && m !== 0 && hasColormaps()) return rgbFloats(itemGrassColor());
  if (id === 104 || id === 105) return rgbFloats(STEM_TINT(m));
  return null;
}
// Blocks whose tile is baked with an item colour in the item atlas: the display block takes the grey terrain atlas (tinted or white as the native draw is).
const TERRAIN_ATLAS = new Set([2, 18, 31, 83, 161]);
export const displayTerrain = (id) => TERRAIN_ATLAS.has(id);
