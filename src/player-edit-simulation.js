import { isChestBlock, ENDER_CHEST, TRAPPED_CHEST } from './chest-blocks.js';
import { CAKE, ITEM_CAKE, cakeEat, cakePlacement } from './stems-cake.js';
import { CHEST } from './chest.js';
import { DISPENSER, DROPPER } from './dispenser-piston.js';
import { newDispenser, DROPPER_TITLE } from './dispenser-container.js';
import { BOW, canDraw } from './bow.js';
import { FISHING_ROD } from './fishing-content.js';
import { CARROT_ON_A_STICK, SADDLE } from './pig-saddle.js';
import { plantedBlock } from './crops.js';
import { NETHER_WART, ITEM_NETHER_WART } from './nether-wart.js';
import { growGrass } from './flowers.js';
import { isBucket } from './buckets.js';
import { useHeldBucket } from './buckets-simulation.js';
import { ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE, eggOf } from './spawn-eggs.js';
import { isAgeable, entityRandom } from './entities.js';
import { creeperIgnite } from './creeper.js';
import { useEggOnBlock, useEggOnWater, useFireCharge, throwExpBottle } from './spawn-egg-use.js';
import { isThrowable, throwHeldItem } from './player-throw-simulation.js';
import { BEACON } from './pyramid.js';
import { ITEM_EYE_OF_ENDER } from './eye-of-ender.js';
import { DRAGON_EGG } from './dragon-egg.js';
import { REDSTONE_ORE, LIT_REDSTONE_ORE } from './world.js';
import { useEyeOfEnder } from './eye-of-ender-live.js';
import { ITEM_EMPTY_MAP } from './maps.js';
import { ITEM_FIREWORK_ROCKET } from './fireworks.js';
import { isBook } from './books.js';
import { useFirework } from './fireworks-live.js';
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
import { ITEM_SKULL, placeSkull } from './skull.js';
import { SOUL_SAND } from './nether-blocks.js';
import { isDoor, activateDoor, doorSound, doorReplaceable } from './doors-panes.js';
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
export const STATIONS = new Set([13, 14, BREWING_STAND, 41, TRAPPED_CHEST, ENDER_CHEST, DISPENSER, DROPPER, HOPPER, ANVIL, BEACON, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, BED, LEVER, STONE_BUTTON, REPEATER,
  FENCE_GATE, TRAPDOOR, CAKE, 139, 177, DRAGON_EGG]);
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
  if (place && isThrowable(id) && (state.survival.creative || state.survival.usable(id)) && !usesBlock) {
    const thrown = throwHeldItem(state, id, hooks);
    return act('throw-projectile', { projectile: thrown.kind });
  }
  // ItemExpBottle (spawn-egg-use.js): thrown like a snowball; Creative keeps the stack.
  if (place && id === ITEM_EXP_BOTTLE && !usesBlock && (state.survival.creative || state.survival.usable(id)) && throwExpBottle(state, hooks)) return act('throw-projectile', { projectile: 'expBottle' });
  // ItemEnderEye: onItemUse on a frame, else onItemRightClick towards the nearest stronghold (eye-of-ender-live.js).
  if (place && id === ITEM_EYE_OF_ENDER && state.eyes && (state.survival.creative || state.survival.usable(id))) {
    const used = useEyeOfEnder(state, { target, usesBlock }, hooks);
    if (used) return act(used.branch);
  }
  // ItemEmptyMap.onItemRightClick: becomes a filled map centred on the player (maps-clock-live.js).
  if (place && id === ITEM_EMPTY_MAP && !usesBlock && state.maps) {
    const made = state.maps.useEmptyMap(state);
    hook('swing');
    hook('renderHotbar');
    hook('markUnsaved');
    return act('use-empty-map', { map: made.data.id });
  }
  // ItemFirework.onItemUse launches a rocket from the clicked block face (fireworks-live.js).
  if (place && id === ITEM_FIREWORK_ROCKET && state.rockets && (state.survival.creative || state.survival.usable(id))) {
    const used = useFirework(state, { target, usesBlock }, hooks);
    if (used) return act(used.branch);
  }
  // ItemWritableBook / ItemEditableBook.onItemRightClick: displayGUIBook opens GuiScreenBook (book-ui.js); no onItemUse.
  if (place && isBook(id) && !usesBlock) {
    hook('openBook', state.survival.held);
    return act('open-book');
  }
  // ItemCarrotOnAStick.onItemRightClick (no onItemUse): boosts the pig the player rides and steers (pig-saddle-live.js).
  if (place && id === CARROT_ON_A_STICK && !usesBlock && !aimedEntity && state.mobs?.stickUse?.(state.survival, state.rider)) {
    hook('renderHotbar');
    hook('reportBrokenTool');
    hook('markUnsaved');
    return act('use-carrot-on-a-stick');
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

  // ItemMonsterPlacer.onItemRightClick: an egg aimed at a water surface (spawn-egg-use.js); other clicks fall through to onItemUse.
  if (place && id === ITEM_SPAWN_EGG && !usesBlock && !aimedEntity && useEggOnWater(state, bucket, hooks)) { hook('swing'); return act('use-spawn-egg-water'); }
  // ItemFood starts the use animation, not an attack swing. A successful planting action swings separately below.
  if (!place || !item?.food) hook('swing');
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
      // ItemStack.hitEntity once the attack landed: ItemSaddle saddles an adult pig, using the saddle up even in Creative.
      if (id === SADDLE) state.mobs.saddleHit?.(aimedEntity.entity, state.survival);
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
    // EntityCreeper.interact: the pitch is the creeper's own Entity.rand nextFloat (creeper.js creeperIgnite; creeperwitch-b45 records).
    const ignite = creeperIgnite(e, entityRandom(e));
    hook('playSound', ignite.name, { volume: ignite.volume, pitch: ignite.pitch, position: ignite.position });
    if (!state.survival.creative) state.survival.wear(id);
    hook('reportBrokenTool');
    hook('renderHotbar');
    hook('markUnsaved');
    return act('ignite-creeper');
  }

  // ItemLead.onItemUse / BlockFence.onBlockActivated: the player's leashed mobs tie to the fence (horse-gear-live.js).
  if (place && activates && !aimedEntity && target && state.mobs?.leashFence?.(target.block, state.survival)) {
    hook('renderHotbar'); hook('markUnsaved');
    return act('leash-fence');
  }

  if (place && aimedEntity?.entity) {
    const e = aimedEntity.entity;
    // EntityLiving.interactFirst: a lead in hand ties the mob, the holder's click frees it (horse-gear-live.js).
    if (state.mobs.leashInteract?.(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('leash-entity');
    }
    // ItemSaddle.itemInteractionForEntity (EntityPlayer.interactWith, before the mob's own interact): true for any pig.
    if (state.mobs.saddleUse?.(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('saddle-pig');
    }
    // EntityAgeable.interact: a spawn egg in hand never reaches the mob's own interact (no trade, no feeding); an egg of the
    // mob's class spawns a baby of it.
    if (id === ITEM_SPAWN_EGG && isAgeable(e.type)) {
      if (state.mobs.spawnEggBaby?.(e, state.survival, eggOf(state.survival.held?.damage))) { hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved'); }
      return act('spawn-egg-ageable');
    }
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
    // EntityOcelot.interact: raw fish tame a tempted ocelot or breed a cat, the owner's other clicks sit it.
    if (e.type === 'ocelot' && state.mobs.ocelotInteract(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('interact-ocelot');
    }
    if (state.mobs.mooshroomInteract?.(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('interact-mooshroom');
    }
    // EntityHorse.interact: feed, tame by riding, saddle, chest and mount (horse-live.js).
    if (e.type === 'horse' && state.mobs.horseInteract(e, state.survival, { sneak: !!state.motion?.sneaking, horses: state.mobs.horseSeats, open: (h) => hook('openHorse', h) })) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('interact-horse');
    }
    // ItemNameTag via ItemStack.interactWithEntity: names the mob once its own interact declined (horse-gear-live.js).
    if (state.mobs.nameTagUse?.(e, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('name-entity');
    }
    if (state.mobs.shear(e, id, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
      return act('shear-entity');
    }
    if (state.mobs.feed(e, id, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
    } else if (e.type === 'pig' && state.rider && state.mobs.horseSeats && state.mobs.pigMount?.(e, Object.assign(state.mobs.horseSeats, { player: state.rider }))) {
      // EntityPig.interact after EntityAnimal.interact declined: a saddled pig seats the player (pig-saddle-live.js).
      hook('markUnsaved');
      return act('mount-pig');
    } else if (state.mobs.dye(e, state.survival.held, state.survival)) {
      hook('handleEntityEvents'); hook('renderHotbar'); hook('markUnsaved');
    } else if (!state.survival.creative && item?.food) {
      beginEating(state, id, hook);
    } else if (item?.kind === 'sword') {
      beginBlocking(state, id);
    }
    // EntityPlayer.interactWith / interactFirst returned true: a held stack left at size <= 0 is destroyed outside Creative (leads2-reference.json sizes).
    if (!state.survival.creative && state.survival.held && state.survival.held.count <= 0) { state.survival.inventory.main[state.survival.inventory.current] = null; hook('renderHotbar'); }
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
    else if (place && item?.kind === 'sword') beginBlocking(state, id);
    return act('no-block-target');
  }

  const block = state.world.get(...target.block);
  if (place) {
    const [x, y, z] = target.block;
    // PlayerControllerMP.onPlayerRightClick: unless sneaking with an item, Block.onBlockActivated runs first and
    // the held item's onItemUse (hoe, seeds, bone meal, ...) only when the block declines.
    // BlockRedstoneOre.onBlockActivated sparkles and lights the ore, then returns false: the held item's use goes on below.
    if (activates && (block === REDSTONE_ORE || block === LIT_REDSTONE_ORE)) hook('touchRedstoneOre', x, y, z);
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
    if (activates && block === BEACON) { hook('useBeacon', target.block.join(',')); return act('open-beacon'); }
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
    // BlockDragonEgg.onBlockActivated: the egg teleports (dragon-egg-live.js) and the click is consumed.
    if (activates && block === DRAGON_EGG && hook('useDragonEgg', x, y, z) !== undefined) return act('use-dragon-egg');
    // BlockCake.onBlockActivated (stems-cake.js): eat a slice when hungry and not in Creative; the seventh bite removes the cake.
    if (activates && block === CAKE) {
      const eaten = cakeEat(state.survival, state.world, x, y, z);
      if (eaten.ate) {
        state.world.set(x, y, z, eaten.next === null ? 0 : CAKE, true, eaten.next ?? 0);
        hook('updateBlock', x, z, y); hook('renderVitals'); hook('markUnsaved');
        hook('playSound', 'random.eat', { volume: 0.5, pitch: 1, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
      }
      return act('use-cake', { eaten });
    }
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
    if (activates && block === ENDER_CHEST) {
      // BlockEnderChest.onBlockActivated: the player's own 27-slot ender inventory (refused under a normal cube).
      const chest = state.survival.openEnderChest(state.world, ...target.block);
      if (chest) hook('openChest', chest, target.block.join(','), target.block);
      return act('open-ender-chest');
    }
    if (activates && isChestBlock(block)) {
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
    if (item?.kind === 'hoe') {
      if (!state.survival.creative && !state.survival.usable(id)) return act('hoe-no-item');
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
    // ItemSeeds(nether wart, soul sand).onItemUse: the top face of soul sand with air above (nether-wart.js).
    if (id === ITEM_NETHER_WART && (state.survival.creative || state.survival.usable(id)) && target.adjacent?.[1] === y + 1 && block === SOUL_SAND && state.world.get(x, y + 1, z) === 0 && y + 1 < (state.world.height ?? 128) - 1) {
      state.world.set(x, y + 1, z, NETHER_WART, true, 0);
      if (!state.survival.creative) state.survival.take(id);
      hook('updateBlock', x, z, y + 1);
      hook('renderHotbar');
      hook('playSound', 'step.grass', { volume: 0.5, pitch: 1, position: { x: x + 0.5, y: y + 1, z: z + 0.5 } });
      hook('markUnsaved');
      return act('plant-nether-wart');
    }
    if (plantedBlock(id)) {
      if ((state.survival.creative || state.survival.usable(id)) && target.adjacent?.[1] === y + 1 && state.farming.plant(x, y, z, id)) {
        if (!state.survival.creative) state.survival.take(id);
        if (item?.food) hook('swing');
        hook('applyFarmUpdates', state.farming.drain());
        hook('renderHotbar');
        hook('playSound', 'step.grass', { volume: 0.5, pitch: 1, position: { x: x + 0.5, y: y + 1, z: z + 0.5 } });
        hook('markUnsaved');
        return act('plant-crop');
      }
      // When aiming at farmland or a crop, a blocked/wrong-face placement remains a planting attempt.
      if (!item?.food || block === 29 || block === 30 || isCrop(block)) return act('plant-seeds-failed');
    }
    if (id === DYE && state.survival.held?.damage === 15) {
      if (!state.survival.creative && !state.survival.usable(id)) return act('bone-meal-no-item');
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
        if (!state.survival.creative) state.survival.take(id); // the held stack, even at size 0 or below (neg-stacks-reference.json use boneMeal)
        hook('renderHotbar');
        // ItemDye (bone meal) plays no sound in 1.7.10: only level event 2005 (the sparkles below); verified in block-sounds-reference.json.
        hook('markUnsaved');
        const now = state.world.get(x, y, z);
        hook('boneMealSparkles', now, x, y, z, now === SAPLING ? Math.fround(0.8) : isCrop(now) ? Math.fround(0.25) : 1, state.itemRand);
      }
      return act('use-bone-meal');
    }
    if (id === ITEM_SPAWN_EGG && useEggOnBlock(state, target, hooks)) return act('use-spawn-egg');
    if (id === ITEM_FIRE_CHARGE && useFireCharge(state, target, hooks)) return act('use-fire-charge');
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
    if (item?.kind === 'sword') { beginBlocking(state, id); return act('begin-blocking'); }

    // ItemBed.onItemUse (bed-reference.json): top face only, both cells air with a solid top below.
    if (id === ITEM_BED) {
      const placed = placeBed({ world: state.world, survival: state.survival, yaw: state.yaw, farming: state.farming }, { id, target }, {
        updateBlock: hooks.updateBlock, renderHotbar: hooks.renderHotbar, markUnsaved: hooks.markUnsaved, sound: hooks.sound,
      });
      return act(placed.placed ? 'place-block' : `placement-${placed.reason}`, { placement: placed });
    }
    // ItemReed.onItemUse for the cake item (stems-cake.js).
    if (id === ITEM_CAKE) {
      const cell = cakePlacement(state.world, target, doorReplaceable);
      // ItemReed refuses a size-0 stack in either mode (attributes2-reference.json use, cake).
      if (!cell || (!state.survival.creative && !state.survival.usable(id)) || (state.survival.held?.id === id && state.survival.held.count === 0)) return act('placement-cake');
      state.world.set(cell[0], cell[1], cell[2], CAKE, true, 0);
      if (!state.survival.creative) state.survival.take(id);
      hooks.updateBlock?.(cell[0], cell[2], cell[1]); hooks.renderHotbar?.(); hooks.markUnsaved?.(); hooks.sound?.(true, CAKE);
      return act('place-block', { placement: { placed: true, reason: 'cake', block: CAKE, position: cell } });
    }
    // ItemSkull.onItemUse (skull.js): any face but the bottom of a solid block; the Wither builds when its T completes.
    if (id === ITEM_SKULL) {
      const placed = placeSkull({ world: state.world, survival: state.survival, yaw: state.yaw, yawDegrees: state.yawDegrees }, { id, damage: state.survival.held?.damage ?? 0, target }, {
        skulls: state.skulls, difficulty: state.difficulty, soulSand: SOUL_SAND, spawnWither: hooks.spawnWither, updateBlock: hooks.updateBlock, renderHotbar: hooks.renderHotbar, markUnsaved: hooks.markUnsaved, sound: hooks.sound,
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
    if (state.survival.creative) {
      // Bytecode-read: PlayerControllerMP.clickBlockCreative extinguishes on the client world with the player (its own fizz), then the
      // server's ItemInWorldManager.onBlockClicked repeats World.extinguishFire(null, ...) and its aux 1004 packet reaches the
      // client too: Creative hears two fizzes (own random draws), Survival only the server's one (the client never extinguishes there).
      hook('playSound', 'random.fizz', { volume: 0.5, pitch: 2.6 + (random() - random()) * 0.8,
        position: { x: burning[0] + 0.5, y: burning[1] + 0.5, z: burning[2] + 0.5 } });
      state.mineCooldown = 5; return act('extinguish-fire-creative');
    }
  }
  if (block === 11 && !state.survival.creative) return act('bedrock-unbreakable');
  if (state.survival.creative) {
    if (item?.kind === 'sword') return act('creative-sword-no-break');
    hook('breakBlock', target.block, true);
    state.mineCooldown = 5;
    return act('creative-break');
  }
  if (state.mining && state.mining.tool === id && state.mining.block.every((v, i) => v === target.block[i])) return act('mining-already-started');
  // ItemInWorldManager.onBlockClicked is the server's half of C07 status 0 (b52 digstart): it runs in the network tick (hooks.serverTask, else at once)
  // and reads the block at the cell then, as the server does.
  const dug = [...target.block];
  const serverClicked = () => {
    const now = state.world.get(...dug);
    if (now === DRAGON_EGG) hook('useDragonEgg', ...dug); // BlockDragonEgg.onBlockClicked: a punch teleports it too, then mining continues
    if (now === 177) hook('blockClicked', ...dug); // BlockNote.onBlockClicked plays the note (Survival only: Creative breaks the block)
    if (now === REDSTONE_ORE || now === LIT_REDSTONE_ORE) hook('touchRedstoneOre', ...dug); // BlockRedstoneOre.onBlockClicked (Survival only: Creative breaks the block)
  };
  if (block === DRAGON_EGG || block === 177 || block === REDSTONE_ORE || block === LIT_REDSTONE_ORE) hooks.serverTask ? hooks.serverTask(serverClicked) : serverClicked();
  // C07 status 0 also starts the server's own dig timer (ItemInWorldManager.initialDamage, b53 digfinish): in the network tick like the click above. An instant
  // break starts it too (initialDamage only; server-dig.js keeps the earlier cell).
  // PlayerControllerMP.clickBlock first sends the abort (C07 status 1, resetBlockRemoving) when a dig of another block or tool is under way (b54 digabort).
  if (state.mining) { hook('digAbort'); state.mining = null; }
  if (hooks.digStart) hooks.serverTask ? hooks.serverTask(() => hooks.digStart(dug)) : hooks.digStart(dug);
  const under = hook('clientEyeInWater');
  if (playerMiningState(state.survival, block, id, !!under, state.grounded).progress >= 1) {
    hook('breakBlock', target.block);
    return act('instant-break');
  }
  state.mining = { block: [...target.block], type: block, progress: 0, tool: id, auto: !state.mineHeld };
  return act('start-mining');
}

// ItemSword.onItemRightClick: setItemInUse(72000) with EnumAction.block. Only the use state exists here (the first- and third-person sword pose); the movement slowdown
// while an item is in use (player-physics.js usingItem) and the halved damage of isBlocking (survival.js blocking, main.js movementTick) are ported (swordblock-b48.test.js).
function beginBlocking(state, id) {
  if (state.survival.usable(id) && !state.eating) state.eating = { id, ticks: 72000, block: true };
}

function beginEating(state, id, hook) {
  if (state.survival.food >= 20 && !ITEMS[id]?.alwaysEdible) return; // alwaysEdible: golden apple; a full player is silently refused (no message in 1.7.10)
  if (state.survival.usable(id) && !state.eating) state.eating = { id, ticks: 32 };
}
