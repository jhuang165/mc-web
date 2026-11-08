// BlockPistonMoving.getCollisionBoundingBoxFromPool in World.getCollidingBoundingBoxes (Minecraft Java 1.7.10): every
// Entity.moveEntity caller sees the moving blocks' boxes, whatever entity system runs it. redstone-runtime.js installs the
// provider (piston-live.js collisionBoxes); entities.js (player, mobs, orbs, falling blocks, TNT), item-entities.js and
// minecarts.js / boats.js read it.
let provider = null;
export const setMovingBoxes = (fn) => { provider = fn; };
// The moving-block boxes meeting `box` ([minX, minY, minZ, maxX, maxY, maxZ]); [] without pistons.
export const movingBoxes = (box) => (provider ? provider(box) : []);
