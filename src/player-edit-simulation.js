import { CHEST } from './chest.js';
import { BOW, canDraw } from './bow.js';
import { plantedBlock } from './crops.js';
import { growGrass } from './flowers.js';
import { isBucket } from './buckets.js';
import { ATTACK_SLOWDOWN, isCritical } from './player-movement.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import {
  DYE, FIRE, SAPLING, SNOW_LAYER, TNT, isCrop,
} from './world.js';
import { ITEMS } from './survival.js';
import { copyStack } from './inventory.js';

const STATIONS = new Set([13, 14, CHEST]);
// PlayerControllerMP's edit(place) dispatcher with browser effects supplied by the
// caller. `state` holds the live mutable gameplay state, `request` snapshots the two
// ray targets and click button, and hooks run synchronously at the original call sites.
// The bucket hook is an intentional adapter boundary: its existing ray origin/direction
// and eyeRay remain browser-owned, while any item-use state change is returned as a patch.
// All hooks keep their original argument list; only useBucketItem explicitly receives
// state as a fourth argument because its browser adapter also updates `eating`.
export function applyPlayerEdit(state, { place = false, target = null, aimedEntity = null } = {}, hooks = {}) {
  const random = hooks.random ?? Math.random;
  const act = (branch, extra = {}) => ({ handled: true, branch, ...extra }),
    hook = (name, ...args) => hooks[name]?.(...args);
  if (state.screen !== 'playing') return { handled: false, branch: 'not-playing' };

  hook('unlock');
  const id = state.heldTool, item = ITEMS[id];
  const activates = !(state.motion.sneaking && id);
  const usesBlock = activates && !aimedEntity && target && STATIONS.has(state.world.get(...target.block));

  // Snowball/egg, bow and buckets return before the vanilla hand swing.
  if (place && (id === 312 || id === 316) && (state.survival.creative || state.survival.count(id)) && !usesBlock) {
    hook('throwSnowball', id);
    return act('throw-projectile');
  }
  if (place && id === BOW && !usesBlock) {
    if (!state.eating && canDraw(state.survival)) state.eating = { id: BOW, ticks: 0, bow: true };
    return act('begin-bow-use');
  }
  if (place && isBucket(item) && !usesBlock) {
    const patch = hooks.useBucketItem?.(id, aimedEntity, target, state);
    // The existing bucket adapter owns eyeRay/global bucket helpers. Only its optional
    // explicit eating patch is state; arbitrary callback return objects are ignored.
    if (patch && Object.hasOwn(patch, 'eating')) state.eating = patch.eating;
    return act('use-bucket');
  }

  hook('swing');
  if (!place && aimedEntity?.entity) {
    state.mining = null;
    const critical = isCritical({ fallDistance: state.fallDistance, onGround: state.grounded, inWater: state.wasInWater });
    const hit = state.mobs.attack(
      aimedEntity.entity,
      id,
      state.survival,
      { x: state.position.x, z: state.position.z, yaw: state.yaw },
      state.motion.sprinting ? 1 : 0,
      critical,
    );
    if (hit) {
      if (critical) hook('criticalHit', aimedEntity.entity);
      if (state.motion.sprinting) {
        state.velocity.x *= ATTACK_SLOWDOWN;
        state.velocity.z *= ATTACK_SLOWDOWN;
        state.motion.sprinting = false;
      }
      hook('handleEntityEvents');
      hook('renderHotbar');
      hook('markUnsaved');
    }
    return act('attack-entity');
  }

  // Flint-and-steel interaction with a live creeper precedes the general entity branch.
  if (place && aimedEntity?.entity?.type === 'creeper' && aimedEntity.entity.health > 0 && item?.kind === 'flint_and_steel') {
    const e = aimedEntity.entity;
    hook('playSound', 'fire.ignite', { volume: 1, pitch: random() * 0.4 + 0.8,
      position: { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 } });
    e.ignited = true;
    if (!state.survival.creative) state.survival.wear(id);
    hook('reportBrokenTool');
    hook('renderHotbar');
    hook('markUnsaved');
    return act('ignite-creeper');
  }

  if (place && aimedEntity?.entity) {
    const e = aimedEntity.entity;
    if (state.mobs.shear(e, id, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('shear-entity');
    }
    if (state.mobs.feed(e, id, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
    } else if (state.mobs.dye(e, state.survival.held, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
    } else if (!state.survival.creative && item?.food) {
      beginEating(state, id, hook);
    }
    return act('interact-entity');
  }

  if (place && item?.armor !== undefined) {
    const inv = state.survival.inventory, slot = 39 - item.armor;
    if (!inv.getStack(slot)) {
      inv.setStack(slot, copyStack(inv.held));
      inv.main[inv.current] = null;
      hook('renderHotbar');
      hook('renderVitals');
      hook('markUnsaved');
    }
    return act('equip-armor');
  }

  if (!target) {
    if (place && !state.survival.creative && item?.food) beginEating(state, id, hook);
    return act('no-block-target');
  }

  const block = state.world.get(...target.block);
  if (place) {
    const [x, y, z] = target.block;
    if (item?.kind === 'hoe') {
      if (!state.survival.creative && !state.survival.count(id)) { hook('toast', 'Craft a hoe first.'); return act('hoe-no-item'); }
      if (target.adjacent?.[1] !== y - 1 && state.farming.till(x, y, z)) {
        state.survival.wear(id);
        hook('applyFarmUpdates', state.farming.drain());
        hook('renderHotbar');
        hook('playSound', 'step.gravel', { volume: 0.7 });
        hook('markUnsaved');
      }
      return act('use-hoe');
    }
    if (plantedBlock(id)) {
      if ((state.survival.creative || state.survival.count(id)) && target.adjacent?.[1] === y + 1 && state.farming.plant(x, y, z, id)) {
        if (!state.survival.creative) state.survival.take(id);
        hook('applyFarmUpdates', state.farming.drain());
        hook('renderHotbar');
        hook('markUnsaved');
        return act('plant-crop');
      }
      if (id === 309) return act('plant-seeds-failed');
    }
    if (id === DYE && state.survival.held?.damage === 15) {
      if (!state.survival.creative && !state.survival.count(id)) return act('bone-meal-no-item');
      let used = false;
      if (block === SAPLING) { state.trees.boneMeal(x, y, z); used = true; }
      else if (block === 1) {
        for (const q of growGrass(state.world, state.flowers, state.boneRandom, state.world.biome, x, y, z)) hook('updateBlock', q[0], q[2], q[1]);
        used = true;
      } else if (state.farming.fertilize(x, y, z)) {
        hook('applyFarmUpdates', state.farming.drain());
        used = true;
      }
      if (used) {
        if (!state.survival.creative) state.survival.inventory.decr(state.survival.inventory.current, 1);
        hook('renderHotbar');
        hook('playSound', 'dig.grass', { volume: 0.4 });
        hook('markUnsaved');
        const now = state.world.get(x, y, z);
        hook('boneMealSparkles', now, x, y, z, now === SAPLING ? Math.fround(0.8) : isCrop(now) ? Math.fround(0.25) : 1, state.itemRand);
      }
      return act('use-bone-meal');
    }
    if (activates && block === TNT && item?.kind === 'flint_and_steel') {
      hook('lightTnt', x, y, z, 'player');
      state.world.set(x, y, z, 0);
      state.farming.observe(x, y, z);
      hook('updateBlock', x, z, y);
      if (!state.survival.creative) state.survival.wear(id);
      hook('reportBrokenTool');
      hook('renderHotbar');
      hook('markUnsaved');
      return act('prime-tnt');
    }
    if (activates && block === 13) { hook('openInventory', true); return act('open-workbench'); }
    if (activates && block === 14) { hook('useFurnace', target.block.join(',')); return act('open-furnace'); }
    if (activates && block === CHEST) {
      const chest = state.survival.openChest(state.world, ...target.block);
      if (chest) hook('openChest', chest, target.block.join(','), target.block);
      return act('open-chest');
    }
    if (item?.kind === 'flint_and_steel') {
      const q = target.adjacent;
      if (!q || q[1] === 0 || q[1] >= (state.world.height === 256 ? 256 : state.world.height - 1) || !state.world.inside(...q)) return act('flint-invalid-position');
      if (state.world.get(...q) === 0) {
        hook('playSound', 'fire.ignite', { volume: 1, pitch: random() * 0.4 + 0.8,
          position: { x: q[0] + 0.5, y: q[1] + 0.5, z: q[2] + 0.5 } });
        state.fire.ignite(...q);
        hook('updateBlocks', state.fire.drain());
      }
      if (!state.survival.creative) state.survival.wear(id);
      hook('reportBrokenTool');
      hook('renderHotbar');
      hook('markUnsaved');
      return act('use-flint-and-steel');
    }
    if (!state.survival.creative && item?.food) { beginEating(state, id, hook); return act('begin-eating'); }

    const result = placeHeldBlock({
      world: state.world, survival: state.survival, position: state.position,
      flowers: state.flowers, yaw: state.yaw, farming: state.farming,
    }, { id, item, target }, {
      ...hooks.placement,
      toast: hooks.toast,
      updateBlock: hooks.updateBlock,
      renderHotbar: hooks.renderHotbar,
      markUnsaved: hooks.markUnsaved,
      sound: hooks.sound,
      playSound: hooks.playSound,
      collides: hooks.collides,
    });
    return act(result?.placed ? 'place-block' : `placement-${result?.reason || 'handled'}`, { placement: result });
  }

  // Left-clicking extinguishes adjacent fire before bedrock/Creative/mining checks.
  const burning = target.adjacent;
  if (burning && state.world.get(...burning) === FIRE && (state.survival.creative || !(state.mining && state.mining.block.every((v, i) => v === target.block[i])))) {
    state.fire.extinguish(...burning);
    hook('playSound', 'random.fizz', { volume: 0.5, pitch: 2.6 + (random() - random()) * 0.8,
      position: { x: burning[0] + 0.5, y: burning[1] + 0.5, z: burning[2] + 0.5 } });
    hook('updateBlocks', state.fire.drain());
    hook('markUnsaved');
    if (state.survival.creative) { state.mineCooldown = 5; return act('extinguish-fire-creative'); }
  }
  if (block === 11 && !state.survival.creative) return act('bedrock-unbreakable');
  if (state.survival.creative) {
    if (item?.kind === 'sword') return act('creative-sword-no-break');
    hook('breakBlock', target.block, true);
    state.mineCooldown = 5;
    return act('creative-break');
  }
  if (state.mining && state.mining.tool === id && state.mining.block.every((v, i) => v === target.block[i])) return act('mining-already-started');
  const under = hook('clientEyeInWater');
  if (state.survival.mining(block, id, !!under, state.grounded).progress >= 1) {
    hook('breakBlock', target.block);
    return act('instant-break');
  }
  state.mining = { block: [...target.block], type: block, progress: 0, tool: id, auto: !state.mineHeld };
  return act('start-mining');
}

function beginEating(state, id, hook) {
  if (state.survival.food >= 20) { hook('toast', 'You are not hungry.'); return; }
  if (state.survival.count(id) && !state.eating) state.eating = { id, ticks: 32 };
}
