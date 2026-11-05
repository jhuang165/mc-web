// EntityDragon.createEnderPortal (xa.b(II)V), 1.7.10: the exit portal structure the dying dragon builds,
// as a pure ordered block list. Original numeric IDs (bedrock 7, torch 50, end portal 119, dragon egg 122).
// Evidence: public/research/end-reference.json "exitPortal" (the full setBlock call list at three centres).
export const EXIT_PORTAL_BASE_Y = 64, EXIT_PORTAL_RADIUS = 4;
const AIR = 0, BEDROCK = 7, TORCH = 50, END_PORTAL = 119, DRAGON_EGG = 122;

// Calls in the original order: y 63..96, then x, then z over the square of side 9 (cells within a disc
// of radius 4 only). Below the base the disc of radius 3 is bedrock; above it air; on the base level the
// inner disc is the portal and the ring is bedrock. Then the pillar: bedrock x3, torches on four sides at
// +2, bedrock at +3, the dragon egg at +4.
export function exitPortalBlocks(centerX, centerZ, baseY = EXIT_PORTAL_BASE_Y) {
  const out = [], r = EXIT_PORTAL_RADIUS, outer = (r - 0.5) * (r - 0.5), inner = (r - 1 - 0.5) * (r - 1 - 0.5);
  for (let y = baseY - 1; y <= baseY + 32; y++) {
    for (let x = centerX - r; x <= centerX + r; x++) {
      for (let z = centerZ - r; z <= centerZ + r; z++) {
        const dx = x - centerX, dz = z - centerZ, d = dx * dx + dz * dz;
        if (d > outer) continue;
        if (y < baseY) { if (d <= inner) out.push([x, y, z, BEDROCK]); }
        else if (y > baseY) out.push([x, y, z, AIR]);
        else out.push([x, y, z, d > inner ? BEDROCK : END_PORTAL]);
      }
    }
  }
  out.push([centerX, baseY, centerZ, BEDROCK], [centerX, baseY + 1, centerZ, BEDROCK], [centerX, baseY + 2, centerZ, BEDROCK],
    [centerX - 1, baseY + 2, centerZ, TORCH], [centerX + 1, baseY + 2, centerZ, TORCH], [centerX, baseY + 2, centerZ - 1, TORCH], [centerX, baseY + 2, centerZ + 1, TORCH],
    [centerX, baseY + 3, centerZ, BEDROCK], [centerX, baseY + 4, centerZ, DRAGON_EGG]);
  return out;
}

// Applies the list with World.setBlock(x, y, z, block) (metadata 0, flags 3). The original raises the static
// BlockEndPortal flag around the whole build so the portal blocks do not remove themselves outside the
// Overworld; `around` receives (true) before and (false) after for adapters that model it.
// BlockTorch.onBlockAdded later picks each torch's facing; that is the caller's block callback.
export function createExitPortal(world, centerX, centerZ, around = null, baseY = EXIT_PORTAL_BASE_Y) {
  around?.(true);
  for (const [x, y, z, id] of exitPortalBlocks(centerX, centerZ, baseY)) world.setBlock(x, y, z, id, 0, 3);
  around?.(false);
}
