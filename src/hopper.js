// Minecraft Java 1.7.10 BlockHopper (aln, original id 154, internal 133) and TileEntityHopper (api), ContainerHopper (aal).
// Native evidence: public/research/hopper-reference.json (tools/verify-hopper.mjs, tools/probes/HopperProbe.java),
// replayed by src/hopper.test.js. See public/research/hopper.md for what is verified and what is approximated.
//
// Block metadata: bits 0-2 facing (0 down, 2-5 horizontal; never 1), bit 3 (8) set when disabled by redstone power.
import { HOPPER_BOUNDS, HOPPER_BOXES, HOPPER_UNION } from "./hopper-shape.js";
import { Container, Slot, StackArray, copyStack } from "./inventory.js";
import {
  containerAt, isInventoryFull, arrayAdapter, pushOne, suckFromInventory, pickUpEntity, insertStack, touch, newHopperTile,
  HOPPER_SLOTS, TRANSFER_COOLDOWN, BLOCK_HOPPER,
} from "./inventory-transfer.js";

export const HOPPER = BLOCK_HOPPER, ITEM_HOPPER = 1000 + BLOCK_HOPPER;
export { HOPPER_SLOTS, TRANSFER_COOLDOWN, newHopperTile };
// TileEntityHopper.getInventoryName without a custom name: container.hopper.
export const HOPPER_TITLE = "Item Hopper";
export const isHopper = (b) => b === HOPPER;

// Facing.offsetX/Y/Z and Facing.oppositeSide.
export const FACING_OFFSETS = Object.freeze([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]);
export const OPPOSITE = Object.freeze([1, 0, 3, 2, 5, 4]);

// BlockHopper.func_149660_a (onBlockPlaced): the opposite of the clicked side, an upward result becoming down.
export const hopperPlacedMeta = (side) => { const o = OPPOSITE[side]; return o === 1 ? 0 : o; };
// BlockHopper.func_149918_b (facing) and func_149917_c (enabled: bit 3 clear).
export const hopperFacing = (meta) => meta & 7;
export const hopperEnabled = (meta) => (meta & 8) !== 8;
// BlockHopper.func_149919_e: the metadata after a redstone check, null when it does not change.
export function hopperPoweredMeta(meta, powered) {
  const enabled = !powered;
  return enabled === hopperEnabled(meta) ? null : (meta & 7) | (enabled ? 0 : 8);
}

// BlockHopper.onBlockAdded / onNeighborBlockChange -> func_149919_e (redstone engine behaviour of original id 154): the
// enabled bit follows World.isBlockIndirectlyGettingPowered, written with flag 4 (no notify).
const checkPower = (w, x, y, z) => {
  const meta = hopperPoweredMeta(w.getBlockMetadata(x, y, z), w.isBlockIndirectlyGettingPowered(x, y, z));
  if (meta !== null) w.setBlockMetadataWithNotify(x, y, z, meta, 4);
};
export const hopperBehaviour = { onBlockAdded: checkPower, onNeighborBlockChange: checkPower };

export { HOPPER_BOUNDS, HOPPER_BOXES, HOPPER_UNION };

// Block.setHardness(3), setResistance(8) (native field 24, stored / 5 by explosion.js), Material.iron (pickaxe to harvest),
// BlockHopper.setStepSound(soundTypeWood).
export const HOPPER_HARDNESS = 3, HOPPER_BLAST = 4.8, HOPPER_SOUND = "wood";
// Hopper -> item 1133; a broken hopper drops its own item (Items.hopper, original 410).
export const hopperDrops = () => [{ id: ITEM_HOPPER, count: 1, damage: 0 }];

// ---- model (RenderBlocks.renderBlockHopper): boxes in 1/16 units, texture roles ----
// Faces: 0 +x, 1 -x, 2 top, 3 bottom, 4 +z, 5 -z (block-textures.js order). Textures: hopper_outside (sides, bottom),
// hopper_top (the top rim), hopper_inside (the bowl floor and inner walls).
export const hopperTileName = (face, inner = false) => (inner ? "hopper_inside" : face === 2 ? "hopper_top" : "hopper_outside");
export const HOPPER_TILES = ["hopper_outside", "hopper_inside", "hopper_top"];

// ---- the 5-slot screen ----
// ContainerHopper: five slots at (44 + 18 i, 20), then the 27 main and 9 hotbar slots at (8 + 18 c, 51 + 18 r) / y 109.
export class HopperContainer extends Container {
  constructor(inv, tile, onChange) {
    super(inv);
    this.tileEntity = tile;
    this.tile = new StackArray(tile.items, onChange);
    for (let i = 0; i < HOPPER_SLOTS; i++) this.addSlot(new Slot(this.tile, i, 44 + i * 18, 20));
    this.addPlayerSlots(8, 51);
    this.title = tile.name || HOPPER_TITLE;
  }
  // ContainerHopper.transferStackInSlot: the copy is returned like ContainerChest, without onPickup.
  transfer(index) {
    const slot = this.slots[index];
    if (!slot?.has) return null;
    const s = slot.stack, moved = copyStack(s);
    if (!(index < HOPPER_SLOTS ? this.merge(s, HOPPER_SLOTS, this.slots.length, true) : this.merge(s, 0, HOPPER_SLOTS, false))) return null;
    if (s.count === 0) slot.put(null);
    else slot.changed();
    return moved;
  }
}

// ---- TileEntityHopper.updateEntity / func_145887_i over the shared transfer helper ----
// host: inventory-transfer.js host plus { items(): item entities ({ stack, x, y, z, dead }), maxStack }.
// Returns true when something moved. `meta` is the block's metadata.
export function updateHopper(host, tile, x, y, z, meta) {
  if (!hopperEnabled(meta) || tile.cooldown > 0) return false;
  const maxStack = host.maxStack, key = `${x},${y},${z}`;
  const self = arrayAdapter(key, tile.items, { hopper: tile, received: () => { tile.cooldown = TRANSFER_COOLDOWN; } });
  let moved = false, target = null, above = null;
  if (tile.items.some(Boolean)) {
    const [dx, dy, dz] = FACING_OFFSETS[hopperFacing(meta)];
    target = containerAt(host, x + dx, y + dy, z + dz);
    if (target) moved = pushOne(self, target, OPPOSITE[hopperFacing(meta)], maxStack);
  }
  if (!tile.items.every((s) => s && s.count === maxStack(s))) {
    above = containerAt(host, x, y + 1, z);
    let got = false;
    if (above) got = suckFromInventory(self, above, maxStack);
    else got = pickUpFromWorld(host, self, x, y, z);
    moved = got || moved;
  }
  if (!moved) return false;
  tile.cooldown = TRANSFER_COOLDOWN;
  touch(host, self, target, above);
  return true;
}
// func_145897_a / func_145898_a: the first EntityItem whose box overlaps (x, y + 1, z) - (x + 1, y + 2, z + 1).
function pickUpFromWorld(host, self, x, y, z) {
  for (const e of host.items?.() ?? []) {
    if (e.dead || !e.stack) continue;
    if (!(e.x + 0.125 > x && e.x - 0.125 < x + 1 && e.y + 0.25 > y + 1 && e.y < y + 2 && e.z + 0.125 > z && e.z - 0.125 < z + 1)) continue;
    const taken = pickUpEntity(self, e, host.maxStack);
    if (taken) e.dead = true;
    return taken;
  }
  return false;
}
export const hopperIsFull = (tile, maxStack) => isInventoryFull(arrayAdapter("", tile.items), -1, maxStack);

// TileEntityHopper.updateEntity for every hopper: decrement, then the update when the cooldown ran out.
// `active(x, z)` skips unloaded columns; a tile whose block is gone is dropped.
export class Hoppers {
  constructor(host) { this.host = host; }
  tick() {
    const { host } = this, tiles = host.hoppers();
    for (const key of Object.keys(tiles)) {
      const [x, y, z] = key.split(",").map(Number);
      if (host.active && !host.active(x, z)) continue;
      if (host.world.get(x, y, z) !== HOPPER) { delete tiles[key]; continue; }
      const tile = tiles[key];
      tile.cooldown = (tile.cooldown ?? 0) - 1;
      if (tile.cooldown > 0) continue;
      tile.cooldown = 0;
      updateHopper(host, tile, x, y, z, host.world.getMeta(x, y, z));
    }
  }
}
export { insertStack };
