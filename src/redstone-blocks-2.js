// Second redstone block family, Minecraft Java 1.7.10: redstone torch (original 75 unlit / 76 lit), redstone lamp
// (123 / 124), block of redstone (152), wooden button (143), light and heavy weighted pressure plates (147 / 148),
// redstone comparator (149 unpowered / 150 powered), daylight sensor (151), the piston moving block (36) and glowstone
// (89), plus the items nether quartz, glowstone dust and the redstone comparator.
// Ported from the unchanged classes (public/research/redstone-blocks-2-reference.json,
// tools/probes/RedstoneBlocks2Probe.java). This module is the BLOCK side only: ids, shapes, textures, light, drops,
// placement and support. Power behaviour lives in redstone.js / redstone-live.js (it reads these blocks through
// block-registry.js); nothing here powers anything.
// Internal ids 119-131 are fixed by the redstone tranche contract; the items of blocks sit at 1000 + block id because
// tools own items 100-127 (a torch is item 1120 whichever state it was broken in).
// Rules that need the world take it as an argument. world.js, rails.js and torches.js are used only inside functions,
// so the import cycle with world.js -> redstone-blocks.js -> this module is harmless.
import { normalCube, FENCE } from "./world.js";
import { NETHER_FENCE } from "./nether-blocks.js";
import { solidTop } from "./rails.js";
import { torchBounds, placedTorchMeta, torchSupported } from "./torches.js";

export const REDSTONE_TORCH_OFF = 119, REDSTONE_TORCH = 120, REDSTONE_LAMP = 121, REDSTONE_LAMP_LIT = 122, REDSTONE_BLOCK = 123;
export const WOODEN_BUTTON = 124, LIGHT_PLATE = 125, HEAVY_PLATE = 126, COMPARATOR = 127, COMPARATOR_POWERED = 128;
export const DAYLIGHT_SENSOR = 129, PISTON_MOVING = 130, GLOWSTONE = 131;
export const FIRST_BLOCK = 119, LAST_BLOCK = 131;

// Plain items (original 404, 406, 348) and the block items (1000 + block id).
export const ITEM_COMPARATOR = 381, ITEM_QUARTZ = 382, ITEM_GLOWSTONE_DUST = 383;
export const ITEM_REDSTONE_TORCH = 1120, ITEM_REDSTONE_LAMP = 1121, ITEM_REDSTONE_BLOCK = 1123, ITEM_WOODEN_BUTTON = 1124;
export const ITEM_LIGHT_PLATE = 1125, ITEM_HEAVY_PLATE = 1126, ITEM_DAYLIGHT_SENSOR = 1129, ITEM_GLOWSTONE = 1131;

export const REDSTONE2_NAMES = Object.freeze([
  "Unlit redstone torch", "Redstone torch", "Redstone lamp", "Lit redstone lamp", "Block of redstone", "Wooden button",
  "Light weighted pressure plate", "Heavy weighted pressure plate", "Redstone comparator", "Powered redstone comparator", "Daylight sensor",
  "Piston moving block", "Glowstone",
]);
// Lang names of the items (item.yellowDust, item.comparator, item.netherquartz, tile.* of the block items).
export const REDSTONE2_ITEM_NAMES = Object.freeze({
  [ITEM_REDSTONE_TORCH]: "Redstone Torch", [ITEM_REDSTONE_LAMP]: "Redstone Lamp", [ITEM_REDSTONE_BLOCK]: "Block of Redstone",
  [ITEM_WOODEN_BUTTON]: "Button", [ITEM_LIGHT_PLATE]: "Weighted Pressure Plate (Light)", [ITEM_HEAVY_PLATE]: "Weighted Pressure Plate (Heavy)",
  [ITEM_DAYLIGHT_SENSOR]: "Daylight Sensor", [ITEM_GLOWSTONE]: "Glowstone",
  [ITEM_COMPARATOR]: "Redstone Comparator", [ITEM_QUARTZ]: "Nether Quartz", [ITEM_GLOWSTONE_DUST]: "Glowstone Dust",
});
// Item textures of the plain items (items/ atlas).
export const REDSTONE2_ITEM_TEXTURES = Object.freeze({ [ITEM_COMPARATOR]: "comparator", [ITEM_QUARTZ]: "quartz", [ITEM_GLOWSTONE_DUST]: "glowstone_dust" });

// Original item id -> internal item id (population-content.js POPULATION_ITEMS).
export const REDSTONE2_ITEM_IDS = Object.freeze({
  76: ITEM_REDSTONE_TORCH, 123: ITEM_REDSTONE_LAMP, 152: ITEM_REDSTONE_BLOCK, 143: ITEM_WOODEN_BUTTON, 147: ITEM_LIGHT_PLATE,
  148: ITEM_HEAVY_PLATE, 151: ITEM_DAYLIGHT_SENSOR, 89: ITEM_GLOWSTONE, 404: ITEM_COMPARATOR, 406: ITEM_QUARTZ, 348: ITEM_GLOWSTONE_DUST,
});

// What picking or placing a block uses (Block.getItem / pick block); the glowstone block's own item is not its drop.
const ITEM_OF_BLOCK = {
  [REDSTONE_TORCH_OFF]: ITEM_REDSTONE_TORCH, [REDSTONE_TORCH]: ITEM_REDSTONE_TORCH, [REDSTONE_LAMP]: ITEM_REDSTONE_LAMP,
  [REDSTONE_LAMP_LIT]: ITEM_REDSTONE_LAMP, [REDSTONE_BLOCK]: ITEM_REDSTONE_BLOCK, [WOODEN_BUTTON]: ITEM_WOODEN_BUTTON,
  [LIGHT_PLATE]: ITEM_LIGHT_PLATE, [HEAVY_PLATE]: ITEM_HEAVY_PLATE, [COMPARATOR]: ITEM_COMPARATOR, [COMPARATOR_POWERED]: ITEM_COMPARATOR,
  [DAYLIGHT_SENSOR]: ITEM_DAYLIGHT_SENSOR, [GLOWSTONE]: ITEM_GLOWSTONE,
};
// The block an item places (ItemBlock / ItemReed): the lit torch and the unpowered comparator and lamp.
const BLOCK_OF_ITEM = {
  [ITEM_REDSTONE_TORCH]: REDSTONE_TORCH, [ITEM_REDSTONE_LAMP]: REDSTONE_LAMP, [ITEM_REDSTONE_BLOCK]: REDSTONE_BLOCK,
  [ITEM_WOODEN_BUTTON]: WOODEN_BUTTON, [ITEM_LIGHT_PLATE]: LIGHT_PLATE, [ITEM_HEAVY_PLATE]: HEAVY_PLATE, [ITEM_COMPARATOR]: COMPARATOR,
  [ITEM_DAYLIGHT_SENSOR]: DAYLIGHT_SENSOR, [ITEM_GLOWSTONE]: GLOWSTONE,
};
export const isRedstone2Block = (b) => b >= FIRST_BLOCK && b <= LAST_BLOCK;
export const itemOfBlock2 = (b) => ITEM_OF_BLOCK[b] ?? 0;
export const blockOfItem2 = (i) => BLOCK_OF_ITEM[i] ?? 0;

// Collision boxes (getCollisionBoundingBox): the torches, button and plates have none, the piston moving block
// is drawn and collided by the pistons module; the rest collide with their bounds.
export const hasCollision2 = (b) => b === REDSTONE_LAMP || b === REDSTONE_LAMP_LIT || b === REDSTONE_BLOCK || b === COMPARATOR
  || b === COMPARATOR_POWERED || b === DAYLIGHT_SENSOR || b === GLOWSTONE;
// Blocks drawn as plain cubes by the mesher (the rest have their own models).
export const isCube2 = (b) => b === REDSTONE_LAMP || b === REDSTONE_LAMP_LIT || b === REDSTONE_BLOCK || b === GLOWSTONE;
// Opaque cubes for face culling and light. The redstone block provides power and the glowstone is Material.glass, so
// neither is a normal cube (Block.isNormalCube false in the probe) although both hide faces.
export const SEE_THROUGH2 = Object.freeze([REDSTONE_TORCH_OFF, REDSTONE_TORCH, WOODEN_BUTTON, LIGHT_PLATE, HEAVY_PLATE, COMPARATOR,
  COMPARATOR_POWERED, DAYLIGHT_SENSOR, PISTON_MOVING]);
export const notNormalCube2 = (b) => b === REDSTONE_BLOCK || b === GLOWSTONE;

// ---- Bounds ---------------------------------------------------------------------------------
const f = Math.fround;
// setBlockBoundsBasedOnState per block and metadata. The torches use BlockTorch's boxes (torches.js; the port stores a
// standing torch as metadata 0 or 5), the button BlockButton's (1/8 deep, 1/16 pressed), the weighted plates are
// 1/16 high at power 0 and 1/32 otherwise.
export function redstoneBounds2(id, meta = 0) {
  switch (id) {
    case REDSTONE_TORCH_OFF: case REDSTONE_TORCH: return torchBounds(meta);
    case WOODEN_BUTTON: { const t = meta & 8 ? 0.0625 : 0.125;
      switch (meta & 7) {
        case 1: return [0, 0.375, 0.3125, t, 0.625, 0.6875];
        case 2: return [1 - t, 0.375, 0.3125, 1, 0.625, 0.6875];
        case 3: return [0.3125, 0.375, 0, 0.6875, 0.625, t];
        case 4: return [0.3125, 0.375, 1 - t, 0.6875, 0.625, 1];
        default: return [0.3125, 0.375, 1 - t, 0.6875, 0.625, 1]; // stale metadata 0 and 5-7: never placed
      } }
    case LIGHT_PLATE: case HEAVY_PLATE: return [0.0625, 0, 0.0625, 0.9375, (meta & 15) > 0 ? 0.03125 : 0.0625, 0.9375];
    case COMPARATOR: case COMPARATOR_POWERED: return [0, 0, 0, 1, 0.125, 1];
    case DAYLIGHT_SENSOR: return [0, 0, 0, 1, 0.375, 1];
    default: return [0, 0, 0, 1, 1, 1];
  }
}

// ---- Native numbers -------------------------------------------------------------------------
// Block.setHardness (-1 unbreakable) and the blast resistance explosion.js stores (native field / 5).
export const HARDNESS2 = Object.freeze({
  [REDSTONE_TORCH_OFF]: 0, [REDSTONE_TORCH]: 0, [REDSTONE_LAMP]: 0.3, [REDSTONE_LAMP_LIT]: 0.3, [REDSTONE_BLOCK]: 5, [WOODEN_BUTTON]: 0.5,
  [LIGHT_PLATE]: 0.5, [HEAVY_PLATE]: 0.5, [COMPARATOR]: 0, [COMPARATOR_POWERED]: 0, [DAYLIGHT_SENSOR]: 0.2, [PISTON_MOVING]: -1, [GLOWSTONE]: 0.3,
});
export const BLAST_RESISTANCE2 = Object.freeze({
  [REDSTONE_TORCH_OFF]: 0, [REDSTONE_TORCH]: 0, [REDSTONE_LAMP]: 0.3, [REDSTONE_LAMP_LIT]: 0.3, [REDSTONE_BLOCK]: 6, [WOODEN_BUTTON]: 0.5,
  [LIGHT_PLATE]: 0.5, [HEAVY_PLATE]: 0.5, [COMPARATOR]: 0, [COMPARATOR_POWERED]: 0, [DAYLIGHT_SENSOR]: 0.2, [PISTON_MOVING]: 0, [GLOWSTONE]: 0.3,
});
// Block.getLightValue: the lit torch (0.5F -> 7), the lit lamp, the powered comparator (0.625F -> 9) and glowstone.
export const lightEmission2 = (b) => (b === REDSTONE_TORCH ? 7 : b === REDSTONE_LAMP_LIT || b === GLOWSTONE ? 15 : b === COMPARATOR_POWERED ? 9 : 0);
// Block.getLightOpacity: the opaque cubes are 255, everything else (torches, button, plates, comparators, sensor,
// moving piston) lets light through.
export const lightOpacity2 = (b) => (b === REDSTONE_LAMP || b === REDSTONE_LAMP_LIT || b === REDSTONE_BLOCK || b === GLOWSTONE ? 255 : 0);
// Block.useNeighborBrightness (probe): the partial blocks sample their neighbour's light.
export const useNeighborBrightness2 = (b) => b === REDSTONE_TORCH_OFF || b === REDSTONE_TORCH || b === WOODEN_BUTTON || b === LIGHT_PLATE
  || b === HEAVY_PLATE || b === COMPARATOR || b === COMPARATOR_POWERED || b === DAYLIGHT_SENSOR || b === PISTON_MOVING;
// Material and sound families (checked against the native Block.SoundType table by block-sounds.test.js; block-sounds.js is the
// source): wood, stone, glass. The redstone block is soundTypeMetal (stone files at frequency 1.5).
export const SOUND2 = Object.freeze({
  [REDSTONE_TORCH_OFF]: "wood", [REDSTONE_TORCH]: "wood", [REDSTONE_LAMP]: "glass", [REDSTONE_LAMP_LIT]: "glass", [REDSTONE_BLOCK]: "stone",
  [WOODEN_BUTTON]: "wood", [LIGHT_PLATE]: "wood", [HEAVY_PLATE]: "wood", [COMPARATOR]: "wood", [COMPARATOR_POWERED]: "wood",
  [DAYLIGHT_SENSOR]: "wood", [PISTON_MOVING]: "stone", [GLOWSTONE]: "glass",
});
export const BREAK_PITCH2 = Object.freeze({ [REDSTONE_BLOCK]: 1.5 });
// Tool rules of the mining table: the redstone block is Material.iron (a pickaxe is needed to harvest it) and so are the
// weighted plates (probe requiresTool); the torches, lamps, button, comparators and sensor harvest by hand.
export const NEEDS_PICKAXE2 = Object.freeze([REDSTONE_BLOCK, LIGHT_PLATE, HEAVY_PLATE]);

// ---- Drops ----------------------------------------------------------------------------------
// Block.getItemDropped / quantityDropped. The unlit torch drops the lit one, the lit lamp the unlit lamp, the
// comparators item 381, glowstone 2-4 dust (BlockGlowstone.quantityDroppedWithBonus: clamp(2 + nextInt(3) +
// nextInt(fortune + 1), 1, 4)), the piston moving block nothing. `nextInt(n)` is a java.util.Random-style source
// (replays use JavaRandom); without one `random` ((): [0,1)) supplies the draws.
export function redstoneDrops2(id, meta = 0, { random = Math.random, fortune = 0, nextInt = (n) => Math.floor(random() * n) } = {}) {
  if (id === PISTON_MOVING) return [];
  if (id === GLOWSTONE) {
    const base = 2 + nextInt(3), bonus = nextInt(fortune + 1);
    return [{ id: ITEM_GLOWSTONE_DUST, count: Math.max(1, Math.min(4, base + bonus)), damage: 0 }];
  }
  const item = ITEM_OF_BLOCK[id];
  return item ? [{ id: item, count: 1, damage: 0 }] : [];
}

// ---- Placement and support ------------------------------------------------------------------
// side: 0 down, 1 up, 2 north (z-), 3 south (z+), 4 west (x-), 5 east (x+) of the clicked block.
const ATTACH_OF_SIDE = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
const BUTTON_ATTACH = { 1: [-1, 0, 0], 2: [1, 0, 0], 3: [0, 0, -1], 4: [0, 0, 1] };
const BUTTON_META = { 2: 4, 3: 3, 4: 2, 5: 1 };
const cube = (w, x, y, z) => normalCube(w.get(x, y, z));
// World.doesBlockHaveSolidTopSurface (rails.js solidTop also counts the block of redstone and the end portal frame).
const solidBelow = (w, x, y, z) => solidTop(w, x, y - 1, z);
// BlockPressurePlateWeighted keeps dust-style support (a fence also holds it); the comparator (BlockRedstoneDiode) does not.
const plateBelow = (w, x, y, z) => solidBelow(w, x, y, z) || w.get(x, y - 1, z) === FENCE || w.get(x, y - 1, z) === NETHER_FENCE;

// Metadata and legality of placing `id` clicked on `side` at (x,y,z); null when it cannot be placed.
// `yawToMeta` maps the camera yaw to the repeater/comparator facing (redstone-blocks.js repeaterMetaForYaw).
export function redstonePlacedMeta2(world, id, x, y, z, side, yaw = 0, yawToMeta = () => 0) {
  switch (id) {
    case REDSTONE_TORCH_OFF: case REDSTONE_TORCH: { const m = placedTorchMeta(world, x, y, z, side); return m < 0 ? null : m; }
    case WOODEN_BUTTON: {
      if (side < 2) return null;
      const a = ATTACH_OF_SIDE[side];
      return cube(world, x + a[0], y + a[1], z + a[2]) ? BUTTON_META[side] : null;
    }
    case LIGHT_PLATE: case HEAVY_PLATE: return plateBelow(world, x, y, z) ? 0 : null;
    case COMPARATOR: case COMPARATOR_POWERED: return solidBelow(world, x, y, z) ? yawToMeta(yaw) : null;
    default: return 0;
  }
}

// Neighbour-change support (onNeighborBlockChange / canPlaceBlockAt): false means the block drops.
export function redstoneSupported2(world, id, x, y, z, meta = world.getMeta(x, y, z)) {
  switch (id) {
    case REDSTONE_TORCH_OFF: case REDSTONE_TORCH: return torchSupported(world, x, y, z, meta);
    case WOODEN_BUTTON: {
      const a = BUTTON_ATTACH[meta & 7];
      if (a) return cube(world, x + a[0], y + a[1], z + a[2]);
      return cube(world, x - 1, y, z) || cube(world, x + 1, y, z) || cube(world, x, y, z - 1) || cube(world, x, y, z + 1);
    }
    case LIGHT_PLATE: case HEAVY_PLATE: return plateBelow(world, x, y, z);
    case COMPARATOR: case COMPARATOR_POWERED: return solidBelow(world, x, y, z);
    default: return true;
  }
}

// ---- Textures -------------------------------------------------------------------------------
// Tile names of the blocks/ atlas. Faces: 0 +x, 1 -x, 2 top, 3 bottom, 4 +z, 5 -z.
export const REDSTONE2_TILES = ["redstone_torch_on", "redstone_torch_off", "redstone_lamp_on", "redstone_lamp_off", "redstone_block", "planks_oak",
  "gold_block", "iron_block", "comparator_off", "comparator_on", "stone_slab_top", "daylight_detector_top", "daylight_detector_side", "glowstone"];
export function redstone2TileName(id, face = 2) {
  switch (id) {
    case REDSTONE_TORCH_OFF: return "redstone_torch_off";
    case REDSTONE_TORCH: return "redstone_torch_on";
    case REDSTONE_LAMP: return "redstone_lamp_off";
    case REDSTONE_LAMP_LIT: return "redstone_lamp_on";
    case REDSTONE_BLOCK: return "redstone_block";
    case WOODEN_BUTTON: return "planks_oak";
    case LIGHT_PLATE: return "gold_block";
    case HEAVY_PLATE: return "iron_block";
    // BlockRedstoneDiode.getIcon: the bottom shows a torch texture, the top the block's own, the sides the slab top.
    case COMPARATOR: return face === 2 ? "comparator_off" : face === 3 ? "redstone_torch_off" : "stone_slab_top";
    case COMPARATOR_POWERED: return face === 2 ? "comparator_on" : face === 3 ? "redstone_torch_on" : "stone_slab_top";
    // BlockDaylightDetector.getIcon: top texture on top, the side texture elsewhere.
    case DAYLIGHT_SENSOR: return face === 2 ? "daylight_detector_top" : "daylight_detector_side";
    case GLOWSTONE: return "glowstone";
    default: return "stone";
  }
}
