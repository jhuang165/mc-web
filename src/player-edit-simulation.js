import { CHEST } from './chest.js';
import { DISPENSER, DROPPER } from './dispenser-piston.js';
import { newDispenser, DROPPER_TITLE } from './dispenser-container.js';
import { BOW, canDraw } from './bow.js';
import { FISHING_ROD } from './fishing-content.js';
import { plantedBlock } from './crops.js';
import { growGrass } from './flowers.js';
import { isBucket } from './buckets.js';
import { useHeldBucket } from './buckets-simulation.js';
import { isThrowable, throwHeldItem } from './player-throw-simulation.js';
import { BOAT_ITEM } from './boats.js';
import { ATTACK_SLOWDOWN, isCritical } from './player-movement.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { hoeSound } from './block-sounds.js';
import { playerMiningState } from './enchantment-effects.js';
import {
  DYE, FIRE, SAPLING, SNOW_LAYER, TNT, ANVIL, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, BED, isCrop,
} from './world.js';
import { ITEM_BED, placeBed } from './bed.js';
import { ITEM_SIGN, placeSign } from './signs.js';
import { isDoor, activateDoor, doorSound } from './doors-panes.js';
import { FENCE_GATE, TRAPDOOR, gateUseMeta, trapOpen } from './shaped-blocks.js';
import { ITEMS } from './survival.js';
import { mayHitBlock } from './adventure.js';
import { LEVER, STONE_BUTTON, REPEATER, redstoneActivate } from './redstone-blocks.js';
import { copyStack, makeStack } from './inventory.js';
import { HOPPER, newHopperTile } from './hopper.js';
import { BREWING_STAND, newBrewingTile } from './brewing.js';
import { ITEM_POTION, ITEM_GLASS_BOTTLE, usePotion, useGlassBottle, bottleFromCauldron } from './potion-use.js';
import { CAULDRON, FLOWER_POT, BUCKET_ITEM, cauldronUse, cauldronWash, potUse, setPotContents } from './stone-utility.js';

const FARMLAND = 29; // farming.js till(): internal dry farmland (original 60, soundTypeGravel)
const STATIONS = new Set([13, 14, BREWING_STAND, CHEST, DISPENSER, DROPPER, HOPPER, ANVIL, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, BED, LEVER, STONE_BUTTON, REPEATER]);
// PlayerControllerMP's edit(place) dispatcher with browser effects supplied by the
// caller. `state` holds the live mutable gameplay state, `request` snapshots the two
// ray targets, the held bucket's own captured trace and the click button, and hooks run
// synchronously at the original call sites. Thrown items (player-throw-simulation.js) and
// buckets (buckets-simulation.js) run headlessly against state.projectiles/items/fluids;
// their presentation reaches the same playSound/sound/resetEquipped/destroyParticles/
// updateBlock/renderHotbar/markUnsaved hooks.
export function applyPlayerEdit(state, { place = false, target = null, aimedEntity = null, bucket = null } = {}, hooks = {}) {
  const random = hooks.random ?? Math.random;
  const act = (branch, extra = {}) => ({ handled: true, branch, ...extra }),
    hook = (name, ...args) => hooks[name]?.(...args);
  if (state.screen !== 'playing') return { handled: false, branch: 'not-playing' };

  hook('unlock');
  const id = state.heldTool, item = ITEMS[id];
  const activates = !(state.motion.sneaking && id);
  // The cauldron consumes empty-hand, water-bucket and wet-leather activations; the empty flower pot
  // takes a supported plant (BlockCauldron/BlockFlowerPot.onBlockActivated).
  const targetBlock = activates && !aimedEntity && target ? state.world.get(...target.block) : 0;
  const cauldronLevel = targetBlock === CAULDRON ? state.world.getMeta(...target.block) & 3 : 0;
  const usesStoneUtility = targetBlock === CAULDRON ? cauldronUse(id, cauldronLevel, true).handled || (id === ITEM_GLASS_BOTTLE && cauldronLevel > 0) || cauldronWash(state.survival.held, cauldronLevel).handled
    : targetBlock === FLOWER_POT && !!potUse(state.world, ...target.block, id, state.survival.held?.damage || 0);
  const usesBlock = activates && !aimedEntity && target && (STATIONS.has(state.world.get(...target.block)) || usesStoneUtility);

  // ItemBoat has no onItemUse, so an activated block (chest, door, ...) wins; otherwise onItemRightClick
  // places the boat along the view ray (hooks.placeBoat returns whether one was placed).
  if (place && id === BOAT_ITEM && !usesBlock && !aimedEntity && hook('placeBoat')) return act('place-boat');
  // Snowball/egg, bow and buckets return before the vanilla hand swing.
  if (place && isThrowable(id) && (state.survival.creative || state.survival.count(id)) && !usesBlock) {
    const thrown = throwHeldItem(state, id, hooks);
    return act('throw-projectile', { projectile: thrown.kind });
  }
  if (place && id === BOW && !usesBlock) {
    if (!state.eating && canDraw(state.survival)) state.eating = { id: BOW, ticks: 0, bow: true };
    return act('begin-bow-use');
  }
  // ItemFishingRod.onItemRightClick: reels in or casts the bobber, then swings.
  if (place && id === FISHING_ROD && !usesBlock) {
    const used = hook('useFishingRod');
    hook('swing');
    hook('renderHotbar');
    hook('markUnsaved');
    return act('use-fishing-rod', { fishing: used ?? 'none' });
  }
  if (place && id === ITEM_POTION && !usesBlock) {
    const used = usePotion(state, hooks);
    return act('use-potion', { potion: used });
  }
  if (place && id === ITEM_GLASS_BOTTLE && !usesBlock) {
    const used = useGlassBottle(state, bucket, hooks);
    return act('use-glass-bottle', { bottle: used.branch });
  }
  if (place && isBucket(item) && !usesBlock) {
    // A stale or malformed bucket capture is consumed here; it never becomes a block click.
    const used = useHeldBucket(state, { id, aimedEntity, bucket }, hooks);
    return act('use-bucket', { bucket: used.branch, ...(used.skipped ? { skipped: true } : {}) });
  }

  hook('swing');
  if (!place && aimedEntity?.entity) {
    state.mining = null;
    const critical = isCritical({ fallDistance: state.fallDistance, onGround: state.grounded, inWater: state.wasInWater });
    const info = {};
    const hit = state.mobs.attack(
      aimedEntity.entity,
      id,
      state.survival,
      { x: state.position.x, z: state.position.z, yaw: state.yaw },
      state.motion.sprinting ? 1 : 0,
      critical,
      info,
    );
    if (hit) {
      if (critical) hook('criticalHit', aimedEntity.entity);
      if (info.enchantCritical) hook('enchantmentCriticalHit', aimedEntity.entity);
      // The push counts the Knockback enchantment as well as sprinting (EntityPlayer.attackTargetEntityWithCurrentItem).
      if (info.knockback !== undefined ? info.knockback > 0 : state.motion.sprinting) {
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
    // EntityVillager.interact: an adult, living, idle villager opens the trading screen.
    if (e.type === 'villager' && hook('openMerchant', e)) return act('trade-villager');
    // EntityZombie.interact: a golden apple on a weakened zombie villager starts the cure.
    if (e.type === 'zombie' && state.mobs.cure(e, id, state.survival, state.survival.held?.damage ?? 0)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('cure-zombie-villager');
    }
    // EntityWolf.interact: bones tame, meat heals or breeds, dyes recolour the collar, the owner's other clicks sit it.
    if (e.type === 'wolf' && state.mobs.wolfInteract(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('interact-wolf');
    }
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

  // Native ItemStack.useItemRightClick armor equip is reached only after the
  // clicked block declines activation. A wet cauldron consumes leather first.
  if (place && item?.armor !== undefined && !usesBlock) {
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
        // ItemHoe.func_150857_a: the tilled block's step sound at (volume + 1) / 2, frequency * 0.8, at the block.
        const tilled = hoeSound(FARMLAND);
        hook('playSound', tilled.name, { volume: tilled.volume, pitch: tilled.pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
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
        // ItemDye (bone meal) plays no sound in 1.7.10: only level event 2005 (the sparkles below); verified in block-sounds-reference.json.
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
    if (activates && block === ANVIL) { hook('useAnvil', target.block.join(',')); return act('open-anvil'); }
    // BlockDoor.onBlockActivated: a wooden door swings (aux effect 1003); an iron door consumes the click and stays shut.
    if (activates && isDoor(block)) {
      const used = activateDoor(state.world, x, y, z, random);
      if (used.changed) {
        for (const c of used.cells) hook('updateBlock', c[0], c[2], c[1]);
        hook('playSound', used.sound.event, { volume: used.sound.volume, pitch: used.sound.pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
        hook('markUnsaved');
      }
      return act('use-door', { door: used });
    }
    // BlockFenceGate / BlockTrapDoor.onBlockActivated (shaped-blocks.js): toggle the open bit (the gate also turns away from the player) and play aux effect 1003.
    if (activates && (block === FENCE_GATE || block === TRAPDOOR)) {
      const meta = state.world.getMeta(x, y, z), next = block === TRAPDOOR ? meta ^ 4 : gateUseMeta(meta, Math.fround(180 - (state.yaw * 180) / Math.PI));
      state.world.set(x, y, z, block, true, next);
      hook('updateBlock', x, z, y);
      const s = doorSound(random);
      hook('playSound', s.event, { volume: s.volume, pitch: s.pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
      hook('markUnsaved');
      return act(block === TRAPDOOR ? 'use-trapdoor' : 'use-fence-gate', { open: block === TRAPDOOR ? trapOpen(next) : (next & 4) !== 0 });
    }
    // BlockBed.onBlockActivated: either half starts sleeping (bed.js; the browser supplies the player and the time of day).
    if (activates && block === 139) { hook('useCommandBlock', x, y, z); return act('use-command-block'); }
    // BlockNote.onBlockActivated raises the note; BlockJukebox ejects, or ItemRecord.onItemUse inserts the held disc (jukebox.js).
    if (activates && (block === 177 || block === 178) && hook('useNoteJukebox', x, y, z, id)) return act('use-note-jukebox');
    if (activates && block === BED) { hook('useBed', x, y, z); return act('use-bed'); }
    // Lever, stone button and repeater right-clicks (redstone-blocks.js): local state only, no power network.
    if (activates && (block === LEVER || block === STONE_BUTTON || block === REPEATER)) {
      const used = redstoneActivate(block, state.world.getMeta(x, y, z));
      if (used.meta !== state.world.getMeta(x, y, z)) {
        state.world.set(x, y, z, block, true, used.meta);
        hook('updateBlock', x, z, y);
        if (used.release) state.world.redstoneBlocks?.schedule(x, y, z, used.release);
        hook('markUnsaved');
      }
      // A pressed button reloaded from a save has no pending release: the next click schedules one (documented deviation).
      else if (used.handled && !state.world.redstoneBlocks?.scheduled(x, y, z)) state.world.redstoneBlocks?.schedule(x, y, z, 20);
      if (used.sound) hook('playSound', used.sound[0], { volume: used.sound[1], pitch: used.sound[2], position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
      return act('use-redstone', { used });
    }
    // BlockCauldron.onBlockActivated: a water bucket fills it to level 3 and leaves an empty bucket (Survival, below level 3).
    if (activates && block === CAULDRON && id === ITEM_GLASS_BOTTLE && (state.world.getMeta(x, y, z) & 3) > 0) {
      const level = bottleFromCauldron(state, state.world.getMeta(x, y, z) & 3);
      state.world.set(x, y, z, CAULDRON, true, level);
      hook('updateBlock', x, z, y);
      hook('playSound', 'liquid.splash', { volume: 1, pitch: 1, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
      hook('renderHotbar'); hook('markUnsaved');
      return act('bottle-from-cauldron', { level });
    }
    if (activates && block === BREWING_STAND) {
      // BlockBrewingStand.onBlockActivated: the four-slot GUI (a missing tile, e.g. an imported block, is created empty).
      const key = target.block.join(','), tile = ((state.survival.brewing ??= {})[key] ??= newBrewingTile());
      hook('openBrewing', tile, key, target.block);
      return act('open-brewing');
    }
    if (activates && block === CAULDRON) {
      const level = state.world.getMeta(x, y, z) & 3, used = cauldronUse(id, level, state.survival.creative);
      const wash = cauldronWash(state.survival.held, level);
      if (wash.handled) {
        const inv = state.survival.inventory;
        let changed = false;
        if (state.survival.held?.color !== undefined) {
          inv.main[inv.current] = wash.stack;
          hook('renderHotbar');
          changed = true;
        }
        if (wash.level !== level) {
          state.world.set(x, y, z, CAULDRON, true, wash.level);
          hook('updateBlock', x, z, y);
          changed = true;
        }
        if (changed) hook('markUnsaved');
        return act('wash-leather', { level: wash.level });
      }
      if (used.handled) {
        if (used.level !== level) {
          state.world.set(x, y, z, CAULDRON, true, used.level);
          hook('updateBlock', x, z, y);
          hook('playSound', 'liquid.splash', { volume: 1, pitch: 1, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
          hook('markUnsaved');
        }
        if (used.bucket) { const inv = state.survival.inventory; inv.main[inv.current] = makeStack(BUCKET_ITEM); hook('renderHotbar'); hook('markUnsaved'); }
        return act('use-cauldron', { level: used.level });
      }
    }
    // BlockFlowerPot.onBlockActivated: an empty pot takes one plant; the block metadata becomes the plant's native damage.
    if (activates && block === FLOWER_POT) {
      const planted = potUse(state.world, x, y, z, id, state.survival.held?.damage || 0);
      if (planted) {
        setPotContents(state.world, x, y, z, planted.content);
        state.world.set(x, y, z, FLOWER_POT, true, planted.meta);
        if (!state.survival.creative) state.survival.take(id);
        hook('updateBlock', x, z, y);
        hook('renderHotbar');
        hook('markUnsaved');
        return act('use-flower-pot');
      }
    }
    if (activates && block === ENCHANTING_TABLE) { hook('useEnchantingTable', target.block.join(',')); return act('open-enchanting-table'); }
    if (activates && block === CHEST) {
      const chest = state.survival.openChest(state.world, ...target.block);
      if (chest) hook('openChest', chest, target.block.join(','), target.block);
      return act('open-chest');
    }
    if (activates && (block === DISPENSER || block === DROPPER)) {
      // BlockDispenser.onBlockActivated: the tile entity's nine-slot GUI (a missing tile, e.g. an imported block, is created empty).
      const key = target.block.join(','), dispenser = ((state.survival.dispensers ??= {})[key] ??= newDispenser());
      hook('openDispenser', dispenser, key, target.block, block === DROPPER ? DROPPER_TITLE : undefined);
      return act('open-dispenser');
    }
    if (activates && block === HOPPER) {
      // BlockHopper.onBlockActivated: the five-slot Item Hopper GUI (a missing tile, e.g. an imported block, is created empty).
      const key = target.block.join(','), hopper = ((state.survival.hoppers ??= {})[key] ??= newHopperTile());
      hook('openHopper', hopper, key, target.block);
      return act('open-hopper');
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

    // ItemBed.onItemUse (bed-reference.json): top face only, both cells air with a solid top below.
    if (id === ITEM_BED) {
      const placed = placeBed({ world: state.world, survival: state.survival, yaw: state.yaw, farming: state.farming }, { id, target }, {
        updateBlock: hooks.updateBlock, renderHotbar: hooks.renderHotbar, markUnsaved: hooks.markUnsaved, sound: hooks.sound,
      });
      return act(placed.placed ? 'place-block' : `placement-${placed.reason}`, { placement: placed });
    }
    // ItemSign.onItemUse (sign-reference.json): any face but the bottom of a solid block; the edit screen opens for the new tile.
    if (id === ITEM_SIGN) {
      const placed = placeSign({ world: state.world, survival: state.survival, yaw: state.yaw }, { id, target }, {
        signs: state.signs, openEditor: hooks.openSignEditor, updateBlock: hooks.updateBlock, renderHotbar: hooks.renderHotbar, markUnsaved: hooks.markUnsaved, sound: hooks.sound,
      });
      return act(placed.placed ? 'place-block' : `placement-${placed.reason}`, { placement: placed });
    }
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
      scheduleFalling: hooks.scheduleFalling,
      collides: hooks.collides,
    });
    return act(result?.placed ? 'place-block' : `placement-${result?.reason || 'handled'}`, { placement: result });
  }

  // PlayerControllerMP.clickBlock / ItemInWorldManager.onBlockClicked open with the adventure gate: without an exempt
  // tool nothing happens (no fire punch-out, no onBlockClicked, no digging); the click's swing above stays.
  if (!mayHitBlock(state.survival, block, state.world.getMeta?.(...target.block) ?? 0, id)) {
    state.mining = null;
    return act('adventure-not-exempt');
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
  if (block === 177) hook('blockClicked', ...target.block); // BlockNote.onBlockClicked plays the note (Survival only: Creative breaks the block)
  const under = hook('clientEyeInWater');
  if (playerMiningState(state.survival, block, id, !!under, state.grounded).progress >= 1) {
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
