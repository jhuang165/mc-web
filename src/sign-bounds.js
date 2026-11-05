// BlockSign.setBlockBoundsBasedOnState (ank), from public/research/sign-reference.json "shape" records: a standing
// sign's post is 0.25..0.75 in x and z and 1 high; a wall sign is a 0.5 high slab on the wall named by its metadata.
// No bounds are used for collision: BlockSign.getCollisionBoundingBoxFromPool is null.
export const SIGN_POST_BOUNDS = Object.freeze([0.25, 0, 0.25, 0.75, 1, 0.75]);
export const WALL_SIGN_BOUNDS = Object.freeze({
  2: Object.freeze([0, 0.28125, 0.875, 1, 0.78125, 1]),
  3: Object.freeze([0, 0.28125, 0, 1, 0.78125, 0.125]),
  4: Object.freeze([0.875, 0.28125, 0, 1, 0.78125, 1]),
  5: Object.freeze([0, 0.28125, 0, 0.125, 0.78125, 1]),
});
// Wall metadata other than 2-5 leaves the default unit cube (such a sign pops on its first neighbour update).
export const signBounds = (block, meta) => [...(block === 176 ? WALL_SIGN_BOUNDS[meta & 15] ?? [0, 0, 0, 1, 1, 1] : SIGN_POST_BOUNDS)];
