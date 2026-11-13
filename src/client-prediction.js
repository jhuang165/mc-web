// Batch 55 instantbreak: the client's own block changes before the server's packet is handled.
// Natively (PlayerControllerMP, bytecode-read) an instant, finished or creative break removes the block on the CLIENT world at once
// (onPlayerDestroyBlock: playAuxSFX 2001, then setBlockToAir) and a right click runs ItemBlock.onItemUse on the client world at once (the
// place sound plays then); the server's C07/C08 is handled later in the network tick and its S23 block change confirms or reverts.
// The port has one shared world, so the server half (the queued break or placement) stays where it is, and the client half is an overlay:
// cell -> predicted block and metadata. The renderer (Scene.buildChunk), the aim ray and the client player's collision read `view`, which
// answers get/getMeta from the overlay; every mutator goes to the real world. An entry ends when its queued task starts (the server's own
// change, or its refusal, then lands in the real world and the cell is rebuilt, which is the S23).
import { collides, isLiquid, BED, TORCH, REDSTONE_TORCH, REDSTONE_TORCH_OFF, LADDER, SNOW_LAYER, REEDS, CACTUS, DOUBLE_PLANT, SAPLING, TALL_GRASS, FERN, PISTON_HEAD,
  REPEATER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, LEVER, STONE_BUTTON, WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED, LIGHT_PLATE, HEAVY_PLATE, isFlower, FIRE, COMMAND_BLOCK } from './world.js';
import { ITEMS } from './survival.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { WOODEN_DOOR_ITEM, IRON_DOOR_ITEM, isDoor, activateDoor, doorNeighbourChange, doorReplaceable, doorSound } from './doors-panes.js';
import { bedNeighbourChange } from './bed.js';
import { torchSupported } from './torches.js';
import { flowerCanStay, flowerGround } from './flowers.js';
import { signShouldPop, isSign } from './signs.js';
import { ladderSupported } from './ladders.js';
import { snowFalls } from './snow.js';
import { carpetCanStay, CARPET } from './colored-blocks.js';
import { REEDS_ITEM, reedCanStay, cactusCanStay } from './plants.js';
import { farmNeighbourChange } from './farming.js';
import { isStemCake, popDrops, cakePlacement, CAKE } from './stems-cake.js';
import { redstoneSupported, ITEM_REDSTONE, ITEM_REPEATER } from './redstone-blocks.js';
import { ITEM_BREWING_STAND } from './brewing.js';
import { wartCanStay, wartPlantedBy, NETHER_WART } from './nether-wart.js';
import { plantedBlock } from './crops.js';
import { baseOfHead, headOfBase, isPistonBase, pistonExtended } from './dispenser-piston.js';
import { FENCE_GATE, TRAPDOOR, gateUseMeta } from './shaped-blocks.js';
import { isChestBlock } from './chest-blocks.js';
import { ITEM_BED } from './bed.js';
import { ITEM_SIGN } from './signs.js';
import { ITEM_SKULL } from './skull.js';
import { ITEM_CAKE } from './stems-cake.js';
import { CAULDRON, FLOWER_POT, ITEM_CAULDRON, ITEM_FLOWER_POT } from './stone-utility.js';
import { STATIONS } from './player-edit-simulation.js';
import { traceBucket, placeContainedLiquid } from './buckets.js';
import { canPlace as fireCanPlace } from './fire.js';
import { potInsertion, potContents } from './stone-utility.js';
import { makeStack } from './inventory.js';
import { DRAGON_EGG } from './dragon-egg.js';
import { isSplashDamage, ITEM_POTION } from './potions.js';

const keyOf = (x, y, z) => `${x},${y},${z}`;

export function createPrediction(world) {
  const cells = new Map();
  const view = Object.create(world);
  view.get = (x, y, z) => cells.get(keyOf(x, y, z))?.block ?? world.get(x, y, z);
  view.getMeta = (x, y, z) => cells.get(keyOf(x, y, z))?.meta ?? world.getMeta(x, y, z);
  // A write through the view is the real write (the overlay never owns state).
  for (const m of ['set', 'put', 'setRaw']) if (typeof world[m] === 'function') view[m] = (...a) => world[m](...a);
  // The plant of a flower pot lives outside the overlay (world.pots); a predicted pot content is kept per cell and the view's `pots` answers with it.
  const pots = new Map();
  Object.defineProperty(view, 'pots', { get: () => { if (!pots.size) return world.pots; const m = new Map(world.pots ?? []); for (const [k, v] of pots) m.set(k, v); return m; }, configurable: true });
  return {
    world, cells, view, pots,
    get active() { return cells.size > 0; },
    // Records a predicted cell; returns false when it equals what the world has (nothing to show).
    // `token` names the queued task the entry belongs to; a later prediction of the same cell replaces it.
    set(x, y, z, block, meta = 0, token = 0) {
      if (world.get(x, y, z) === block && world.getMeta(x, y, z) === meta) return false;
      cells.set(keyOf(x, y, z), { x, y, z, block, meta, token });
      return true;
    },
    // Ends an entry when its own task runs (a newer task's entry for the cell stays).
    clear(x, y, z, token) { const e = cells.get(keyOf(x, y, z)); if (!e || (token !== undefined && e.token !== token)) return false; pots.delete(keyOf(x, y, z)); return cells.delete(keyOf(x, y, z)); },
    clearAll() { const was = [...cells.values()]; cells.clear(); pots.clear(); return was; },
    // A predicted pot content ({ id, damage }) for a cell; it ends with the cell's entry. Returns false when the cell has no entry to hang it on.
    setPot(x, y, z, content) { if (!cells.has(keyOf(x, y, z))) return false; pots.set(keyOf(x, y, z), { id: content.id, damage: content.damage | 0 }); return true; },
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
const REDSTONE_PARTS = new Set([REPEATER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, LEVER, STONE_BUTTON, WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED, LIGHT_PLATE, HEAVY_PLATE]);
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
  else if (b === FIRE) { if (!fireCanPlace(w, x, y, z)) w.set(x, y, z, 0); } // BlockFire.onNeighborBlockChange (probe 'break-under-fire*': an unsupported fire goes, a flammable neighbour keeps it)
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
  else if (b === STONE_BUTTON || b === WOODEN_BUTTON) { const m = world.getMeta(x, y, z); if (!(m & 8)) scratch.put(x, y, z, b, m | 8); } // BlockButton.onBlockActivated has no isRemote guard: the pressed bit (probe: 77 and 143 meta 1 -> 9)
  else if (b === COMPARATOR || b === COMPARATOR_POWERED) { // BlockRedstoneComparator.onBlockActivated on the client (probe 149 / 150, 12 records): subtract mode (bit 4) set -> the mode and the lit bit clear (m4, m5, m12 -> m & 3); else 149 sets bit 4 (m0 -> 4, m8 -> 12) and 150 sets bits 4 and 8 (m0, m8 -> 12)
    const m = world.getMeta(x, y, z);
    scratch.put(x, y, z, b, m & 4 ? m & 3 : m | (b === COMPARATOR ? 4 : 12));
  }
  else if (b === REPEATER) scratch.put(x, y, z, b, (world.getMeta(x, y, z) + 4) & 15); // BlockRedstoneRepeater: the delay steps by 4 and wraps at 16 (probe: 0->4 ... 12->0)
  else return null;
  return [...writes.values()];
}
// The sound the client plays at once for an activation (BlockDoor / BlockTrapDoor / BlockFenceGate: aux effect 1003, which the server sends to every player
// but the clicker), or null. A button or comparator click is NOT heard at the click: the client's own playSoundEffect is silent (RenderGlobal.playSound is empty,
// bytecode-read) and the sound comes once, from the server's S29 (client-predict-reference.json 'soundchain'). `random` is Math.random for the open/close pick.
export function activateSound(block, random = Math.random) {
  if (isDoor(block) || block === TRAPDOOR || block === FENCE_GATE) return doorSound(random);
  return null;
}
// ItemFlintAndSteel.onItemUse on the client world (probe 'flint-*' records): the cell beside the face, when it is air, gets fire (the sound is the server's S29); BlockFire.onBlockAdded then
// removes a fire with no solid top below and no flammable neighbour. The stack is damaged by 1 either way (outside Creative). Returns the cells that end up different.
const FACE_STEP = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const isFlintAndSteel = (id) => !!id && ITEMS[id]?.kind === 'flint_and_steel';
export function dryFlint(state, target) {
  const { world } = state, q = target.adjacent ?? (target.face != null ? target.block.map((v, i) => v + FACE_STEP[target.face][i]) : null);
  if (!q || q[1] <= 0 || q[1] >= (world.height === 256 ? 256 : (world.height ?? 256) - 1) || !world.inside(...q) || world.get(...q) !== 0) return [];
  const { scratch, writes } = scratchWorld(world);
  scratch.put(q[0], q[1], q[2], FIRE, 0);
  if (!fireCanPlace(scratch, q[0], q[1], q[2])) return [];
  return [...writes.values()];
}
// BlockFlowerPot.onBlockActivated on the client (probe 'pot-*': the client's tile takes the plant, the block metadata becomes the plant's damage, the stack loses one outside Creative).
// Returns { cell, content } or null (a full pot, a non-plant: nothing changes).
export function dryPot(state, target) {
  const { world, heldId, heldDamage } = state, [x, y, z] = target.block;
  if (!heldId || potContents(world, x, y, z)) return null;
  const ins = potInsertion(heldId, heldDamage | 0);
  return ins ? { cell: { x, y, z, block: FLOWER_POT, meta: ins.meta }, content: ins.content } : null;
}
// ItemBucket.onItemRightClick on the client world (executed, client-predict-reference.json 'bucket' records): Item.getMovingObjectPositionFromPlayer traces 5.0
// blocks from the eye (liquids only for an empty bucket, boxless blocks skipped for a full one), an empty bucket removes a source of water or lava, a full one
// sets its liquid beside the traced face (the Nether refuses water). The swapped bucket in the hand is the inventory's business and is not drawn here.
const SIDE_STEP = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const tracedBucket = (id) => { const k = id ? ITEMS[id]?.bucket : null; return k === 'empty' || k === 'filled' ? k : null; };
// `dryBucketUse` is the whole client half: the cells, the Nether's fizz cell (the water is not placed there; the client shows its smoke at the click, the fizz sound
// comes from the server's S29) and `took`, the liquid block an empty bucket removed.
export function dryBucketUse(state, eye, dir) {
  const { world } = state, kind = tracedBucket(state.heldId), out = { cells: [], fizz: null, took: 0, used: false };
  if (!kind || !eye || !dir) return out;
  const hit = traceBucket(world, eye, dir, kind === 'empty');
  if (!hit) return out;
  const [x, y, z] = hit.block;
  if (kind === 'empty') {
    if (isLiquid(world.get(x, y, z)) && world.getMeta(x, y, z) === 0) { out.cells = [{ x, y, z, block: 0, meta: 0 }]; out.took = world.get(x, y, z); out.used = true; }
    return out;
  }
  const { scratch, writes } = scratchWorld(world), [dx, dy, dz] = SIDE_STEP[hit.side];
  scratch.evaporated = (ex, ey, ez) => { out.fizz = [ex, ey, ez]; }; // recorded, never the real world's effect
  out.used = placeContainedLiquid(scratch, x + dx, y + dy, z + dz, ITEMS[state.heldId].contains, null);
  out.cells = out.used ? [...writes.values()].filter((c) => c.block !== world.get(c.x, c.y, c.z) || c.meta !== world.getMeta(c.x, c.y, c.z)) : [];
  return out;
}
export const dryBucket = (state, eye, dir) => dryBucketUse(state, eye, dir).cells;

// The client's own change of the held stack (probe: client-predict-reference.json 'use', 'bucket' and 'throw' records): ItemBlock.onItemUse, ItemReed, ItemSeeds and
// ItemSnowball.onItemRightClick take one from the stack on the client too; a Creative controller restores it. An empty bucket that took a liquid becomes that liquid's
// bucket when it was the only one in the stack; a full bucket that placed (or fizzed in the Nether) becomes an empty bucket. Returns { dCount, swap } or null.
const EMPTY_BUCKET = 340;
export const filledBucketOf = (block) => Object.values(ITEMS).find((i) => i?.bucket === 'filled' && i.contains === block)?.id ?? 0;
export function heldPlan({ kind, stack, creative, placed = false, took = 0 }) {
  if (!stack || creative || !(stack.count > 0)) return null;
  if (kind === 'flint') { const max = ITEMS[stack.id]?.durability || 0; return max && !stack.unbreakable && (stack.damage | 0) + 1 < max ? { dCount: 0, dDamage: 1 } : null; } // ItemStack.damageItem(1) on the client (a breaking tool is left to the server)
  if (kind === 'pot') return placed ? { dCount: -1 } : null;
  if (kind === 'place' || kind === 'use' || kind === 'throw') return kind === 'throw' || placed ? { dCount: -1 } : null;
  if (kind !== 'bucket') return null;
  const k = tracedBucket(stack.id);
  if (k === 'empty') { // a lone bucket becomes the filled one; a stack gives one and the filled bucket goes to the first free slot (probe 'empty-stack*'; with no free slot the client drops it, the entity is the server's)
    const to = took ? filledBucketOf(took) : 0;
    if (!to) return null;
    return stack.count === 1 ? { dCount: 0, swap: [stack.id, to] } : { dCount: -1, give: to };
  }
  return k === 'filled' && placed ? { dCount: 0, swap: [stack.id, EMPTY_BUCKET] } : null;
}
// Applies a plan to the real stack object (in place, so every reader of the hotbar sees it) and returns the undo. The undo is relative (a later queued click's
// own change stays), and a stack that dropped to nothing leaves its slot at once and is put back by the undo.
export function applyHeldPlan(inventory, plan) {
  const stack = inventory.held, slot = inventory.current;
  if (!plan || !stack) return null;
  const was = stack.id;
  stack.count += plan.dCount;
  if (plan.dDamage) stack.damage = (stack.damage | 0) + plan.dDamage;
  if (plan.swap) stack.id = plan.swap[1];
  if (stack.count <= 0) inventory.main[slot] = null;
  let given = -1;
  if (plan.give) { // InventoryPlayer.addItemStackToInventory of the filled bucket: the first free slot
    const before = inventory.main.slice(), add = makeStack(plan.give);
    inventory.add(add);
    given = inventory.main.findIndex((m, i) => m && m !== before[i]);
  }
  const placed = given >= 0 ? inventory.main[given] : null;
  return () => {
    if (placed && inventory.main[given] === placed) inventory.main[given] = null;
    stack.count -= plan.dCount;
    if (plan.dDamage) stack.damage = (stack.damage | 0) - plan.dDamage;
    if (plan.swap && stack.id === plan.swap[1]) stack.id = was;
    if (stack.count > 0 && inventory.main[slot] === null) inventory.main[slot] = stack;
  };
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
// Items that are not ItemBlocks (no ITEMS[id].block) but that placeHeldBlock places: door items, reeds, redstone, repeater, brewing stand, cauldron, flower pot.
export const PLACED_ITEMS = new Set([WOODEN_DOOR_ITEM, IRON_DOOR_ITEM, REEDS_ITEM, ITEM_REDSTONE, ITEM_REPEATER, ITEM_BREWING_STAND, ITEM_CAULDRON, ITEM_FLOWER_POT]);
const NOT_PLAIN = new Set([ITEM_BED, ITEM_SIGN, ITEM_SKULL, ITEM_CAKE]);
// A held ItemBlock whose right click on a plain block reaches placeHeldBlock (no entity, no activated block, not sneaking past one).
export function predictsPlacement({ world, target, heldId, sneaking, aimed }) {
  if (aimed || !target || !heldId) return false;
  const item = ITEMS[heldId];
  if (!item?.block || NOT_PLAIN.has(heldId) || isLiquid(heldId)) return false;
  return sneaking || !activatesOnClick(world.get(...target.block));
}

// What a right click on a block draws at once: 'activate' (door, trapdoor, gate toggle, button, repeater), 'bucket' (ItemBucket's own trace), 'place' (placeHeldBlock)
// or 'use' (cake, seeds, wart), else null. Lead, bed, sign and skull draw no block on the client (client-predict-reference.json: isRemote returns), lever and
// the other onBlockActivated that return early on the client are not drawn either.
export function useKind({ world, target, heldId, heldDamage = 0, sneaking, aimed }) {
  if (aimed) return null;
  const item = heldId ? ITEMS[heldId] : null, b = target ? world.get(...target.block) : 0;
  if (target && (!sneaking || !item)) { // Block.onBlockActivated that acts on the client: the egg's particles, the command block's screen, a pot taking a plant
    if (b === DRAGON_EGG) return 'egg';
    if (b === COMMAND_BLOCK) return 'command';
    if (b === FLOWER_POT && heldId && !potContents(world, ...target.block) && potInsertion(heldId, heldDamage | 0)) return 'pot';
  }
  if (target && isFlintAndSteel(heldId) && (sneaking || !activatesOnClick(b))) return 'flint';
  if (target && (!sneaking || !item) && (isDoor(b) || b === TRAPDOOR || b === FENCE_GATE || b === STONE_BUTTON || b === WOODEN_BUTTON || b === REPEATER || b === COMPARATOR || b === COMPARATOR_POWERED)) return 'activate';
  if (tracedBucket(heldId)) return !target || sneaking || !activatesOnClick(b) ? 'bucket' : null; // the trace needs no block under the cursor (water)
  if (!target) return null;
  if (predictsPlacement({ world, target, heldId, sneaking, aimed }) || (PLACED_ITEMS.has(heldId) && (sneaking || !activatesOnClick(b)))) return 'place';
  if (heldId === ITEM_DYE && heldDamage === 3 && (sneaking || !activatesOnClick(b))) return 'place'; // cocoa beans on a jungle log (ItemDye.onItemUse, probe 'cocoa')
  if (!heldId || (!sneaking && activatesOnClick(b))) return null;
  return heldId === ITEM_CAKE || wartPlantedBy(heldId) || plantedBlock(heldId) ? 'use' : null;
}
const ITEM_DYE = 351;

// The overlay's own bookkeeping, kept here so a test can drive the whole draw / refusal / revert cycle without main.js.
// drawPrediction records `list` ([x, y, z, block, meta]) under `token` and draws it at once; revertPrediction is the refused click's S23: a cell the server left as it
// was is rebuilt (and relit) from the real world.
export function drawPrediction(layer, scene, token, list) {
  const cells = [];
  for (const [x, y, z, block, meta] of list) {
    const was = { block: layer.world.get(x, y, z), meta: layer.world.getMeta(x, y, z) };
    if (layer.set(x, y, z, block, meta, token)) cells.push({ x, y, z, was });
  }
  scene.showPredictedCells(cells); // one relight per cell and one mesh per touching column (scene.js)
  return cells.length ? { token, cells } : null;
}
export function revertPrediction(world, scene, pred) {
  if (pred) for (const c of pred.cells) if (world.get(c.x, c.y, c.z) === c.was.block && world.getMeta(c.x, c.y, c.z) === c.was.meta) scene.updateBlock(c.x, c.z, c.y);
}

// A splash potion is thrown like the other throwables (ItemPotion.onItemRightClick takes one from the client stack, the entity is the server's; probe 'throw373-*');
// a drinkable potion only starts the use animation and keeps its count (probe 'drink373-x5').
export const throwsPotion = (id, damage = 0) => id === ITEM_POTION && isSplashDamage(damage | 0);
