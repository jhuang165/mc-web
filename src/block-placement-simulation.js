// Ordinary held-block placement from main.js edit(place = true). The world and
// Survival own gameplay state; synchronous hooks keep UI/audio observers in
// their original positions without requiring a browser or scene.
import { collides, WOOL, RED_FLOWER, SNOW_LAYER, SAPLING, REEDS, LADDER, CACTUS, isLiquid, isFlower } from "./world.js";
import { stackedSnowMeta, snowCanStay } from "./snow.js";
import { reedTarget, canPlaceReeds, cactusCanPlace, REEDS_ITEM } from "./plants.js";
import { canPlaceChest, placeChest, CHEST } from "./chest.js";
import { flowerCanStay } from "./flowers.js";
import { saplingCanStay, placedLeavesMeta } from "./trees.js";
import { canPlaceLadder, placedLadderMeta, clickedSide } from "./ladders.js";

const BLOCK_MAX = new Set([WOOL, RED_FLOWER, 2, 6, 56, 58]);
const result = (placed, reason, block = null, position = null) => ({ placed, reason, block, position });

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
  const { id, item, target } = request;
  const {
    collides: intersects = collides,
    toast = () => {},
    updateBlock = () => {},
    renderHotbar = () => {},
    sound = () => {},
    playSound = () => {},
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
    playSound("dig.snow", { position: { x: here[0] + 0.5, y: here[1] + 0.5, z: here[2] + 0.5 }, volume: 1, pitch: 0.8 });
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

  // ItemBlock.onItemUse: replace a one-layer snow cell; full snow remains the
  // clicked block and placement uses the adjacent target.
  const p = block === SNOW_LAYER && !hereMeta ? here : adjacent;
  if (!withinBounds(p)) return result(false, "invalid-position", id, p);
  if (!item?.block || isLiquid(id)) {
    toast("Select a building block, food, or workstation.");
    return result(false, "not-a-building-block", id, p);
  }
  if (!survival.creative && !survival.count(id)) {
    toast("Gather this material first.");
    return result(false, "empty-stack", id, p);
  }
  if (id === CHEST && !canPlaceChest(world, ...p)) return result(false, "chest-support", id, p);
  if (isFlower(id) && !flowerCanStay(world, flowers, ...p)) return result(false, "flower-support", id, p);
  if (id === SAPLING && !saplingCanStay(world, ...p)) return result(false, "sapling-support", id, p);
  if (id === SNOW_LAYER && !snowCanStay(world, ...p)) return result(false, "snow-support", id, p);
  if (id === LADDER && !canPlaceLadder(world, ...p)) return result(false, "ladder-support", id, p);
  if (id === CACTUS && !cactusCanPlace(world, ...p)) return result(false, "cactus-support", id, p);

  const old = world.get(...p), oldMeta = world.getMeta(...p);
  const meta = BLOCK_MAX.has(id) ? survival.held?.damage || 0
    : id === 5 ? placedLeavesMeta()
      : id === LADDER ? placedLadderMeta(world, ...p, clickedSide(here, p))
        : 0;
  world.set(...p, id, false, meta);
  if (intersects(world, position.x, position.y, position.z)) {
    world.set(...p, old, false, oldMeta);
    toast("Give yourself a little room to build.");
    return result(false, "player-collision", id, p);
  }
  world.set(...p, id, true, meta);
  if (id === CHEST) placeChest(world, survival.chests, ...p, yaw);
  farming.observe(...p);
  if (!survival.creative) survival.take(id);
  updateBlock(p[0], p[2], p[1]);
  renderHotbar();
  sound(true, id);
  markUnsaved();
  return result(true, "block", id, p);
}
