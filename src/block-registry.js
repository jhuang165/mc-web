// The port's internal block ids against the original 1.7.10 block registry (Block.registerBlocks).
// Chunk storage (chunk-store.js) holds original ids and metadata, so a cell converts through
// toOriginal / fromOriginal. State the browser keeps outside the cell (fluid ticks, farmland moisture
// in farming.js, chest facing in chest.js, the furnace runtime) travels in `state`:
//   flowing   true for flowing_water/flowing_lava (8/10); still water/lava (9/11) otherwise
//   moisture  BlockFarmland metadata 0-7 (internal 29 is dry, 30 any moisture above 0)
//   facing    BlockChest / BlockFurnace metadata 2-5
//   lit       lit_furnace (62)
// Original blocks the port has no family for map to null. Ids and flags: tools/probes/ChunkProbe.java,
// public/research/chunk-reference.json.
import { BLOCKS, WATER, LAVA, ANVIL, ENCHANTING_TABLE,
  OAK_STAIRS, COBBLESTONE_STAIRS, STONE_BRICK_STAIRS, SANDSTONE_STAIRS, SPRUCE_STAIRS, BIRCH_STAIRS, JUNGLE_STAIRS, BRICK_STAIRS, ACACIA_STAIRS, DARK_OAK_STAIRS, WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE, STONE_BRICKS, DOUBLE_STONE_SLAB, STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, REDSTONE_WIRE, LEVER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, REPEATER, TRIPWIRE_HOOK, TRIPWIRE, DISPENSER, STICKY_PISTON, PISTON, PISTON_HEAD,
  REDSTONE_TORCH_OFF, REDSTONE_TORCH, REDSTONE_LAMP, REDSTONE_LAMP_LIT, REDSTONE_BLOCK, WOODEN_BUTTON, LIGHT_PLATE, HEAVY_PLATE, COMPARATOR, COMPARATOR_POWERED, DAYLIGHT_SENSOR, PISTON_MOVING, GLOWSTONE,
} from "./world.js";

// Block.blockRegistry: ids 0-175 except 165-169 (unused in 1.7.10). Everything else reads as air.
export const ORIGINAL_BLOCK_IDS = Array.from({ length: 176 }, (_, i) => i).filter((i) => i < 165 || i > 169);
const REGISTERED = new Uint8Array(4096);
for (const id of ORIGINAL_BLOCK_IDS) REGISTERED[id] = 1;
// Block.getTickRandomly (aji.t) for registered blocks.
export const ORIGINAL_RANDOM_TICK = [
  2, 6, 8, 10, 11, 18, 28, 31, 32, 37, 38, 39, 40, 50, 51, 59, 60, 70, 72, 74, 75, 76, 77, 78, 79, 80, 81, 83, 86, 90,
  91, 92, 104, 105, 106, 110, 111, 115, 127, 131, 132, 141, 142, 143, 147, 148, 161, 171, 175,
];
const TICKING = new Uint8Array(4096);
for (const id of ORIGINAL_RANDOM_TICK) TICKING[id] = 1;
// BlockContainer (akw) subclasses: their cells own tile entities in the original Chunk.
export const ORIGINAL_CONTAINERS = [23, 25, 36, 52, 54, 61, 62, 63, 68, 84, 116, 117, 119, 130, 137, 138, 140, 144, 146, 149, 150, 151, 154, 158];
// Block.getBlockById (aji.e) of an unregistered id is air, so it reads back as 0.
export const isRegistered = (id) => id >= 0 && id < 4096 && REGISTERED[id] === 1;
export const ticksRandomlyOriginal = (id) => id >= 0 && id < 4096 && TICKING[id] === 1;

const same = (mc) => ({ mc, to: (meta) => [mc, meta & 15], from: (meta) => ({ meta, exact: true }) });
// One original state; others of the same original id come back inexactly.
const fixed = (mc, value = 0) => ({ mc, to: () => [mc, value], from: (meta) => ({ meta: 0, exact: meta === value }) });
const fluid = (still) => ({
  mc: still,
  also: [still - 1],
  to: (meta, state) => [state.flowing ? still - 1 : still, meta & 15],
  from: (meta, mc) => ({ meta, state: mc === still - 1 ? { flowing: true } : undefined, exact: true }),
});
// BlockRedstoneTorch (75 unlit / 76 lit) is a BlockTorch: metadata 1-4 on a wall, 5 standing (the port stores standing as 0, like torch 20).
const redstoneTorch = (mc) => ({
  mc,
  to: (meta) => [mc, meta >= 1 && meta <= 4 ? meta : 5],
  from: (meta) => (meta >= 1 && meta <= 4 ? { meta, exact: true } : { meta: 0, exact: meta === 5 }),
});
const facing = (state) => (state.facing >= 2 && state.facing <= 5 ? state.facing : 3);

// Internal id -> mapping. Identity metadata ("same") where the port stores the original meaning.
const MAP = {
  0: fixed(0), 1: fixed(2), 2: same(3), 3: fixed(1), 4: same(17), 5: same(18), 6: same(12), 7: same(5),
  8: fixed(45), 9: fixed(20), [WATER]: fluid(9), 11: fixed(7), 12: fixed(4), 13: fixed(58),
  // BlockFurnace: facing 2-5 (3 is func_149930_e's open-neighbour default); lit_furnace is 62.
  14: {
    mc: 61, also: [62],
    to: (meta, state) => [state.lit ? 62 : 61, facing(state)],
    from: (meta, mc) => ({ meta: 0, state: { facing: meta, ...(mc === 62 ? { lit: true } : {}) }, exact: meta >= 2 && meta <= 5 }),
  },
  15: fixed(16), 16: fixed(15), 17: fixed(56), 18: fixed(14), 19: same(35),
  // BlockTorch: metadata 1-4 on a wall, 5 standing. The port stores a standing torch as 0 (and
  // reads 5 the same way); both are written as 5.
  20: {
    mc: 50,
    to: (meta) => [50, meta >= 1 && meta <= 4 ? meta : 5],
    from: (meta) => (meta >= 1 && meta <= 4 ? { meta, exact: true } : { meta: 0, exact: meta === 5 }),
  },
  21: fixed(47), 22: fixed(49), 23: fixed(80), 24: fixed(82), 25: fixed(13), 26: fixed(42), 27: fixed(41), 28: fixed(57),
  // BlockFarmland metadata is the moisture 0-7; the port splits dry (29) from moist (30).
  29: { mc: 60, to: () => [60, 0], from: (meta) => (meta === 0 ? { meta: 0, exact: true } : null) },
  30: {
    mc: 60,
    to: (meta, state) => [60, state.moisture >= 1 && state.moisture <= 7 ? state.moisture : 7],
    from: (meta) => (meta === 0 ? null : { meta: 0, state: { moisture: Math.min(meta, 7) }, exact: meta <= 7 }),
  },
  // BlockCrops (wheat, 59): the port keeps the age in the id 31-38.
  ...Object.fromEntries(Array.from({ length: 8 }, (_, age) => [31 + age, {
    mc: 59, to: () => [59, age], from: (meta) => ((meta & 7) === age ? { meta: 0, exact: meta === age } : null),
  }])),
  // BlockTallGrass metadata 1 (grass); 0 dead shrub and 2 fern have no port block.
  39: fixed(31, 1),
  40: fixed(172),
  41: { mc: 54, to: (meta, state) => [54, facing(state)], from: (meta) => ({ meta: 0, state: { facing: meta }, exact: meta >= 2 && meta <= 5 }) },
  [LAVA]: fluid(11),
  43: fixed(37), 44: same(38), 45: same(51), 46: same(78), 47: fixed(79), 48: same(6), 49: same(141), 50: same(142),
  51: fixed(30), 52: same(65), 53: same(81), 54: same(83), 55: fixed(46), 56: same(24), 57: fixed(110), 58: same(159), 59: fixed(111),
  // BlockFence (85) has no metadata; BlockRail (66) keeps its shape 0-9; BlockMobSpawner (52) keeps
  // its tile entity outside the cell (mob-spawner.js).
  60: fixed(85),
  61: { mc: 66, to: (meta) => [66, meta <= 9 ? meta : 0], from: (meta) => ({ meta: meta <= 9 ? meta : 0, exact: meta <= 9 }) },
  62: fixed(52),
  63: fixed(21),64: fixed(73),65: fixed(74),66: fixed(129),67: same(86),68: same(97),69: same(175),
  70: same(162),71: same(161),72: same(106),73: same(127),74: fixed(48),75: fixed(39),76: fixed(40),
  77: same(99),78: same(100),79: fixed(32),80: fixed(174),81: fixed(103),82: fixed(44,1),83: fixed(31,0),84: fixed(31,2),
  // BlockAnvil: low two bits are orientation; high bits are damage stage.
  // BlockEnchantmentTable: one state; its book tile entity is presentation-only here (enchanting-table.md).
  [ENCHANTING_TABLE]: fixed(116),
  [ANVIL]: { mc: 145, to: (meta) => [145, meta & 15], from: (meta) => ({ meta, exact: true }) },
  // Structure families: provisional identity-metadata mappings; each family's owner refines its own entries.
  [OAK_STAIRS]: same(53),
  [COBBLESTONE_STAIRS]: same(67),
  [STONE_BRICK_STAIRS]: same(109),
  [SANDSTONE_STAIRS]: same(128),
  [SPRUCE_STAIRS]: same(134),
  [BIRCH_STAIRS]: same(135),
  [JUNGLE_STAIRS]: same(136),
  [BRICK_STAIRS]: same(108),
  [ACACIA_STAIRS]: same(163),
  [DARK_OAK_STAIRS]: same(164),
  [WOODEN_DOOR]: same(64),
  [IRON_DOOR]: same(71),
  [IRON_BARS]: same(101),
  [GLASS_PANE]: same(102),
  [STONE_BRICKS]: same(98),
  [DOUBLE_STONE_SLAB]: same(43),
  // BlockStoneSlab 44: every state but 44:1 (bottom sandstone slab, internal 82, which stays the home of old saves);
  // 103:1 is never written, so it exports as 44:0 and the exact round trip skips it.
  [STONE_SLAB]: { mc: 44, to: (meta) => [44, (meta & 15) === 1 ? 0 : meta & 15], from: (meta) => ({ meta, exact: true }) },
  [END_PORTAL_FRAME]: same(120),
  [CAULDRON]: same(118),
  [FLOWER_POT]: same(140),
  [REDSTONE_WIRE]: same(55),
  [LEVER]: same(69),
  [STONE_PRESSURE_PLATE]: same(70),
  [WOODEN_PRESSURE_PLATE]: same(72),
  [STONE_BUTTON]: same(77),
  // BlockRedstoneRepeater: 93 unpowered / 94 powered share one internal id; `powered` is side state like furnace `lit`.
  [REPEATER]: {
    mc: 93, also: [94],
    to: (meta, state) => [state.powered ? 94 : 93, meta & 15],
    from: (meta, mc) => ({ meta, state: mc === 94 ? { powered: true } : undefined, exact: true }),
  },
  [TRIPWIRE_HOOK]: same(131),
  [TRIPWIRE]: same(132),
  [DISPENSER]: same(23),
  [STICKY_PISTON]: same(29),
  [PISTON]: same(33),
  [PISTON_HEAD]: same(34),
  // 0.39.0 redstone blocks (redstone-blocks-2.js): the lit and unlit states of torch, lamp and comparator are separate internal ids.
  // Metadata is the original's (button facing and pressed bit, plate power, comparator facing/mode/powered bits, sensor power, piston moving facing).
  [REDSTONE_TORCH_OFF]: redstoneTorch(75), [REDSTONE_TORCH]: redstoneTorch(76),
  [REDSTONE_LAMP]: fixed(123), [REDSTONE_LAMP_LIT]: fixed(124), [REDSTONE_BLOCK]: fixed(152),
  [WOODEN_BUTTON]: same(143), [LIGHT_PLATE]: same(147), [HEAVY_PLATE]: same(148),
  [COMPARATOR]: same(149), [COMPARATOR_POWERED]: same(150), [DAYLIGHT_SENSOR]: same(151),
  [PISTON_MOVING]: same(36), [GLOWSTONE]: fixed(89),
  // 0.40.0 reservations: dropper 158, hopper 154, brewing stand 117, powered/detector/activator rails 27/28/157 (metadata as the original's).
  132: same(158), 133: same(154), 134: same(117), 135: same(27), 136: same(28), 137: same(157),
};
if (Object.keys(MAP).length !== BLOCKS.length) throw new Error("block-registry.js: every BLOCKS entry needs a mapping");

// Original id -> internal ids that can represent it, in internal id order.
const BY_ORIGINAL = new Map();
for (const [id, m] of Object.entries(MAP))
  for (const mc of [m.mc, ...(m.also || [])]) {
    if (!BY_ORIGINAL.has(mc)) BY_ORIGINAL.set(mc, []);
    BY_ORIGINAL.get(mc).push(Number(id));
  }

// [original id, original meta] for an internal cell, or null for an unknown id.
export function toOriginal(id, meta = 0, state = {}) {
  const m = MAP[id];
  return m ? m.to(meta, state || {}) : null;
}

// {id, meta, state?, exact} for an original cell; exact is false when the port keeps less (a wall
// torch becomes a standing torch). null when no port block represents the original id.
export function fromOriginal(mc, meta = 0) {
  const ids = BY_ORIGINAL.get(mc);
  if (!ids) return null;
  let fallback = null;
  for (const id of ids) {
    const r = MAP[id].from(meta & 15, mc);
    if (!r) continue;
    const out = { id, meta: r.meta, exact: r.exact };
    if (r.state) out.state = r.state;
    if (r.exact) return out;
    fallback ??= out;
  }
  return fallback;
}

export const internalIdsFor = (mc) => BY_ORIGINAL.get(mc)?.slice() || [];
