// What TileEntityPiston.func_145863_a can push (Java 1.7.10): every Entity in the moving block's box is moved with
// Entity.moveEntity(delta along the facing). No entity class of 1.7.10 overrides moveEntity (javap: sv, yz, blk, bjk, wo, xl,
// xi, xk), so the push is the entity's own move with its own fields: living entities step 0.5 (stepHeight), a sneaking
// player on the ground keeps to the edge, ySize decays by 0.4, blocked axes zero the motion, onGround / isCollidedHorizontally
// / fallDistance are rewritten, and the move tail (webs, soul sand, cactus, detector rails) runs. Non-living entities have
// stepHeight 0, so they never step up.
//
//   pushPlayer(world, player, dx, dy, dz)        the player's state through entities.js moveEntity (as movePlayer builds it)
//   pistonPushExtras(world, game) -> [{ box, move(dx, dy, dz) }]   dropped items, primed TNT, experience orbs, falling blocks
//                                    and minecarts / boats, each through its own move
// `game` is the runtime hook object of redstone-runtime.js (items(), itemSystem(), primed(), orbs(), orbSystem(), falling(),
// minecarts(), boatSystem(), boats(), player(), mobs()).
import { moveEntity } from "./entities.js";

const ITEM = { half: 0.125, size: 0.25 }, TNT = { half: 0.49, size: 0.98 }, FALLING = { half: 0.49, size: 0.98 };
const CART = { width: 0.98, height: 0.7 }, BOAT = { width: 1.5, height: 0.6 }, ORB = { width: 0.5, height: 0.5 };

// Entity.moveEntity on a copy of the body, written back (entities keep their own velocity and flag fields): the fallback for an
// entity without its system's move. `y` is the box bottom as in every entity system here; orbs keep posY, which shifts by the
// same delta.
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
// { position, velocity?, motion?, onGround, collidedH, fallDistance, flying, inWater, vehicle, width, height, land?, tail? }
// (setters for the flags); without `world` the delta is applied as is. Returns the landing fall distance (0 when none).
// The move's tail runs as in the player's own moveEntity: `player.tail(body)` (player-environment.js playerMoveTail) gives the
// fire counter and the hooks (cactus and fire hurt, wetness, fire resistance, fizz) and writes the counter back; a landing
// (updateFallState on the ground) calls `player.land(distance)` (player-environment.js landPlayer: trampling, fall sound, damage).
export function pushPlayer(world, player, dx, dy, dz) {
  const pos = player.position ?? player, vel = player.velocity, motion = player.motion;
  const body = {
    x: pos.x, y: pos.y, z: pos.z, vx: vel?.x ?? 0, vy: vel?.y ?? 0, vz: vel?.z ?? 0,
    onGround: !!player.onGround, sneaking: !!motion?.sneaking, fallDistance: player.flying ? 0 : player.fallDistance ?? 0,
    inWater: !!player.inWater, living: true, inWeb: !!motion?.inWeb, vehicle: player.vehicle ?? null,
  };
  if (typeof motion?.ySize === "number") body.ySize = motion.ySize;
  let landed = 0;
  const tail = world ? player.tail?.(body) : null;
  if (tail) body.fire = tail.fire;
  if (world) landed = moveEntity(world, body, player.width ?? 0.6, player.height ?? 1.8, dx, dy, dz, undefined, tail?.hooks);
  else { body.x += dx; body.y += dy; body.z += dz; }
  tail?.finish(body);
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
    // Entity.setSize takes floats: the box half-width is (float) width / 2.
    const pos = p.position ?? p, w = Math.fround(p.width ?? 0.6), h = Math.fround(p.height ?? 1.8);
    out.push({ x: pos.x, y: pos.y, z: pos.z, bb: [pos.x - w / 2, pos.y, pos.z - w / 2, pos.x + w / 2, pos.y + h, pos.z + w / 2], ref: p.rider ?? null });
  }
  const mobs = game.mobs?.();
  for (const e of mobs?.entities ?? []) {
    if (!(e.health > 0 || (e.death ?? 0) < 20) || !mobs.size) continue;
    const [w, h] = mobs.size(e).map(Math.fround);
    out.push({ bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2], ref: e });
  }
  return out;
}

// Dropped items, primed TNT, falling blocks and orbs move through their own Entity.moveEntity (none of EntityItem, EntityTNTPrimed,
// EntityFallingBlock, EntityXPOrb overrides it): the item system's move with the item's noClip and inWater (ItemEntities.push),
// the orb system's move with its hurt / wet / fizz tail (ExperienceOrbs.move), and entities.js moveEntity on the TNT and falling
// block themselves (stepHeight 0, no hurt tail). Written to the entity: position, blocked-axis motion, onGround, isCollidedHorizontally,
// fallDistance, the web flag. Without the systems (`game.itemSystem` / `game.orbSystem`) or a world, the body copy (bodyMove) is used.
export function pistonPushExtras(world, game) {
  const out = [];
  const add = (list, box, w, h, own) => {
    for (const e of list ?? []) if (!e.dead && !e.removed) out.push({ box: box(e), entity: e, now: () => box(e), move: world && own ? (dx, dy, dz) => own(e, dx, dy, dz) : (dx, dy, dz) => bodyMove(world, e, w, h, dx, dy, dz) });
  };
  const itemSystem = game.itemSystem?.(), orbSystem = game.orbSystem?.();
  add(game.items?.() ?? itemSystem?.items, (e) => flat(e, ITEM.half, ITEM.size), ITEM.size, ITEM.size, itemSystem?.push && ((e, dx, dy, dz) => itemSystem.push(world, e, dx, dy, dz)));
  const direct = (size) => (e, dx, dy, dz) => { if (!e.dead) moveEntity(world, e, size, size, dx, dy, dz, 0); };
  add(game.primed?.(), (e) => flat(e, TNT.half, TNT.size), TNT.size, TNT.size, direct(TNT.size));
  add(game.falling?.(), (e) => flat(e, FALLING.half, FALLING.size), FALLING.size, FALLING.size, direct(FALLING.size));
  add(game.orbs?.() ?? orbSystem?.orbs, (e) => e.bb ?? flat(e, 0.25, 0.5), ORB.width, ORB.height, orbSystem?.move && ((e, dx, dy, dz) => { if (!e.dead) orbSystem.move(world, e, dx, dy, dz); }));
  // Minecarts and boats move with their own Entity.moveEntity port (Minecarts.move / Boats.move): blocked by the other carts
  // (boats) and the pushable entities, flags, fall state (a boat's crash), block hurts and, for carts, detector rails.
  // World.getCollidingBoundingBoxes adds mover.getCollisionBox(other) and other.getBoundingBox() for each entity in range
  // (javap): EntityBoat.getCollisionBox returns any entity's box and its getBoundingBox its own; EntityMinecart.getCollisionBox
  // returns the box of a canBePushed entity (carts, boats, living) and its getBoundingBox null. So a pushed cart is blocked by
  // carts, boats, the player and mobs; a pushed boat also by dropped items, primed TNT, orbs and falling blocks.
  const carts = game.minecarts?.(), boats = game.boatSystem?.();
  const cartList = carts?.carts ?? carts?.list ?? (Array.isArray(carts) ? carts : null), boatList = boats?.carts ?? game.boats?.();
  // Boxes are read when the vehicle moves (an entity pushed earlier in the same call has moved).
  const loose = out.slice();
  const looseBoxes = () => loose.filter((x) => !x.entity.dead && !x.entity.removed).map((x) => ({ bb: x.now(), ref: x.entity }));
  const others = (boat) => [...(cartList ?? []), ...(boatList ?? []), ...vehicleBlockers(game), ...(boat ? looseBoxes() : [])];
  const vehicles = (system, list, w, h, boat) => {
    if (!system?.move || !world) return add(list, (e) => e.bb, w, h);
    for (const e of list ?? []) if (!e.dead && e.bb) out.push({ box: e.bb, entity: e, move: (dx, dy, dz) => { if (!e.dead) system.move(world, e, dx, dy, dz, others(boat)); } });
  };
  vehicles(carts?.move ? carts : null, cartList, CART.width, CART.height, false);
  vehicles(boats, boatList, BOAT.width, BOAT.height, true);
  return out.filter((x) => x.box && x.box.every(Number.isFinite));
}
