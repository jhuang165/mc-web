// BlockAnvil (original block 145), Minecraft Java 1.7.10.
// The component bounds and metadata are copied from the native BlockAnvil and
// RenderBlocks.renderBlockAnvilOrient/Rotate implementations.
export const anvilDamage = (meta) => (meta & 15) >> 2;
export const anvilFacing = (meta) => meta & 3;
export const anvilDropDamage = (meta) => (meta & 15) >> 2;

// EntityFallingBlock.fall(float): the argument is accumulated FallDistance;
// returns the native entity-damage amount and anvil state after impact.
export function anvilImpact(meta, fallDistance, random) {
  const i = Math.ceil(fallDistance - 1);
  if (i <= 0) return { distance: i, damage: 0, meta: meta & 15, broken: false };
  const damage = Math.min(Math.floor(i * 2), 40);
  if (random.nextFloat() < 0.05000000074505806 + i * 0.05) {
    const stage = (meta >> 2) + 1;
    if (stage > 2) return { distance: i, damage, meta: meta & 15, broken: true };
    meta = (meta & 3) | (stage << 2);
  }
  return { distance: i, damage, meta: meta & 15, broken: false };
}

// ItemAnvil placement receives Minecraft rotationYaw (float degrees). The app
// camera yaw is radians and zero faces north; Minecraft yaw is 180° - camera.
export function anvilPlacementMeta(yaw, damage = 0) {
  const rotationYaw = Math.fround(180 - (yaw * 180) / Math.PI),
    quadrant = Math.floor(Math.fround(Math.fround(rotationYaw * 4) / 360) + 0.5) & 3,
    facing = (quadrant + 2) & 3;
  return ((damage & 3) << 2) | facing;
}

// RenderBlocks draws four overlapping cuboids; each tuple is [center width,
// starting Y, height, center length]. For east/west metadata, X and Z exchange.
const SHAPES = Object.freeze([
  [0.75, 0, 0.25, 0.75],
  [0.5, 0.25, 0.0625, 0.625],
  [0.25, 0.3125, 0.3125, 0.5],
  [0.625, 0.625, 0.375, 1],
]);
export function anvilModelBoxes(meta, x = 0, y = 0, z = 0) {
  const swap = anvilFacing(meta) === 1 || anvilFacing(meta) === 3;
  return SHAPES.map(([w, y0, h, d]) => {
    if (swap) [w, d] = [d, w];
    return [x + 0.5 - w / 2, y + y0, z + 0.5 - d / 2, x + 0.5 + w / 2, y + y0 + h, z + 0.5 + d / 2];
  });
}
