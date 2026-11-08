// What TileEntityPiston.func_145863_a can push (Java 1.7.10): every Entity in the moving block's box is moved with
// Entity.moveEntity(delta along the facing). No entity class of 1.7.10 overrides moveEntity (javap: sv, yz, blk, bjk, wo, xl,
// xi, xk), so the push is the entity's own move with its own fields: living entities step 0.5 (stepHeight), a sneaking
// player on the ground keeps to the edge, ySize decays by 0.4, blocked axes zero the motion, onGround / isCollidedHorizontally
// / fallDistance are rewritten, and the move tail (webs, soul sand, cactus, detector rails) runs. Non-living entities have
// stepHeight 0, so they never step up.
//
//   pushPlayer(world, player, dx, dy, dz)        the player's state through entities.js moveEntity (as movePlayer builds it)
//   pistonPushExtras(world, game) -> [{ box, move(dx, dy, dz) }]   dropped items, primed TNT, experience orbs, falling blocks
//                                    (body copy through moveEntity), minecarts and boats (their own Minecarts.move / Boats.move)
// `game` is the runtime hook object of redstone-runtime.js (items(), primed(), orbs(), falling(), minecarts(), boatSystem(),
// boats(), player(), mobs()).
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

// The player pushed through Entity.moveEntity with its own state, the body movePlayer (player-physics.js) gives moveEntity:
// motion, onGround, sneaking (the sneak edge applies: a sneaking player on the ground is not pushed off an edge), ySize,
// fallDistance (unchanged while flying), isInWeb and inWater. Written back: position, motion (zeroed on blocked axes, soul sand
// x 0.4), onGround, collidedH, fallDistance, ySize and the web flag. `player` is the runtime adapter
// { position, velocity?, motion?, onGround, collidedH, fallDistance, flying, inWater, vehicle, width, height, land?(distance) }
// (setters for the flags); without `world` the delta is applied as is. Returns the landing fall distance (0 when none).
export function pushPlayer(world, player, dx, dy, dz) {
  const pos = player.position ?? player, vel = player.velocity, motion = player.motion;
  const body = {
    x: pos.x, y: pos.y, z: pos.z, vx: vel?.x ?? 0, vy: vel?.y ?? 0, vz: vel?.z ?? 0,
    onGround: !!player.onGround, sneaking: !!motion?.sneaking, fallDistance: player.flying ? 0 : player.fallDistance ?? 0,
    inWater: !!player.inWater, living: true, inWeb: !!motion?.inWeb, vehicle: player.vehicle ?? null,
  };
  if (typeof motion?.ySize === "number") body.ySize = motion.ySize;
  let landed = 0;
  if (world) landed = moveEntity(world, body, player.width ?? 0.6, player.height ?? 1.8, dx, dy, dz);
  else { body.x += dx; body.y += dy; body.z += dz; }
  pos.x = body.x; pos.y = body.y; pos.z = body.z;
  if (!world) return 0;
  if (vel) { vel.x = body.vx; vel.y = body.vy; vel.z = body.vz; }
  if ("onGround" in player) player.onGround = body.onGround;
  if ("collidedH" in player) player.collidedH = body.collidedH;
  if (!player.flying && "fallDistance" in player) player.fallDistance = body.fallDistance;
  if (motion) {
    if (body.ySize !== undefined) motion.ySize = body.ySize;
    motion.inWeb = !!body.inWeb;
  }
  if (landed > 0) player.land?.(landed);
  return landed;
}

// The pushable entities a cart or boat move is blocked by, as structure-simulation.js tickMinecartSimulation builds them
// (EntityMinecart / EntityBoat getCollisionBox): the player (its rider identity keeps its own vehicle out) and living mobs.
function vehicleBlockers(game) {
  const out = [], p = game.player?.();
  if (p && p.alive !== false) {
    const pos = p.position ?? p, w = p.width ?? 0.6, h = p.height ?? 1.8;
    out.push({ x: pos.x, y: pos.y, z: pos.z, bb: [pos.x - w / 2, pos.y, pos.z - w / 2, pos.x + w / 2, pos.y + h, pos.z + w / 2], ref: p.rider ?? null });
  }
  const mobs = game.mobs?.();
  for (const e of mobs?.entities ?? []) {
    if (!(e.health > 0 || (e.death ?? 0) < 20) || !mobs.size) continue;
    const [w, h] = mobs.size(e);
    out.push({ bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2], ref: e });
  }
  return out;
}

export function pistonPushExtras(world, game) {
  const out = [];
  const add = (list, box, w, h) => {
    for (const e of list ?? []) if (!e.dead && !e.removed) out.push({ box: box(e), move: (dx, dy, dz) => bodyMove(world, e, w, h, dx, dy, dz) });
  };
  add(game.items?.(), (e) => flat(e, ITEM.half, ITEM.size), ITEM.size, ITEM.size);
  add(game.primed?.(), (e) => flat(e, TNT.half, TNT.size), TNT.size, TNT.size);
  add(game.falling?.(), (e) => flat(e, FALLING.half, FALLING.size), FALLING.size, FALLING.size);
  add(game.orbs?.(), (e) => e.bb ?? flat(e, 0.25, 0.5), ORB.width, ORB.height);
  // Minecarts and boats move with their own Entity.moveEntity port (Minecarts.move / Boats.move): blocked by the other carts
  // (boats) and the pushable entities, flags, fall state (a boat's crash), block hurts and, for carts, detector rails.
  let blockers = null;
  const others = (system) => [...system.carts, ...(blockers ??= vehicleBlockers(game))];
  const vehicles = (system, list, w, h) => {
    if (!system?.move || !world) return add(list, (e) => e.bb, w, h);
    for (const e of list ?? []) if (!e.dead && e.bb) out.push({ box: e.bb, move: (dx, dy, dz) => { if (!e.dead) system.move(world, e, dx, dy, dz, others(system)); } });
  };
  const carts = game.minecarts?.();
  vehicles(carts?.move ? carts : null, carts?.carts ?? carts?.list ?? (Array.isArray(carts) ? carts : null), CART.width, CART.height);
  const boats = game.boatSystem?.();
  vehicles(boats, boats?.carts ?? game.boats?.(), BOAT.width, BOAT.height);
  return out.filter((x) => x.box && x.box.every(Number.isFinite));
}
