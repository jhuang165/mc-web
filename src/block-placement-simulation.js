// Ordinary held-block placement from main.js edit(place = true). The world and
// Survival own gameplay state; synchronous hooks keep UI/audio observers in
// their original positions without requiring a browser or scene.
import { collides, WOOL, RED_FLOWER, SNOW_LAYER, SAPLING, REEDS, LADDER, CACTUS, TORCH, RAIL, ANVIL, TALL_GRASS, VINE, DEAD_BUSH, DEAD_SHRUB, FERN, isLiquid, isFlower } from "./world.js";
import { stackedSnowMeta, snowCanStay } from "./snow.js";
import { placeSound } from "./block-sounds.js";
import { reedTarget, canPlaceReeds, cactusCanPlace, REEDS_ITEM } from "./plants.js";
import { canPlaceChest, placeChest, CHEST } from "./chest.js";
import { flowerCanStay } from "./flowers.js";
import { saplingCanStay, placedLeavesMeta } from "./trees.js";
import { canPlaceLadder, placedLadderMeta, clickedSide } from "./ladders.js";
import { placedTorchMeta } from "./torches.js";
import { railCanPlace, railAdded, railItemBlock, isRailId } from "./rails.js";
import { anvilPlacementMeta } from './anvil-block.js';
import { isStair, stairPlacementMeta } from './stairs.js';
import { paneItemBlock, doorItemBlock, useDoorItem, doorRotationYaw, solidTopSurface, doorReplaceable } from './doors-panes.js';
import { blockOfItem as stoneUtilityItemBlock, heldSlabType, planSlabUse, endFrameFacing, STONE_BRICKS, END_PORTAL_FRAME, FLOWER_POT } from './stone-utility.js';
import { blockForItem as dispenserPistonItemBlock, isDispenserPiston, DISPENSER, DROPPER, pistonOrientation, minecraftYaw } from './dispenser-piston.js';
import { newDispenser } from './dispenser-container.js';
import { brewingItemBlock } from './brewing.js';
import { HOPPER, hopperPlacedMeta, newHopperTile } from './hopper.js';
import { blockOfItem as redstoneItemBlock, isRedstoneBlock, redstonePlacedMeta } from './redstone-blocks.js';

import { logPlacedMeta } from './wood-types.js';
import { coloredItemBlock, isColoredBlock, coloredPlacedMeta, pumpkinFacingMeta, CARPET, carpetCanStay } from './colored-blocks.js';
const BLOCK_MAX = new Set([STONE_BRICKS,4,5,7,48,69,70,71,82,WOOL, RED_FLOWER, 2, 6, 56, 58]);
const result = (placed, reason, block = null, position = null) => ({ placed, reason, block, position });
// ItemBlock.onItemUse: clicking vines, tall grass (with its dead-shrub and fern variants) or a dead bush places into the
// clicked cell itself instead of the neighbour on the clicked face.
const CLICK_REPLACED = new Set([TALL_GRASS, VINE, DEAD_BUSH, DEAD_SHRUB, FERN]);
// World.canPlaceEntityOnSide: the target cell's Material.isReplaceable (air, water, lava, fire, snow layer, Material.vine);
// public/research/replaceable-reference.json holds the native flags for every original block.
export const placementReplaceable = doorReplaceable;

/**
 * Place the selected held ItemBlock/snow/reed at the request's copied target.
 *
 * `state`: `{world,survival,position:{x,y,z},flowers,yaw,farming}`.
 * `request`: `{id,item,target:{block:[x,y,z],adjacent:[x,y,z]}}`.
 * Hooks: `collides`, `toast`, `updateBlock(x,z,y)`, `renderHotbar`,
 * `sound(placed,id)`, `playSound(name,options)`, and `markUnsaved`.
 * Returns `{placed,reason,block,position}` for the caller's action result.
 */
export function placeHeldBlock(state, request, hooks = {}) {
  const { world, survival, position, flowers, farming, yaw } = state;
  const { id: itemId, item, target } = request;
  const id = (itemId === 1139 ? 139 : 0) || coloredItemBlock(itemId) || dispenserPistonItemBlock(itemId) || redstoneItemBlock(itemId) || railItemBlock(itemId) || brewingItemBlock(itemId) || paneItemBlock(itemId) || stoneUtilityItemBlock(itemId) || itemId; // the glass pane item (1100) places block 100; stone utility items 1101-1106 their blocks 101-106
  const {
    collides: intersects = collides,
    toast = () => {},
    updateBlock = () => {},
    renderHotbar = () => {},
    sound = () => {},
    playSound = () => {},
    scheduleFalling = () => {},
    markUnsaved = () => {},
  } = hooks;
  if (!target?.block) return result(false, "no-target");
  const here = [...target.block], adjacent = target.adjacent ? [...target.adjacent] : null,
    block = world.get(...here), hereMeta = block === SNOW_LAYER ? world.getMeta(...here) : 0,
    stacked = stackedSnowMeta(hereMeta);
  const withinBounds = (p) => p && p[1] !== 0 && p[1] < (world.height === 256 ? 256 : world.height - 1) && world.inside(...p);

  // ItemSnow.onItemUse: add one layer to the clicked snow cell first. The first
  // write is silent so the real collision box is tested; failures restore meta.
  if (id === SNOW_LAYER && block === SNOW_LAYER && stacked !== null && (survival.creative || survival.count(id))) {
    world.set(...here, SNOW_LAYER, false, stacked);
    if (intersects(world, position.x, position.y, position.z)) {
      world.set(...here, SNOW_LAYER, false, hereMeta);
      toast("Give yourself a little room to build.");
      return result(false, "player-collision", SNOW_LAYER, here);
    }
    world.set(...here, SNOW_LAYER, true, stacked);
    if (!survival.creative) survival.take(id);
    updateBlock(here[0], here[2], here[1]);
    renderHotbar();
    const placed = placeSound(SNOW_LAYER); // ItemSnow.onItemUse: the snow layer's place sound at (volume + 1) / 2, frequency * 0.8
    playSound(placed.name, { position: { x: here[0] + 0.5, y: here[1] + 0.5, z: here[2] + 0.5 }, volume: placed.volume, pitch: placed.pitch });
    markUnsaved();
    return result(true, "stacked-snow", SNOW_LAYER, here);
  }

  // ItemReed.onItemUse: replace a one-layer snow/tall-grass cell, otherwise use
  // the clicked face. This item silently fails when unsupported/out of stock.
  if (id === REEDS_ITEM) {
    const cell = reedTarget(world, here, adjacent);
    if (!withinBounds(cell) || (!survival.creative && !survival.count(id)) || !canPlaceReeds(world, ...cell))
      return result(false, "cannot-place-reeds", REEDS, cell);
    world.set(...cell, REEDS, true, 0);
    if (!survival.creative) survival.take(id);
    updateBlock(cell[0], cell[2], cell[1]);
    renderHotbar();
    sound(true, REEDS);
    markUnsaved();
    return result(true, "reeds", REEDS, cell);
  }

  // ItemDoor.onItemUse: only the top face (side 1) of the clicked block places, on the cell above it, with
  // the facing from the player's yaw; no entity check, both cells must be replaceable over a solid top.
  if (doorItemBlock(id)) {
    const above = [here[0], here[1] + 1, here[2]];
    if (!adjacent || adjacent[0] !== above[0] || adjacent[1] !== above[1] || adjacent[2] !== above[2]) return result(false, "door-side", id, adjacent);
    if (!withinBounds(above) || (!survival.creative && !survival.count(id))) return result(false, "empty-stack", id, above);
    const door = useDoorItem(world, id, here[0], here[1], here[2], 1, doorRotationYaw(yaw));
    if (!door) return result(false, "door-support", id, above);
    farming.observe(...above);
    if (!survival.creative) survival.take(id);
    updateBlock(above[0], above[2], above[1]);
    updateBlock(above[0], above[2], above[1] + 1);
    renderHotbar();
    sound(true, door);
    markUnsaved();
    return result(true, "door", door, above);
  }
  // ItemBlock.onItemUse: replace a one-layer snow cell; full snow remains the
  // clicked block and placement uses the adjacent target.
  // Snow counts as clicking its top face (side 1); the Material.vine blocks keep the clicked face.
  const snowTop = block === SNOW_LAYER && !hereMeta, p = snowTop || CLICK_REPLACED.has(block) ? here : adjacent;
  if (!withinBounds(p)) return result(false, "invalid-position", id, p);
  const side = snowTop || !adjacent ? 1 : clickedSide(here, adjacent);
  if(id===351&&survival.held?.damage===3){
    if(!survival.creative&&!survival.count(id))return result(false,"empty-stack",73,p);
    if(block!==4||(world.getMeta(...here)&3)!==3||p[1]!==here[1]||world.get(...p)!==0)return result(false,'cocoa-support',73,p);
    const dx=here[0]-p[0],dz=here[2]-p[2],dir=dz===1?0:dx===-1?1:dz===-1?2:3;
    world.set(...p,73,true,dir);if(!survival.creative)survival.take(id);updateBlock(p[0],p[2],p[1]);markUnsaved();return result(true,'cocoa',73,p);
  }
  if(id===69){
    if(![1,2,29,30].includes(world.get(p[0],p[1]-1,p[2]))||!placementReplaceable(world.get(...p))||world.get(p[0],p[1]+1,p[2])!==0||!withinBounds([p[0],p[1]+1,p[2]]))return result(false,'double-plant-support',id,p);
    if(!survival.creative&&!survival.count(id))return result(false,'empty-stack',id,p);
    world.put(...p,id,survival.held?.damage||0,true);world.set(p[0],p[1]+1,p[2],id,true,8);
    if(!survival.creative)survival.take(id);updateBlock(p[0],p[2],p[1]);updateBlock(p[0],p[2],p[1]+1);markUnsaved();return result(true,'double-plant',id,p);
  }
  // ItemSlab.onItemUse (stone-utility.js planSlabUse): merge into a double slab on the open face or in the adjacent cell, else
  // place the half chosen by the side and the hit height. Item 82 is the sandstone slab (type 1); 1103's damage is the type.
  const slabType = heldSlabType(itemId, survival.held?.damage || 0);
  if (slabType >= 0) {
    if (!survival.creative && !survival.count(itemId)) { toast("Gather this material first."); return result(false, "empty-stack", id, p); }
    const hitY = Math.fround(Math.fround(target.hit?.[1] ?? here[1] + 0.5) - here[1]);
    const plan = planSlabUse(slabType, { id: block, meta: world.getMeta(...here) }, { id: world.get(...p), meta: world.getMeta(...p) }, side, hitY);
    const cell = plan.merge === "clicked" ? here : p, was = world.get(...cell), wasMeta = world.getMeta(...cell);
    if (!withinBounds(cell)) return result(false, "invalid-position", plan.id, cell);
    world.set(...cell, plan.id, false, plan.meta);
    if (intersects(world, position.x, position.y, position.z)) {
      world.set(...cell, was, false, wasMeta);
      toast("Give yourself a little room to build.");
      return result(false, "player-collision", plan.id, cell);
    }
    world.set(...cell, plan.id, true, plan.meta);
    farming.observe(...cell);
    if (!survival.creative) survival.take(itemId);
    updateBlock(cell[0], cell[2], cell[1]);
    renderHotbar();
    sound(true, plan.id);
    markUnsaved();
    return result(true, plan.merge ? "slab-merge" : "slab", plan.id, cell);
  }
  if ((!item?.block && !dispenserPistonItemBlock(itemId) && !redstoneItemBlock(itemId) && !brewingItemBlock(itemId) && !stoneUtilityItemBlock(itemId)) || isLiquid(id)) {
    toast("Select a building block, food, or workstation.");
    return result(false, "not-a-building-block", id, p);
  }
  if (!survival.creative && !survival.count(itemId)) {
    toast("Gather this material first.");
    return result(false, "empty-stack", id, p);
  }
  // World.canPlaceEntityOnSide: an occupied, non-replaceable cell (a torch, rail or flower the ray passed through, say)
  // refuses the placement and keeps the item. Before this check the block was silently overwritten.
  if (!placementReplaceable(world.get(...p))) return result(false, "occupied", id, p);
  if (id === CHEST && !canPlaceChest(world, ...p)) return result(false, "chest-support", id, p);
  // BlockCarpet.canPlaceBlockAt: any non-air block below (colored-blocks.js).
  if (id === CARPET && !carpetCanStay(world, ...p)) return result(false, "carpet-support", id, p);
  if (isFlower(id) && !flowerCanStay(world, flowers, ...p)) return result(false, "flower-support", id, p);
  if (id === SAPLING && !saplingCanStay(world, ...p)) return result(false, "sapling-support", id, p);
  if (id === SNOW_LAYER && !snowCanStay(world, ...p)) return result(false, "snow-support", id, p);
  if (id === LADDER && !canPlaceLadder(world, ...p)) return result(false, "ladder-support", id, p);
  if (id === CACTUS && !cactusCanPlace(world, ...p)) return result(false, "cactus-support", id, p);
  if (isRailId(id) && !railCanPlace(world, ...p)) return result(false, "rail-support", id, p);
  // BlockFlowerPot.canPlaceBlockAt: the block below needs a solid top surface.
  if (id === FLOWER_POT && !solidTopSurface(world, p[0], p[1] - 1, p[2])) return result(false, "pot-support", id, p);
  // BlockTorch.canPlaceBlockAt, then onBlockPlaced/onBlockAdded pick the wall (1-4) or floor
  // metadata; replacing a snow layer counts as clicking its top (side 1).
  const torchMeta = id === TORCH ? placedTorchMeta(world, ...p, side) : 0;
  if (torchMeta < 0) return result(false, "torch-support", id, p);

  // Redstone components (redstone-blocks.js): metadata from the clicked face and yaw, and the support rule; the item is kept on failure.
  const rsMeta = isRedstoneBlock(id) ? redstonePlacedMeta(world, id, ...p, side, yaw) : 0;
  if (rsMeta === null) return result(false, "redstone-support", id, p);

  const old = world.get(...p), oldMeta = world.getMeta(...p);
  const meta = isColoredBlock(id) ? coloredPlacedMeta(id, survival.held?.damage || 0, side, doorRotationYaw(yaw)) : id === 67 ? pumpkinFacingMeta(doorRotationYaw(yaw)) : id===5||id===71?placedLeavesMeta(survival.held?.damage||0):id===4||id===70?logPlacedMeta(survival.held?.damage||0,side):BLOCK_MAX.has(id) ? survival.held?.damage || 0
    : id === LADDER ? placedLadderMeta(world, ...p, side)
        : id === TORCH ? torchMeta
          : id === ANVIL ? anvilPlacementMeta(yaw,survival.held?.damage||0)
          // BlockEndPortalFrame.onBlockPlacedBy: facing from the yaw (Minecraft degrees = 180 - camera yaw).
          : id === END_PORTAL_FRAME ? endFrameFacing(Math.fround(180 - (yaw * 180) / Math.PI))
          // ItemBlock.onItemUse: onBlockPlaced(side, hit) sets the upside-down bit, onBlockPlacedBy the facing from the yaw.
          : isStair(id) ? stairPlacementMeta(yaw, side, Math.fround(Math.fround(target.hit?.[1] ?? here[1] + 0.5) - here[1]))
          : isRedstoneBlock(id) ? rsMeta
          // BlockPistonBase/BlockDispenser.onBlockPlacedBy -> determineOrientation: from the player's position and yaw (six facings).
          // BlockHopper.onBlockPlaced: the opposite of the clicked side (never up).
          : id === HOPPER ? hopperPlacedMeta(side)
          : isDispenserPiston(id) ? pistonOrientation(p[0], p[1], p[2], position.x, position.y, position.z, minecraftYaw(yaw))
          : 0;
  world.set(...p, id, false, meta);
  if (intersects(world, position.x, position.y, position.z)) {
    world.set(...p, old, false, oldMeta);
    toast("Give yourself a little room to build.");
    return result(false, "player-collision", id, p);
  }
  world.set(...p, id, true, meta);
  if (id === CHEST) placeChest(world, survival.chests, ...p, yaw);
  if (id === DISPENSER || id === DROPPER) (survival.dispensers ??= {})[p.join(',')] ??= newDispenser();
  if (id === HOPPER) (survival.hoppers ??= {})[p.join(',')] ??= newHopperTile();
  if (id === ANVIL) scheduleFalling(...p);
  // BlockRailBase.onBlockAdded: the rail takes its shape and reshapes the rails it joins.
  if (isRailId(id)) railAdded(world, ...p);
  farming.observe(...p);
  if (!survival.creative) survival.take(itemId);
  updateBlock(p[0], p[2], p[1]);
  renderHotbar();
  sound(true, id);
  markUnsaved();
  return result(true, "block", id, p);
}
