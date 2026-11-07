// What TileEntityPiston.func_145863_a can push (Java 1.7.10): every Entity in the moving block's box is moved with
// Entity.moveEntity(delta along the facing), so walls still stop it. piston-live.js already moves the player and mobs;
// this builds the `extra` list for the other entity systems: dropped items, primed TNT, experience orbs, falling blocks,
// minecarts and boats. `game` is the runtime hook object of redstone-runtime.js (items(), primed(), orbs(), falling(),
// minecarts(), boats()). Non-living entities have stepHeight 0, so they never step up (EntityLivingBase sets 0.5).
//
//   pistonPushExtras(world, game) -> [{ box: [minX, minY, minZ, maxX, maxY, maxZ], move(dx, dy, dz) }]
import { moveEntity } from "./entities.js";

const ITEM = { half: 0.125, size: 0.25 }, TNT = { half: 0.49, size: 0.98 }, FALLING = { half: 0.49, size: 0.98 };
const CART = { width: 0.98, height: 0.7 }, BOAT = { width: 1.5, height: 0.6 }, ORB = { width: 0.5, height: 0.5 };

// Entity.moveEntity on a copy of the body, written back (entities keep their own velocity and flag fields). `y` is the box
// bottom as in every entity system here; carts, boats and orbs keep posY, which shifts by the same delta.
export function bodyMove(world, e, width, height, dx, dy, dz) {
  const tmp = { x: e.x, y: e.y, z: e.z, vx: 0, vy: 0, vz: 0, onGround: !!e.onGround };
  if (e.bb) tmp.bb = e.bb.slice();
  if (world) moveEntity(world, tmp, width, height, dx, dy, dz, 0);
  else {
    tmp.x += dx; tmp.y += dy; tmp.z += dz;
    if (tmp.bb) { tmp.bb[0] += dx; tmp.bb[3] += dx; tmp.bb[1] += dy; tmp.bb[4] += dy; tmp.bb[2] += dz; tmp.bb[5] += dz; }
  }
  if (e.posY !== undefined) e.posY += tmp.y - e.y;
  e.x = tmp.x; e.y = tmp.y; e.z = tmp.z;
  if (tmp.bb) e.bb = tmp.bb;
  return tmp;
}
const flat = (e, h, s) => [e.x - h, e.y, e.z - h, e.x + h, e.y + s, e.z + h];

export function pistonPushExtras(world, game) {
  const out = [];
  const add = (list, box, w, h) => {
    for (const e of list ?? []) if (!e.dead && !e.removed) out.push({ box: box(e), move: (dx, dy, dz) => bodyMove(world, e, w, h, dx, dy, dz) });
  };
  add(game.items?.(), (e) => flat(e, ITEM.half, ITEM.size), ITEM.size, ITEM.size);
  add(game.primed?.(), (e) => flat(e, TNT.half, TNT.size), TNT.size, TNT.size);
  add(game.falling?.(), (e) => flat(e, FALLING.half, FALLING.size), FALLING.size, FALLING.size);
  add(game.orbs?.(), (e) => e.bb ?? flat(e, 0.25, 0.5), ORB.width, ORB.height);
  const carts = game.minecarts?.();
  add(carts?.carts ?? carts?.list, (e) => e.bb, CART.width, CART.height);
  add(game.boats?.(), (e) => e.bb, BOAT.width, BOAT.height);
  return out.filter((x) => x.box && x.box.every(Number.isFinite));
}
