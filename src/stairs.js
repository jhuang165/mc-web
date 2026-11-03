// BlockStairs (ans), Minecraft Java 1.7.10: the ten stair blocks (internal 87-96, original 53, 67,
// 109, 128, 134, 135, 136, 108, 163, 164), their shape (func_150147_e, func_150145_f,
// func_150144_g), multi-box collision, the eight-octant collisionRayTrace and the placement
// metadata. Replayed against the unchanged classes by src/stairs.test.js
// (public/research/stairs-reference.json, tools/verify-stairs.mjs).
// Metadata: bits 0-1 facing (0 ascends towards +x, 1 -x, 2 +z, 3 -z), bit 2 upside-down.
// This module imports nothing so world.js and the render/physics modules can all use it.

export const STAIR_FIRST = 87, STAIR_LAST = 96;
export const isStair = (id) => id >= STAIR_FIRST && id <= STAIR_LAST;

// Per-stair data copied from the constructor (model block material/hardness/resistance/sound),
// see stairs-reference.json. model is the internal block id and damage whose textures each face
// uses; hardness/explosion are Block.getBlockHardness and Block.getExplosionResistance (blockResistance/5).
// kind is the tool Material.rock (pickaxe) or Material.wood (axe) is mined with.
export const STAIRS = Object.freeze({
  87: { original: 53, name: 'Oak wood stairs', model: 'planks', modelId: 7, modelDamage: 0, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
  88: { original: 67, name: 'Cobblestone stairs', model: 'cobblestone', modelId: 12, modelDamage: 0, hardness: 2, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  89: { original: 109, name: 'Stone brick stairs', model: 'stonebrick', modelId: 101, modelDamage: 0, hardness: 1.5, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  90: { original: 128, name: 'Sandstone stairs', model: 'sandstone', modelId: 56, modelDamage: 0, hardness: 0.800000011920929, resistance: 4, kind: 'pickaxe', sound: 'stone' },
  91: { original: 134, name: 'Spruce wood stairs', model: 'planks', modelId: 7, modelDamage: 1, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
  92: { original: 135, name: 'Birch wood stairs', model: 'planks', modelId: 7, modelDamage: 2, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
  93: { original: 136, name: 'Jungle wood stairs', model: 'planks', modelId: 7, modelDamage: 3, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
  94: { original: 108, name: 'Brick stairs', model: 'brick', modelId: 8, modelDamage: 0, hardness: 2, resistance: 30, kind: 'pickaxe', sound: 'stone' },
  95: { original: 163, name: 'Acacia wood stairs', model: 'planks', modelId: 7, modelDamage: 4, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
  96: { original: 164, name: 'Dark oak wood stairs', model: 'planks', modelId: 7, modelDamage: 5, hardness: 2, resistance: 15, kind: 'axe', sound: 'wood' },
});
// The six-block shaped recipes (CraftingManager: "#  ", "## ", "###", also mirrored; 4 stairs). The
// ingredient is the model block; planks match their exact damage, the others any damage (4:*, 45:*, 98:*, 24:*).
const STAIR_INGREDIENT = { 87: [7, 0], 88: [12, null], 89: [1101, null], 90: [56, null], 91: [7, 1], 92: [7, 2], 93: [7, 3], 94: [8, null], 95: [7, 4], 96: [7, 5] };
const STAIR_PATTERNS = [[0, 3, 4, 6, 7, 8], [2, 4, 5, 6, 7, 8]];
export function stairRecipeResult(cells, size) {
  if (size !== 3 || cells.filter(Boolean).length !== 6) return null;
  for (const pattern of STAIR_PATTERNS) {
    if (!pattern.every((i) => cells[i]) ) continue;
    for (const [id, [item, damage]] of Object.entries(STAIR_INGREDIENT))
      if (pattern.every((i) => cells[i].id === item && (damage === null || (cells[i].damage ?? 0) === damage))) return { id: Number(id), count: 4, damage: 0 };
  }
  return null;
}
// Block.getExplosionResistance (aji.a(sa)): blockResistance / 5, where the field already holds the
// model block's resistance * 3 (the constructor stores model.blockResistance / 3 via setResistance).
export const stairExplosionResistance = (id) => STAIRS[id].resistance / 5;

// Block.damageDropped is 0 and the block drops itself.
export const stairDropDamage = () => 0;
// World.doesBlockHaveSolidTopSurface: only an upside-down stair (metadata bit 2) has a solid top.
export const stairSolidTop = (meta) => (meta & 4) !== 0;

// func_150147_e: the half-block box, [0, .5, 0, 1, 1, 1] upside-down, else [0, 0, 0, 1, .5, 1].
export const stairBaseBox = (meta) => (meta & 4 ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1]);

// `at(dx, dz)` returns the full metadata of a stair at the horizontal neighbour, or -1 for any
// other block (BlockStairs.func_150148_a is an instanceof test). func_150146_f is "a stair there
// with exactly this metadata".
const same = (at, dx, dz, meta) => at(dx, dz) === meta;

// func_150145_f: the second box; `simple` (the method's boolean result) says whether no outer-corner
// reduction applied, which is what lets func_150144_g add an inner-corner third box.
function secondBox(meta, at) {
  const facing = meta & 3, y0 = meta & 4 ? 0 : 0.5, y1 = meta & 4 ? 0.5 : 1;
  let x0 = 0, x1 = 1, z0 = 0, z1 = 1, simple = true;
  const stairAt = (dx, dz) => { const m = at(dx, dz); return m >= 0 && (m & 4) === (meta & 4) ? m & 3 : -1; };
  if (facing === 0) {
    x0 = 0.5;
    const k = stairAt(1, 0);
    if (k === 3 && !same(at, 0, 1, meta)) { z1 = 0.5; simple = false; }
    else if (k === 2 && !same(at, 0, -1, meta)) { z0 = 0.5; simple = false; }
  } else if (facing === 1) {
    x1 = 0.5;
    const k = stairAt(-1, 0);
    if (k === 3 && !same(at, 0, 1, meta)) { z1 = 0.5; simple = false; }
    else if (k === 2 && !same(at, 0, -1, meta)) { z0 = 0.5; simple = false; }
  } else if (facing === 2) {
    z0 = 0.5;
    const k = stairAt(0, 1);
    if (k === 1 && !same(at, 1, 0, meta)) { x1 = 0.5; simple = false; }
    else if (k === 0 && !same(at, -1, 0, meta)) { x0 = 0.5; simple = false; }
  } else {
    z1 = 0.5;
    const k = stairAt(0, -1);
    if (k === 1 && !same(at, 1, 0, meta)) { x1 = 0.5; simple = false; }
    else if (k === 0 && !same(at, -1, 0, meta)) { x0 = 0.5; simple = false; }
  }
  return { box: [x0, y0, z0, x1, y1, z1], simple };
}

// func_150144_g: the inner-corner third box, or null.
function cornerBox(meta, at) {
  const facing = meta & 3, y0 = meta & 4 ? 0 : 0.5, y1 = meta & 4 ? 0.5 : 1;
  let x0 = 0, x1 = 0.5, z0 = 0.5, z1 = 1, found = false;
  const stairAt = (dx, dz) => { const m = at(dx, dz); return m >= 0 && (m & 4) === (meta & 4) ? m & 3 : -1; };
  if (facing === 0) {
    const k = stairAt(-1, 0);
    if (k === 3 && !same(at, 0, -1, meta)) { z0 = 0; z1 = 0.5; found = true; }
    else if (k === 2 && !same(at, 0, 1, meta)) { found = true; }
  } else if (facing === 1) {
    x0 = 0.5; x1 = 1;
    const k = stairAt(1, 0);
    if (k === 3 && !same(at, 0, -1, meta)) { z0 = 0; z1 = 0.5; found = true; }
    else if (k === 2 && !same(at, 0, 1, meta)) { found = true; }
  } else if (facing === 2) {
    z0 = 0; z1 = 0.5;
    const k = stairAt(0, -1);
    if (k === 1 && !same(at, -1, 0, meta)) { found = true; }
    else if (k === 0 && !same(at, 1, 0, meta)) { x0 = 0.5; x1 = 1; found = true; }
  } else {
    const k = stairAt(0, 1);
    if (k === 1 && !same(at, -1, 0, meta)) { found = true; }
    else if (k === 0 && !same(at, 1, 0, meta)) { x0 = 0.5; x1 = 1; found = true; }
  }
  return found ? [x0, y0, z0, x1, y1, z1] : null;
}

// The boxes RenderBlocks.renderBlockStairs draws and addCollisionBoxesToList collides with, in
// order: the half block (normal face culling), the second box and the optional corner box (both
// drawn with all six faces). `at` is described above.
export function stairShape(meta, at) {
  const second = secondBox(meta, at), boxes = [stairBaseBox(meta), second.box];
  if (second.simple) {
    const corner = cornerBox(meta, at);
    if (corner) boxes.push(corner);
  }
  return boxes;
}
// The same from a world (anything with get(x, y, z) and getMeta(x, y, z)).
export function stairBoxes(world, x, y, z) {
  const meta = world.getMeta(x, y, z);
  return stairShape(meta, (dx, dz) => (isStair(world.get(x + dx, y, z + dz)) ? world.getMeta(x + dx, y, z + dz) : -1));
}

// RenderBlocks.renderBlockAsItem (render type 10): the two boxes drawn for a stair in a hand or inventory slot.
export const STAIR_ITEM_BOXES = Object.freeze([[0, 0, 0, 1, 1, 0.5], [0, 0, 0.5, 1, 0.5, 1]]);

// Block.getSelectedBoundingBoxFromPool is delegated to the model block: the outline is a full cube.
export const STAIR_SELECTION = Object.freeze([0, 0, 0, 1, 1, 1]);

// BlockStairs.collisionRayTrace: the octants (bit 0 x, bit 1 y, bit 2 z, high half when set) the
// shape leaves empty, by (metadata & 3) + 4 * upside-down. Each remaining octant is ray traced as
// a Block, and the hit nearest the start wins (the largest squareDistanceTo(end) in the original).
const EXCLUDED = [[2, 6], [3, 7], [2, 3], [6, 7], [0, 4], [1, 5], [0, 1], [4, 5]];
export const stairExcludedOctants = (meta) => EXCLUDED[(meta & 3) + (meta & 4 ? 4 : 0)];
export const stairOctantBox = (i) => {
  const x = (i & 1) * 0.5, y = ((i >> 1) & 1) * 0.5, z = ((i >> 2) & 1) * 0.5;
  return [x, y, z, x + 0.5, y + 0.5, z + 0.5];
};

// Vec3.getIntermediateWithX/Y/Z (azw.b/c/d) and AxisAlignedBB.calculateIntercept.
const EPS = 1.0000000116860974e-7;
function between(a, b, axis, value) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  if (d[axis] * d[axis] < EPS) return null;
  const t = (value - a[axis]) / d[axis];
  return t >= 0 && t <= 1 ? [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t] : null;
}
const dist2 = (a, b) => (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2;
export function interceptBox([x0, y0, z0, x1, y1, z1], a, b) {
  const hits = [between(a, b, 0, x0), between(a, b, 0, x1), between(a, b, 1, y0), between(a, b, 1, y1), between(a, b, 2, z0), between(a, b, 2, z1)];
  const inYZ = (v) => v && v[1] >= y0 && v[1] <= y1 && v[2] >= z0 && v[2] <= z1,
    inXZ = (v) => v && v[0] >= x0 && v[0] <= x1 && v[2] >= z0 && v[2] <= z1,
    inXY = (v) => v && v[0] >= x0 && v[0] <= x1 && v[1] >= y0 && v[1] <= y1;
  const ok = [inYZ(hits[0]), inYZ(hits[1]), inXZ(hits[2]), inXZ(hits[3]), inXY(hits[4]), inXY(hits[5])],
    sides = [4, 5, 0, 1, 2, 3];
  let best = -1;
  for (let i = 0; i < 6; i++) if (ok[i] && (best < 0 || dist2(a, hits[i]) < dist2(a, hits[best]))) best = i;
  return best < 0 ? null : { vec: hits[best], side: sides[best] };
}
// Block.collisionRayTrace for the cell (x, y, z) with the start and end in world coordinates:
// { side, vec } with vec in world coordinates, or null. Octants are tried 0-7 as in the original.
export function stairRayTrace(meta, x, y, z, start, end) {
  const a = [start[0] - x, start[1] - y, start[2] - z], b = [end[0] - x, end[1] - y, end[2] - z],
    skip = stairExcludedOctants(meta);
  let best = null, bestDistance = -Infinity;
  for (let i = 0; i < 8; i++) {
    if (skip.includes(i)) continue;
    const hit = interceptBox(stairOctantBox(i), a, b);
    if (!hit) continue;
    const vec = [hit.vec[0] + x, hit.vec[1] + y, hit.vec[2] + z], d = dist2(vec, end);
    // The original keeps the later octant only when its distance to the end is strictly larger.
    if (d > bestDistance) { best = { side: hit.side, vec }; bestDistance = d; }
  }
  return best;
}

// onBlockPlaced (aji.a(ahb, III, I, F, F, F, I)): the lower face or the upper half of a side face
// makes the stair upside-down.
export const stairPlacedMeta = (side, hitY, meta = 0) => (side === 0 || (side !== 1 && hitY > 0.5) ? meta | 4 : meta);
// onBlockPlacedBy: floor(rotationYaw * 4 / 360 + 0.5) & 3 selects the facing, keeping bit 2.
const FACING = [2, 1, 3, 0];
export function stairFacingMeta(rotationYaw, existing = 0) {
  const quadrant = Math.floor(Math.fround(Math.fround(rotationYaw * 4) / 360) + 0.5) & 3;
  return FACING[quadrant] | (existing & 4);
}
// The app camera yaw is radians with zero facing north; Minecraft's rotationYaw is 180 - camera degrees.
export const stairRotationYaw = (cameraYaw) => Math.fround(180 - (cameraYaw * 180) / Math.PI);
export function stairPlacementMeta(cameraYaw, side, hitY) {
  return stairFacingMeta(stairRotationYaw(cameraYaw), stairPlacedMeta(side, hitY, 0));
}
