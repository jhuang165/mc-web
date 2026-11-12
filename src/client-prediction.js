// Batch 55 instantbreak: the client's own block changes before the server's packet is handled.
// Natively (PlayerControllerMP, bytecode-read) an instant, finished or creative break removes the block on the CLIENT world at once
// (onPlayerDestroyBlock: playAuxSFX 2001, then setBlockToAir) and a right click runs ItemBlock.onItemUse on the client world at once (the
// place sound plays then); the server's C07/C08 is handled later in the network tick and its S23 block change confirms or reverts.
// The port has one shared world, so the server half (the queued break or placement) stays where it is, and the client half is an overlay:
// cell -> predicted block and metadata. The renderer (Scene.buildChunk), the aim ray and the client player's collision read `view`, which
// answers get/getMeta from the overlay; every mutator goes to the real world. An entry ends when its queued task starts (the server's own
// change, or its refusal, then lands in the real world and the cell is rebuilt, which is the S23).
import { collides, isLiquid } from './world.js';
import { ITEMS } from './survival.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { isDoor } from './doors-panes.js';
import { isChestBlock } from './chest-blocks.js';
import { ITEM_BED } from './bed.js';
import { ITEM_SIGN } from './signs.js';
import { ITEM_SKULL } from './skull.js';
import { ITEM_CAKE } from './stems-cake.js';
import { CAULDRON, FLOWER_POT } from './stone-utility.js';
import { STATIONS } from './player-edit-simulation.js';

const keyOf = (x, y, z) => `${x},${y},${z}`;

export function createPrediction(world) {
  const cells = new Map();
  const view = Object.create(world);
  view.get = (x, y, z) => cells.get(keyOf(x, y, z))?.block ?? world.get(x, y, z);
  view.getMeta = (x, y, z) => cells.get(keyOf(x, y, z))?.meta ?? world.getMeta(x, y, z);
  // A write through the view is the real write (the overlay never owns state).
  for (const m of ['set', 'put', 'setRaw']) if (typeof world[m] === 'function') view[m] = (...a) => world[m](...a);
  return {
    world, cells, view,
    get active() { return cells.size > 0; },
    // Records a predicted cell; returns false when it equals what the world has (nothing to show).
    // `token` names the queued task the entry belongs to; a later prediction of the same cell replaces it.
    set(x, y, z, block, meta = 0, token = 0) {
      if (world.get(x, y, z) === block && world.getMeta(x, y, z) === meta) return false;
      cells.set(keyOf(x, y, z), { x, y, z, block, meta, token });
      return true;
    },
    // Ends an entry when its own task runs (a newer task's entry for the cell stays).
    clear(x, y, z, token) { const e = cells.get(keyOf(x, y, z)); if (!e || (token !== undefined && e.token !== token)) return false; return cells.delete(keyOf(x, y, z)); },
    clearAll() { const was = [...cells.values()]; cells.clear(); return was; },
    // The world a client-side reader (aim, collision) sees.
    read() { return cells.size ? view : world; },
  };
}

// The dry run of ItemBlock.onItemUse against a copy-on-write world: it returns the cells the placement writes (final value per cell),
// whether it placed, and runs the client's place sound hook at once. Survival state, tile maps and farming are stubbed so nothing real changes.
export function dryPlace(state, request, hooks = {}) {
  const { world, survival } = state, writes = new Map();
  const scratch = Object.create(world);
  scratch.get = (x, y, z) => writes.get(keyOf(x, y, z))?.block ?? world.get(x, y, z);
  scratch.getMeta = (x, y, z) => writes.get(keyOf(x, y, z))?.meta ?? world.getMeta(x, y, z);
  scratch.put = (x, y, z, block, meta = 0) => {
    if (!world.inside(x, y, z) || (world.isLoaded && !world.isLoaded(x, z))) return false;
    writes.set(keyOf(x, y, z), { x, y, z, block, meta });
    return true;
  };
  scratch.set = (x, y, z, block, track = true, meta = 0) => scratch.put(x, y, z, block, meta);
  scratch.setRaw = scratch.put;
  const held = Object.create(survival);
  Object.assign(held, { chests: {}, enderTiles: {}, dispensers: {}, hoppers: {}, take() {}, wear() {}, wearBlock() {} });
  Object.defineProperty(held, 'held', { get: () => survival.held });
  const result = placeHeldBlock({ world: scratch, survival: held, position: state.position, flowers: state.flowers, yaw: state.yaw, farming: { observe() {} } },
    request, { collides: hooks.collides ?? collides, toast: () => {}, updateBlock: () => {}, renderHotbar: () => {}, markUnsaved: () => {}, scheduleFalling: () => {},
      sound: hooks.sound, playSound: hooks.playSound });
  return { placed: !!result?.placed, result, cells: result?.placed ? [...writes.values()] : [] };
}

// Cells whose target block takes the click as a use (applyPlayerEdit's station and activation branches), so a held block is not placed there.
export function activatesOnClick(block) {
  return STATIONS.has(block) || block === 178 || block === CAULDRON || block === FLOWER_POT || isDoor(block) || isChestBlock(block);
}
const NOT_PLAIN = new Set([ITEM_BED, ITEM_SIGN, ITEM_SKULL, ITEM_CAKE]);
// A held ItemBlock whose right click on a plain block reaches placeHeldBlock (no entity, no activated block, not sneaking past one).
export function predictsPlacement({ world, target, heldId, sneaking, aimed }) {
  if (aimed || !target || !heldId) return false;
  const item = ITEMS[heldId];
  if (!item?.block || NOT_PLAIN.has(heldId) || isLiquid(heldId)) return false;
  return sneaking || !activatesOnClick(world.get(...target.block));
}
