// Batch 50: what RenderBlocks.renderBlockAsItem (blm.a(aji, meta, brightness)) draws for a minecart's custom display block, by the block's render type
// (bytecode-read, `javap -c -p` on blm and boi). RenderMinecart.func_147910_a only calls it (no render-type test besides -1 in doRender), so a block whose render
// type renderBlockAsItem has no branch for draws NOTHING: fluids 4, fire 3, doors 7, rails 9, ladders 8, vines 20, redstone wire 5, levers 12, repeaters 15, signs, beds 14,
// panes and bars 18, the lily pad 23 (its branch only begins and draws an empty tessellator), cauldrons 24, brewing stands 25, cocoa 28, tripwire 29/30, pots 33, double
// plants 40, comparators 36, pistons' arms 17. Branches: 0, 31, 39, 16, 26 turned boxes (blockItemGeometry / blockCubeGeometry), 13 cactus, 10 stairs, 11 fences, 21 gates,
// 27 dragon egg, 32 walls, 34 beacon, 35 anvil, 22 chests, 38 hopper, plus the flat plant shapes built here: 1 crossed squares (scale 1 at -0.5), 6 crops (two pairs of
// planes, 1/16 low), 19 stems (renderBlockStemSmall, height 0.25 from BlockStem.setBlockBoundsForItemRender) and 2 torches (upright).
import * as THREE from "three";
import { blockTile, tileRect } from "./block-textures.js";
import { crossedSquares, stemSmall } from "./render-vessels.js";

const CROSS = new Set([6, 30, 31, 32, 37, 38, 39, 40, 83]), CROPS = new Set([59, 115, 141, 142]), STEMS = new Set([104, 105]), TORCHES = new Set([50, 75, 76]);
const NOTHING = new Set([8, 9, 10, 11, 26, 27, 28, 34, 36, 51, 55, 63, 64, 65, 66, 68, 69, 71, 90, 93, 94, 101, 102, 106, 111, 117, 118, 119, 127, 131, 132, 140, 144, 149, 150, 157, 160, 175]);
// "none" | "cross" | "crops" | "stem" | "torch" | "item" (the existing box / cube / chest / hopper paths) by ORIGINAL block id.
export function displayShape(id) {
  if (!id) return "none";
  if (NOTHING.has(id)) return "none";
  if (CROSS.has(id)) return "cross";
  if (CROPS.has(id)) return "crops";
  if (STEMS.has(id)) return "stem";
  if (TORCHES.has(id)) return "torch";
  return "item";
}

// Quads { verts: [[x, y, z] x4], uv: [[fu, fv] x4] } (fu, fv in icon fractions, v from the top) of the flat shapes, centred on the origin as renderBlockAsItem does.
export function displayQuads(shape) {
  const origin = -0.5;
  if (shape === "cross") return crossedSquares(origin, origin, origin, 1, null, 0);
  if (shape === "stem") return stemSmall(origin, origin, origin, 0.25, null);
  if (shape === "crops") { // renderBlockCropsImpl at -0.5: the planes at 0.25 and 0.75, one block tall from 1/16 below the origin, each drawn from both sides
    const out = [], y0 = origin - 1 / 16, y1 = y0 + 1, q = (l) => ({ verts: l.map((v) => [v[0], v[1], v[2]]), uv: l.map((v) => [v[3], v[4]]) });
    for (const o of [0.25, 0.75]) {
      const x = origin + o, z = origin + o, xa = origin, xb = origin + 1;
      out.push(q([[x, y1, xa, 0, 0], [x, y0, xa, 0, 1], [x, y0, xb, 1, 1], [x, y1, xb, 1, 0]]), q([[x, y1, xb, 0, 0], [x, y0, xb, 0, 1], [x, y0, xa, 1, 1], [x, y1, xa, 1, 0]]));
      out.push(q([[xa, y1, z, 0, 0], [xa, y0, z, 0, 1], [xb, y0, z, 1, 1], [xb, y1, z, 1, 0]]), q([[xb, y1, z, 0, 0], [xb, y0, z, 0, 1], [xa, y0, z, 1, 1], [xa, y1, z, 1, 0]]));
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
  const r = tileRect(blockTile(cell.id, 0, false, cell.meta)), positions = [], uvs = [], indices = [];
  for (const q of displayQuads(shape)) {
    const base = positions.length / 3;
    q.verts.forEach((v, i) => { positions.push(v[0], v[1], v[2]); uvs.push(r.u0 + (r.u1 - r.u0) * q.uv[i][0], r.v1 - (r.v1 - r.v0) * q.uv[i][1]); });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
