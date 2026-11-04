// BlockHopper shapes (leaf module so world.js can read them). Native facts: public/research/hopper-reference.json.
// The selection / ray box stays the full block; addCollisionBoxesToList adds the 5/8 floor and four 1/8 walls that rise
// the full block (the bowl). Block-local boxes [x0, y0, z0, x1, y1, z1].
const WALL = 0.125;
export const HOPPER_BOUNDS = Object.freeze([0, 0, 0, 1, 1, 1]);
export const HOPPER_BOXES = Object.freeze([
  Object.freeze([0, 0, 0, 1, 0.625, 1]), Object.freeze([0, 0, 0, WALL, 1, 1]), Object.freeze([0, 0, 0, 1, 1, WALL]),
  Object.freeze([1 - WALL, 0, 0, 1, 1, 1]), Object.freeze([0, 0, 1 - WALL, 1, 1, 1]),
]);
export const HOPPER_UNION = HOPPER_BOUNDS;
