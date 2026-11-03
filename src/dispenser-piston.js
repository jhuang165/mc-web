// BlockDispenser (original 23), BlockPistonBase (33 normal, 29 sticky) and BlockPistonExtension (34), Minecraft Java 1.7.10.
// Static live blocks: facings from BlockPistonBase.determineOrientation, metadata bit 3 (extended / sticky head), bounds,
// icons and RenderBlocks.renderPistonBase / renderPistonExtension quads, replayed against public/research/dispenser-piston-reference.json.
// No imports (world.js and the renderers read it); internal ids are the ones reserved in world.js BLOCKS.
export const DISPENSER = 115, STICKY_PISTON = 116, PISTON = 117, PISTON_HEAD = 118;
// Tools own item ids 100-127, so these blocks carry 1000 + block id as their item ids (the piston head has no item).
export const SLIMEBALL = 460, DISPENSER_ITEM = 1115, STICKY_PISTON_ITEM = 1116, PISTON_ITEM = 1117;
export const BLOCK_FOR_ITEM = Object.freeze({ [DISPENSER_ITEM]: DISPENSER, [STICKY_PISTON_ITEM]: STICKY_PISTON, [PISTON_ITEM]: PISTON });
export const ITEM_FOR_BLOCK = Object.freeze({ [DISPENSER]: DISPENSER_ITEM, [STICKY_PISTON]: STICKY_PISTON_ITEM, [PISTON]: PISTON_ITEM });
// Original item ids -> internal item ids (POPULATION_ITEMS): slimeball 341, dispenser 23, sticky piston 29, piston 33.
export const ORIGINAL_ITEMS = Object.freeze({ 341: SLIMEBALL, 23: DISPENSER_ITEM, 29: STICKY_PISTON_ITEM, 33: PISTON_ITEM });
export const isPlaceableItem = (id) => id in BLOCK_FOR_ITEM;
export const isPistonBase = (b) => b === PISTON || b === STICKY_PISTON;
export const isDispenserPiston = (b) => b === DISPENSER || isPistonBase(b) || b === PISTON_HEAD;
// The block an item places (the item itself when it is not one of this family's).
export const blockForItem = (id) => BLOCK_FOR_ITEM[id] ?? 0;
export const itemForBlock = (b) => ITEM_FOR_BLOCK[b] ?? 0;

const fl = Math.fround;
const floor = Math.floor;
// BlockPistonBase.determineOrientation(world, x, y, z, entity): above/below the block when the entity stands within
// 2 blocks horizontally and its eye is more than 2 above / any below; otherwise the horizontal facing from the yaw
// quadrant. `y` is the feet height (EntityPlayerMP: yOffset 0); the eye adds 1.82.
export function pistonOrientation(bx, by, bz, px, py, pz, yaw) {
  if (Math.abs(fl(fl(px) - bx)) < 2 && Math.abs(fl(fl(pz) - bz)) < 2) {
    const d0 = py + 1.82;
    if (d0 - by > 2) return 1;
    if (by - d0 > 0) return 0;
  }
  const l = floor(fl(fl(fl(yaw) * 4) / 360) + 0.5) & 3;
  return l === 0 ? 2 : l === 1 ? 5 : l === 2 ? 3 : 4;
}
// The app's camera yaw (radians, zero faces north) as Minecraft's rotationYaw degrees.
export const minecraftYaw = (cameraYaw) => fl(180 - (cameraYaw * 180) / Math.PI);

export const pistonFacing = (meta) => meta & 7;
export const pistonExtended = (meta) => (meta & 8) !== 0;
// BlockPistonExtension.getDirectionMeta: facings above 5 read as 5.
export const headFacing = (meta) => Math.min(meta & 7, 5);
export const headSticky = (meta) => (meta & 8) !== 0;
// The cell of the head / base partner: the head sits one block along the base's facing.
export const FACING_OFFSETS = Object.freeze([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]);

// setBlockBoundsBasedOnState. Base: an extended base loses 4/16 on its facing side (meta 6-7 behave as facing 5).
const BASE_CUT = [[0, 0.25, 0, 1, 1, 1], [0, 0, 0, 1, 0.75, 1], [0, 0, 0.25, 1, 1, 1], [0, 0, 0, 1, 1, 0.75], [0.25, 0, 0, 1, 1, 1], [0, 0, 0, 0.75, 1, 1]];
const HEAD_PLATE = [[0, 0, 0, 1, 0.25, 1], [0, 0.75, 0, 1, 1, 1], [0, 0, 0, 1, 1, 0.25], [0, 0, 0.75, 1, 1, 1], [0, 0, 0, 0.25, 1, 1], [0.75, 0, 0, 1, 1, 1]];
// The arm box added to the plate by BlockPistonExtension.addCollisionBoxesToList (per facing).
const HEAD_ARM = [[0.375, 0.25, 0.375, 0.625, 1, 0.625], [0.375, 0, 0.375, 0.625, 0.75, 0.625], [0.25, 0.375, 0.25, 0.75, 0.625, 1],
  [0.25, 0.375, 0, 0.75, 0.625, 0.75], [0.375, 0.25, 0.25, 0.625, 0.75, 1], [0, 0.375, 0.25, 0.75, 0.625, 0.75]];
export const pistonBaseBounds = (meta) => (meta & 8 ? BASE_CUT[Math.min(meta & 7, 5)] : [0, 0, 0, 1, 1, 1]).slice();
export const pistonHeadBounds = (meta) => HEAD_PLATE[headFacing(meta)].slice();
export const pistonHeadCollision = (meta) => [HEAD_PLATE[headFacing(meta)].slice(), HEAD_ARM[headFacing(meta)].slice()];
export const dispenserPistonBounds = (id, meta) => id === PISTON_HEAD ? pistonHeadBounds(meta) : isPistonBase(id) ? pistonBaseBounds(meta) : [0, 0, 0, 1, 1, 1];
// Collision boxes of one cell (block-local); a dispenser and a retracted base are full cubes.
// Metadata 14-15 of a base (facing above 5) collides as a full cube although its bounds are cut.
export const dispenserPistonBoxes = (id, meta) => id === PISTON_HEAD ? pistonHeadCollision(meta) : [isPistonBase(id) && (meta & 7) > 5 ? [0, 0, 0, 1, 1, 1] : dispenserPistonBounds(id, meta)];
export function unionBox(boxes) {
  return [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
}

// Block.getIcon(side, meta) by native side order (-y, +y, -z, +z, -x, +x).
export function iconName(id, meta, side) {
  const f = meta & 7;
  if (id === DISPENSER) {
    if (f > 5) return side < 2 ? "furnace_top" : "furnace_side";
    if (f < 2) return side === f ? "dispenser_front_vertical" : "furnace_top";
    return side < 2 ? "furnace_top" : side === f ? "dispenser_front_horizontal" : "furnace_side";
  }
  const top = id === STICKY_PISTON ? "piston_top_sticky" : "piston_top_normal";
  if (id === PISTON_HEAD) {
    const h = headFacing(meta);
    return side === h ? (meta & 8 ? "piston_top_sticky" : "piston_top_normal") : side === (h ^ 1) ? "piston_top_normal" : "piston_side";
  }
  if (f > 5) return top;
  return side === f ? (meta & 8 ? "piston_inner" : top) : side === (f ^ 1) ? "piston_bottom" : "piston_side";
}
// The scene's face order (+x, -x, +y, -y, +z, -z) in native side indexes.
export const SIDE_OF_FACE = Object.freeze([5, 4, 1, 0, 3, 2]);
export const iconNameForFace = (id, meta, face) => iconName(id, meta, SIDE_OF_FACE[face]);

// RenderBlocks.renderPistonBase / renderPistonExtension vertices. Faces in native order with the Tessellator vertex order and
// shade (1.0 top, 0.5 bottom, 0.8 north/south, 0.6 west/east); vertex [x, y, z, u, v] with u/v the icon fraction after the
// per-facing rotation of renderFace*.
const SHADES = [0.5, 1, 0.8, 0.8, 0.6, 0.6];
const DEF = [(x, y, z) => [x, z], (x, y, z) => [x, z], (x, y, z) => [1 - x, 1 - y], (x, y, z) => [x, 1 - y], (x, y, z) => [z, 1 - y], (x, y, z) => [1 - z, 1 - y]];
const TR = [([u, v]) => [u, v], ([u, v]) => [1 - v, u], ([u, v]) => [v, 1 - u], ([u, v]) => [1 - u, 1 - v], ([u, v]) => [1 - u, v], ([u, v]) => [u, 1 - v], ([u, v]) => [v, u], ([u, v]) => [1 - v, 1 - u]];
// Rotation of each native face by facing (uvRotateTop/Bottom/East/West/South/North set per metadata).
const ROT = [[0, 0, 3, 3, 3, 3], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 7], [3, 3, 0, 0, 2, 6], [1, 1, 7, 1, 0, 0], [2, 2, 6, 2, 0, 0]];
function faceVertices(side, [x0, y0, z0, x1, y1, z1]) {
  return [
    [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
    [[x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [x0, y1, z1]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]],
    [[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]],
    [[x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
  ][side];
}
// The arm of the head: along `axis` from lo to hi, four quads from cross-section corners A -> B (cross coordinates in axis order).
const ARM_QUADS = {
  y: [[[0.375, 0.625], [0.625, 0.625], 0.8], [[0.625, 0.375], [0.375, 0.375], 0.8], [[0.375, 0.375], [0.375, 0.625], 0.6], [[0.625, 0.625], [0.625, 0.375], 0.6]],
  z: [[[0.375, 0.625], [0.375, 0.375], 0.6], [[0.625, 0.375], [0.625, 0.625], 0.6], [[0.375, 0.375], [0.625, 0.375], 0.5], [[0.625, 0.625], [0.375, 0.625], 1]],
  x: [[[0.375, 0.625], [0.375, 0.375], 0.5], [[0.625, 0.375], [0.625, 0.625], 1], [[0.375, 0.375], [0.625, 0.375], 0.6], [[0.625, 0.625], [0.375, 0.625], 0.6]],
};
const ARM_AXIS = ["y", "y", "z", "z", "x", "x"];
// Each quad: { icon, shade, verts: [[x, y, z, u, v] x4] }; the head adds its four arm quads (piston_side) to the plate.
export function pistonQuads(id, meta) {
  if (id !== PISTON && id !== STICKY_PISTON && id !== PISTON_HEAD) return [];
  const head = id === PISTON_HEAD, k = head ? headFacing(meta) : meta & 7,
    bounds = !head && k > 5 ? [0, 0, 0, 1, 1, 1] : dispenserPistonBounds(id, meta), quads = [];
  for (let side = 0; side < 6; side++) {
    const t = TR[!head && k > 5 ? 0 : ROT[k][side]];
    quads.push({ icon: iconName(id, meta, side), shade: SHADES[side], verts: faceVertices(side, bounds).map(([x, y, z]) => [x, y, z, ...t(DEF[side](x, y, z))]) });
  }
  if (head) {
    const axis = ARM_AXIS[k], lo = k & 1 ? -0.25 : 0.25, hi = lo + 1;
    for (const [a, b, shade] of ARM_QUADS[axis]) {
      const at = (c, along) => axis === "y" ? [c[0], along, c[1]] : axis === "z" ? [c[0], c[1], along] : [along, c[0], c[1]];
      quads.push({ icon: "piston_side", shade, verts: [[...at(a, hi), 1, 0], [...at(a, lo), 0, 0], [...at(b, lo), 0, 0.25], [...at(b, hi), 1, 0.25]] });
    }
  }
  return quads;
}
// The head cell's base: the neighbour opposite its facing, and the base's cell for the head.
export const baseOfHead = (x, y, z, meta) => { const o = FACING_OFFSETS[headFacing(meta)]; return [x - o[0], y - o[1], z - o[2]]; };
export const headOfBase = (x, y, z, meta) => { const o = FACING_OFFSETS[Math.min(meta & 7, 5)]; return [x + o[0], y + o[1], z + o[2]]; };
// Static consistency: a base with bit 3 should have its head one block along the facing, and a head its base behind it.
// BlockPistonExtension.breakBlock: breaking the head removes the base behind it when that is a piston of the matching
// kind with the same facing; the base drops itself in Survival (harvest). BlockPistonBase has no counterpart for the head
// when broken first: the unpowered, extended base retracts, which is inert here, so its head is removed with it.
export const headBaseId = (meta) => (meta & 8 ? STICKY_PISTON : PISTON);
