// Column mesh building (RenderBlocks): the geometry arrays of one 16 x 16 chunk column, with no renderer state. The page thread
// (VoxelScene, scene.js) and the mesh worker (mesh-worker.js) run this same code: VoxelScene takes the MeshMethods as its own, and a
// ChunkMesher reads the world, light volume and biome colours of whatever it was created over (a region snapshot in the worker).
import { BEACON } from "./pyramid.js";
import { END_PORTAL } from "./eye-of-ender.js";
import { DRAGON_EGG, eggBoxes } from "./dragon-egg.js";
import { isChestShaped } from "./chest-blocks.js";
import { PUMPKIN_STEM, MELON_STEM, CAKE, cakeBounds, stemDirection, stemTint, stemQuads } from './stems-cake.js';
import { PORTAL, portalSideRendered } from "./nether-portal.js";
import { NETHER_WART } from "./nether-wart.js";
import * as THREE from "three";
import { WOOD_SLAB, woodSlabBounds, gateRenderBoxes, trapBounds, wallMask, wallRenderBoxes } from './shaped-blocks.js';
import { LILY_PAD, FERN, DEAD_SHRUB, HEIGHT, FIRE, SNOW_LAYER, ICE, WEB, LADDER, CACTUS, REEDS, FENCE, RAIL, VINE, COCOA, DOUBLE_PLANT, SANDSTONE_SLAB, ANVIL, BED, PISTON_MOVING, wallSolid, blockBounds, blockHeight, snowSelectionHeight, isPlant, isCrop, isFlower, opaqueCube, normalCube, STAINED_GLASS, CARPET, HAY_BALE, IRON_BARS } from "./world.js";
import { STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, endFrameBoxes, cauldronBoxes, cauldronWaterHeight, CAULDRON_FLOOR, CAULDRON_WALL, potContents, POT_BOUNDS, potPlantOf } from './stone-utility.js';
import { REDSTONE_WIRE, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, LEVER, REPEATER, TRIPWIRE_HOOK, TRIPWIRE, isRedstoneBlock, redstoneBounds, wireArms, wireClimbs, wireTint } from './redstone-blocks.js';
import { REDSTONE_TORCH, REDSTONE_TORCH_OFF, COMPARATOR, COMPARATOR_POWERED, DAYLIGHT_SENSOR, isRedstone2Block, isCube2, redstoneBounds2 } from './redstone-blocks-2.js';
import { tileByName } from './block-textures.js';
import { lilyPadRotation } from "./lily-pad.js";
import { PINE, BIRCH, LILY_PAD_COLOR } from "./biome-colors.js";
import { blockTile, tileRect, ATLAS_ROWS, ATLAS_COLUMNS, namedTile } from "./block-textures.js";
import { pistonQuads, isPistonBase, PISTON_HEAD } from "./dispenser-piston.js";
import { mhSin, mhCos, smoothFace, flatFace, lightEmission } from "./lighting.js";
import { anaglyphFog } from "./post-shaders.js";
import { meshAnaglyph, anaglyphMultiplier } from "./anaglyph.js";
import { render, usePartialAo, leavesOpaque } from "./render-settings.js";
import { liquidHeight, flowAngle } from "./fluids.js";
import { fireVertices } from "./fire.js";
import { fenceMask, fenceRenderBoxes } from "./fences.js";
import { NETHER_FENCE, QUARTZ_BLOCK } from "./nether-blocks.js";
import { anvilModelBoxes } from './anvil-block.js';
import { isStair, stairBoxes } from './stairs.js';
import { BED_DIR, bedTexture } from './bed.js';
import { isDoor, isPane, doorFlags, doorBoundsFor, doorFaceFlip, paneMask, paneArms, paneSideRendered } from './doors-panes.js';

// Face order +x, -x, +y, -y, +z, -z with RenderBlocks' AO-path shades:
// 0.6 east/west, 0.8 north/south, 0.5 bottom, 1.0 top.
export const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];
// Fancy graphics: leaves are not opaque at render time, so faces next to them draw; Fast makes both leaf
// blocks opaque (BlockLeaves.setGraphicsLevel), so faces between and against leaves are culled.
// BlockSlab.shouldSideBeRendered (single slab; bytecode-read and replayed in render-types.test.js): the side faces follow aji.a (hidden by an
// opaque cube) and are also dropped against a single slab of the same half; the top and bottom faces are never dropped.
const slabCulled = (w, b, meta, x, y, z, fi, f, boundary) => {
  const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2], nb = w.get(nx, ny, nz), single = nb === STONE_SLAB || nb === WOOD_SLAB, nbTop = single && (w.getMeta(nx, ny, nz) & 8) !== 0, top = (meta & 8) !== 0;
  if (fi === 2 || fi === 3) return false; // the top and bottom: a single slab is not an opaque cube, so either the aji.a test or the same-half test passes
  return (boundary && hides(nb)) || (single && nbTop === top);
};
// RenderBlocks' uvRotate* quarter turn of a face's texture, per face in the face's own (s, t) texture space (t grows downward). Read off the
// native vertices of logs and quartz pillars (render-types.test.js): the faces are mirrored differently, so the turn is a plain rotation
// on the top, bottom, west and south faces and a reflection across the anti-diagonal on the east and north faces.
const TURN = [(u, v) => [1 - v, 1 - u], (u, v) => [v, 1 - u], (u, v) => [v, 1 - u], (u, v) => [1 - v, u], (u, v) => [v, 1 - u], (u, v) => [1 - v, 1 - u]];
const turnUvs = (uvs, fi, r) => uvs.forEach((uv, i) => {
  const [s, t] = TURN[fi]((uv[0] - r.u0) / (r.u1 - r.u0), (r.v1 - uv[1]) / (r.v1 - r.v0));
  uvs[i] = [r.u0 + (r.u1 - r.u0) * s, r.v1 - (r.v1 - r.v0) * t];
});
export const hides = (b) => opaqueCube(b) && ((b !== 5 && b !== 71) || leavesOpaque());
// Smooth Lighting: Off lights each face flat from one cell (renderStandardBlockWithColorMultiplier), Minimum
// uses the full-cube ambient occlusion path for every block, Maximum switches to the interpolating partial
// path for blocks whose bounds are not the whole cell.
export function shadeFace(L, x, y, z, fi, corners, boundary, partial = false) {
  if (render.ao === 0) return flatFace(L, x, y, z, fi, corners, boundary);
  return smoothFace(L, x, y, z, fi, corners, boundary, usePartialAo(render.ao, !partial));
}
export const partialBox = (lo, hi) => lo.some((v) => v > 0) || hi.some((v) => v < 1);
export class Mesher {
  constructor() {
    this.p = [];
    this.uv = [];
    this.shade = [];
    this.light = [];
    this.idx = [];
  }
  // Four vertices with per-vertex (or shared) shade and packed brightness. twoSided true draws the same vertices from behind (reversed
  // triangles); "mirror" adds a second quad of its own vertices for the back with the u of every vertex mirrored across the quad's u span, as
  // RenderBlocks.renderCrossedSquares and renderBlockCropsImpl draw their back faces (the picture is not flipped when seen from behind).
  quad(verts, uvs, shade, packed, twoSided = false) {
    const v = this.p.length / 3, mirror = twoSided === "mirror";
    for (let pass = 0; pass < (mirror ? 2 : 1); pass++) {
      const lo = Math.min(...uvs.map((t) => t[0])), hi = Math.max(...uvs.map((t) => t[0]));
      for (let i = 0; i < 4; i++) {
        this.p.push(...verts[i]);
        this.uv.push(pass ? lo + hi - uvs[i][0] : uvs[i][0], uvs[i][1]);
        const s = Array.isArray(shade) ? shade[i] : shade, l = Array.isArray(packed) ? packed[i] : packed;
        const sf = Math.fround(s); this.shade.push(sf, sf, sf); // RenderBlocks colours are Java floats
        this.light.push(l & 0xffff, (l >> 16) & 0xffff);
      }
    }
    this.last = mirror ? 8 : 4;
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    if (mirror) this.idx.push(v + 4, v + 6, v + 5, v + 4, v + 7, v + 6);
    else if (twoSided) this.idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
  }
  // Block.colorMultiplier: multiplies the last quad's four (eight for a mirrored back face) vertex colours by 0xRRGGBB (the shade attribute is an rgb triple).
  // `native` false marks the paths that never read EntityRenderer.anaglyphEnable (vine, water, redstone wire): their tint stays raw.
  tint(color, native = true) {
    const [r, g, b] = anaglyphMultiplier(color, native && meshAnaglyph.on), n = this.last ?? 4, k = this.shade.length - 3 * n;
    const f = Math.fround;
    for (let i = 0; i < n; i++) { this.shade[k + i * 3] = f(this.shade[k + i * 3] * r); this.shade[k + i * 3 + 1] = f(this.shade[k + i * 3 + 1] * g); this.shade[k + i * 3 + 2] = f(this.shade[k + i * 3 + 2] * b); }
  }
  // Tessellator.setColorOpaque_F (bmh.b(float,float,float), bytecode-read): each float channel becomes (int) (c * 255.0f) (clamped to a byte by
  // setColorOpaque) in the vertex colour int, and GL reads it back as byte / 255. The vertex colours that reach the GPU are these bytes.
  colors() {
    const f = Math.fround, out = new Float32Array(this.shade.length);
    for (let i = 0; i < out.length; i++) out[i] = f(Math.min(255, Math.max(0, Math.trunc(f(f(this.shade[i]) * 255)))) / 255);
    return out;
  }
  geometry() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("shade", new THREE.Float32BufferAttribute(this.colors(), 3));
    g.setAttribute("lightCoord", new THREE.Float32BufferAttribute(this.light, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
export const rectUvs = (r) => [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
// renderFaceYNeg gives the corner at the cell's low z the icon's minV (its top row), the opposite of the FACES order's plain rectUvs.
export const bottomUvs = (r) => [[r.u0, r.v1], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0]];
// BlockLiquid.getMixedBrightnessForBlock: the brighter of the cell and the one above.
export const maxPacked = (a, b) => Math.max(a & 0xffff, b & 0xffff) | (Math.max(a >>> 16, b >>> 16) << 16);

export class MeshMethods {
  grassTint(x, y, z) { return this.biomeColors.grass(x + this.colorX, y, z + this.colorZ); }
  foliageTint(x, y, z) { return this.biomeColors.foliage(x + this.colorX, y, z + this.colorZ); }
  // The block's colour multiplier for a face, or null for white (BlockGrass tints the top only; its sides take the overlay quad).
  cubeTint(b, fi, x, y, z, meta) {
    if (b === 1) return fi === 2 ? this.grassTint(x, y, z) : null;
    if (b === 5) { const m = meta & 3; return m === 1 ? PINE : m === 2 ? BIRCH : this.foliageTint(x, y, z); }
    if (b === 71) return this.foliageTint(x, y, z);
    return null;
  }
  // renderBlockFire (blm.a(alb, ...)): the vertex stream of fire.js, one layer per quad, at
  // the cell's own brightness (block light 15) with no side shading. v is flipped for the
  // bottom-up texture coordinates.
  fireBlock(meshers, x, y, z) {
    const get = (a, b, c) => this.world.get(a, b, c), light = this.light.packed(x, y, z), v = fireVertices(get, x, y, z);
    for (let i = 0; i < v.length; i += 4) {
      const q = v.slice(i, i + 4);
      meshers[q[0][5]].quad(q.map((p) => [p[0], p[1], p[2]]), q.map((p) => [p[3], 1 - p[4]]), 1, light);
    }
  }
  // renderStandardBlockWithAmbientOcclusion; blocks that emit light (a lit
  // furnace) take the flat colour-multiplier path with neighbour brightness.
  cube(m, b, x, y, z) {
    const w = this.world, L = this.light, h = b === SNOW_LAYER ? snowSelectionHeight(w.getMeta(x, y, z)) : blockHeight(b), lit = b === 14 && this.litFurnaces.has(`${x},${y},${z}`),
      // renderStandardBlock: ambient occlusion only for blocks whose light value is 0; emitters (glowstone, a lit furnace, ...) take the colour-multiplier path.
      flat = lit || lightEmission(b) > 0;
    FACES.forEach((f, fi) => {
      const boundary = fi !== 2 || h >= 1, nb = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
      // BlockSnow.shouldSideBeRendered always draws the top.
      // BlockBreakable.shouldSideBeRendered: stained glass beside any block whose metadata differs from its own is always drawn (even beside an
      // opaque cube); beside the same metadata, glass of the same block is dropped.
      const glassDiffers = b === STAINED_GLASS && w.getMeta(x + f.n[0], y + f.n[1], z + f.n[2]) !== w.getMeta(x, y, z);
      if (glassDiffers) { /* drawn */ } else {
        if (boundary && hides(nb) && !(b === SNOW_LAYER && fi === 2)) return;
        if ((b === 9 || b === ICE) && nb === b) return;
        if (b === STAINED_GLASS && nb === b) return;
      }
      const snowed = b === 1 && (w.get(x, y + 1, z) === SNOW_LAYER || w.get(x, y + 1, z) === 23);
      const corners = f.v.map((v) => [v[0], v[1] * h, v[2]]), r = tileRect(blockTile(b, fi, lit, w.getMeta(x, y, z), snowed)), uvs = fi === 3 ? bottomUvs(r) : rectUvs(r);
      // RenderBlocks.renderBlockQuartz: a pillar lying on x (meta 3) turns the top, bottom and z faces a quarter, one on z (meta 4) the x faces.
      if (b === QUARTZ_BLOCK) { const qm = w.getMeta(x, y, z); if ((qm === 3 && fi >= 2) || (qm === 4 && fi < 2)) turnUvs(uvs, fi, r); }
      // RenderBlocks.renderBlockLog (render type 31): a log lying on x (meta 4) turns the top, bottom, east and west faces a quarter, one lying on z (meta 8) the north and south faces.
      if (b === 4 || b === 70 || b === HAY_BALE) { const axis = w.getMeta(x, y, z) & 12; if ((axis === 4 && fi >= 2) || (axis === 8 && fi < 2)) turnUvs(uvs, fi, r); }
      // Side faces of short blocks crop the texture from the top, as renderMaxY does.
      if (fi !== 2 && fi !== 3 && h < 1) uvs[2][1] = uvs[3][1] = r.v0 + (r.v1 - r.v0) * h;
      const verts = corners.map((v) => [x + v[0], y + v[1], z + v[2]]);
      const s = flat ? null : shadeFace(L, x, y, z, fi, corners, boundary, h < 1),
        put = (uv) => (flat ? m.quad(verts, uv, f.shade, L.packed(x + f.n[0], y + f.n[1], z + f.n[2])) : m.quad(verts, uv, s.ao.map((a) => a * f.shade), s.packed)),
        tint = this.cubeTint(b, fi, x, y, z, w.getMeta(x, y, z));
      put(uvs);
      if (tint !== null) m.tint(tint);
      // RenderBlocks.renderStandardBlockWithAmbientOcclusion: with Fancy graphics a grass side also draws grass_side_overlay tinted by the biome.
      if (b === 1 && fi !== 2 && fi !== 3 && !snowed && render.fancy) { put(rectUvs(tileRect(tileByName("grass_side_overlay")))); m.tint(this.grassTint(x, y, z)); }
    });
  }
  // RenderBlocks.renderBlockTorch (blm.c(aji, III)) and renderTorchAtAngle: wall torches
  // (metadata 1-4) move 0.1 towards their wall, rise 0.2 and lean 0.4 over their 1-block height;
  // metadata 5 (the port's 0) stands upright. A 2x2-pixel top at 10/16 above the base, a 2x2
  // bottom from pixels 7-9 / 13-15, and four sides 1/16 from the centre, all in the cell's own
  // brightness with no face shading. Vertices follow the original order.
  torch(m, x, y, z, tileId = 20) {
    const meta = this.world.getMeta(x, y, z), light = this.light.packed(x, y, z), t = blockTile(tileId, 0),
      tx = (t % ATLAS_COLUMNS) * 16, ty = Math.floor(t / ATLAS_COLUMNS) * 16, W = ATLAS_COLUMNS * 16, H = ATLAS_ROWS * 16,
      uv = (u, v) => [(tx + u) / W, 1 - (ty + v) / H];
    const lean = Math.fround(0.4), wall = 0.5 - lean, rise = Math.fround(0.2);
    let px = x, py = y, pz = z, dx = 0, dz = 0;
    if (meta === 1) [px, py, dx] = [x - wall, y + rise, -lean];
    else if (meta === 2) [px, py, dx] = [x + wall, y + rise, lean];
    else if (meta === 3) [pz, py, dz] = [z - wall, y + rise, -lean];
    else if (meta === 4) [pz, py, dz] = [z + wall, y + rise, lean];
    const r = 0.0625, h = 0.625, cx = px + 0.5, cz = pz + 0.5, x0 = cx - 0.5, x1 = cx + 0.5, z0 = cz - 0.5, z1 = cz + 0.5,
      tx0 = cx + dx * (1 - h), tz0 = cz + dz * (1 - h);
    const quads = [
      [[tx0 - r, py + h, tz0 - r, 7, 6], [tx0 - r, py + h, tz0 + r, 7, 8], [tx0 + r, py + h, tz0 + r, 9, 8], [tx0 + r, py + h, tz0 - r, 9, 6]],
      [[cx + r + dx, py, cz - r + dz, 9, 13], [cx + r + dx, py, cz + r + dz, 9, 15], [cx - r + dx, py, cz + r + dz, 7, 15], [cx - r + dx, py, cz - r + dz, 7, 13]],
      [[cx - r, py + 1, z0, 0, 0], [cx - r + dx, py, z0 + dz, 0, 16], [cx - r + dx, py, z1 + dz, 16, 16], [cx - r, py + 1, z1, 16, 0]],
      [[cx + r, py + 1, z1, 0, 0], [cx + dx + r, py, z1 + dz, 0, 16], [cx + dx + r, py, z0 + dz, 16, 16], [cx + r, py + 1, z0, 16, 0]],
      [[x0, py + 1, cz + r, 0, 0], [x0 + dx, py, cz + r + dz, 0, 16], [x1 + dx, py, cz + r + dz, 16, 16], [x1, py + 1, cz + r, 16, 0]],
      [[x1, py + 1, cz - r, 0, 0], [x1 + dx, py, cz - r + dz, 0, 16], [x0 + dx, py, cz - r + dz, 16, 16], [x0, py + 1, cz - r, 16, 0]],
    ];
    for (const q of quads) m.quad(q.map((p) => [p[0], p[1], p[2]]), q.map((p) => uv(p[3], p[4])), 1, light);
  }
  // Wood slab, fence gate, trapdoor and cobblestone wall models (shaped-blocks.js).
  shaped(m, b, x, y, z, all = false) {
    const w = this.world, meta = w.getMeta(x, y, z);
    if (b === 165) this.box(m, b, x, y, z, woodSlabBounds(b, meta), meta, all);
    else if (b === 167) for (const box of gateRenderBoxes(meta)) this.box(m, b, x, y, z, box, meta, true);
    else if (b === 168) this.box(m, b, x, y, z, trapBounds(meta), meta, true);
    else if (b === 169) for (const box of wallRenderBoxes(wallMask(w, x, y, z, wallSolid), w.get(x, y + 1, z) === 0)) this.box(m, b, x, y, z, box, meta, true);
  }
  // RenderBlocks.renderStandardBlock over setRenderBounds (used by renderBlockFence): each face of
  // the box with the ambient-occlusion path. Texture coordinates follow renderFace*: u = x on the
  // top, bottom and south faces, z on the west face, 1 - x north and 1 - z east (the mirrored
  // field_152631_f mapping, which for the centred fence post equals the plain one); v = z on the
  // top and bottom, 1 - y on the sides. A face on the cell boundary is skipped next to an opaque cube.
  box(m, b, x, y, z, [x0, y0, z0, x1, y1, z1], meta = 0, renderAllFaces = false) {
    const w = this.world, L = this.light, lo = [x0, y0, z0], hi = [x1, y1, z1];
    FACES.forEach((f, fi) => {
      const axis = fi >> 1, positive = (fi & 1) === 0, boundary = positive ? hi[axis] >= 1 : lo[axis] <= 0;
      if (!renderAllFaces && (b === STONE_SLAB ? slabCulled(w, b, meta, x, y, z, fi, f, boundary) : boundary && hides(w.get(x + f.n[0], y + f.n[1], z + f.n[2])))) return;
      const r = tileRect(blockTile(b, fi, false, meta)),
        corners = f.v.map((v) => [v[0] ? x1 : x0, v[1] ? y1 : y0, v[2] ? z1 : z0]),
        st = (p) => [[1 - p[2], 1 - p[1]], [p[2], 1 - p[1]], [p[0], p[2]], [p[0], p[2]], [p[0], 1 - p[1]], [1 - p[0], 1 - p[1]]][fi],
        uvs = corners.map((p) => {
          const [s, t] = st(p);
          return [r.u0 + (r.u1 - r.u0) * s, r.v1 - (r.v1 - r.v0) * t];
        }),
        s = shadeFace(L, x, y, z, fi, corners, boundary, partialBox(lo, hi));
      m.quad(corners.map((p) => [x + p[0], y + p[1], z + p[2]]), uvs, s.ao.map((a) => a * f.shade), s.packed);
    });
  }
  // RenderBlocks.renderBlockStairs (render type 10): the half block (renderAllFaces false), then
  // the second box and the optional inner-corner box with the same culling (native bounds-based; renderAllFaces stays off, verified in render-types.test.js) (stairBoxes).
  stairs(m,b,x,y,z) {
    stairBoxes(this.world,x,y,z).forEach((box,i)=>this.box(m,b,x,y,z,box,0,false));
  }
  // RenderBlocks.renderBlockDoor (render type 7): the half's bounds as a box with every face always drawn (flat light), each side
  // face using BlockDoor.getIcon's flipped or plain texture (doorFaceFlip); the top and bottom use the lower texture.
  door(m,b,x,y,z) {
    const w=this.world,L=this.light,flags=doorFlags(w,x,y,z),[x0,y0,z0,x1,y1,z1]=doorBoundsFor(flags),lo=[x0,y0,z0],hi=[x1,y1,z1],
      SIDE=[5,4,1,0,3,2],half=(flags&8)?8:0;
    FACES.forEach((f,fi)=>{
      const axis=fi>>1,positive=(fi&1)===0,boundary=positive?hi[axis]>=1:lo[axis]<=0;
      const flip=fi<2||fi>3?doorFaceFlip(flags,SIDE[fi]):false,
        r=tileRect(blockTile(b,fi,false,fi===2||fi===3?0:half)),
        corners=f.v.map(v=>[v[0]?x1:x0,v[1]?y1:y0,v[2]?z1:z0]),
        // renderFaceXPos/ZNeg crop the icon to the face's extent: the mirrored axes run (min + max) - p, so a thin end cap shows a strip of the door
        // (the native end caps differ from a full-width face here; render-types.test.js).
        st=(p)=>[[z0+z1-p[2],1-p[1]],[p[2],1-p[1]],[p[0],p[2]],[p[0],p[2]],[p[0],1-p[1]],[x0+x1-p[0],1-p[1]]][fi],
        uvs=corners.map(p=>{const [s0,t]=st(p),s=flip?1-s0:s0;return[r.u0+(r.u1-r.u0)*s,r.v1-(r.v1-r.v0)*t];}),
        sm=flatFace(L,x,y,z,fi,corners,boundary); // renderBlockDoor never takes the ambient occlusion path (native, all three settings)
      m.quad(corners.map(p=>[x+p[0],y+p[1],z+p[2]]),uvs,sm.ao.map(a=>a*f.shade),sm.packed);
    });
  }
  // RenderBlocks.renderBlockBed (blm.v(aji, x, y, z), render type 14; executed in the render-types probe): bounds 0, 0, 0, 1, 9/16, 1. The bottom (planks, colour 0.5, the
  // cell's brightness) sits 3/16 up; the top (colour 1.0) takes the brightness of the cell ABOVE and turns its texture by the bed's direction;
  // then the four sides in the order z-, z+, x-, x+ (colours 0.8, 0.8, 0.6, 0.6), each skipped on the side the other half lies (Direction.d, the
  // head looks back at the foot) and against an opaque neighbour, with the neighbour's brightness, the texture cropped to its lower 9 rows
  // (renderFaceZNeg/ZPos/XNeg/XPos with flipTexture set on the long side the direction table names; XNeg/XPos use the bytecode's own minZ/maxZ test for light).
  // RenderBlocks.renderBlockLilyPad (blm.o, executed in the render-types probe): two flat-light quads 1/64 above the floor, the top in the
  // block colour and the underside (same corners, reversed) in half of it ((c & 0xFEFEFE) >> 1); hashed rotation from lily-pad.js. Float maths as the bytecode.
  lilyPad(m,x,y,z) {
    const r=tileRect(blockTile(LILY_PAD,1)),light=this.light.packed(x,y,z),f=Math.fround(0.015625),i1=lilyPadRotation(x,y,z),F=Math.fround,
      f19=F(x+0.5),f20=F(z+0.5),f21=F(F(F(i1&1)*0.5)*F(1-(Math.trunc(i1/2)%2)*2)),f22=F(F(F((i1+1)&1)*0.5)*F(1-(Math.trunc((i1+1)/2)%2)*2)),
      A=F(F(f19+f21)-f22),B=F(F(f20+f21)+f22),C=F(F(f19+f21)+f22),D=F(F(f20-f21)+f22),E=F(F(f19-f21)+f22),G=F(F(f20-f21)-f22),H=F(F(f19-f21)-f22),I=F(F(f20+f21)-f22),
      top=[[A,B,r.u0,r.v1],[C,D,r.u1,r.v1],[E,G,r.u1,r.v0],[H,I,r.u0,r.v0]],
      put=(list,color)=>{m.quad(list.map((p)=>[p[0],y+f,p[1]]),list.map((p)=>[p[2],p[3]]),1,light);m.tint(color);};
    put(top,LILY_PAD_COLOR);
    put(top.slice().reverse(),(LILY_PAD_COLOR&0xFEFEFE)>>1);
  }
  bed(m,b,x,y,z) {
    const w=this.world,L=this.light,meta=w.getMeta(x,y,z),dir=meta&3,head=(meta&8)!==0,top=.5625,
      DIRECTION_FACE=[3,4,2,5],OPPOSITE=[2,3,0,1],
      skip=DIRECTION_FACE[head?OPPOSITE[dir]:dir],flipSide=[5,3,4,2][dir],
      FI=[3,2,5,4,1,0], // native side (0 bottom, 1 top, 2 z-, 3 z+, 4 x-, 5 x+) -> this mesher's face index for the texture
      rect=(side)=>tileRect(blockTile(b,FI[side],false,meta)),
      put=(r,pts,shade,packed)=>m.quad(pts.map((p)=>[p[0],p[1],p[2]]),pts.map((p)=>[r.u0+(r.u1-r.u0)*p[3],r.v1-(r.v1-r.v0)*p[4]]),shade,packed),
      own=L.packed(x,y,z);
    // Bottom.
    put(rect(0),[[x,y+.1875,z+1,0,1],[x,y+.1875,z,0,0],[x+1,y+.1875,z,1,0],[x+1,y+.1875,z+1,1,1]],.5,own);
    // Top: u and v per vertex start as the corners of the icon and are swapped by the direction.
    let u35=0,u37=1,v39=0,v41=0,u43=0,u45=1,v47=1,v49=1;
    if(dir===0){u37=0;v39=1;u43=1;v49=0;}
    else if(dir===2){u35=1;v41=1;u45=0;v47=0;}
    else if(dir===3){u35=1;v41=1;u45=0;v47=0;u37=0;v39=1;u43=1;v49=0;}
    put(rect(1),[[x+1,y+top,z+1,u43,v47],[x+1,y+top,z,u35,v39],[x,y+top,z,u37,v41],[x,y+top,z+1,u45,v49]],1,L.packed(x,y+1,z));
    const side=(face,nx,nz,shade,pts)=>{
      if(skip===face||hides(w.get(x+nx,y,z+nz)))return;
      put(rect(face),pts(face===flipSide),shade,L.packed(x+nx,y,z+nz));
    };
    const yb=y,yt=y+top,tt=7/16;
    // renderFaceZNeg / ZPos / XNeg / XPos with the icon's lower 9 rows (v 7/16 .. 1); a flipped face swaps its two u values.
    side(2,0,-1,.8,(f)=>{const a=f?0:1,c=f?1:0;return[[x,yt,z,a,tt],[x+1,yt,z,c,tt],[x+1,yb,z,c,1],[x,yb,z,a,1]];});
    side(3,0,1,.8,(f)=>{const a=f?1:0,c=f?0:1;return[[x,yt,z+1,a,tt],[x,yb,z+1,a,1],[x+1,yb,z+1,c,1],[x+1,yt,z+1,c,tt]];});
    side(4,-1,0,.6,(f)=>{const a=f?1:0,c=f?0:1;return[[x,yt,z+1,c,tt],[x,yt,z,a,tt],[x,yb,z,a,1],[x,yb,z+1,c,1]];});
    side(5,1,0,.6,(f)=>{const a=f?1:0,c=f?0:1;return[[x+1,yb,z+1,a,1],[x+1,yb,z,c,1],[x+1,yt,z,c,tt],[x+1,yt,z+1,a,tt]];});
  }
  // RenderBlocks.renderBlockPane (blm.a(aoa, x, y, z), render types 18 and 41), segment by segment as the bytecode does (bytecode-read, and the
  // native render-types probe agrees): one flat brightness and colour; an x section (a full plane through z + 0.5 with both x neighbours or with
  // no neighbour at all, else a half plane towards the one x neighbour), then the same along z. Every plane is two quads (the back quad has the
  // two end coordinates swapped and the same uvs). A lone half plane gets a 2-pixel end cap (top texture u 7..9) when the other axis has no
  // neighbour. The top and bottom 2-pixel strips (top texture) are drawn when the pane has no pane or opaque cube above (below), or, for the half
  // strip beside a connected arm, when the cell diagonally above (below) on that side is air. The x strips sit 0.01 off the cell face, the z strips 0.005.
  pane(m,b,x,y,z) {
    const w=this.world,meta=w.getMeta(x,y,z),mask=paneMask(w,x,y,z),side=tileRect(blockTile(b,0,false,meta)),top=tileRect(blockTile(b,2,false,meta)),light=this.light.packed(x,y,z),
      lerp=(p,q,t)=>p+(q-p)*t,minU=side.u0,midU=lerp(side.u0,side.u1,.5),maxU=side.u1,minV=side.v1,maxV=side.v0,
      tu7=lerp(top.u0,top.u1,7/16),tu9=lerp(top.u0,top.u1,9/16),tminV=top.v1,tmidV=lerp(top.v1,top.v0,.5),tmaxV=top.v0,
      N=(mask&1)!==0,S=(mask&2)!==0,W=(mask&4)!==0,E=(mask&8)!==0,
      xL=x,xM=x+.5,xH=x+1,zL=z,zM=z+.5,zH=z+1,xm=x+.5-.0625,xp=x+.5+.0625,zm=z+.5-.0625,zp=z+.5+.0625,
      H=w.height||256,air=(a,c,d)=>w.get(a,c,d)===0,
      upOK=paneSideRendered(b,w.get(x,y+1,z)),dnOK=paneSideRendered(b,w.get(x,y-1,z)),
      // Two quads: the listed one and its back (the vertices' coordinate on `axis` swapped between lo and hi), vertices [a, y, o, u, v].
      pair=(axis,lo,hi,pts)=>{
        for(const back of [false,true])
          m.quad(pts.map(([a,yy,o])=>{const c=back?(a===lo?hi:a===hi?lo:a):a;return axis==='x'?[c,yy,o]:[o,yy,c];}),pts.map((q)=>[q[3],q[4]]),1,light);
      },
      up=y+1,
      stripX=(yy,kind)=>kind==='full'?pair('x',xL,xH,[[xL,yy,zp,tu9,tmaxV],[xH,yy,zp,tu9,tminV],[xH,yy,zm,tu7,tminV],[xL,yy,zm,tu7,tmaxV]])
        :kind==='w'?pair('x',xL,xM,[[xL,yy,zp,tu9,tmidV],[xM,yy,zp,tu9,tmaxV],[xM,yy,zm,tu7,tmaxV],[xL,yy,zm,tu7,tmidV]])
        :pair('x',xM,xH,[[xM,yy,zp,tu9,tminV],[xH,yy,zp,tu9,tmidV],[xH,yy,zm,tu7,tmidV],[xM,yy,zm,tu7,tminV]]),
      stripZ=(yy,kind)=>kind==='full'?pair('z',zL,zH,[[xp,yy,zH,tu9,tmaxV],[xp,yy,zL,tu9,tminV],[xm,yy,zL,tu7,tminV],[xm,yy,zH,tu7,tmaxV]])
        :kind==='n'?pair('z',zL,zM,[[xm,yy,zL,tu9,tminV],[xm,yy,zM,tu9,tmidV],[xp,yy,zM,tu7,tmidV],[xp,yy,zL,tu7,tminV]])
        :pair('z',zM,zH,[[xm,yy,zM,tu7,tmidV],[xm,yy,zH,tu7,tmaxV],[xp,yy,zH,tu9,tmaxV],[xp,yy,zM,tu9,tmidV]]),
      // Full strip when the face is open, else the half strip beside each connected arm that has air diagonally beyond it (the full-plane sections test both sides).
      strips=(strip,yy,open,sides)=>{
        if(open)strip(yy,'full');else for(const [kind,ok] of sides)if(ok)strip(yy,kind);
      },
      upAir=(dx,dz)=>y<H-1&&air(x+dx,y+1,z+dz),dnAir=(dx,dz)=>y>1&&air(x+dx,y-1,z+dz),
      e01=.01,e005=.005;
    // The x section.
    if((W&&E)||(!W&&!E&&!N&&!S)){
      pair('x',xL,xH,[[xL,up,zM,minU,minV],[xL,y,zM,minU,maxV],[xH,y,zM,maxU,maxV],[xH,up,zM,maxU,minV]]);
      strips(stripX,up+e01,upOK,[['w',upAir(-1,0)],['e',upAir(1,0)]]);
      strips(stripX,y-e01,dnOK,[['w',dnAir(-1,0)],['e',dnAir(1,0)]]);
    }else if(W&&!E){
      pair('x',xL,xM,[[xL,up,zM,minU,minV],[xL,y,zM,minU,maxV],[xM,y,zM,midU,maxV],[xM,up,zM,midU,minV]]);
      if(!N&&!S)pair('z',zm,zp,[[xM,up,zp,tu7,tminV],[xM,y,zp,tu7,tmaxV],[xM,y,zm,tu9,tmaxV],[xM,up,zm,tu9,tminV]]);
      if(upOK||upAir(-1,0))stripX(up+e01,'w');
      if(dnOK||dnAir(-1,0))stripX(y-e01,'w');
    }else if(!W&&E){
      pair('x',xM,xH,[[xM,up,zM,midU,minV],[xM,y,zM,midU,maxV],[xH,y,zM,maxU,maxV],[xH,up,zM,maxU,minV]]);
      if(!N&&!S)pair('z',zm,zp,[[xM,up,zm,tu7,tminV],[xM,y,zm,tu7,tmaxV],[xM,y,zp,tu9,tmaxV],[xM,up,zp,tu9,tminV]]);
      if(upOK||upAir(1,0))stripX(up+e01,'e');
      if(dnOK||dnAir(1,0))stripX(y-e01,'e');
    }
    // The z section.
    if((N&&S)||(!W&&!E&&!N&&!S)){
      pair('z',zL,zH,[[xM,up,zH,minU,minV],[xM,y,zH,minU,maxV],[xM,y,zL,maxU,maxV],[xM,up,zL,maxU,minV]]);
      strips(stripZ,up+e005,upOK,[['n',upAir(0,-1)],['s',upAir(0,1)]]);
      strips(stripZ,y-e005,dnOK,[['n',dnAir(0,-1)],['s',dnAir(0,1)]]);
    }else if(N&&!S){
      pair('z',zL,zM,[[xM,up,zL,minU,minV],[xM,y,zL,minU,maxV],[xM,y,zM,midU,maxV],[xM,up,zM,midU,minV]]);
      if(!E&&!W)pair('x',xm,xp,[[xm,up,zM,tu7,tminV],[xm,y,zM,tu7,tmaxV],[xp,y,zM,tu9,tmaxV],[xp,up,zM,tu9,tminV]]);
      if(upOK||upAir(0,-1))stripZ(up+e005,'n');
      if(dnOK||dnAir(0,-1))stripZ(y-e005,'n');
    }else if(!N&&S){
      pair('z',zM,zH,[[xM,up,zM,midU,minV],[xM,y,zM,midU,maxV],[xM,y,zH,maxU,maxV],[xM,up,zH,maxU,minV]]);
      if(!E&&!W)pair('x',xm,xp,[[xp,up,zM,tu7,tminV],[xp,y,zM,tu7,tmaxV],[xm,y,zM,tu9,tmaxV],[xm,up,zM,tu9,tminV]]);
      if(upOK||upAir(0,1))stripZ(up+e005,'s');
      if(dnOK||dnAir(0,1))stripZ(y-e005,'s');
    }
  }
  // RenderBlocks.renderBlockPane's render type 41 (blm.k(aji, x, y, z); BlockPane.getRenderType is 41 when the material is glass: glass and stained
  // glass panes, 102 and 160; iron bars keep type 18, pane() above). Executed natively in the render-types probe and replayed segment by segment:
  // the pane is drawn as thin walls on both sides of its arms (z - 1/16 and z + 1/16 for the x arms, x +- 1/16 for the z arms), 0.001 inside the
  // cell top and bottom. Where a crossing arm joins, the wall is cut at the post (x - 1/16 or + 1/16), a lone arm gets an end cap at the post, a
  // pane with no neighbour gets all four caps. Every arm has a top and a bottom strip (top texture) and the post a top and bottom square; there
  // is no test against the blocks above and below. One quad per piece (no back faces); flat brightness and colour.
  glassPane(m,b,x,y,z) {
    const w=this.world,meta=w.getMeta(x,y,z),mask=paneMask(w,x,y,z),side=tileRect(blockTile(b,0,false,meta)),top=tileRect(blockTile(b,2,false,meta)),light=this.light.packed(x,y,z),
      lerp=(p,q,t)=>p+(q-p)*t,minU=side.u0,iu7=lerp(side.u0,side.u1,7/16),iu9=lerp(side.u0,side.u1,9/16),maxU=side.u1,minV=side.v1,maxV=side.v0,
      tu7=lerp(top.u0,top.u1,7/16),tu9=lerp(top.u0,top.u1,9/16),tminV=top.v1,tv7=lerp(top.v1,top.v0,7/16),tv9=lerp(top.v1,top.v0,9/16),tmaxV=top.v0,
      N=(mask&1)!==0,S=(mask&2)!==0,W=(mask&4)!==0,E=(mask&8)!==0,none=!N&&!S&&!W&&!E,
      xL=x,xH=x+1,zL=z,zH=z+1,xm=x+.5-.0625,xp=x+.5+.0625,zm=z+.5-.0625,zp=z+.5+.0625,Yh=y+.999,Yl=y+.001,
      Q=(...v)=>m.quad(v.map((p)=>[p[0],p[1],p[2]]),v.map((p)=>[p[3],p[4]]),1,light),
      // A wall piece: the two ends on the arm's axis (a0 first, uv u0 at a0, u1 at a1), at the fixed other coordinate o.
      wallX=(o,a0,u0,a1,u1)=>Q([a0,Yh,o,u0,minV],[a0,Yl,o,u0,maxV],[a1,Yl,o,u1,maxV],[a1,Yh,o,u1,minV]),
      wallZ=(o,a0,u0,a1,u1)=>Q([o,Yh,a0,u0,minV],[o,Yl,a0,u0,maxV],[o,Yl,a1,u1,maxV],[o,Yh,a1,u1,minV]);
    // x arms: west (or no arm at all) and east.
    if(W||none){
      if(W&&E){
        if(!N)wallX(zm,xH,maxU,xL,minU);else{wallX(zm,xm,iu7,xL,minU);wallX(zm,xH,maxU,xp,iu9);}
        if(!S)wallX(zp,xL,minU,xH,maxU);else{wallX(zp,xL,minU,xm,iu7);wallX(zp,xp,iu9,xH,maxU);}
        Q([xL,Yh,zp,tu9,tminV],[xH,Yh,zp,tu9,tmaxV],[xH,Yh,zm,tu7,tmaxV],[xL,Yh,zm,tu7,tminV]);
        Q([xH,Yl,zp,tu7,tmaxV],[xL,Yl,zp,tu7,tminV],[xL,Yl,zm,tu9,tminV],[xH,Yl,zm,tu9,tmaxV]);
      }else{
        if(N||none)wallX(zm,xm,iu7,xL,minU);else wallX(zm,xp,iu9,xL,minU);
        if(S||none)wallX(zp,xL,minU,xm,iu7);else wallX(zp,xL,minU,xp,iu9);
        Q([xL,Yh,zp,tu9,tminV],[xm,Yh,zp,tu9,tv7],[xm,Yh,zm,tu7,tv7],[xL,Yh,zm,tu7,tminV]);
        Q([xm,Yl,zp,tu7,tv7],[xL,Yl,zp,tu7,tminV],[xL,Yl,zm,tu9,tminV],[xm,Yl,zm,tu9,tv7]);
      }
    }else if(!N&&!S)Q([xm,Yh,zm,iu7,minV],[xm,Yl,zm,iu7,maxV],[xm,Yl,zp,iu9,maxV],[xm,Yh,zp,iu9,minV]);
    if((E||none)&&!W){
      if(S||none)wallX(zp,xp,iu9,xH,maxU);else wallX(zp,xm,iu7,xH,maxU);
      if(N||none)wallX(zm,xH,maxU,xp,iu9);else wallX(zm,xH,maxU,xm,iu7);
      Q([xp,Yh,zp,tu9,tv9],[xH,Yh,zp,tu9,tminV],[xH,Yh,zm,tu7,tminV],[xp,Yh,zm,tu7,tv9]);
      Q([xH,Yl,zp,tu7,tmaxV],[xp,Yl,zp,tu7,tv9],[xp,Yl,zm,tu9,tv9],[xH,Yl,zm,tu9,tmaxV]);
    }else if(!E&&!N&&!S)Q([xp,Yh,zp,iu7,minV],[xp,Yl,zp,iu7,maxV],[xp,Yl,zm,iu9,maxV],[xp,Yh,zm,iu9,minV]);
    // z arms: north (or no arm at all) and south.
    if(N||none){
      if(N&&S){
        if(!W)wallZ(xm,zL,minU,zH,maxU);else{wallZ(xm,zL,minU,zm,iu7);wallZ(xm,zp,iu9,zH,maxU);}
        if(!E)wallZ(xp,zH,maxU,zL,minU);else{wallZ(xp,zm,iu7,zL,minU);wallZ(xp,zH,maxU,zp,iu9);}
        Q([xp,Yh,zL,tu9,tminV],[xm,Yh,zL,tu7,tminV],[xm,Yh,zH,tu7,tmaxV],[xp,Yh,zH,tu9,tmaxV]);
        Q([xm,Yl,zL,tu7,tminV],[xp,Yl,zL,tu9,tminV],[xp,Yl,zH,tu9,tmaxV],[xm,Yl,zH,tu7,tmaxV]);
      }else{
        if(W||none)wallZ(xm,zL,minU,zm,iu7);else wallZ(xm,zL,minU,zp,iu9);
        if(E||none)wallZ(xp,zm,iu7,zL,minU);else wallZ(xp,zp,iu9,zL,minU);
        Q([xp,Yh,zL,tu9,tminV],[xm,Yh,zL,tu7,tminV],[xm,Yh,zm,tu7,tv7],[xp,Yh,zm,tu9,tv7]);
        Q([xm,Yl,zL,tu7,tminV],[xp,Yl,zL,tu9,tminV],[xp,Yl,zm,tu9,tv7],[xm,Yl,zm,tu7,tv7]);
      }
    }else if(!E&&!W)Q([xp,Yh,zm,iu9,minV],[xp,Yl,zm,iu9,maxV],[xm,Yl,zm,iu7,maxV],[xm,Yh,zm,iu7,minV]);
    if((S||none)&&!N){
      if(W||none)wallZ(xm,zp,iu9,zH,maxU);else wallZ(xm,zm,iu7,zH,maxU);
      if(E||none)wallZ(xp,zH,maxU,zp,iu9);else wallZ(xp,zH,maxU,zm,iu7);
      Q([xp,Yh,zp,tu9,tv9],[xm,Yh,zp,tu7,tv9],[xm,Yh,zH,tu7,tmaxV],[xp,Yh,zH,tu9,tmaxV]);
      Q([xm,Yl,zp,tu7,tv9],[xp,Yl,zp,tu9,tv9],[xp,Yl,zH,tu9,tmaxV],[xm,Yl,zH,tu7,tmaxV]);
    }else if(!S&&!E&&!W)Q([xm,Yh,zp,iu7,minV],[xm,Yl,zp,iu7,maxV],[xp,Yl,zp,iu9,maxV],[xp,Yh,zp,iu9,minV]);
    // The post's top and bottom squares, then (no neighbour at all) the four end caps.
    Q([xp,Yh,zm,tu9,tv7],[xm,Yh,zm,tu7,tv7],[xm,Yh,zp,tu7,tv9],[xp,Yh,zp,tu9,tv9]);
    Q([xm,Yl,zm,tu7,tv7],[xp,Yl,zm,tu9,tv7],[xp,Yl,zp,tu9,tv9],[xm,Yl,zp,tu7,tv9]);
    if(none){
      Q([xL,Yh,zm,iu7,minV],[xL,Yl,zm,iu7,maxV],[xL,Yl,zp,iu9,maxV],[xL,Yh,zp,iu9,minV]);
      Q([xH,Yh,zp,iu7,minV],[xH,Yl,zp,iu7,maxV],[xH,Yl,zm,iu9,maxV],[xH,Yh,zm,iu9,minV]);
      Q([xp,Yh,zL,iu9,minV],[xp,Yl,zL,iu9,maxV],[xm,Yl,zL,iu7,maxV],[xm,Yh,zL,iu7,minV]);
      Q([xm,Yh,zH,iu7,minV],[xm,Yl,zH,iu7,maxV],[xp,Yl,zH,iu9,maxV],[xp,Yh,zH,iu9,minV]);
    }
  }
  // RenderBlocks render type 16/17 (piston base/extension): rotated native quads from dispenser-piston.js,
  // flat cell brightness instead of per-vertex AO.
  piston(m,b,x,y,z) {
    const meta=this.world.getMeta(x,y,z),light=this.light.packed(x,y,z);
    for(const q of pistonQuads(b,meta)){
      const r=tileRect(namedTile(q.icon));
      m.quad(q.verts.map(v=>[x+v[0],y+v[1],z+v[2]]),q.verts.map(v=>[r.u0+(r.u1-r.u0)*v[3],r.v1-(r.v1-r.v0)*v[4]]),q.shade,light,true);
    }
  }
  // RenderBlocks render type 35: native four-piece metal silhouette, with the
  // metadata orientation and damaged top tile. BlockAnvil.shouldSideBeRendered
  // returns true, so all outward faces remain visible beside full cubes.
  // RenderBlocks.renderBlockBeacon (render type 34): the glass shell, the obsidian base and the beacon core (the last two draw every face).
  beacon(m,x,y,z) {
    this.box(m,BEACON,x,y,z,[0,0,0,1,1,1],0);
    this.box(m,BEACON,x,y,z,[.125,.00625,.125,.875,.1875,.875],1,true);
    this.box(m,BEACON,x,y,z,[.1875,.1875,.1875,.8125,.875,.8125],2,true);
  }
  // RenderBlocks.renderBlockEndPortalFrame (render type 26): the 13/16 base, then the eye's smaller box with every face
  // drawn in the endframe_eye texture (blockTile reads meta bit 16 as that override).
  endFrameBlock(m,x,y,z) { // (named endFrame until batch 30, when VoxelScene's own endFrame() shadowed it and portal frames were never meshed)
    const meta=this.world.getMeta(x,y,z);
    endFrameBoxes(meta).forEach((box,i)=>this.box(m,END_PORTAL_FRAME,x,y,z,box,i?16:meta,i>0));
  }
  // RenderBlocks.renderBlockCauldron (render type 24): the outer boxes (floor and four walls) in the cauldron textures, the
  // inner faces of floor and walls in cauldron_inner, and the water surface (water_still, not biome tinted) at 6/16 + 3/16 per level.
  cauldron(m,x,y,z) {
    cauldronBoxes().forEach(box=>this.box(m,CAULDRON,x,y,z,box,0,true));
    const own=this.light.packed(x,y,z);
    // blockTile reads meta bit 16 as cauldron_inner and bit 32 as water_still.
    const innerUv=rectUvs(tileRect(blockTile(CAULDRON,0,false,16))),F=CAULDRON_FLOOR,W=CAULDRON_WALL,e=0.002;
    m.quad([[x+W,y+F+e,z+W],[x+1-W,y+F+e,z+W],[x+1-W,y+F+e,z+1-W],[x+W,y+F+e,z+1-W]],innerUv,0.9,own,true);
    // inner wall faces, bottom edge first
    for(const q of [
      [[W,F,W],[1-W,F,W],[1-W,1,W],[W,1,W]], [[W,F,1-W],[1-W,F,1-W],[1-W,1,1-W],[W,1,1-W]],
      [[W,F,W],[W,F,1-W],[W,1,1-W],[W,1,W]], [[1-W,F,W],[1-W,F,1-W],[1-W,1,1-W],[1-W,1,W]],
    ])m.quad(q.map(p=>[x+p[0],y+p[1],z+p[2]]),innerUv,0.8,own,true);
    const level=this.world.getMeta(x,y,z)&3;
    if(level>0){const h=cauldronWaterHeight(level),wuv=rectUvs(tileRect(blockTile(CAULDRON,0,false,32)));
      m.quad([[x+W,y+h,z+W],[x+1-W,y+h,z+W],[x+1-W,y+h,z+1-W],[x+W,y+h,z+1-W]],wuv,1,own,true);}
  }
  // RenderBlocks.renderBlockBrewingStand (render type 25): the centre post in brewing_stand, the three base slabs in brewing_stand_base
  // (blockTile reads meta bit 16 as the base) and one vertical sprite plane toward each slab whose bottle bit (1/2/4) is set.
  brewingStand(m,x,y,z) {
    const meta=this.world.getMeta(x,y,z),own=this.light.packed(x,y,z);
    this.box(m,134,x,y,z,[0.4375,0,0.4375,0.5625,0.875,0.5625],0,true);
    for(const box of [[0.5625,0,0.3125,0.9375,0.125,0.6875],[0.125,0,0.0625,0.5,0.125,0.4375],[0.125,0,0.5625,0.5,0.125,0.9375]])this.box(m,134,x,y,z,box,16,true);
    const uvs=rectUvs(tileRect(blockTile(134,0,false,0)));
    [[0.75,0.5],[0.3125,0.25],[0.3125,0.75]].forEach(([cx,cz],i)=>{
      if(!(meta&(1<<i)))return;
      const dx=cx-0.5,dz=cz-0.5,len=Math.hypot(dx,dz),px=-dz/len*0.28,pz=dx/len*0.28;
      m.quad([[x+0.5-px,y+0.01,z+0.5-pz],[x+0.5+px,y+0.01,z+0.5+pz],[x+0.5+px,y+0.875,z+0.5+pz],[x+0.5-px,y+0.875,z+0.5-pz]],uvs,1,own,true);
    });
  }
  // RenderBlocks.renderBlockHopper (render type 38, bytecode func_147799_a): the bowl box (0, 5/8, 0)-(1, 1, 1) in the block's own icons
  // (hopper_top on top, hopper_outside elsewhere), its four inner wall faces 1/8 in from the edge in hopper_outside and the floor at
  // 5/8 in hopper_inside, the funnel (1/4, 1/4, 1/4)-(3/4, 5/8 - 0.002, 3/4) and the spout box for the facing, both in hopper_outside.
  // blockTile reads meta bit 16 as hopper_outside on every face and bit 32 as hopper_inside.
  hopper(m,x,y,z) {
    const B=133,facing=this.world.getMeta(x,y,z)&7,own=this.light.packed(x,y,z),F=0.625,W=0.125;
    this.box(m,B,x,y,z,[0,F,0,1,1,1],0,true);
    const wall=rectUvs(tileRect(blockTile(B,0,false,16))),floor=rectUvs(tileRect(blockTile(B,0,false,32)));
    for(const q of [
      [[W,F,0],[W,F,1],[W,1,1],[W,1,0]], [[1-W,F,0],[1-W,F,1],[1-W,1,1],[1-W,1,0]],
      [[0,F,W],[1,F,W],[1,1,W],[0,1,W]], [[0,F,1-W],[1,F,1-W],[1,1,1-W],[0,1,1-W]],
    ])m.quad(q.map(p=>[x+p[0],y+p[1],z+p[2]]),wall,0.8,own,true);
    m.quad([[x,y+F,z],[x+1,y+F,z],[x+1,y+F,z+1],[x,y+F,z+1]],floor,1,own,true);
    this.box(m,B,x,y,z,[0.25,0.25,0.25,0.75,F-0.002,0.75],16,true);
    const spout={0:[0.375,0,0.375,0.625,0.25,0.625],2:[0.375,0.25,0,0.625,0.5,0.25],3:[0.375,0.25,0.75,0.625,0.5,1],4:[0,0.25,0.375,0.25,0.5,0.625],5:[0.75,0.25,0.375,1,0.5,0.625]}[facing];
    if(spout)this.box(m,B,x,y,z,spout,16,true);
  }
  // BlockFlowerPot (render type 33): the 6/16 pot in the flower_pot texture and its plant as crossed quads sunk into the pot.
  flowerPot(m,x,y,z) {
    this.box(m,FLOWER_POT,x,y,z,[...POT_BOUNDS],0,true);
    const c=potContents(this.world,x,y,z);
    if(!c||!potPlantOf(c.id,c.damage))return;
    const uvs=rectUvs(tileRect(blockTile(c.id,0,false,c.damage))),light=this.light.packed(x,y,z),py=y+0.1875,a=0.1875,d=0.8125;
    m.quad([[x+a,py+0.1875,z+a],[x+d,py+0.1875,z+d],[x+d,py+1.0,z+d],[x+a,py+1.0,z+a]],uvs,1,light,true);
    m.quad([[x+a,py+0.1875,z+d],[x+d,py+0.1875,z+a],[x+d,py+1.0,z+a],[x+a,py+1.0,z+d]],uvs,1,light,true);
  }
  anvil(m,x,y,z) {
    const meta=this.world.getMeta(x,y,z);
    for(const [x0,y0,z0,x1,y1,z1] of anvilModelBoxes(meta))
      this.box(m,ANVIL,x,y,z,[x0,y0,z0,x1,y1,z1],meta,true);
  }
  // RenderBlocks.renderBlockMinecartTrack (blm.a(aje, III), render type 9): one quad 1/16 above
  // the cell floor, drawn from both sides, its corners rotated per metadata and the raised edge
  // of an ascending rail (2-5) lifted by one block; the cell's mixed brightness, colour 1.
  // Powered, detector and activator rails (ids 135-137) draw the same quad from metadata & 7; bit 8 picks the powered texture.
  rail(m, x, y, z, id = RAIL) {
    const raw = this.world.getMeta(x, y, z), meta = id === RAIL ? raw : raw & 7, r = tileRect(blockTile(id, 0, false, raw)), light = this.light.packed(x, y, z);
    let ax = x + 1, bx = x + 1, cx = x, dx = x, az = z, bz = z + 1, cz = z + 1, dz = z;
    if (meta === 1 || meta === 2 || meta === 3 || meta === 7) [ax, dx, bx, cx, az, bz, cz, dz] = [x + 1, x + 1, x, x, z + 1, z + 1, z, z];
    else if (meta === 8) [ax, bx, cx, dx, az, dz, bz, cz] = [x, x, x + 1, x + 1, z + 1, z + 1, z, z];
    else if (meta === 9) [ax, dx, bx, cx, az, bz, cz, dz] = [x, x, x + 1, x + 1, z, z, z + 1, z + 1];
    const h = y + 0.0625;
    let ay = h, by = h, cy = h, dy = h;
    if (meta === 2 || meta === 4) { ay += 1; dy += 1; }
    else if (meta === 3 || meta === 5) { by += 1; cy += 1; }
    // Original (maxU, minV), (maxU, maxV), (minU, maxV), (minU, minV); minV is the tile's top.
    m.quad([[ax, ay, az], [bx, by, bz], [cx, cy, cz], [dx, dy, dz]], [[r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0], [r.u0, r.v1]], 1, light, true);
  }
  // Redstone components (redstone-blocks.js). Inert: the dust is always drawn at power 0 and the lever,
  // repeater and button show their stored state only. Dust follows RenderBlocks.renderBlockRedstoneWire
  // (base quad 0.015625 up, tint, overlay, climbing strips); the lever, repeater, hook and
  // tripwire models are drawn from the class descriptions, not replayed against the native renderer.
  redstone(m, b, x, y, z) {
    const w = this.world, meta = w.getMeta(x, y, z), light = this.light.packed(x, y, z);
    if (b === REDSTONE_WIRE) this.wire(m, x, y, z, light);
    else if (b === STONE_PRESSURE_PLATE || b === WOODEN_PRESSURE_PLATE || b === STONE_BUTTON) this.box(m, b, x, y, z, redstoneBounds(b, meta), meta, true);
    else if (b === LEVER) this.lever(m, x, y, z, meta, light);
    else if (b === REPEATER) this.repeater(m, x, y, z, meta, light);
    else if (b === TRIPWIRE_HOOK) this.hook(m, x, y, z, meta, light);
    else if (b === TRIPWIRE) this.tripwire(m, x, y, z, meta, light);
    else if (isRedstone2Block(b)) this.redstone2(m, b, x, y, z, meta, light);
  }
  // Second redstone family (redstone-blocks-2.js), block side only: the torches reuse the torch model with their own
  // texture, the lamps, redstone block and glowstone are full cubes, the button, plates and daylight sensor are
  // boxes of redstoneBounds2 and the comparator is a repeater-like slab with torches. The comparator's torch layout
  // is drawn from the class description (not replayed against the native renderer).
  redstone2(m, b, x, y, z, meta, light) {
    if (b === REDSTONE_TORCH || b === REDSTONE_TORCH_OFF) this.torch(m, x, y, z, b);
    else if (isCube2(b)) this.cube(m, b, x, y, z);
    else if (b === COMPARATOR || b === COMPARATOR_POWERED) this.comparator(m, b, x, y, z, meta, light);
    else this.box(m, b, x, y, z, redstoneBounds2(b, meta), meta, b !== DAYLIGHT_SENSOR);
  }
  // BlockRedstoneComparator (render type 37): a 1/8 slab (top comparator_off/on, sides stone slab, bottom torch texture)
  // with two rear torches and a front torch that is raised in subtract mode (metadata bit 2).
  comparator(m, b, x, y, z, meta, light) {
    this.box(m, b, x, y, z, [0, 0, 0, 1, 0.125, 1], meta, true);
    const dir = meta & 3, subtract = (meta & 4) !== 0, lit = b === COMPARATOR_POWERED;
    const rotate = (side, back) => [dir === 1 ? -back : dir === 3 ? back : dir === 0 ? side : -side, dir === 0 ? back : dir === 2 ? -back : dir === 1 ? side : -side];
    const torches = [[0, -0.3125, subtract, subtract ? 0.625 : 0.3125], [-0.25, 0.25, lit, 0.5], [0.25, 0.25, lit, 0.5]];
    const r = 0.0625;
    for (const [side, back, on, height] of torches) {
      const t = tileRect(tileByName(on ? "redstone_torch_on" : "redstone_torch_off")), U = (p) => t.u0 + ((t.u1 - t.u0) * p) / 16, V = (p) => t.v1 - ((t.v1 - t.v0) * p) / 16;
      const [ox, oz] = rotate(side, back), cx = x + 0.5 + ox, cz = z + 0.5 + oz, y0 = y + 0.125, y1 = y0 + height;
      const sides = [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]];
      for (const [[ax, az], [bx, bz]] of sides) m.quad([[cx + ax, y0, cz + az], [cx + bx, y0, cz + bz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az]], [[U(7), V(16)], [U(9), V(16)], [U(9), V(16 - height * 16)], [U(7), V(16 - height * 16)]], 1, light, true);
      m.quad([[cx - r, y1, cz + r], [cx + r, y1, cz + r], [cx + r, y1, cz - r], [cx - r, y1, cz - r]], [[U(7), V(8)], [U(9), V(8)], [U(9), V(6)], [U(7), V(6)]], 1, light, true);
    }
  }
  wire(m, x, y, z, light) {
    const { w, e, n, s } = wireArms(this.world, x, y, z), climb = wireClimbs(this.world, x, y, z), tint = wireTint(0);
    const lineX = (w || e) && !n && !s, lineZ = (n || s) && !w && !e, cross = !lineX && !lineZ;
    const uOf = (r, p) => r.u0 + ((r.u1 - r.u0) * p) / 16, vOf = (r, p) => r.v1 - ((r.v1 - r.v0) * p) / 16;
    const setTint = (c) => { const k = m.shade.length - 12; for (let i = 0; i < 4; i++) { m.shade[k + i * 3] = c[0]; m.shade[k + i * 3 + 1] = c[1]; m.shade[k + i * 3 + 2] = c[2]; } };
    const y0 = y + 0.015625, px = [0, 0, 16, 16];
    let x0 = x, x1 = x + 1, z0 = z, z1 = z + 1;
    if (cross) {
      if (!w) { x0 += 0.3125; px[0] = 5; }
      if (!e) { x1 -= 0.3125; px[2] = 11; }
      if (!n) { z0 += 0.3125; px[1] = 5; }
      if (!s) { z1 -= 0.3125; px[3] = 11; }
    }
    const names = cross ? ["redstone_dust_cross", "redstone_dust_cross_overlay"] : ["redstone_dust_line", "redstone_dust_line_overlay"];
    names.forEach((name, k) => {
      const r = tileRect(tileByName(name)), verts = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]],
        pts = [[px[0], px[3]], [px[2], px[3]], [px[2], px[1]], [px[0], px[1]]];
      m.quad(verts, pts.map(([u, v]) => (lineX ? [uOf(r, v), vOf(r, u)] : [uOf(r, u), vOf(r, v)])), 1, light, true);
      setTint(k === 0 ? tint : [1, 1, 1]);
    });
    // Strips up the side of a normal cube that carries dust on top.
    const top = y + 1.021875, q = 0.015625;
    const strips = [[climb.w, x + q, null], [climb.e, x + 1 - q, null], [climb.n, null, z + q], [climb.s, null, z + 1 - q]];
    for (const [on, sx, sz] of strips) {
      if (!on) continue;
      const verts = sx !== null ? [[sx, top, z + 1], [sx, y, z + 1], [sx, y, z], [sx, top, z]] : [[x, top, sz], [x, y, sz], [x + 1, y, sz], [x + 1, top, sz]];
      ["redstone_dust_line", "redstone_dust_line_overlay"].forEach((name, k) => {
        const r = tileRect(tileByName(name));
        m.quad(verts, [[r.u0, r.v1], [r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1]], 1, light, true);
        setTint(k === 0 ? tint : [1, 1, 1]);
      });
    }
  }
  // Axis-aligned textured box with the whole tile on every face (shaded by direction).
  tbox(m, name, x, y, z, [x0, y0, z0, x1, y1, z1], light) {
    const uv = rectUvs(tileRect(tileByName(name)));
    for (const f of FACES) m.quad(f.v.map((v) => [x + (v[0] ? x1 : x0), y + (v[1] ? y1 : y0), z + (v[2] ? z1 : z0)]), uv, f.shade, light);
  }
  // A square prism from centre a to centre b with half-width hw, textured with a tile sub-rectangle (pixels).
  stick(m, name, a, b, hw, light, [pu0, pv0, pu1, pv1]) {
    const r = tileRect(tileByName(name)), U = (p) => r.u0 + ((r.u1 - r.u0) * p) / 16, V = (p) => r.v1 - ((r.v1 - r.v0) * p) / 16;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d), dn = d.map((c) => c / len);
    const h = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    let u = cr(dn, h); const ul = Math.hypot(...u); u = u.map((c) => (c / ul) * hw);
    let v = cr(dn, u); const vl = Math.hypot(...v); v = v.map((c) => (c / vl) * hw);
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [0, 1, 2].map((i) => s * u[i] + t * v[i])), add = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    for (let i = 0; i < 4; i++) {
      const o0 = ring[i], o1 = ring[(i + 1) % 4];
      m.quad([add(a, o0), add(a, o1), add(b, o1), add(b, o0)], [[U(pu0), V(pv1)], [U(pu1), V(pv1)], [U(pu1), V(pv0)], [U(pu0), V(pv0)]], 0.8, light, true);
    }
    m.quad(ring.map((o) => add(b, o)), [[U(pu0), V(pv0 + 2)], [U(pu1), V(pv0 + 2)], [U(pu1), V(pv0)], [U(pu0), V(pv0)]], 1, light, true);
  }
  // Lever/hook local frame: local y runs away from the supporting face. Returns a cell-space mapper for a
  // lever metadata (5/6 floor, 7/0 ceiling, 1-4 walls).
  leverFrame(meta, x, y, z) {
    const f = { 5: (a, b, c) => [a, b, c], 6: (a, b, c) => [c, b, a], 7: (a, b, c) => [a, -b, c], 0: (a, b, c) => [c, -b, a],
      1: (a, b, c) => [b, a, c], 2: (a, b, c) => [-b, a, c], 3: (a, b, c) => [c, a, b], 4: (a, b, c) => [c, a, -b] }[meta & 7] || ((a, b, c) => [a, b, c]);
    return ([lx, ly, lz]) => { const [a, b, c] = f(lx - 0.5, ly - 0.5, lz - 0.5); return [x + 0.5 + a, y + 0.5 + b, z + 0.5 + c]; };
  }
  localBox(T, [x0, y0, z0, x1, y1, z1]) {
    const p = [T([x0, y0, z0]), T([x1, y1, z1])];
    return [0, 1, 2].map((i) => Math.min(p[0][i], p[1][i])).concat([0, 1, 2].map((i) => Math.max(p[0][i], p[1][i])));
  }
  // BlockLever (render type 12): a cobblestone base and a stick that leans one way off and the other on.
  lever(m, x, y, z, meta, light) {
    const T = this.leverFrame(meta, x, y, z), base = this.localBox(T, [0.25, 0, 0.25, 0.75, 0.1875, 0.75]), tilt = meta & 8 ? 0.25 : -0.25;
    this.tbox(m, "cobblestone", 0, 0, 0, base, light);
    this.stick(m, "lever", T([0.5, 0.1875, 0.5]), T([0.5 + tilt, 0.6875, 0.5]), 0.0625, light, [7, 6, 9, 16]);
  }
  // BlockRedstoneRepeater (render type 15): a 1/8 slab with its top texture, and two torches (fixed and delay).
  repeater(m, x, y, z, meta, light) {
    this.box(m, REPEATER, x, y, z, [0, 0, 0, 1, 0.125, 1], meta, true);
    const dir = meta & 3, delay = (meta >> 2) & 3, val = [-0.0625, 0.0625, 0.1875, 0.3125][delay], r = 0.0625;
    const t = tileRect(tileByName("redstone_torch_off")), U = (p) => t.u0 + ((t.u1 - t.u0) * p) / 16, V = (p) => t.v1 - ((t.v1 - t.v0) * p) / 16;
    for (const d of [-0.3125, val]) {
      const cx = x + 0.5 + (dir === 1 ? -d : dir === 3 ? d : 0), cz = z + 0.5 + (dir === 0 ? d : dir === 2 ? -d : 0), y0 = y + 0.125, y1 = y0 + 0.625;
      const sides = [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]];
      for (const [[ax, az], [bx, bz]] of sides) m.quad([[cx + ax, y0, cz + az], [cx + bx, y0, cz + bz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az]], [[U(7), V(16)], [U(9), V(16)], [U(9), V(0)], [U(7), V(0)]], 1, light, true);
      m.quad([[cx - r, y1, cz + r], [cx + r, y1, cz + r], [cx + r, y1, cz - r], [cx - r, y1, cz - r]], [[U(7), V(8)], [U(9), V(8)], [U(9), V(6)], [U(7), V(6)]], 1, light, true);
    }
  }
  // BlockTripWireHook: a plank plate on its wall and the hook sprite.
  hook(m, x, y, z, meta, light) {
    const T = this.leverFrame([3, 2, 4, 1][meta & 3], x, y, z), plate = this.localBox(T, [0.375, 0, 0.3125, 0.625, 0.125, 0.6875]);
    this.tbox(m, "planks_oak", 0, 0, 0, plate, light);
    const r = tileRect(tileByName("trip_wire_source"));
    m.quad([[0.2, 0.125, 0.5], [0.8, 0.125, 0.5], [0.8, 0.6875, 0.5], [0.2, 0.6875, 0.5]].map((p) => T(p)), [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], 1, light, true);
  }
  // BlockTripWire (render type 30): a thin strip along the axis its neighbours (tripwire or hook) lie on.
  tripwire(m, x, y, z, meta, light) {
    const w = this.world, linked = (px, pz) => { const q = w.get(px, y, pz); return q === TRIPWIRE || q === TRIPWIRE_HOOK; };
    const alongX = linked(x - 1, z) || linked(x + 1, z), h = y + (meta & 2 ? 0.1 : 0.0625), r = tileRect(tileByName("trip_wire"));
    const a = 0.4375, b = 0.5625;
    const verts = alongX ? [[x, h, z + a], [x + 1, h, z + a], [x + 1, h, z + b], [x, h, z + b]] : [[x + a, h, z], [x + b, h, z], [x + b, h, z + 1], [x + a, h, z + 1]];
    m.quad(verts, [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], 1, light, true);
  }
  // RenderBlocks.renderBlockVine (blm.j(aji, x, y, z), executed in the render-types probe): for each metadata bit a wall quad 0.05f off the cell face (bit 2 at
  // x, bit 8 at x + 1, bit 4 at z, bit 1 at z + 1) drawn twice (the second quad lists the same four vertices in reverse order), and one single quad
  // 0.05f under the top when the block above is a normal cube (Block.isNormalCube, not only a vine with bits set). The same flat brightness and the
  // foliage colour at the cell (no anaglyph conversion) for every quad.
  vine(m,x,y,z) {
    const w=this.world,meta=w.getMeta(x,y,z),r=tileRect(blockTile(VINE,0)),light=this.light.packed(x,y,z),d=0.05000000074505806,
      minU=r.u0,maxU=r.u1,minV=r.v1,maxV=r.v0,
      put=(pts,twice)=>{
        for(const list of twice?[pts,pts.slice().reverse()]:[pts]){
          m.quad(list.map((p)=>[x+p[0],y+p[1],z+p[2]]),list.map((p)=>[p[3],p[4]]),1,light);
          m.tint(this.biomeColors.foliageAt(x+this.colorX,y,z+this.colorZ),false);
        }
      };
    if(meta&2)put([[d,1,1,minU,minV],[d,0,1,minU,maxV],[d,0,0,maxU,maxV],[d,1,0,maxU,minV]],true);
    if(meta&8)put([[1-d,0,1,maxU,maxV],[1-d,1,1,maxU,minV],[1-d,1,0,minU,minV],[1-d,0,0,minU,maxV]],true);
    if(meta&4)put([[1,0,d,maxU,maxV],[1,1,d,maxU,minV],[0,1,d,minU,minV],[0,0,d,minU,maxV]],true);
    if(meta&1)put([[1,1,1-d,minU,minV],[1,0,1-d,minU,maxV],[0,0,1-d,maxU,maxV],[0,1,1-d,maxU,minV]],true);
    if(normalCube(w.get(x,y+1,z)))put([[1,1-d,0,minU,minV],[1,1-d,1,minU,maxV],[0,1-d,1,maxU,maxV],[0,1-d,0,maxU,minV]],false);
  }
  // renderCrossedSquares, with the tall-grass position jitter from the block coordinates.
  // RenderBlocks.renderBlockStem (stems-cake.js stemQuads): crossed planes tinted by age, plus the connected plane beside a fruit.
  stem(m, b, x, y, z) {
    const meta = this.world.getMeta(x, y, z), dir = stemDirection(this.world, x, y, z, b), light = this.light.packed(x, y, z), tint = meshAnaglyph.on ? anaglyphFog(stemTint(meta)) : stemTint(meta), // renderBlockStem (blm.m) converts the age colour
      prefix = b === PUMPKIN_STEM ? "pumpkin_stem_" : "melon_stem_";
    for (const q of stemQuads(meta, dir)) {
      const r = tileRect(tileByName(prefix + (q.tile === "connected" ? "connected" : "disconnected")));
      m.quad(q.verts.map((v) => [x + v[0], y + v[1], z + v[2]]), q.uvs.map(([u, v]) => [r.u0 + (r.u1 - r.u0) * u, r.v1 - (r.v1 - r.v0) * v]), 1, light, true);
      const k = m.shade.length - 12;
      for (let i = 0; i < 4; i++) { m.shade[k + i * 3] = tint[0]; m.shade[k + i * 3 + 1] = tint[1]; m.shade[k + i * 3 + 2] = tint[2]; }
    }
  }
  crossed(m, b, x, y, z) {
    const w = this.world;
    let px = x, py = y, pz = z, hash = 0n;
    const tallgrass = b === 39 || b === FERN || b === DEAD_SHRUB;
    if (tallgrass || isFlower(b) || b === DOUBLE_PLANT) {
      // blm.l hashes x * 3129871 ^ z * 116129781 ^ y; blm.a(ako, ...) (the double plant) leaves y out of the same hash (bytecode-read, and the
      // native probe's positions agree).
      let i = BigInt.asIntN(64, BigInt(Math.imul(x, 3129871)) ^ (BigInt(z) * 116129781n) ^ (b === DOUBLE_PLANT ? 0n : BigInt(y)));
      i = BigInt.asIntN(64, i * i * 42317861n + i * 11n);
      hash = i;
      const bits = (s) => Number((i >> BigInt(s)) & 15n) / 15;
      // blm.l: tall grass (every BlockTallGrass metadata: dead shrub, grass, fern) moves 0.5 sideways and sinks; flowers (yellow and
      // red) use the same hash for a 0.3 sideways jitter and do not sink. The double plant jitters 0.3 sideways, no sink.
      const spread = tallgrass ? 0.5 : 0.3;
      px += (bits(16) - 0.5) * spread;
      if (tallgrass) py += (bits(20) - 1) * 0.2;
      pz += (bits(24) - 0.5) * spread;
    }
    const raw=w.getMeta(x,y,z), top=b===DOUBLE_PLANT&&(raw&8)!==0, plantMeta=top?(w.getMeta(x,y-1,z)&7)|8:raw;
    const uvs = rectUvs(tileRect(blockTile(b, 0, false, plantMeta))), light = this.light.packed(x, y, z), a = 0.05, c = 0.95;
    // BlockTallGrass (not the dead shrub), BlockReed and BlockDoublePlant grass/fern: the biome grass colour of this one position.
    const grassy = b === 39 || b === FERN || b === REEDS || (b === DOUBLE_PLANT && ((plantMeta & 7) === 2 || (plantMeta & 7) === 3)),
      tint = grassy ? this.biomeColors.grassAt(x + this.colorX, y, z + this.colorZ) : null;
    m.quad([[px + a, py, pz + a], [px + c, py, pz + c], [px + c, py + 1, pz + c], [px + a, py + 1, pz + a]], uvs, 1, light, "mirror");
    if (tint !== null) m.tint(tint);
    m.quad([[px + a, py, pz + c], [px + c, py, pz + a], [px + c, py + 1, pz + a], [px + a, py + 1, pz + c]], uvs, 1, light, "mirror");
    if (tint !== null) m.tint(tint);
    if (top && (plantMeta & 7) === 0) this.sunflowerHead(m, px, py, pz, light, hash);
  }
  // The sunflower's head (blm.a(ako, ...), bytecode-read): on the upper half, a front and a back quad (double_plant_sunflower_front and _back)
  // turned about the vertical by cos(l * 0.8) * pi * 0.1 (l the position hash) and leaning 0.3 / 0.05 off the stem; y is not jittered.
  sunflowerHead(m, px, py, pz, light, hash) {
    const ang = Math.cos(Number(hash) * 0.8) * Math.PI * 0.1, cs = Math.cos(ang), sn = Math.sin(ang),
      d41 = 0.5 + 0.3 * cs - 0.5 * sn, d43 = 0.5 + 0.5 * cs + 0.3 * sn, d45 = 0.5 + 0.3 * cs + 0.5 * sn, d47 = 0.5 + -0.5 * cs + 0.3 * sn,
      d49 = 0.5 + -0.05 * cs + 0.5 * sn, d51 = 0.5 + -0.5 * cs + -0.05 * sn, d53 = 0.5 + -0.05 * cs - 0.5 * sn, d55 = 0.5 + 0.5 * cs + -0.05 * sn;
    const front = tileRect(tileByName("double_plant_sunflower_front")), back = tileRect(tileByName("double_plant_sunflower_back"));
    // Original (minU, maxV) .. with minV the tile's top: the atlas v1 is the top row.
    m.quad([[px + d49, py + 1, pz + d51], [px + d53, py + 1, pz + d55], [px + d41, py, pz + d43], [px + d45, py, pz + d47]],
      [[front.u0, front.v0], [front.u1, front.v0], [front.u1, front.v1], [front.u0, front.v1]], 1, light);
    m.quad([[px + d53, py + 1, pz + d55], [px + d49, py + 1, pz + d51], [px + d45, py, pz + d47], [px + d41, py, pz + d43]],
      [[back.u0, back.v0], [back.u1, back.v0], [back.u1, back.v1], [back.u0, back.v1]], 1, light);
  }
  // RenderBlocks.renderBlockCactusImpl (render type 13): no ambient occlusion. The bottom and top
  // follow shouldSideBeRendered (not under an opaque cube) in the brightness of the cell beyond;
  // the four sides are full faces moved 1/16 inwards (Tessellator.addTranslation), always drawn,
  // in the cactus cell's own brightness. Shades 0.5, 1, 0.8 (z) and 0.6 (x).
  cactus(m, x, y, z) {
    const w = this.world, L = this.light, t = 1 / 16, own = L.packed(x, y, z);
    FACES.forEach((f, fi) => {
      const vertical = fi === 2 || fi === 3;
      if (vertical && hides(w.get(x, y + f.n[1], z))) return;
      const verts = f.v.map((v) => [x + v[0] - f.n[0] * t, y + v[1], z + v[2] - f.n[2] * t]);
      m.quad(verts, (fi === 3 ? bottomUvs : rectUvs)(tileRect(blockTile(CACTUS, fi))), f.shade, vertical ? L.packed(x, y + f.n[1], z) : own);
    });
  }
  // RenderBlocks.renderBlockLadder (render type 8): one quad 0.05 off the wall the metadata
  // names, facing away from it, in the cell's own brightness with no face shading.
  ladder(m, x, y, z) {
    const uvs = rectUvs(tileRect(blockTile(LADDER, 0))), light = this.light.packed(x, y, z), a = 0.05, c = 0.95;
    const quads = {
      5: [[x + a, y, z + 1], [x + a, y, z], [x + a, y + 1, z], [x + a, y + 1, z + 1]],
      4: [[x + c, y, z], [x + c, y, z + 1], [x + c, y + 1, z + 1], [x + c, y + 1, z]],
      3: [[x, y, z + a], [x + 1, y, z + a], [x + 1, y + 1, z + a], [x, y + 1, z + a]],
      2: [[x + 1, y, z + c], [x, y, z + c], [x, y + 1, z + c], [x + 1, y + 1, z + c]],
    };
    const verts = quads[this.world.getMeta(x, y, z)];
    if (verts) m.quad(verts, uvs, 1, light);
  }
  // renderBlockCropsImpl: a # of four planes at 1/4 and 3/4, sunk 1/16.
  // BlockPortal: bounds by axis, faces kept by shouldSideBeRendered (portalSideRendered),
  // drawn from the whole animated portal.png strip.
  portalBlock(m, x, y, z) {
    const w = this.world, bb = blockBounds(w, x, y, z), light = this.light.packed(x, y, z), VANILLA_SIDE = [5, 4, 1, 0, 3, 2];
    FACES.forEach((f, fi) => {
      if (!portalSideRendered(w, x + f.n[0], y + f.n[1], z + f.n[2], VANILLA_SIDE[fi])) return;
      const corners = f.v.map((v) => [x + (v[0] ? bb[3] : bb[0]), y + (v[1] ? bb[4] : bb[1]), z + (v[2] ? bb[5] : bb[2])]);
      const uvs = f.v.map((v) => (fi < 2 ? [v[2], v[1]] : fi < 4 ? [v[0], v[2]] : [v[0], v[1]]));
      m.quad(corners, uvs, f.shade, light, true);
    });
  }
  crops(m, b, x, y, z) {
    const uvs = rectUvs(tileRect(blockTile(b, 0, false, this.world.getMeta(x, y, z)))), light = this.light.packed(x, y, z), y0 = y - 1 / 16, y1 = y0 + 1;
    for (const o of [0.25, 0.75]) {
      m.quad([[x + o, y0, z], [x + o, y0, z + 1], [x + o, y1, z + 1], [x + o, y1, z]], uvs, 1, light, "mirror");
      m.quad([[x, y0, z + o], [x + 1, y0, z + o], [x + 1, y1, z + o], [x, y1, z + o]], uvs, 1, light, "mirror");
    }
  }
  // renderBlockLiquid (blm.d(Lawt;III)): the top uses the still frames, or the
  // flowing ones turned to the flow direction (func_149802_a) when the water
  // moves; both are drawn from either side. The four corner heights drop by
  // 0.001 when the top is drawn and the sides follow them. Sides use the
  // flowing texture's top-left quarter, a 0.001 inset and liquid brightness.
  liquid(kind, still, flow, x, y, z) {
    const w = this.world, L = this.light, e = 0.001, inset = 0.0010000000474974513,
      bright = (bx, by, bz) => maxPacked(L.packed(bx, by, bz, false), L.packed(bx, by + 1, bz, false)), // BlockLiquid.getMixedBrightnessForBlock reads both cells with lightValue 0
      top = w.get(x, y + 1, z) !== kind,
      h = [[liquidHeight(w, x, y, z, kind), liquidHeight(w, x, y, z + 1, kind)], [liquidHeight(w, x + 1, y, z, kind), liquidHeight(w, x + 1, y, z + 1, kind)]];
    // BlockLiquid.colorMultiplier: water averages the biome water colour over x-1..x+1, z-1..z+1; lava is white.
    let tint = null; const paint = (mesher) => { tint ??= kind === 10 ? this.biomeColors.water(x + this.colorX, z + this.colorZ) : 0xFFFFFF; if (tint !== 0xFFFFFF) mesher.tint(tint, false); }; // renderBlockLiquid (blm.p) never reads anaglyphEnable
    if (top) {
      for (const row of h) for (let i = 0; i < 2; i++) row[i] -= inset;
      const verts = [[x, y + h[0][0], z], [x, y + h[0][1], z + 1], [x + 1, y + h[1][1], z + 1], [x + 1, y + h[1][0], z]], angle = flowAngle(w, x, y, z, kind);
      if (angle > -999) {
        const a = Math.fround(angle), s = Math.fround(mhSin(a) * 0.25), c = Math.fround(mhCos(a) * 0.25),
          at = (du, dv) => [(8 + du * 16) / 16, 1 - (8 + dv * 16) / 16];
        flow.quad(verts, [at(-c - s, -c + s), at(-c + s, c + s), at(c + s, c - s), at(c - s, -c - s)], 1, bright(x, y, z), true); paint(flow);
      } else { still.quad(verts, [[0, 1], [0, 0], [1, 0], [1, 1]], 1, bright(x, y, z), true); paint(still); }
    }
    const below = w.get(x, y - 1, z);
    if (below !== kind && !opaqueCube(below))
      still.quad([[x, y + e, z], [x + 1, y + e, z], [x + 1, y + e, z + 1], [x, y + e, z + 1]], [[0, 1], [1, 1], [1, 0], [0, 0]], 0.5, bright(x, y - 1, z));
    if (below !== kind && !opaqueCube(below)) paint(still);
    for (const fi of [0, 1, 4, 5]) {
      const f = FACES[fi], nx = x + f.n[0], nz = z + f.n[2], nb = w.get(nx, y, nz);
      if (nb === kind || hides(nb)) continue;
      const verts = f.v.map((v) => [x + v[0] - f.n[0] * e, y + (v[1] ? h[v[0]][v[2]] : 0), z + v[2] - f.n[2] * e]),
        uvs = f.v.map((v, i) => [i === 1 || i === 2 ? 0 : 0.5, v[1] ? 1 - (1 - h[v[0]][v[2]]) * 0.5 : 0.5]);
      flow.quad(verts, uvs, f.shade, bright(nx, y, nz), true); // drawn from both sides, as renderBlockLiquid emits each side twice
      paint(flow);
    }
  }
  // The block's vertices into the layer meshers (the per-block dispatch of meshColumn; light-float.test.js drives it per block).
  meshBlock(M, b, x, y, z) {
    const w = this.world, { solid, water, ice, flow, lava, lavaFlow, fire, portal } = M;
    if (b === PORTAL) this.portalBlock(portal, x, y, z);
    else if (b === NETHER_WART) this.crops(solid, b, x, y, z);
    else if (b === 20) this.torch(solid, x, y, z);
    else if (isCrop(b)) this.crops(solid, b, x, y, z);
    else if (b === PUMPKIN_STEM || b === MELON_STEM) this.stem(solid, b, x, y, z);
    else if (b === DRAGON_EGG) eggBoxes().forEach((box) => this.box(solid, b, x, y, z, box, 0, true)); // RenderBlocks.renderBlockDragonEgg
    else if (b === CAKE) this.box(solid, b, x, y, z, cakeBounds(w.getMeta(x, y, z)), w.getMeta(x, y, z));
    else if (b===COCOA||b===SANDSTONE_SLAB) this.box(solid,b,x,y,z,blockBounds(w,x,y,z));
    else if (b===STONE_SLAB) this.box(solid,b,x,y,z,blockBounds(w,x,y,z),w.getMeta(x,y,z));
    else if (b===END_PORTAL_FRAME) this.endFrameBlock(solid,x,y,z);
    else if (b===BEACON) this.beacon(solid,x,y,z);
    else if (b===133) this.hopper(solid,x,y,z);
    else if (b===CAULDRON) this.cauldron(solid,x,y,z);
    else if (b===FLOWER_POT) this.flowerPot(solid,x,y,z);
    else if (b===134) this.brewingStand(solid,x,y,z);
    else if (b===ANVIL) this.anvil(solid,x,y,z);
    else if (isPistonBase(b)||b===PISTON_HEAD) this.piston(solid,b,x,y,z);
    else if (isStair(b)) this.stairs(solid,b,x,y,z);
    else if (isDoor(b)) this.door(solid,b,x,y,z);
    else if (b===LILY_PAD) this.lilyPad(solid,x,y,z);
    else if (b===BED) this.bed(solid,b,x,y,z);
    else if (isPane(b)) (b===IRON_BARS ? this.pane(solid,b,x,y,z) : this.glassPane(solid,b,x,y,z));
    else if (b===VINE) this.vine(solid,x,y,z);
    else if (isPlant(b) || b === WEB || b === REEDS) this.crossed(solid, b, x, y, z);
    else if (b === LADDER) this.ladder(solid, x, y, z);
    else if (b === FENCE || b === NETHER_FENCE) for (const box of fenceRenderBoxes(fenceMask(w, x, y, z))) this.box(solid, b, x, y, z, box, 0, true); // renderBlockFence (blm type 11) draws every face of its boxes, against opaque neighbours too (render-types-reference.json)
    else if (b >= 165 && b !== 166 && b <= 169) this.shaped(solid, b, x, y, z);
    else if (isRedstoneBlock(b)) this.redstone(solid, b, x, y, z);
    else if (b === RAIL || (b >= 135 && b <= 137)) this.rail(solid, x, y, z, b);
    else if (b === CACTUS) this.cactus(solid, x, y, z);
    else if (b === 10) this.liquid(10, water, flow, x, y, z);
    else if (b === 42) this.liquid(42, lava, lavaFlow, x, y, z);
    else if (b === FIRE) this.fireBlock(fire, x, y, z);
    else if (b === CARPET) this.box(solid, b, x, y, z, blockBounds(w, x, y, z), w.getMeta(x, y, z));
    else this.cube(b === ICE || b === STAINED_GLASS ? ice : solid, b, x, y, z);
  }
  // The meshers of the column at (cx, cz), one per draw layer; fire has two (fire.js layers).
  meshColumn(cx, cz) {
    const w = this.world, solid = new Mesher(), water = new Mesher(), ice = new Mesher(), flow = new Mesher(), lava = new Mesher(), lavaFlow = new Mesher(), fire = [new Mesher(), new Mesher()], portal = new Mesher(), M = { solid, water, ice, flow, lava, lavaFlow, fire, portal };
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < (w.height ?? HEIGHT); y++) {
          const b = w.get(x, y, z);
          if (!b || b === END_PORTAL || isChestShaped(b) || b === PISTON_MOVING || b === 175 || b === 176 || b === 172) continue; // signs are drawn by sign-renderer.js; the moving block is drawn by updateMoving, never as a cube
          this.meshBlock(M, b, x, y, z);
        }
    return M;
  }
}

// A mesher over any world-like source: { world, light, biomeColors, colorX, colorZ, litFurnaces }. VoxelScene itself is such a source
// and also owns the methods (below), so the page thread meshes with `this`; the worker passes a region snapshot.
export class ChunkMesher extends MeshMethods {
  constructor(src) { super(); this.src = src; }
  get world() { return this.src.world; }
  get light() { return this.src.light; }
  get biomeColors() { return this.src.biomeColors; }
  get colorX() { return this.src.colorX; }
  get colorZ() { return this.src.colorZ; }
  get litFurnaces() { return this.src.litFurnaces; }
}
export const MESH_METHODS = Object.getOwnPropertyNames(MeshMethods.prototype).filter((n) => n !== "constructor");

// The page's half of a worker mesh: buffers from the typed arrays of mesh-region.js meshArrays (same attributes as Mesher.geometry).
export function arraysGeometry(a) {
  if (!a) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(a.position, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(a.uv, 2));
  g.setAttribute("shade", new THREE.BufferAttribute(a.shade, 3));
  g.setAttribute("lightCoord", new THREE.BufferAttribute(a.lightCoord, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  g.computeBoundingSphere();
  return g;
}
