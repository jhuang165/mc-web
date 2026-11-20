// b85 mppredict85: the multiplayer client's own half of an item use that is not an onItemUse on a block. Natively PlayerControllerMP.sendUseItem (bje.a(yz, ahb, add))
// calls ItemStack.useItemRightClick on the CLIENT world too, after rightClickMouse found no block use (onPlayerRightClick false) and no entity interaction; the item's
// onItemRightClick then changes the client world and the client stack at once, and the server's C08 255 handling repeats it. Bytecode-read per class (1.7.10 jar):
//   ItemLilyPad (aej)      trace, canMineBlock (true on the client: ahb.a(yz,III) is iconst_1), canPlayerEdit, water meta 0 with air above: setBlock, --stack unless creative. No isRemote guard.
//   ItemBucket (abo)       no isRemote guard: an empty one removes the source and swaps/gives the filled bucket, a full one places (client-prediction.js dryBucketUse / heldPlan).
//   ItemGlassBottle (abl)  no isRemote guard and NO creative test: a traced water cell takes one bottle; a lone one becomes the water bottle (a(Ladd) -> new ItemStack(potion)),
//                          else the potion goes to the inventory or is dropped. The world is untouched.
//   ItemBoat (abj)         the spawn is inside `if (!world.isRemote)`, the decrement (unless creative) is not: a client with no entity or block blocking the boat's box loses one.
//   ItemSnowball / ItemEgg / ItemExpBottle (aed, ack, acp) and ItemPotion splash (adp): --stack unless creative, then the sound, and only the spawn is `!isRemote`.
//   ItemEnderPearl (aco)   creative returns before everything; otherwise as the snowball.
//   Nothing on the client: ItemEnderEye (acn, decrement and spawn both inside !isRemote), ItemMonsterPlacer (aee returns at once on a client), ItemFishingRod (acv, swing only; the hook
//   is !isRemote), ItemBow / ItemFood / drinkable potions (start the use animation only, client-use-predict.js), written books (screen only, b66).
// b86 predict86 (bytecode-read unless marked):
//   ItemEmptyMap (acl) has no guard and NO creative test: a new map "map_<id>" with id = ahb.b("map") on the CLIENT world. WorldClient's storage is NetHandlerPlayClient.a
//                          (bjb.<init>: new azq(null), bjf.<init> copies it), so azq.a(String) counts in memory from 0 per connection (idcounts is never read or written),
//                          and azq.a(String, ayl) replaces the client's own copy of that id (a server map the client was sent under the same id is blanked until S34 rows
//                          refill it). Scale 0, centre Math.round(posX / 128) * 128, the client world's dimension; --stack, a lone map becomes the filled one, else the
//                          filled map goes to the inventory. The server's S2F / S30 then replaces the client's id with the server's.
//   Overflow (abl, abo, acl): with no room, yz.a(add, false) builds the EntityItem and calls yz.a(xk) (joinEntityItemWithWorld), which EntityClientPlayerMP (bjk) overrides with a
//                          bare `return`: the client spawns no item entity, only the held stack and the slots change (InventoryPlayer.addItemStackToInventory, yx.a(add)).
//   ItemBoat (abj)         ray from posY + 1.62 - yOffset (the client's yOffset is 1.62, so feet - ySize + 1.62; never the sneak or camera eye) along MathHelper sin/cos of the
//                          rotation, rayTraceBlocks(liquids); then every entity in boundingBox.addCoord(look * 5).expand(1, 1, 1) with canBeCollidedWith (sa.R) whose box,
//                          grown by getCollisionBorderSize (sa.af: 0.1, EntityFireball ze 1.0), holds the ray START refuses; then getCollidingBoundingBoxes(boat, box - 0.1):
//                          blocks plus EVERY entity's box (EntityBoat.h(sa) returns the other entity's boundingBox), the player's own included.
//   ItemArmor (abb)        no guard, no creative test: an empty armour slot takes a copy and the held stack goes to size 0 (sendUseItem clears the slot).
//   Nothing on the client: ItemCarrotOnAStick (abp: the pig's EntityAIControlledByPlayer never runs there, sv.br() = !isRemote gates the AI, so ub.h() stays false) and the fishing
//                          rod's reel (xe.e() returns 0 on a client world, so damageItem(0)).
// The server's S2F (applySlots) sets the absolute stack, so the client's change and the server's equal change never add up.
import { ITEMS } from './survival.js';
import { LILY_PAD, WATER } from './world.js';
import { traceBucket } from './buckets.js';
import { lilyPadCell } from './lily-use.js';
import { dryBucketUse, tracedBucket, heldPlan } from './client-prediction.js';
import { Boats, BOAT_ITEM } from './boats.js';
import { ITEM_GLASS_BOTTLE, ITEM_POTION, isSplashDamage } from './potions.js';
import { isThrowable } from './player-throw-simulation.js';
import { ITEM_EXP_BOTTLE } from './spawn-eggs.js';
import { ITEM_EMPTY_MAP, ITEM_FILLED_MAP, createEmptyMapData } from './maps.js';
import { mhSin, mhCos } from './fishing-line.js';
import { mobBox } from './mob-spawner.js';
import { TNT_SIZE } from './explosion.js';
import { remotePlayerBox } from './multiplayer/client-placement-entities.js';
import { crystalBox, BOAT_ENTITY_SIZES } from './boat-place-entities.js'; // b87 boatcheck87
import { dragonListed } from './dragon-part-query.js';

const f = Math.fround, RAD = f(0.017453292), PI = f(3.1415927), Y_OFFSET = f(1.62);

// { cells: [{ x, y, z, block, meta }], plan: heldPlan-style change or null }. `state`: { world, survival, held, eye, dir, yaw, playerBox, blocked(box) }.
export function clientUseItem(state) {
  const { world, survival, held, eye, dir } = state, id = held?.id ?? 0, creative = !!survival?.creative, none = { cells: [], plan: null };
  if (!id || !(held.count > 0) || !eye || !dir) return none;
  if (id === LILY_PAD) {
    const cell = lilyPadCell(world, eye, dir);
    return cell ? { cells: [{ x: cell[0], y: cell[1], z: cell[2], block: LILY_PAD, meta: 0 }], plan: creative ? null : { dCount: -1 } } : none;
  }
  if (tracedBucket(id)) {
    const out = dryBucketUse({ world, heldId: id }, eye, dir);
    return { cells: out.cells, plan: heldPlan({ kind: 'bucket', stack: held, creative, placed: out.used, took: out.took }), fizz: out.fizz };
  }
  if (id === ITEM_GLASS_BOTTLE) {
    const hit = traceBucket(world, eye, dir, true);
    if (!hit || world.get(...hit.block) !== WATER) return none;
    return { cells: [], plan: held.count === 1 ? { dCount: 0, swap: [id, ITEM_POTION] } : { dCount: -1, give: ITEM_POTION } }; // no creative test (abl)
  }
  if (id === BOAT_ITEM) return { cells: [], plan: clientBoatFits(state) && !creative ? { dCount: -1 } : null };
  if (id === ITEM_EMPTY_MAP && state.maps && state.position) { // acl: the client's own map (see above); Creative too
    const data = createEmptyMapData(state.maps, { x: state.position.x, z: state.position.z, dimension: state.dimension ?? 0 });
    return { cells: [], plan: held.count === 1 ? { dCount: 0, swap: [id, ITEM_FILLED_MAP], swapDamage: data.id } : { dCount: -1, give: ITEM_FILLED_MAP, giveDamage: data.id }, map: data };
  }
  const armor = ITEMS[id]?.armor;
  if (armor !== undefined) { // abb: the slot is 39 - armour type (helmet 0 .. boots 3); Creative too
    const slot = 39 - armor;
    return { cells: [], plan: survival?.inventory?.getStack(slot) ? null : { dCount: -held.count, equip: slot } };
  }
  const throws = isThrowable(id) || id === ITEM_EXP_BOTTLE || (id === ITEM_POTION && isSplashDamage(held.damage | 0));
  return { cells: [], plan: throws && !creative ? { dCount: -1 } : null };
}

// ItemBoat's own ray (abj.a): start (posX, posY + 1.62 - yOffset, posZ), direction from MathHelper.sin / cos of the tick rotation (partial 1.0). `position` is the box bottom,
// `ySize` the step smoothing (posY = minY + yOffset - ySize), `mcYaw` / `mcPitch` Minecraft degrees.
export function boatRay(position, ySize, mcYaw, mcPitch) {
  const yawA = f(f(f(-mcYaw) * RAD) - PI), pitchA = f(f(-mcPitch) * RAD), cy = mhCos(yawA), sy = mhSin(yawA), cp = f(-mhCos(pitchA)), sp = mhSin(pitchA);
  return { eye: [position.x, position.y + Y_OFFSET - (ySize ?? 0) + 1.62 - Y_OFFSET, position.z], dir: [f(sy * cp), sp, f(cy * cp)] };
}

// Whether ItemBoat.onItemRightClick reaches its decrement on the client world. `state`: { world, position, ySize, mcYaw, mcPitch, yaw (boat yaw: Minecraft degrees), playerBox,
// entities: clientEntityBoxes(...) }. Without position / mcYaw the caller's eye / dir are used.
// b87 boatcheck87: the sight test is Boats.place's, against the START rayTraceBlocks leaves (the entry point of the last cell it visited: World.rayTraceBlocks moves its first
// vector, bytecode-read ahb.a(azw, azw, Z, Z, Z) putfield azw.a/b/c; executed, boat-reference.json `sight` records), not the ray's eye.
export function clientBoatFits(state) {
  const ray = state.position && Number.isFinite(state.mcYaw) ? boatRay(state.position, state.ySize, state.mcYaw, state.mcPitch ?? 0) : { eye: state.eye, dir: state.dir };
  if (!ray.eye || !ray.dir) return false;
  const box = state.playerBox, list = state.entities ?? [];
  return !!new Boats().place(state.world, { eye: ray.eye, dir: ray.dir, yaw: state.yaw ?? 0, box }, [...(box ? [{ bb: box }] : []), ...list], list);
}

// The client world's entity copies as boxes for the boat checks: { bb, collide (canBeCollidedWith), border, listed }. canBeCollidedWith and the box sizes are executed per kind
// (b87 boatcheck87: tools/probes/BoatEntityProbe.java, boat-entity-reference.json; see boat-place-entities.js): EntityLivingBase (sv) and the boat, minecart, falling block and
// primed TNT (xi, xl, xj, xw) while not dead, EntityHanging (ss), EntityDragonPart (wy), EntityEnderCrystal (wz) and EntityFireball (ze, border 1.0) always; EntityDragon (xa),
// the small fireball and wither skull (zi, zp) and every other entity (items, orbs, arrows, throwables, rockets, eyes, hooks) never. Wire rows (port-read y conventions,
// matching the native boxes): items 0.25 and orbs 0.5 from their box bottom (posY - 0.125 / - 0.25), arrows 0.5, throwables / rockets / eyes / hooks 0.25, fireball 1.0,
// small fireball and skull 0.3125 from posY (yOffset 0), primed TNT and falling blocks 0.98 from their box bottom (posY - 0.49), an ender crystal copy (posY, yOffset 1)
// [y - 1, y + 1], the dragon's body (not collidable) and its parts (collidable), both only while the body is listed (dragon-part-query.js).
const BALL = { fireball: 1, smallFireball: 0.3125, witherSkull: 0.3125 };
const cube = (x, y, z, s) => [x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2];
export function clientEntityBoxes({ players, mobs, vehicles, primed = [], items = [], orbs = [], arrows = [], balls = [], hooks = [], falling = [] } = {}) {
  const out = [];
  for (const entry of players?.values?.() ?? []) { const p = entry.state ?? entry.last; if (p && !entry.hidden) out.push({ bb: remotePlayerBox(p), collide: true }); }
  for (const o of mobs?.list?.() ?? []) {
    if (!(o.health > 0 || (o.death ?? 0) < 20)) continue;
    if (o.type === 'ender_crystal') { out.push({ bb: crystalBox(o.x, o.y, o.z), collide: true }); continue; }
    const [w, h] = mobs.factory.size(o);
    if (o.type === 'ender_dragon') {
      const listed = (area) => dragonListed(o, area);
      out.push({ bb: mobBox(o.x, o.y, o.z, w, h), collide: false, listed });
      for (const p of o.dragon?.parts ?? []) if (p.box) out.push({ bb: p.box, collide: true, listed });
      continue;
    }
    out.push({ bb: mobBox(o.x, o.y, o.z, w, h), collide: true });
  }
  for (const list of [vehicles?.carts?.carts, vehicles?.boats?.carts]) for (const c of list ?? []) if (!c.dead && c.bb) out.push({ bb: c.bb, collide: true });
  for (const e of vehicles?.hanging?.copies?.values?.() ?? []) if (e.bb) out.push({ bb: e.bb, collide: true });
  for (const t of primed) if (!t.dead) out.push({ bb: cube(t.x, t.y, t.z, TNT_SIZE), collide: true });
  for (const e of falling) if (!e.dead) out.push({ bb: cube(e.x, e.y, e.z, BOAT_ENTITY_SIZES.falling), collide: true });
  for (const e of items) out.push({ bb: cube(e.x, e.y, e.z, 0.25), collide: false });
  for (const o of orbs) out.push({ bb: cube(o.x, o.y, o.z, 0.5), collide: false });
  for (const a of arrows) out.push({ bb: cube(a.x, a.y, a.z, 0.5), collide: false });
  for (const b of balls) out.push(b.kind === 'fireball' ? { bb: cube(b.x, b.y, b.z, 1), collide: true, border: 1 } : { bb: cube(b.x, b.y, b.z, BALL[b.kind] ?? 0.25), collide: false });
  for (const h of hooks) if (!h.dead) out.push({ bb: cube(h.x, h.y, h.z, BOAT_ENTITY_SIZES.hook), collide: false });
  return out;
}
