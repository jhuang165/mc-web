// Authoritative integrated-server explosion orchestration from main.js. This
// module mutates world/entity state directly while leaving rendering, audio,
// container presentation and UI notifications to synchronous hooks.
import { explodeBlocks, explosionImpact, explodeTnt, primeTnt } from "./explosion.js";
import { ENTITY_TYPES } from "./entities.js";
import { makeStack, copyStack } from "./inventory.js";
import { PHYSICS, opaqueCube } from "./world.js";
import { entityBox } from "./weather.js";
import { blastKnockback } from "./armor-enchantments.js";
import { PISTON_HEAD, isPistonBase, pistonExtended, baseOfHead, headOfBase, itemForBlock } from "./dispenser-piston.js";

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
export function applyExplosion(state, request, hooks = {}) {
  const {
    world, weather, random = weather?.random, mobs, items, xpOrbs, arrows,
    projectiles, falling, primed, survival, position, velocity, farming,
  } = state;
  // `smoking` false (a creeper with gamerule mobGriefing off): WorldServer.newExplosion clears affectedBlockPositions
  // after doExplosionA, so nothing breaks or drops and the client draws no per-block particles.
  const { x, y, z, size, exploder = null, attacker = null, smoking = true } = request;
  const {
    opaque = opaqueCube,
    brokenTool = () => {},
    burst = () => {},
    sound = () => {},
    updateBlocks = () => {},
    syncChests = () => {},
    renderVitals = () => {},
    markDirty = () => {},
  } = hooks;

  const explosion = explodeBlocks(world, x, y, z, size, random, { opaque, smoking });
  const mobHits = [];
  // Explosion.doExplosionA sees every entity before any affected block is removed.
  const hitFrom = attacker === "player" ? position : attacker;
  for (const entity of mobs?.entities ?? []) {
    if (entity === exploder) continue;
    const type = ENTITY_TYPES[entity.type];
    if (!type) continue;
    const scale = entity.growingAge < 0 ? 0.5 : 1;
    const width = type.width * scale, height = type.height * scale;
    const hit = explosionImpact(
      world, x, y, z, size,
      entity.x, entity.y, entity.z,
      entity.y + Math.fround(Math.fround(height) * Math.fround(0.85)),
      entityBox(entity, width, height),
    );
    if (!hit) continue;
    if (hitFrom) mobs.damage(entity, hit.damage, hitFrom.x, hitFrom.z, attacker === "player", attacker?.type ?? null);
    else mobs.hazard(entity, hit.damage, "explosion");
    entity.vx += hit.push[0]; entity.vy += hit.push[1]; entity.vz += hit.push[2];
    mobHits.push({ entity, ...hit });
  }

  items.explode(world, x, y, z, size, exploder);
  xpOrbs.explode(world, x, y, z, size, exploder);
  arrows.explode(world, x, y, z, size, exploder);
  projectiles.explode(world, x, y, z, size, exploder);
  falling?.explode(x, y, z, size, exploder);
  state.hanging?.explode(x, y, z, size); // paintings and item frames break (hanging.js)
  const tntProcessed = [];
  for (const entity of primed) {
    if (entity === exploder) continue;
    explodeTnt(world, entity, x, y, z, size);
    tntProcessed.push(entity);
  }

  let playerHit = null;
  if (survival.health > 0) {
    playerHit = explosionImpact(
      world, x, y, z, size,
      position.x, position.y, position.z, position.y + PHYSICS.eye,
      entityBox(position, PHYSICS.width, PHYSICS.height),
    );
    if (playerHit) {
      if (!survival.creative && survival.scaledDamage(
        playerHit.damage,
        attacker && attacker !== "player" ? "a " + attacker.type : "an explosion", { source: "explosion" },
      )) brokenTool();
      // Explosion.doExplosionA: knockback is impact less floor(impact * Blast Protection level * 0.15F).
      const kick = blastKnockback(survival.inventory?.armor ?? [], playerHit.impact), scale = playerHit.impact && kick !== playerHit.impact ? kick / playerHit.impact : 1;
      velocity.x += playerHit.push[0] * scale; velocity.y += playerHit.push[1] * scale; velocity.z += playerHit.push[2] * scale;
    }
  }

  burst(x, y, z, size, smoking ? explosion.list : [], { viewer: [position.x, position.y + PHYSICS.eye, position.z] });
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
  for (const drop of explosion.drops)
    items.spawn(makeStack(drop.id, 1, drop.damage || 0), drop.x, drop.y, drop.z, { delay: 10 });
  for (const orb of explosion.xp) xpOrbs.spawn(orb.value, orb);
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
