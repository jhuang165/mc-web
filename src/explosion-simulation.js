// Authoritative integrated-server explosion orchestration from main.js. This
// module mutates world/entity state directly while leaving rendering, audio,
// container presentation and UI notifications to synchronous hooks.
import { isFrozen, liveOrder } from "./saved-order.js"; // b62: an unloaded chunk's entities are in no chunk list (getEntitiesWithinAABB misses them)
import { explosionReaches } from "./ring-events.js";
import { drainKnockback } from "./player-knockback.js";
import { WITHER_PROOF_INTERNAL, skullResistance } from "./wither-boss.js";
import { explodeBlocks, explosionResistance, explosionImpact, explodeTnt, primeTnt } from "./explosion.js";
import { ENTITY_TYPES } from "./entities.js";
import { livingEyeHeight } from "./ai.js";
import { makeStack, copyStack } from "./inventory.js";
import { PHYSICS, opaqueCube, FIRE } from "./world.js";
import { entityBox } from "./weather.js";
import { isDragon, reachesDragon } from "./dragon-parts.js";
import { blastKnockback } from "./armor-enchantments.js";
import { PISTON_HEAD, isPistonBase, pistonExtended, baseOfHead, headOfBase, itemForBlock } from "./dispenser-piston.js";

// An EntityMinecart or EntityBoat in the blast: Entity.getEyeHeight is 0, so the eye is posY; attackEntityFrom(explosion source, damage) wobbles it and breaks it
// above 40 (a creative player's own explosion breaks it outright), then the knockback is added to its motion (vehicles are not EntityLivingBase: no Blast Protection).
function explodeVehicles(system, world, x, y, z, size, exploder, creative, drop) {
  for (const v of [...(system?.carts ?? [])]) {
    if (v.dead || v === exploder || isFrozen(v)) continue;
    const hit = explosionImpact(world, x, y, z, size, v.x, v.posY, v.z, v.posY, v.bb);
    if (!hit) continue;
    system.attack(v, hit.damage, { source: "explosion", creative });
    v.vx += hit.push[0]; v.vy += hit.push[1]; v.vz += hit.push[2];
  }
  // A broken vehicle's drops join the entity list at once (Entity.entityDropItem), so an item dropped mid-pass still updates in this pass.
  if (drop && system?.drain) for (const d of system.drain()) drop(d);
}
/**
 * The non-living entity lists of Explosion.doExplosionA, in main.js order: items, orbs, arrows, thrown entities, the witch and dispenser potions and the snow golem's
 * snowballs (EntityThrowable: zero eye height, no damage, motion added), falling blocks, hanging entities, and the minecarts and boats (attackEntityFrom with the explosion
 * source, then the motion; EntityListProbe). Primed TNT, mobs and the player stay with applyExplosion.
 */
export function explodeNonLiving(state, x, y, z, size, exploder = null, creative = false, vehicleDrop = null, itemsBefore = null) {
  const { world, mobs, items, xpOrbs, arrows, projectiles, falling } = state;
  // `itemsBefore`: the item count when the blast collected its entity list; the items after it (a mob the blast just killed dropped them) wait out the blast.
  const born = itemsBefore === null || !items.items ? [] : items.items.splice(itemsBefore);
  items.explode(world, x, y, z, size, exploder);
  xpOrbs.explode(world, x, y, z, size, exploder);
  arrows.explode(world, x, y, z, size, exploder);
  projectiles.explode(world, x, y, z, size, exploder);
  mobs?.potions?.projectiles?.explode(world, x, y, z, size, exploder);
  mobs?._golemBalls?.projectiles?.explode(world, x, y, z, size, exploder);
  explodeVehicles(state.minecarts, world, x, y, z, size, exploder, creative, vehicleDrop);
  explodeVehicles(state.boats, world, x, y, z, size, exploder, creative, vehicleDrop);
  falling?.explode(x, y, z, size, exploder);
  state.hanging?.explode(x, y, z, size); // paintings and item frames break (hanging.js)
  if (born.length) items.items.splice(itemsBefore, 0, ...born);
}
/**
 * Apply an integrated-server explosion in main.js order. Explosion rays and
 * drop data are prepared from the current world first. Entity hits and
 * knockback then run against the unmodified blocks; only after player and
 * nonliving hits does the caller observe the burst/sound and the ordered block
 * mutations, spills, drops, XP and chained TNT.
 *
 * `state`: `{world, weather|random, mobs, items, xpOrbs, arrows, projectiles,
 * falling, primed, survival, position, velocity, farming}`.
 * `request`: `{x,y,z,size,exploder,attacker}`.
 * Hooks: `brokenTool`, `burst`, `sound`, `updateBlocks`, `syncChests`,
 * `renderVitals`, and `markDirty` are synchronous presentation/UI callbacks.
 *
 * Returns `{explosion, mobHits, tntProcessed, playerHit, changes, chainedTnt}`.
 */
// EntityWitherSkull.func_145772_a on a blue skull: resistance capped at 0.8 except bedrock, end portal, its frame and command blocks.
const blueSkullResistance = (id) => skullResistance(true, WITHER_PROOF_INTERNAL.includes(id), explosionResistance(id));
/**
 * The living-entity half of Explosion.doExplosionA (mobs only; no player): each mob in reach takes the impact damage through attackEntityFrom (a kill drops its loot at once,
 * EntityLivingBase.onDeath) and then the push. Returns the hits. `request`: `{x, y, z, size, exploder, attacker}`.
 */
export function explodeMobs(state, request) {
  const { world, mobs, position } = state;
  const { x, y, z, size, exploder = null, attacker = null } = request;
  const mobHits = [];
  // Explosion.doExplosionA sees every entity before any affected block is removed.
  const hitFrom = attacker === "player" ? position : attacker;
  for (const entity of liveOrder(mobs, [...(mobs?.entities ?? [])])) { // the list doExplosionA collected before any attackEntityFrom (a zombie that converts a killed villager joins it later)
    if (entity === exploder) continue;
    const type = ENTITY_TYPES[entity.type];
    if (!type) continue;
    // World.newExplosion's getEntitiesWithinAABBExcludingEntity lists the EntityDragonPart boxes: each part inside the blast takes its own
    // distance/exposure damage (Entity.getEyeHeight is 0 for a part) and attackEntityFromPart then divides it for the non-head parts.
    if (entity.type === "ender_dragon") {
      // The query box is Explosion.doExplosionA's integer box floor(centre -/+ (2 * size) - 1) (probed: the dragon's own box and chunk gate the parts).
      const r = 2 * size, area = [Math.floor(x - r - 1), Math.floor(y - r - 1), Math.floor(z - r - 1), Math.floor(x + r + 1), Math.floor(y + r + 1), Math.floor(z + r + 1)];
      if (!isDragon(entity) || !reachesDragon(entity, area)) continue;
      for (const [part, p] of entity.dragon.parts.entries()) {
        const hit = explosionImpact(world, x, y, z, size, p.x, p.y, p.z, p.y, p.box);
        if (!hit) continue;
        mobs.attackEntityFrom(entity, hit.damage, { name: "explosion", part, from: hitFrom ? { x: hitFrom.x, z: hitFrom.z } : undefined, player: attacker === "player", attacker: attacker && attacker !== "player" ? attacker : undefined });
        mobHits.push({ entity, part, ...hit });
      }
      continue;
    }
    const scale = entity.growingAge < 0 ? 0.5 : 1;
    const width = type.width * scale, height = type.height * scale;
    const hit = explosionImpact(
      world, x, y, z, size,
      entity.x, entity.y, entity.z,
      entity.y + livingEyeHeight(entity.type, height), // Explosion.doExplosionA reads posY + getEyeHeight()
      entityBox(entity, width, height),
    );
    if (!hit) continue;
    if (hitFrom) mobs.damage(entity, hit.damage, hitFrom.x, hitFrom.z, attacker === "player", attacker?.type ?? null);
    else mobs.hazard(entity, hit.damage, "explosion");
    entity.vx += hit.push[0]; entity.vy += hit.push[1]; entity.vz += hit.push[2];
    mobHits.push({ entity, ...hit });
  }
  return mobHits;
}
export function applyExplosion(state, request, hooks = {}) {
  const {
    world, weather, random = weather?.random, mobs, items, xpOrbs, arrows,
    projectiles, falling, primed, survival, position, velocity, farming,
  } = state;
  // `smoking` false (a creeper with gamerule mobGriefing off): WorldServer.newExplosion clears affectedBlockPositions
  // after doExplosionA, so nothing breaks or drops and the client draws no per-block particles.
  const { x, y, z, size, exploder = null, attacker = null, smoking = true, flaming = false, blue = false } = request;
  const {
    opaque = opaqueCube,
    ignite = null,
    brokenTool = () => {},
    burst = () => {},
    sound = () => {},
    updateBlocks = () => {},
    syncChests = () => {},
    renderVitals = () => {},
    markDirty = () => {},
  } = hooks; // `hooks.vehicleDrop(drop)`: a broken cart's or boat's item (Minecarts / Boats drain record), spawned at once

  const explosion = explodeBlocks(world, x, y, z, size, random, { opaque, smoking, flaming: flaming && !!ignite, resistance: blue ? blueSkullResistance : undefined }); // blue: a charged wither skull caps resistance (wither-boss.js)
  // Batch 49: a mob this blast kills drops its loot at its hurt call (EntityLivingBase.onDeath), after Explosion.doExplosionA collected its entity list: those items are not in it.
  const itemsBefore = items.items?.length ?? null;
  const mobHits = explodeMobs(state, { x, y, z, size, exploder, attacker });

  explodeNonLiving(state, x, y, z, size, exploder, attacker === "player" && !!survival.creative, hooks.vehicleDrop, itemsBefore);
  const tntProcessed = [];
  for (const entity of primed) {
    if (entity === exploder || isFrozen(entity)) continue;
    explodeTnt(world, entity, x, y, z, size);
    tntProcessed.push(entity);
  }

  let playerHit = null;
  if (survival.health > 0) {
    playerHit = explosionImpact(
      world, x, y, z, size,
      position.x, position.y, position.z, position.y + Math.fround(PHYSICS.eye), // EntityPlayerMP.getEyeHeight is the float 1.62F (eye-height-reference.json); creeperwitch-b45 push records
      entityBox(position, PHYSICS.width, PHYSICS.height),
    );
    if (playerHit) {
      if (!survival.creative && survival.scaledDamage(
        playerHit.damage,
        attacker && attacker !== "player" ? "a " + attacker.type : "an explosion", { source: "explosion", from: attacker && attacker !== "player" ? attacker : undefined },
      )) brokenTool();
      // The source entity (Explosion.getExplosivePlacedBy: a creeper or other living exploder) knocks back first (attackEntityFrom), then the
      // explosion velocity is added on top (doExplosionA), so the queue is applied before it.
      drainKnockback(survival, velocity, position);
      // Explosion.doExplosionA: knockback is impact less floor(impact * Blast Protection level * 0.15F).
      const kick = blastKnockback(survival.inventory?.armor ?? [], playerHit.impact), scale = playerHit.impact && kick !== playerHit.impact ? kick / playerHit.impact : 1;
      velocity.x += playerHit.push[0] * scale; velocity.y += playerHit.push[1] * scale; velocity.z += playerHit.push[2] * scale;
      const server = survival.serverPlayer?.motion; // the server's EntityPlayerMP gets the same Explosion.func_77277_b push (its motion leads a witch's aim); the hit's own knockback reached it in queueKnockBack
      if (server) { server.x += playerHit.push[0] * scale; server.y += playerHit.push[1] * scale; server.z += playerHit.push[2] * scale; }
    }
  }

  // S27 reaches only a player within 64 blocks (WorldServer.newExplosion), and the client's huge explosion particle has no other range test (ring-events.js).
  if (explosionReaches(x, y, z, position)) burst(x, y, z, size, smoking ? explosion.list : [], { viewer: [position.x, position.y + PHYSICS.eye, position.z] });
  sound("random.explode", { volume: 4, pitch: explosion.pitch, position: { x, y, z } });

  const changes = [];
  for (const block of explosion.broken) {
    const key = block.x + "," + block.y + "," + block.z;
    const furnace = survival.furnaces[key], chest = survival.chests[key], dispenser = survival.dispensers?.[key], pistonMeta = world.getMeta(block.x, block.y, block.z);
    if (!world.set(block.x, block.y, block.z, 0)) continue;
    changes.push([block.x, block.y, block.z, block.id, 0]);
    farming.observe(block.x, block.y, block.z);
    if (furnace) {
      items.spill(furnace.items.filter(Boolean), block.x, block.y, block.z);
      delete survival.furnaces[key];
    }
    if (chest) {
      items.spill(chest.items.filter(Boolean).map(copyStack), block.x, block.y, block.z);
      delete survival.chests[key];
    }
    if (survival.brewing?.[key]) {
      items.spill(survival.brewing[key].items.filter(Boolean).map(copyStack), block.x, block.y, block.z);
      delete survival.brewing[key];
    }
    if (dispenser) {
      items.spill(dispenser.items.filter(Boolean).map(copyStack), block.x, block.y, block.z);
      delete survival.dispensers[key];
    }
    if (survival.hoppers?.[key]) {
      items.spill(survival.hoppers[key].items.filter(Boolean).map(copyStack), block.x, block.y, block.z);
      delete survival.hoppers[key];
    }
    // A destroyed piston head takes its base along (the base drops itself); a destroyed extended base removes its head.
    if (block.id === PISTON_HEAD) {
      const base = baseOfHead(block.x, block.y, block.z, pistonMeta), baseBlock = world.get(...base);
      if (isPistonBase(baseBlock) && pistonExtended(world.getMeta(...base)) && world.set(...base, 0)) {
        changes.push([...base, baseBlock, 0]);
        items.dropBlock([makeStack(itemForBlock(baseBlock), 1, 0)], ...base);
      }
    } else if (isPistonBase(block.id) && pistonExtended(pistonMeta)) {
      const head = headOfBase(block.x, block.y, block.z, pistonMeta);
      if (world.get(...head) === PISTON_HEAD && world.set(...head, 0)) changes.push([...head, PISTON_HEAD, 0]);
    }
  }
  // Explosion.doExplosionB(flaming): the cells explodeBlocks chose get fire (flaming is the ender crystal and ghast fireballs).
  for (const [fx, fy, fz] of explosion.fires) if (ignite(fx, fy, fz)) changes.push([fx, fy, fz, 0, FIRE]);
  for (const drop of explosion.drops)
    items.spawn(makeStack(drop.id, 1, drop.damage || 0), drop.x, drop.y, drop.z, { delay: 10 });
  for (const orb of explosion.xp) xpOrbs.spawn(orb.value, orb);
  for (const at of explosion.released) (hooks.releaseSilverfish ?? ((x, y, z) => mobs?.spawnSilverfishAt?.(x, y, z)))(...at); // b67: a blown-up monster egg lets its silverfish out (explosion.js)
  const chainedTnt = [];
  for (const block of explosion.primed) {
    const entity = primeTnt(block.x, block.y, block.z, { fuse: block.fuse, placer: attacker });
    primed.push(entity);
    chainedTnt.push(entity);
  }

  updateBlocks(changes);
  syncChests(world, survival.chests);
  renderVitals();
  markDirty();
  return { explosion, mobHits, tntProcessed, playerHit, changes, chainedTnt };
}
