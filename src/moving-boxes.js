// BlockPistonMoving.getCollisionBoundingBoxFromPool in World.getCollidingBoundingBoxes (Minecraft Java 1.7.10): every
// Entity.moveEntity caller sees the moving blocks' boxes, whatever entity system runs it. redstone-runtime.js installs the
// provider (piston-live.js collisionBoxes); entities.js (player, mobs, orbs, falling blocks, TNT), item-entities.js and
// minecarts.js / boats.js read it.
let provider = null;
export const setMovingBoxes = (fn) => { provider = fn; };
// The moving-block boxes meeting `box` ([minX, minY, minZ, maxX, maxY, maxZ]); [] without pistons.
// b67 pistons4: a dedicated server runs several worlds (Overworld, Nether, End), each with its own moving blocks, so a per-world provider (keyed by the
// World the caller passes) takes precedence over the single global one. Single player never registers one.
const byWorld = new WeakMap();
export const setWorldMovingBoxes = (world, fn) => { if (fn) byWorld.set(world, fn); else byWorld.delete(world); };
export const movingBoxes = (box, world) => { const own = world && byWorld.get(world); return own ? own(box) : provider ? provider(box) : []; };
