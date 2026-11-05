// Leaf module for world.js: BlockSkull's block id, bounds and BLOCKS entry (the rest is skull.js).
export const SKULL = 172;
// BlockSkull.setBlockBoundsBasedOnState by metadata & 7 (default = the floor box).
const BOUNDS = { 1: [0.25, 0, 0.25, 0.75, 0.5, 0.75], 2: [0.25, 0.25, 0.5, 0.75, 0.75, 1], 3: [0.25, 0.25, 0, 0.75, 0.75, 0.5], 4: [0.5, 0.25, 0.25, 1, 0.75, 0.75], 5: [0, 0.25, 0.25, 0.5, 0.75, 0.75] };
export const skullBounds = (meta) => [...(BOUNDS[meta & 7] ?? BOUNDS[1])];
export function installSkullBlocks(blocks) { blocks[SKULL] = { name: 'Mob Head', color: '#cfcfc6', hidden: true }; }
