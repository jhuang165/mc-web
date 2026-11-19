// Authoritative integrated-server explosion orchestration from main.js. This
// module mutates world/entity state directly while leaving rendering, audio,
// container presentation and UI notifications to synchronous hooks.
import { isFrozen, liveOrder } from "./saved-order.js"; // b62: an unloaded chunk's entities are in no chunk list (getEntitiesWithinAABB misses them)
import { explosionReaches } from "./ring-events.js";
import { drainKnockback } from "./player-knockback.js";
import { WITHER_PROOF_INTERNAL, skullResistance } from "./wither-boss.js";
import { explosionBlocks, explosionOutcome, explosionResistance, explosionImpact, explodeTnt, primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { JavaRandom } from "./java-random.js";
import { fireballRows, rocketRows, eyeRows, hookRows, knotRows, blastRow, blastNear, runBlastRows } from "./explosion-extras.js"; // b82 spblast82, b83 blastorder83: one list in the native order
import { ENTITY_TYPES } from "./entities.js";
import { livingEyeHeight } from "./ai.js";
import { makeStack, copyStack } from "./inventory.js";
import { PHYSICS, opaqueCube, FIRE } from "./world.js";
import { entityBox } from "./weather.js";
import { isDragon, reachesDragon } from "./dragon-parts.js";
import { blastKnockback } from "./armor-enchantments.js";
import { clientDropDraws } from "./multiplayer/client-explosion.js"; // b80 mpfx80
import { s27Loopback } from "./multiplayer/server-explosion-packet.js"; // b79 explfx79: the integrated client sees the blast as S27 does
import { velocityPacket } from "./multiplayer/server-velocity.js"; // S12 quantisation
import { PISTON_HEAD, isPistonBase, pistonExtended, baseOfHead, headOfBase, itemForBlock } from "./dispenser-piston.js";
import { forgetTableName } from "./tile-names.js"; // b75: a destroyed table loses its CustomName
import { serverPosY, serverEyeY, SLEEP_BOX } from "./sleeper-eye.js"; // b68 fixes68

// An EntityMinecart or EntityBoat in the blast: Entity.getEyeHeight is 0, so the eye is posY; attackEntityFrom(explosion source, damage) wobbles it and breaks it
// above 40 (a creative player's own explosion breaks it outright), then the knockback is added to its motion (vehicles are not EntityLivingBase: no Blast Protection).
// A broken vehicle's drops join the entity list at once (Entity.entityDropItem): b83 blastorder83 drains them right after its hit (they are in no row of this blast).
function vehicleRows(system, b, creative, drop) {
  const out = [];
  for (const v of [...(system?.carts ?? [])]) {
    const r = blastRow(b, v, v.posY, () => {
      if (v.dead) return; // EntityMinecart / EntityBoat.attackEntityFrom: !isDead (a nested blast earlier in the list may have broken it)
      const hit = explosionImpact(b.world, b.x, b.y, b.z, b.size, v.x, v.posY, v.z, v.posY, v.bb);
      if (!hit) return;
      system.attack(v, hit.damage, { source: "explosion", creative });
      v.vx += hit.push[0]; v.vy += hit.push[1]; v.vz += hit.push[2];
      if (drop && system.drain) for (const d of system.drain()) drop(d);
    });
    if (r) out.push(r);
  }
  return out;
}
// One system's rows through its explodeOne (items, orbs, arrows, thrown entities, falling blocks): `py` is the entity's posY.
const systemRows = (list, b, py, one) => { const out = []; for (const e of [...(list ?? [])]) { const r = blastRow(b, e, py(e), () => one(e)); if (r) out.push(r); } return out; };
/**
 * b83 blastorder83: the rows (explosion-extras.js) of every non-living entity of Explosion.doExplosionA's list: items, orbs, arrows, thrown entities, the witch and dispenser
 * potions and the snow golem's snowballs (EntityThrowable: zero eye height, no damage, motion added), falling blocks, hanging entities, the minecarts and boats, leash knots,
 * fireballs and wither skulls, rockets, eyes of ender and fishing hooks. `itemsBefore` / `orbsBefore` (optional) cut the item and orb lists where the blast took its list.
 */
export function nonLivingRows(state, b, { creative = false, vehicleDrop = null, itemsBefore = null, orbsBefore = null } = {}) {
  const { world, mobs, items, xpOrbs, arrows, projectiles, falling } = state;
  const { x, y, z, size } = b, cut = (list, n) => (n === null || !list ? list : list.slice(0, n));
  const hanging = state.hanging?.h ?? state.hanging, hangingDrops = state.hanging?.h ? () => state.hanging.drops() : null; // the server's ServerHanging wraps a Hanging and spawns its drops at once
  const balls = (p) => (p ? systemRows(p.balls, b, (e) => e.y, (e) => p.explodeOne(world, e, x, y, z, size)) : []);
  return [
    ...(items?.explodeOne ? systemRows(cut(items.items, itemsBefore), b, (e) => e.y + 0.125, (e) => items.explodeOne(world, e, x, y, z, size)) : []), // EntityItem: posY the box centre
    ...(xpOrbs?.explodeOne ? systemRows(cut(xpOrbs.orbs, orbsBefore), b, (e) => e.posY, (e) => xpOrbs.explodeOne(world, e, x, y, z, size)) : []),
    ...(arrows?.explodeOne ? systemRows(arrows.list, b, (e) => e.y, (e) => arrows.explodeOne(world, e, x, y, z, size)) : []),
    ...balls(projectiles), ...balls(mobs?.potions?.projectiles), ...balls(mobs?._golemBalls?.projectiles),
    ...vehicleRows(state.minecarts, b, creative, vehicleDrop), ...vehicleRows(state.boats, b, creative, vehicleDrop),
    ...(falling?.explodeOne ? systemRows(falling.entities, b, (e) => e.y + 0.49, (e) => falling.explodeOne(e, x, y, z, size)) : []),
    ...(hanging?.explodeOne ? systemRows(hanging.entities, b, (e) => e.y, (e) => { hanging.explodeOne(e, x, y, z, size, creative ? { player: true, creative: true } : null); if (hangingDrops) hangingDrops(); else if (vehicleDrop && hanging.drain) for (const d of hanging.drain()) vehicleDrop(d); }) : []), // paintings and item frames break (hanging.js)
    ...knotRows(mobs, b), ...fireballRows(mobs?._fireballs, b), ...fireballRows(mobs?._skulls, b),
    ...rocketRows(state.rockets?.rockets, b), ...eyeRows(state.eyes?.eyes, b), ...hookRows(state.hooks, b),
  ];
}
/** Primed TNT rows (Entity.attackEntityFrom: setBeenAttacked; the push). `done` collects the TNT reached. */
export const tntRows = (primed, b, done = null) => systemRows(primed, b, (e) => e.y + TNT_Y_OFFSET, (e) => { explodeTnt(b.world, e, b.x, b.y, b.z, b.size); done?.push(e); });
/** After the pass: the orbs a blast killed leave their list (ExperienceOrbs.explode did this per kind). */
export function finishBlastRows(state) { const o = state.xpOrbs; if (o?.orbs?.some((e) => e.dead)) o.orbs = o.orbs.filter((e) => !e.dead); }
const blastOf = (world, x, y, z, size, exploder, placer) => ({ world, x, y, z, size, exploder, placer });
/**
 * The non-living entities of Explosion.doExplosionA: items, orbs, arrows, thrown entities, potions and golem snowballs, falling blocks, hanging entities, minecarts and boats
 * (attackEntityFrom with the explosion source, then the motion; EntityListProbe), b82 spblast82's fireballs and wither skulls, firework rockets, eyes of ender, fishing hooks
 * (`state.rockets`, `state.eyes`, `state.hooks`: an array) and leash knots (explosion-extras.js); `placer` is getExplosivePlacedBy, whose look a large fireball takes.
 * Primed TNT, mobs and the player stay with applyExplosion, which runs all of them in one list (b83 blastorder83).
 */
export function explodeNonLiving(state, x, y, z, size, exploder = null, creative = false, vehicleDrop = null, itemsBefore = null, orbsBefore = null, placer = null) {
  // `itemsBefore`: the item count when the blast collected its entity list; the items after it (a mob the blast just killed dropped them) wait out the blast.
  // b81 blast81 `orbsBefore`: the same for the orbs (an ore an ender crystal's nested blast broke dropped them, Block.dropXpOnBlockBreak in that blast's doExplosionB).
  // b83 blastorder83: the kinds run together in the world's list order (runBlastRows), not one kind after another.
  runBlastRows(nonLivingRows(state, blastOf(state.world, x, y, z, size, exploder, placer), { creative, vehicleDrop, itemsBefore, orbsBefore }));
  finishBlastRows(state);
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
  const mobHits = [];
  runBlastRows(mobRows(state, request, mobHits));
  return mobHits;
}
/** b83 blastorder83: the mob rows of doExplosionA's list (explodeMobs runs them alone); each hit is pushed to `mobHits` at its turn. */
export function mobRows(state, request, mobHits = []) {
  const { world, mobs, position } = state;
  const { x, y, z, size, exploder = null, attacker = null } = request;
  const b = blastOf(world, x, y, z, size, exploder, null), out = [];
  // Explosion.doExplosionA sees every entity before any affected block is removed.
  const hitFrom = attacker === "player" ? position : attacker;
  for (const entity of liveOrder(mobs, [...(mobs?.entities ?? [])])) { // the list doExplosionA collected before any attackEntityFrom (a zombie that converts a killed villager joins it later)
    if (entity === exploder) continue;
    const type = ENTITY_TYPES[entity.type];
    if (!type) continue;
    // World.newExplosion's getEntitiesWithinAABBExcludingEntity lists the EntityDragonPart boxes: each part inside the blast takes its own
    // distance/exposure damage (Entity.getEyeHeight is 0 for a part) and attackEntityFromPart then divides it for the non-head parts.
    // Chunk.getEntitiesWithinAABBForEntity lists the parts right after the dragon itself, so the dragon's row runs them.
    if (entity.type === "ender_dragon") {
      // The query box is Explosion.doExplosionA's integer box floor(centre -/+ (2 * size) - 1) (probed: the dragon's own box and chunk gate the parts).
      const r = 2 * size, area = [Math.floor(x - r - 1), Math.floor(y - r - 1), Math.floor(z - r - 1), Math.floor(x + r + 1), Math.floor(y + r + 1), Math.floor(z + r + 1)];
      if (!isDragon(entity) || !reachesDragon(entity, area)) continue;
      // b84 blastparts84 (bytecode-read apx.a(sa, azt, List, sj)): the list gets the dragon ITSELF (xa), then its getParts() that meet the area, all inside one `meets` block, so
      // the body and its parts are consecutive list entries at the dragon's slot. xa.a(ro, F) returns false (no damage, no setBeenAttacked); the push below still lands on its
      // motion. Parts are collected now (before any hurt), each with the box it has at list time.
      const meets = (bb) => bb[3] > area[0] && bb[0] < area[3] && bb[4] > area[1] && bb[1] < area[4] && bb[5] > area[2] && bb[2] < area[5];
      const listed = [...entity.dragon.parts.entries()].filter(([, p]) => p.box && meets(p.box));
      out.push({ key: entity, pos: [entity.x, entity.y, entity.z], run: () => {
        const body = explosionImpact(world, x, y, z, size, entity.x, entity.y, entity.z, entity.y + livingEyeHeight("ender_dragon", 8), [entity.x - 8, entity.y, entity.z - 8, entity.x + 8, entity.y + 8, entity.z + 8]);
        if (body) { entity.vx += body.push[0]; entity.vy += body.push[1]; entity.vz += body.push[2]; }
        for (const [part, p] of listed) {
          const hit = explosionImpact(world, x, y, z, size, p.x, p.y, p.z, p.y, p.box);
          if (!hit) continue;
          mobs.attackEntityFrom(entity, hit.damage, { name: "explosion", part, from: hitFrom ? { x: hitFrom.x, z: hitFrom.z } : undefined, player: attacker === "player", attacker: attacker && attacker !== "player" ? attacker : undefined });
          mobHits.push({ entity, part, ...hit });
        }
      } });
      continue;
    }
    if (isFrozen(entity) || !blastNear(b, entity.x, entity.y, entity.z)) continue;
    out.push({ key: entity, pos: [entity.x, entity.y, entity.z], run: () => {
      const scale = entity.growingAge < 0 ? 0.5 : 1;
      const width = type.width * scale, height = type.height * scale;
      // b84 blastparts84 (bytecode-read wz.<init>): an ender crystal is no EntityLivingBase: yOffset = height / 2 = 1, so its `y` is posY and its box [y - 1, y + 1]; getEyeHeight is 0.
      const crystal = entity.type === "ender_crystal";
      const hit = explosionImpact(
        world, x, y, z, size,
        entity.x, entity.y, entity.z,
        crystal ? entity.y : entity.y + livingEyeHeight(entity.type, height), // Explosion.doExplosionA reads posY + getEyeHeight()
        crystal ? [entity.x - 1, entity.y - 1, entity.z - 1, entity.x + 1, entity.y + 1, entity.z + 1] : entityBox(entity, width, height),
      );
      if (!hit) return;
      if (hitFrom) mobs.damage(entity, hit.damage, hitFrom.x, hitFrom.z, attacker === "player", attacker?.type ?? null);
      else mobs.hazard(entity, hit.damage, "explosion");
      entity.vx += hit.push[0]; entity.vy += hit.push[1]; entity.vz += hit.push[2];
      mobHits.push({ entity, ...hit });
    } });
  }
  return out;
}
export function applyExplosion(state, request, hooks = {}) {
  const {
    world, weather, random = weather?.random, mobs, items, xpOrbs, arrows,
    projectiles, falling, primed, survival, position, velocity, farming, sleeping = false,
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

  // Explosion.doExplosionA: the rays first (World.rand), against the unmodified world. b81 blast81: the rest of doExplosionB (pitch, drop draws, chained fuses) waits until the
  // entities are hurt (explosionOutcome below), because an ender crystal hurt here explodes inside this blast and can clear cells of this list first.
  const list = explosionBlocks(world, x, y, z, size, random, blue ? blueSkullResistance : explosionResistance); // blue: a charged wither skull caps resistance (wither-boss.js)
  // Batch 49: a mob this blast kills drops its loot at its hurt call (EntityLivingBase.onDeath), after Explosion.doExplosionA collected its entity list: those items are not in it.
  // b81 blast81: neither are the orbs and primed TNT a nested crystal blast makes (doExplosionA takes its entity list once, before the first attackEntityFrom).
  // b83 blastorder83: that one list, every kind together, in the world's list order (chunk x, chunk z, vertical slice, insertion: candidate-order.js); each row is hurt and pushed at
  // its own turn, so a nested blast (an ender crystal, a TNT cart) lands between the rows before it and the rows after it, as natively.
  const b = blastOf(world, x, y, z, size, exploder, attacker), mobHits = [], tntProcessed = [];
  const rows = [
    ...mobRows(state, { x, y, z, size, exploder, attacker }, mobHits),
    ...nonLivingRows(state, b, { creative: attacker === "player" && !!survival.creative, vehicleDrop: hooks.vehicleDrop }),
    ...tntRows(primed, b, tntProcessed),
  ];
  let playerHit = null;
  if (survival.health > 0 && blastNear(b, position.x, serverPosY(position.y, sleeping), position.z)) rows.push({ key: "player", pos: [position.x, position.y + Math.fround(1.62), position.z], first: true, run: () => { playerHit = playerBlast(); } });
  runBlastRows(rows);
  finishBlastRows(state);

  function playerBlast() {
    if (!(survival.health > 0)) return null;
    const playerHit = explosionImpact(
      world, x, y, z, size,
      position.x, serverPosY(position.y, sleeping), position.z, serverEyeY(position.y, sleeping), // EntityPlayerMP.getEyeHeight is the float 1.62F (eye-height-reference.json); creeperwitch-b45 push records; b68: a sleeper's posY is minY + 0.2
      entityBox(position, sleeping ? SLEEP_BOX : PHYSICS.width, sleeping ? SLEEP_BOX : PHYSICS.height),
    );
    if (playerHit) {
      const hurtBefore = survival.hurtCount | 0;
      if (!survival.creative && survival.scaledDamage(
        playerHit.damage,
        attacker && attacker !== "player" ? "a " + attacker.type : "an explosion", { source: "explosion", from: attacker && attacker !== "player" ? attacker : undefined },
      )) brokenTool();
      // A hit that opened a fresh hurt window is Entity.setBeenAttacked: the integrated server sends S12 (the server copy's motion) after the S27, and S12 SETS the client's motion.
      const s12 = !survival.creative && (survival.hurtCount | 0) > hurtBefore;
      // The source entity (Explosion.getExplosivePlacedBy: a creeper or other living exploder) knocks back first (attackEntityFrom), then the
      // explosion velocity is added on top (doExplosionA), so the queue is applied before it.
      drainKnockback(survival, velocity, position);
      // Explosion.doExplosionA: the server's own motion gets the push less floor(impact * Blast Protection level * 0.15F); the S27 to the client carries the unreduced push.
      const kick = blastKnockback(survival.inventory?.armor ?? [], playerHit.impact), scale = playerHit.impact && kick !== playerHit.impact ? kick / playerHit.impact : 1;
      const server = survival.serverPlayer?.motion; // the server's EntityPlayerMP gets the same Explosion.func_77277_b push (its motion leads a witch's aim); the hit's own knockback reached it in queueKnockBack
      if (server) { server.x += playerHit.push[0] * scale; server.y += playerHit.push[1] * scale; server.z += playerHit.push[2] * scale; }
      // b79 explfx79 (bytecode-read bjb.a(gu), bjb.a(hy)): handleExplosion adds the float push to the client motion; handleEntityVelocity then replaces that motion with the server copy's (quantised).
      // So a hurt player ends with the server copy's motion (Blast Protection applied, the unreduced push overwritten), a creative or hurt-window-refused one keeps the unreduced S27 push.
      if (s12 && server) { const v = velocityPacket(server); velocity.x = v.x; velocity.y = v.y; velocity.z = v.z; }
      else if (s12) { velocity.x += playerHit.push[0] * scale; velocity.y += playerHit.push[1] * scale; velocity.z += playerHit.push[2] * scale; } // no server copy to read: the reduced push
      else { velocity.x += Math.fround(playerHit.push[0]); velocity.y += Math.fround(playerHit.push[1]); velocity.z += Math.fround(playerHit.push[2]); }
    }
    return playerHit;
  }

  // b82 spblast82: the fire roll draws on Explosion's own unseeded Random (agw.<init>: new Random()), here a JavaRandom seeded from Math.random, made only for a flaming blast
  // (as ServerMobs.explode); explosionOutcome's old default seeded it from the clock.
  const own = flaming && ignite ? new JavaRandom(Math.floor(Math.random() * 2 ** 48)) : null;
  const explosion = { list, ...explosionOutcome(world, list, size, random, { opaque, smoking, flaming: flaming && !!ignite, ...(own ? { own } : {}) }) }; // b81 blast81: doExplosionB reads the cells as they are now

  // S27 reaches only a player within 64 blocks (WorldServer.newExplosion), and the client's huge explosion particle has no other range test (ring-events.js).
  if (explosionReaches(x, y, z, position)) {
    const wire = s27Loopback(x, y, z, size, smoking ? explosion.list : []); // b79 explfx79: float centre, offset bytes (the integrated client reads S27, not the server's list)
    // b80 mpfx80: the integrated client's world still holds the blocks when S27 arrives (the S23s follow), so its ore and spawner drop draws on World.rand run between the
    // cells' particles; here the blocks are still in place too (broken below).
    burst(wire.x, wire.y, wire.z, wire.size, wire.list, { viewer: [position.x, position.y + PHYSICS.eye, position.z], cell: (bx, by, bz, r) => clientDropDraws(world.get(bx, by, bz), world.getMeta?.(bx, by, bz) ?? 0, r) });
  }
  sound("random.explode", { volume: 4, pitch: explosion.pitch, position: { x, y, z } });

  const changes = [];
  for (const block of explosion.broken) {
    const key = block.x + "," + block.y + "," + block.z;
    const furnace = survival.furnaces[key], chest = survival.chests[key], dispenser = survival.dispensers?.[key], pistonMeta = world.getMeta(block.x, block.y, block.z);
    if (!world.set(block.x, block.y, block.z, 0)) continue;
    changes.push([block.x, block.y, block.z, block.id, 0]);
    farming.observe(block.x, block.y, block.z);
    forgetTableName(survival, key, 0);
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
  // Explosion.doExplosionB(flaming): the cells explodeBlocks chose get fire (flaming is ghast fireballs and beds; the ender crystal is not flaming, ender-crystal-mobs.js).
  for (const [fx, fy, fz] of explosion.fires) if (ignite(fx, fy, fz)) changes.push([fx, fy, fz, 0, FIRE]);
  for (const drop of explosion.drops)
    items.spawn(makeStack(drop.id, 1, drop.damage || 0, undefined, drop.tags), drop.x, drop.y, drop.z, { delay: 10 }); // b82 pots82: tags carry a pot drop's rawDamage
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
