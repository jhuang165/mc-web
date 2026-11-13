// Batch 55 instantbreak: the client's own block changes before the server's packet is handled.
// Natively (PlayerControllerMP, bytecode-read) an instant, finished or creative break removes the block on the CLIENT world at once
// (onPlayerDestroyBlock: playAuxSFX 2001, then setBlockToAir) and a right click runs ItemBlock.onItemUse on the client world at once (the
// place sound plays then); the server's C07/C08 is handled later in the network tick and its S23 block change confirms or reverts.
// The port has one shared world, so the server half (the queued break or placement) stays where it is, and the client half is an overlay:
// cell -> predicted block and metadata. The renderer (Scene.buildChunk), the aim ray and the client player's collision read `view`, which
// answers get/getMeta from the overlay; every mutator goes to the real world. An entry ends when its queued task starts (the server's own
// change, or its refusal, then lands in the real world and the cell is rebuilt, which is the S23).
import { collides, isLiquid, BED, TORCH, REDSTONE_TORCH, REDSTONE_TORCH_OFF, LADDER, SNOW_LAYER, REEDS, CACTUS, DOUBLE_PLANT, SAPLING, TALL_GRASS, FERN, PISTON_HEAD,
  REPEATER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, LEVER, STONE_BUTTON, WOODEN_BUTTON, LIGHT_PLATE, HEAVY_PLATE, isFlower } from './world.js';
import { ITEMS } from './survival.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { isDoor, activateDoor, doorNeighbourChange, doorReplaceable } from './doors-panes.js';
import { bedNeighbourChange } from './bed.js';
import { torchSupported } from './torches.js';
import { flowerCanStay, flowerGround } from './flowers.js';
import { signShouldPop, isSign } from './signs.js';
import { ladderSupported } from './ladders.js';
import { snowFalls } from './snow.js';
import { carpetCanStay, CARPET } from './colored-blocks.js';
import { reedCanStay, cactusCanStay } from './plants.js';
import { farmNeighbourChange } from './farming.js';
import { isStemCake, popDrops, cakePlacement, CAKE } from './stems-cake.js';
import { redstoneSupported } from './redstone-blocks.js';
import { wartCanStay, wartPlantedBy, NETHER_WART } from './nether-wart.js';
import { plantedBlock } from './crops.js';
import { baseOfHead, headOfBase, isPistonBase, pistonExtended } from './dispenser-piston.js';
import { FENCE_GATE, TRAPDOOR, gateUseMeta } from './shaped-blocks.js';
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
// A copy-on-write world: reads see the writes, every mutator records a write and nothing real changes. `onWrite` runs for each write that changes a cell.
function scratchWorld(world, onWrite) {
  const writes = new Map(), scratch = Object.create(world);
  scratch.get = (x, y, z) => writes.get(keyOf(x, y, z))?.block ?? world.get(x, y, z);
  scratch.getMeta = (x, y, z) => writes.get(keyOf(x, y, z))?.meta ?? world.getMeta(x, y, z);
  scratch.put = (x, y, z, block, meta = 0) => {
    if (!world.inside(x, y, z) || (world.isLoaded && !world.isLoaded(x, z))) return false;
    const changed = scratch.get(x, y, z) !== block || scratch.getMeta(x, y, z) !== meta;
    writes.set(keyOf(x, y, z), { x, y, z, block, meta });
    if (changed) onWrite?.(x, y, z);
    return true;
  };
  scratch.set = (x, y, z, block, track = true, meta = 0) => scratch.put(x, y, z, block, meta);
  scratch.setRaw = scratch.put;
  return { scratch, writes };
}

// The dry run of ItemBlock.onItemUse against a copy-on-write world: it returns the cells the placement writes (final value per cell),
// whether it placed, and runs the client's place sound hook at once. Survival state, tile maps and farming are stubbed so nothing real changes.
export function dryPlace(state, request, hooks = {}) {
  const { world, survival } = state, { scratch, writes } = scratchWorld(world);
  const held = Object.create(survival);
  Object.assign(held, { chests: {}, enderTiles: {}, dispensers: {}, hoppers: {}, take() {}, wear() {}, wearBlock() {} });
  Object.defineProperty(held, 'held', { get: () => survival.held });
  const result = placeHeldBlock({ world: scratch, survival: held, position: state.position, flowers: state.flowers, yaw: state.yaw, farming: { observe() {} } },
    request, { collides: hooks.collides ?? collides, toast: () => {}, updateBlock: () => {}, renderHotbar: () => {}, markUnsaved: () => {}, scheduleFalling: () => {},
      sound: hooks.sound, playSound: hooks.playSound });
  return { placed: !!result?.placed, result, cells: result?.placed ? [...writes.values()] : [] };
}

// BlockX.onNeighborBlockChange on the CLIENT world for the cell (x, y, z), as the probe measured it (client-predict-reference.json, executed on the
// native classes with isRemote set): blocks that lose their support or their other half set themselves to air. BlockRedstoneWire, BlockRailBase,
// BlockTrapDoor and BlockBed's support check return early on the client (isRemote), falling blocks only schedule a tick: nothing for those.
const REDSTONE_PARTS = new Set([REPEATER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, LEVER, STONE_BUTTON, WOODEN_BUTTON, LIGHT_PLATE, HEAVY_PLATE]);
export function clientNeighbourChange(w, x, y, z) {
  const b = w.get(x, y, z);
  if (!b) return;
  if (isDoor(b)) doorNeighbourChange(w, x, y, z, 0);
  else if (b === BED) bedNeighbourChange(w, x, y, z);
  else if (b === TORCH || b === REDSTONE_TORCH || b === REDSTONE_TORCH_OFF) { if (!torchSupported(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === DOUBLE_PLANT) {
    const top = (w.getMeta(x, y, z) & 8) !== 0;
    if (top ? w.get(x, y - 1, z) !== DOUBLE_PLANT : w.get(x, y + 1, z) !== DOUBLE_PLANT || !flowerGround(w.get(x, y - 1, z))) w.set(x, y, z, 0);
  }
  else if (isFlower(b) || b === SAPLING || b === TALL_GRASS || b === FERN) { if (!flowerCanStay(w, null, x, y, z)) w.set(x, y, z, 0); }
  else if (b === NETHER_WART) { if (!wartCanStay(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === REEDS) { if (!reedCanStay(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === CACTUS) { if (!cactusCanStay(w, x, y, z)) w.set(x, y, z, 0); }
  else if (isSign(b)) { if (signShouldPop(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === LADDER) { if (!ladderSupported(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === SNOW_LAYER) { if (snowFalls(w, x, y, z)) w.set(x, y, z, 0); }
  else if (b === CARPET) { if (!carpetCanStay(w, x, y, z)) w.set(x, y, z, 0); }
  else if (isStemCake(b)) { if (popDrops(w, x, y, z) !== null) w.set(x, y, z, 0); }
  else if (REDSTONE_PARTS.has(b)) { if (!redstoneSupported(w, b, x, y, z)) w.set(x, y, z, 0); }
}
const SIX = [[0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
// Runs the neighbour chain of a changed cell on a scratch world until nothing more changes (each removal notifies its own neighbours).
function settle(scratch, queue) {
  for (let n = 0; queue.length && n < 2048; n++) {
    const [x, y, z] = queue.shift();
    for (const [dx, dy, dz] of SIX) clientNeighbourChange(scratch, x + dx, y + dy, z + dz);
    for (const c of farmNeighbourChange(scratch, x, y, z)) void c; // crops off farmland, farmland under a solid block (BlockCrops / BlockFarmland)
  }
}

// PlayerControllerMP.onPlayerDestroyBlock on the client world (bytecode-read order, replayed by the probe): setBlockToAir, the six neighbour
// notifications, then Block.onBlockDestroyedByPlayer (nothing is harvested or dropped client side). Returns the cells that end up different
// as {x,y,z,block,meta}; the broken cell is the first.
export function dryBreak(state, p) {
  const { world } = state, queue = [], { scratch, writes } = scratchWorld(world, (x, y, z) => queue.push([x, y, z]));
  const block = world.get(...p), meta = world.getMeta(...p);
  if (!block) return { cells: [] };
  scratch.set(p[0], p[1], p[2], 0);
  settle(scratch, queue);
  if (block === PISTON_HEAD) { // BlockPistonExtension.breakBlock: the extended base behind the head goes with it
    const base = baseOfHead(...p, meta);
    if (isPistonBase(scratch.get(...base)) && pistonExtended(scratch.getMeta(...base))) { scratch.set(...base, 0); settle(scratch, queue); }
  } else if (isPistonBase(block) && pistonExtended(meta)) { // an extended base's head is left without a base and vanishes
    const head = headOfBase(...p, meta);
    if (scratch.get(...head) === PISTON_HEAD) { scratch.set(...head, 0); settle(scratch, queue); }
  }
  return { cells: [...writes.values()].filter((c) => c.block !== world.get(c.x, c.y, c.z) || c.meta !== world.getMeta(c.x, c.y, c.z)) };
}

// Block.onBlockActivated that changes the client world at once (probe: wooden door, trapdoor and fence gate toggle; iron door, lever, note block, cake,
// bed do nothing client side). Returns the changed cells, or null when this block is not one the client toggles.
export function dryActivate(state, target) {
  const { world } = state, [x, y, z] = target.block, b = world.get(x, y, z), { scratch, writes } = scratchWorld(world);
  if (isDoor(b)) activateDoor(scratch, x, y, z);
  else if (b === TRAPDOOR) scratch.put(x, y, z, b, world.getMeta(x, y, z) ^ 4);
  else if (b === FENCE_GATE) scratch.put(x, y, z, b, gateUseMeta(world.getMeta(x, y, z), Math.fround(180 - (state.yaw * 180) / Math.PI)));
  else return null;
  return [...writes.values()];
}
// Item.onItemUse for the items placeHeldBlock does not handle (ItemCake via ItemReed, ItemSeeds, nether wart): the one cell they write.
// Bed, sign and skull items return early on the client (isRemote): not predicted.
export function dryUse(state, request) {
  const { world, survival } = state, { id, target } = request, [x, y, z] = target.block, usable = survival.creative || survival.usable?.(id);
  if (!usable || (survival.held?.id === id && survival.held.count === 0)) return [];
  if (id === ITEM_CAKE) { const c = cakePlacement(world, target, doorReplaceable); return c ? [{ x: c[0], y: c[1], z: c[2], block: CAKE, meta: 0 }] : []; }
  const up = y + 1, face = target.adjacent?.[1] === up, free = world.get(x, up, z) === 0 && up < (world.height ?? 256) - 1;
  if (wartPlantedBy(id)) return face && free && wartCanStay(world, x, up, z) ? [{ x, y: up, z, block: NETHER_WART, meta: 0 }] : [];
  const crop = plantedBlock(id);
  if (crop) return face && (world.get(x, y, z) === 29 || world.get(x, y, z) === 30) && world.get(x, up, z) === 0 && y < (world.height ?? 256) - 2 ? [{ x, y: up, z, block: crop, meta: 0 }] : [];
  return [];
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

// What a right click on a block draws at once: 'activate' (door, trapdoor, gate toggle), 'place' (placeHeldBlock) or 'use' (cake, seeds, wart), else null.
export function useKind({ world, target, heldId, sneaking, aimed }) {
  if (aimed || !target) return null;
  const b = world.get(...target.block), item = heldId ? ITEMS[heldId] : null;
  if (!sneaking || !item) { if (isDoor(b) || b === TRAPDOOR || b === FENCE_GATE) return 'activate'; }
  if (predictsPlacement({ world, target, heldId, sneaking, aimed })) return 'place';
  if (!heldId || (!sneaking && activatesOnClick(b))) return null;
  return heldId === ITEM_CAKE || wartPlantedBy(heldId) || plantedBlock(heldId) ? 'use' : null;
}
