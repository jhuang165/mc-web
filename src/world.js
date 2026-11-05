import { skullBounds, installSkullBlocks } from "./skull-bounds.js";
import { generateJavaWorld, isJavaLandscape, JAVA_LANDSCAPES, streamedWorldType } from "./java-world.js";
import { decorateFlowers } from "./flowers.js";
import { generateLakes, generateSprings } from "./lakes.js";
import { populateSnow } from "./snow.js";
import { generateTreeAt } from "./trees.js";
import { ladderBounds } from "./ladders.js";
import { CACTUS_COLLISION, REED_BOUNDS, decorateSand, decorateReeds } from "./plants.js";
import { fenceMask, fenceConnectsTo, fenceBounds, fenceCollisionUnion, fenceCollisionBoxes, isFence } from "./fences.js";
import { installNetherBlocks, NETHER_FENCE, NETHER_BRICK_STAIRS, QUARTZ_STAIRS, SOUL_SAND, SOUL_SAND_COLLISION } from "./nether-blocks.js";
import { railBounds } from "./rails.js";
import { NOT_OPAQUE_NEW, isRailBlock2 } from "./blocks-0-40.js";
import { BREWING_BOXES, BREWING_SELECTION } from "./brewing.js";
import { HOPPER_BOXES } from "./hopper-shape.js";
import { torchBounds } from "./torches.js";
import { isDoor, isPane, doorBounds, paneMask, paneBounds, paneCollisionBoxes, paneCollisionUnion } from "./doors-panes.js";
import { isStair, stairBoxes, stairExcludedOctants, stairRayTrace, interceptBox } from "./stairs.js";
import { dispenserPistonBounds, dispenserPistonBoxes, unionBox, isDispenserPiston, isPistonBase, pistonExtended } from "./dispenser-piston.js";
import { isRedstoneBlock, redstoneBounds, hasCollision as redstoneHasCollision } from "./redstone-blocks.js";
import { installNoteJukeboxBlocks } from "./note-jukebox-content.js";
import { signBounds } from "./sign-bounds.js";
import { isChestShaped, TRAPPED_CHEST, ENDER_CHEST } from "./chest-blocks.js";
import { PUMPKIN_STEM, MELON_STEM, CAKE, stemBounds, cakeBounds } from "./stems-cake.js";
import { END_PORTAL, END_PORTAL_BOUNDS } from "./eye-of-ender.js";
import { DRAGON_EGG, EGG_BOUNDS } from "./dragon-egg.js";
import { isShaped, shapedBounds, shapedBoxes, gateOpen, FENCE_GATE as SHAPED_GATE, WOOD_SLAB as SHAPED_WOOD_SLAB, DOUBLE_WOOD_SLAB as SHAPED_DOUBLE_WOOD_SLAB, TRAPDOOR as SHAPED_TRAPDOOR, COBBLE_WALL as SHAPED_COBBLE_WALL } from "./shaped-blocks.js";
import { stoneUtilityBounds, stoneUtilityBoxes, hasPartialBounds, isStoneUtility } from "./stone-utility.js";
export const SIZE = 128,
  HEIGHT = 64,
  SEA = 16;
export const BLOCKS = [
  { name: "Air" },
  { name: "Grass", color: "#71994d", top: "#83ab59", side: "#7d6244" },
  { name: "Dirt", color: "#866444" },
  { name: "Stone", color: "#90918a" },
  { name: "Oak log", color: "#79603b", top: "#aa8e58" },
  { name: "Leaves", color: "#4c783f" },
  { name: "Sand", color: "#d8c99a" },
  { name: "Oak planks", color: "#b49462" },
  { name: "Brick", color: "#a66550" },
  { name: "Glass", color: "#bcd9d4" },
  { name: "Water", color: "#5f9fbc" },
  { name: "Bedrock", color: "#444941" },
  { name: "Cobblestone", color: "#777d77" },
  { name: "Crafting table", color: "#a47a48" },
  { name: "Furnace", color: "#7a7e7b" },
  { name: "Coal ore", color: "#7b817d" },
  { name: "Iron ore", color: "#a19280" },
  { name: "Diamond ore", color: "#78b9b6" },
  { name: "Gold ore", color: "#bbaa6b" },
  { name: "White wool", color: "#e7e5d9" },
  { name: "Torch", color: "#e1b968" },
  { name: "Bookshelf", color: "#a98e60" },
  { name: "Obsidian", color: "#383044" },
  { name: "Snow block", color: "#e4ece8" },
  { name: "Clay", color: "#9ba9b0" },
  { name: "Gravel", color: "#999189" },
  { name: "Iron block", color: "#c5ccca" },
  { name: "Gold block", color: "#e6c65d" },
  { name: "Diamond block", color: "#70cec5" },
  {name:'Farmland',color:'#8c6243',hidden:true},
  {name:'Moist farmland',color:'#65492f',hidden:true},
  ...Array.from({length:8},(_,i)=>({name:'Wheat (stage '+i+')',color:i===7?'#d7b75e':'#709b43',hidden:true})),
  {name:'Tall grass',color:'#82aa51'},
  {name:'Hardened clay',color:'#965c42'},
  {name:'Chest',color:'#a0742f'},
  // Flowing and still lava are one block (see fluids.js), like water at id 10.
  {name:'Lava',color:'#d4560f',hidden:true},
  // BlockFlower (yellow_flower = dandelion, red_flower meta 0-8): appended last
  // and referenced through the constants below, never by number.
  {name:'Dandelion',color:'#f1e04b'},
  {name:'Red flower',color:'#c9302a'},
  // BlockFire (alb, vanilla id 51): not in any creative tab. Logic in fire.js; its
  // age is the metadata.
  {name:'Fire',color:'#e2711d',hidden:true},
  // 46 and 47 are BlockSnow (snow_layer, metadata 0-7 = layers - 1) and BlockIce, referenced
  // through the constants below.
  {name:'Snow',color:'#f4fafa'},
  {name:'Ice',color:'#8cb4fe'},
  // Id 48 is BlockSapling (oak only: metadata 0, bit 8 = growth stage marked), see trees.js.
  {name:'Oak sapling',color:'#5f8f2f'},
  {name:'Carrots',color:'#6c9634',hidden:true},
  {name:'Potatoes',color:'#7f9a42',hidden:true},
  {name:'Cobweb',color:'#dedede'},
  // BlockLadder (original id 65); metadata 2-5 is the wall it hangs on (ladders.js).
  {name:'Ladder',color:'#9b7d4a'},
  // BlockCactus (original id 81) and BlockReed (83, "reeds"): metadata is the growth age
  // 0-15 (plants.js). Sugar cane is placed by its item (ItemReed, internal 327) and is
  // not a creative entry itself.
  {name:'Cactus',color:'#5f8a2e'},
  {name:'Sugar cane',color:'#94c065',hidden:true},
  // BlockTNT (original id 46); primed TNT and explosions are in explosion.js.
  {name:'TNT',color:'#db441a'},
  {name:'Sandstone',color:'#d9cba4',hidden:true},
  {name:'Mycelium',color:'#796b7d',hidden:true},
  {name:'Stained clay',color:'#a26b51',hidden:true},
  {name:'Lily pad',color:'#39772b',hidden:true},
  // Mineshaft blocks (public/research/mineshaft-blocks.md): BlockFence (original 85), BlockRail (66)
  // and BlockMobSpawner (52). Appended; internal ids are never renumbered.
  {name:'Fence',color:'#b49462'},
  {name:'Rail',color:'#8a7b62'},
  {name:'Monster spawner',color:'#1d2a36',hidden:true},
  ...[
    ['Lapis lazuli ore','#5676ba'],['Redstone ore','#944947'],['Glowing redstone ore','#c14839'],
    ['Emerald ore','#52946e'],['Pumpkin','#d78125'],['Monster egg','#888888'],['Double plant','#6c9b3c'],
    ['Acacia log','#827566'],['Acacia leaves','#65883f'],['Vines','#437536'],['Cocoa','#90602d'],
    ['Mossy cobblestone','#647857'],['Brown mushroom','#96754f'],['Red mushroom','#bb4537'],
    ['Brown mushroom block','#957253'],['Red mushroom block','#b83b2e'],['Dead bush','#8b683b'],
    ['Packed ice','#9db6e5'],['Melon','#98a934'],['Sandstone slab','#d9cba4'],
    ['Dead shrub','#8b683b'],['Fern','#669646'],
  ].map(([name,color])=>({name,color})),
  {name:'Anvil',color:'#555b5d'},
  {name:'Enchanting table',color:'#7b2d3c'},
  // 0.37.0 structure block families, appended in reserved order (internal 87-118); see block-registry.js.
  {name:'Oak wood stairs',color:'#9c7f4e'},
  {name:'Cobblestone stairs',color:'#7a7a7a'},
  {name:'Stone brick stairs',color:'#7b7b7b'},
  {name:'Sandstone stairs',color:'#d9cba4'},
  {name:'Spruce wood stairs',color:'#6b5132'},
  {name:'Birch wood stairs',color:'#c4b27b'},
  {name:'Jungle wood stairs',color:'#9e7350'},
  {name:'Brick stairs',color:'#965a4a'},
  {name:'Acacia wood stairs',color:'#a95b33'},
  {name:'Dark oak wood stairs',color:'#3f2a14'},
  {name:'Wooden door',color:'#8a6a3d'},
  {name:'Iron door',color:'#bfbfbf'},
  {name:'Iron bars',color:'#8c8c8c'},
  {name:'Glass pane',color:'#c6dfe4'},
  {name:'Stone bricks',color:'#7b7b7b'},
  {name:'Double stone slab',color:'#a8a8a8'},
  {name:'Stone slab',color:'#a8a8a8'},
  {name:'End portal frame',color:'#3b6b5a'},
  {name:'Cauldron',color:'#3c3c3c'},
  {name:'Flower pot',color:'#7c4536'},
  {name:'Redstone wire',color:'#9b0000'},
  {name:'Lever',color:'#6b5a3a'},
  {name:'Stone pressure plate',color:'#8a8a8a'},
  {name:'Wooden pressure plate',color:'#9c7f4e'},
  {name:'Stone button',color:'#8a8a8a'},
  {name:'Redstone repeater',color:'#a09a96'},
  {name:'Tripwire hook',color:'#8d8d8d'},
  {name:'Tripwire',color:'#d8d8d8'},
  {name:'Dispenser',color:'#6f6f6f'},
  {name:'Sticky piston',color:'#7e9a5a'},
  {name:'Piston',color:'#9c8d6b'},
  {name:'Piston head',color:'#9c8d6b'},
  // 0.39.0 redstone block family (internal 119-131, redstone-blocks-2.js); original ids in block-registry.js.
  {name:'Unlit redstone torch',color:'#6b3a2a'},
  {name:'Redstone torch',color:'#d63a22'},
  {name:'Redstone lamp',color:'#7d5a3a'},
  {name:'Lit redstone lamp',color:'#f0c872'},
  {name:'Block of redstone',color:'#b01010'},
  {name:'Wooden button',color:'#9c7f4e'},
  {name:'Light weighted pressure plate',color:'#f0d24a'},
  {name:'Heavy weighted pressure plate',color:'#d8d8d8'},
  {name:'Redstone comparator',color:'#a09a96'},
  {name:'Powered redstone comparator',color:'#c0b0aa'},
  {name:'Daylight sensor',color:'#a88c5a'},
  {name:'Piston moving block',color:'#9c8d6b'},
  {name:'Glowstone',color:'#d9b66c'},
  // 0.40.0 reservations (internal 132-137); behaviour in each owning module, original ids in block-registry.js.
  {name:'Dropper',color:'#7a7a7a'},
  {name:'Hopper',color:'#3c3c3c'},
  {name:'Brewing stand',color:'#8a7a5a'},
  {name:'Powered rail',color:'#c8a040'},
  {name:'Detector rail',color:'#8a6a50'},
  {name:'Activator rail',color:'#a05050'},
  // 0.42.0: BlockBed (original id 26, bed.js).
  {name:'Bed',color:'#a8322e'},
  {name:'Command Block',color:'#b88863'},
  // Colored and storage blocks (colored-blocks.js; original ids in block-registry.js). Items are 1140-1148.
  {name:'Stained glass',color:'#9fb4c8',hidden:true},{name:'Stained glass pane',color:'#9fb4c8',hidden:true},{name:'Carpet',color:'#e9ecec',hidden:true},{name:'Hay Bale',color:'#b8962c',hidden:true},
  {name:'Block of Coal',color:'#1b1b1b',hidden:true},{name:'Lapis Lazuli Block',color:'#1f3f9a',hidden:true},{name:'Block of Emerald',color:'#2bb74f',hidden:true},{name:'Sponge',color:'#c9c24a',hidden:true},{name:"Jack o'Lantern",color:'#d98a1b',hidden:true},
];
// Nether, End and quartz building blocks (internal 150-158, nether-blocks.js); ids 140-149 stay with other content tracks.
installNetherBlocks(BLOCKS);
installNoteJukeboxBlocks(BLOCKS); // internal 177 note block, 178 jukebox; unused ids up to 176 stay reserved placeholders
// Signs (signs.js; original blocks 63 and 68): internal 175-176 overwrite the reserved placeholders.
export const SIGN_POST=175,WALL_SIGN=176;
BLOCKS[SIGN_POST]={name:'Sign',color:'#9c7f4e'};
BLOCKS[WALL_SIGN]={name:'Wall sign',color:'#9c7f4e'};
// Shaped blocks (shaped-blocks.js): wood slab 165, double wood slab 166, fence gate 167, trapdoor 168, cobblestone wall 169
// overwrite the reserved placeholders; their items are 1165-1169.
BLOCKS[165]={name:'Wood Slab',color:'#b49462'};
BLOCKS[166]={name:'Double Wood Slab',color:'#b49462'};
BLOCKS[167]={name:'Fence Gate',color:'#b49462'};
BLOCKS[168]={name:'Trapdoor',color:'#8f6f3a'};
BLOCKS[169]={name:'Cobblestone Wall',color:'#8d8d8d'};
// Chests track (chest-blocks.js): trapped chest (original 146) and ender chest (original 130) overwrite reserved 162 and 163; items 1940/1941.
BLOCKS[TRAPPED_CHEST]={name:'Trapped Chest',color:'#a06e2f'};
BLOCKS[ENDER_CHEST]={name:'Ender Chest',color:'#16393b'};
// Stems and cake (stems-cake.js): internal 159 pumpkin stem, 160 melon stem, 161 cake overwrite the reserved placeholders; cake's item is 1930.
BLOCKS[PUMPKIN_STEM]={name:'Pumpkin stem',color:'#7a9a3a'};
BLOCKS[MELON_STEM]={name:'Melon stem',color:'#7a9a3a'};
BLOCKS[CAKE]={name:'Cake',color:'#e8d6c4'};
installSkullBlocks(BLOCKS); // skull.js: original block 144 (mob head) overwrites reserved 172; item 2050
BLOCKS[END_PORTAL]={name:'End Portal',color:'#0b1a1a',hidden:true}; // eye-of-ender.js: original block 119 overwrites reserved 149
BLOCKS[DRAGON_EGG]={name:'Dragon Egg',color:'#0e0b16'}; // dragon-egg.js: original block 122 overwrites reserved 171
export const LAPIS_ORE=63,REDSTONE_ORE=64,LIT_REDSTONE_ORE=65,EMERALD_ORE=66,PUMPKIN=67,MONSTER_EGG=68,DOUBLE_PLANT=69,
  LOG2=70,LEAVES2=71,VINE=72,COCOA=73,MOSSY_COBBLE=74,BROWN_MUSHROOM=75,RED_MUSHROOM=76,
  BROWN_MUSHROOM_BLOCK=77,RED_MUSHROOM_BLOCK=78,DEAD_BUSH=79,PACKED_ICE=80,MELON=81,SANDSTONE_SLAB=82,DEAD_SHRUB=83,FERN=84;
export const TREE_TYPES=['Oak','Spruce','Birch','Jungle','Acacia','Dark oak'];
export const DOUBLE_PLANTS=['Sunflower','Lilac','Double tallgrass','Large fern','Rose bush','Peony'];
export const SANDSTONE=56,MYCELIUM=57,STAINED_CLAY=58,LILY_PAD=59;
export const TORCH=20,FENCE=60,RAIL=61,MOB_SPAWNER=62;
// Original BlockAnvil id 145, appended to preserve every existing internal ID.
export const ANVIL=85;
// Original BlockEnchantmentTable id 116 (0.75 high, light opacity 0), appended after the anvil.
export const ENCHANTING_TABLE=86;
// Structure block families (original ids in block-registry.js), reserved together so they keep these ids.
export const OAK_STAIRS=87,COBBLESTONE_STAIRS=88,STONE_BRICK_STAIRS=89,SANDSTONE_STAIRS=90,SPRUCE_STAIRS=91,BIRCH_STAIRS=92,JUNGLE_STAIRS=93,BRICK_STAIRS=94,ACACIA_STAIRS=95,DARK_OAK_STAIRS=96,WOODEN_DOOR=97,IRON_DOOR=98,IRON_BARS=99,GLASS_PANE=100,STONE_BRICKS=101,DOUBLE_STONE_SLAB=102,STONE_SLAB=103,END_PORTAL_FRAME=104,CAULDRON=105,FLOWER_POT=106,REDSTONE_WIRE=107,LEVER=108,STONE_PRESSURE_PLATE=109,WOODEN_PRESSURE_PLATE=110,STONE_BUTTON=111,REPEATER=112,TRIPWIRE_HOOK=113,TRIPWIRE=114,DISPENSER=115,STICKY_PISTON=116,PISTON=117,PISTON_HEAD=118;
// 0.39.0 redstone blocks (redstone-blocks-2.js keeps the same numbers; the module cannot import these without a cycle).
export const REDSTONE_TORCH_OFF=119,REDSTONE_TORCH=120,REDSTONE_LAMP=121,REDSTONE_LAMP_LIT=122,REDSTONE_BLOCK=123,WOODEN_BUTTON=124,LIGHT_PLATE=125,HEAVY_PLATE=126,COMPARATOR=127,COMPARATOR_POWERED=128,DAYLIGHT_SENSOR=129,PISTON_MOVING=130,GLOWSTONE=131;
export const WATER=10,LAVA=42;
export const BED=138;
export const COMMAND_BLOCK=139;
import { STAINED_GLASS, STAINED_GLASS_PANE, CARPET, HAY_BALE, COAL_BLOCK, LAPIS_BLOCK, EMERALD_BLOCK, SPONGE, JACK_O_LANTERN } from "./colored-blocks.js"; // ids 140-148 live there (no imports) to avoid a cycle
export { STAINED_GLASS, STAINED_GLASS_PANE, CARPET, HAY_BALE, COAL_BLOCK, LAPIS_BLOCK, EMERALD_BLOCK, SPONGE, JACK_O_LANTERN };
export const SNOW_LAYER=46,ICE=47,SAPLING=48;
export const CARROTS=49,POTATOES=50,WEB=51,LADDER=52,TNT=55;
// Sand (6, original 12) and gravel (25, original 13) are the BlockFalling blocks (falling.js).
export const SAND=6,GRAVEL=25,CACTUS=53,REEDS=54;
export const isLiquid=b=>b===WATER||b===LAVA;
export const YELLOW_FLOWER = BLOCKS.findIndex((b) => b.name === 'Dandelion');
export const RED_FLOWER = BLOCKS.findIndex((b) => b.name === 'Red flower');
export const FIRE = BLOCKS.findIndex((b) => b.name === 'Fire');
export const TALL_GRASS = 39;
// BlockFlower.field_149860_M / field_149861_a: red_flower metadata 0-8 names
// and their textures (flower_<texture>.png). Dandelion has no variants.
export const RED_FLOWERS = [
  ['rose', 'Poppy'], ['blue_orchid', 'Blue orchid'], ['allium', 'Allium'], ['houstonia', 'Azure bluet'],
  ['tulip_red', 'Red tulip'], ['tulip_orange', 'Orange tulip'], ['tulip_white', 'White tulip'],
  ['tulip_pink', 'Pink tulip'], ['oxeye_daisy', 'Oxeye daisy'],
].map(([texture, label]) => ({ texture, label }));
// ItemDye (acj) id 351, damage 0-15: field_150921_b gives the dye_powder_<texture>
// suffix and the lang file the label. Damage 15 is bone meal (internal id 310
// before this port; saves migrate it, see inventory.js).
export const DYE = 351;
export const DYES = [
  ['black', 'Ink sac'], ['red', 'Rose red'], ['green', 'Cactus green'], ['brown', 'Cocoa beans'],
  ['blue', 'Lapis lazuli'], ['purple', 'Purple dye'], ['cyan', 'Cyan dye'], ['silver', 'Light gray dye'],
  ['gray', 'Gray dye'], ['pink', 'Pink dye'], ['lime', 'Lime dye'], ['yellow', 'Dandelion yellow'],
  ['light_blue', 'Light blue dye'], ['magenta', 'Magenta dye'], ['orange', 'Orange dye'], ['white', 'Bone meal'],
].map(([texture, label]) => ({ texture, label }));
export const isFlower = (b) => b === YELLOW_FLOWER || b === RED_FLOWER;
// BlockColored (aka) metadata 0-15 in wool order: `texture` is the
// wool_colored_<name> suffix (ItemDye.field_150921_b[~meta & 15]) and `label`
// the item name ("tile.cloth.<name>.name"). The id 19 stack's damage is the metadata.
export const WOOL_COLORS = [
  ["white", "White"], ["orange", "Orange"], ["magenta", "Magenta"], ["light_blue", "Light blue"],
  ["yellow", "Yellow"], ["lime", "Lime"], ["pink", "Pink"], ["gray", "Gray"],
  ["silver", "Light gray"], ["cyan", "Cyan"], ["purple", "Purple"], ["blue", "Blue"],
  ["brown", "Brown"], ["green", "Green"], ["red", "Red"], ["black", "Black"],
].map(([texture, label]) => ({ texture, label }));
export const WOOL = 19;
export const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8, 9];
// Vanilla 1.7.10 values, located using MCP SRG mappings and javap; see research notes.
export const PHYSICS = Object.freeze({
  tick: 1 / 20,
  gravity: 0.08,
  drag: Math.fround(0.98),
  jump: Math.fround(0.42),
  width: 0.6,
  height: 1.8,
  eye: 1.62,
});
export function fallingVelocity(v) {
  return (v - PHYSICS.gravity) * PHYSICS.drag;
}
export function hashSeed(value) {
  let h = 0;
  for (const c of String(value)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h;
}
export function hash(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, z, seed) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  let fx = x - ix,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed) * (1 - fx) + hash(ix + 1, iz, seed) * fx,
    b = hash(ix, iz + 1, seed) * (1 - fx) + hash(ix + 1, iz + 1, seed) * fx;
  return a * (1 - fz) + b * fz;
}
export const isCrop=b=>(b>=31&&b<=38)||b===CARROTS||b===POTATOES;
// Wheat's stages retain their old internal IDs for save compatibility; root crops use metadata.
export const cropAge=(b,meta=0)=>b>=31&&b<=38?b-31:meta&7;
export const cropKind=b=>b>=31&&b<=38?31:b;
export const blockHeight=b=>b===LILY_PAD?1/64:b===29||b===30?15/16:isChestShaped(b)?.875:b===SNOW_LAYER?.125:b===ENCHANTING_TABLE?.75:b===BED?.5625:1;
export const isPlant=b=>isCrop(b)||b===PUMPKIN_STEM||b===MELON_STEM||b===39||isFlower(b)||b===SAPLING||[DOUBLE_PLANT,BROWN_MUSHROOM,RED_MUSHROOM,DEAD_BUSH,DEAD_SHRUB,FERN].includes(b);
// Blocks with Block.tickRandomly: they count towards a section's random-tick refcount
// (ExtendedBlockStorage.getNeedsRandomTick), which WorldServer reads to pick sections.
// Grass, leaves, farmland, crops, lava, snow layer, ice and saplings here; snow and ice act on a
// random tick in snow.js/weather.js, fire and still lava in fire.js, leaves (decay) and saplings (growth) in trees.js.
// Cactus and sugar cane grow on a random tick (plants.js).
export const ticksRandomly=b=>b===1||b===5||b===LEAVES2||b===LIT_REDSTONE_ORE||b===COCOA||b===29||b===30||isCrop(b)||b===LAVA||b===SNOW_LAYER||b===ICE||b===FIRE||b===SAPLING||b===CACTUS||b===REEDS||b===PUMPKIN_STEM||b===MELON_STEM;
// Block.func_149730_j (opaque at construction) and isNormalCube for this
// build's blocks. Leaves count as opaque: BlockLeaves reports an opaque cube
// while its fancy-graphics flag is still unset in the Block constructor.
const SEE_THROUGH=new Set([STAINED_GLASS,STAINED_GLASS_PANE,CARPET,0,9,10,20,29,30,41,42,SNOW_LAYER,ICE,FIRE,WEB,LADDER,CACTUS,REEDS,LILY_PAD,FENCE,NETHER_FENCE,NETHER_BRICK_STAIRS,QUARTZ_STAIRS,RAIL,SIGN_POST,WALL_SIGN,MOB_SPAWNER,VINE,COCOA,SANDSTONE_SLAB,ANVIL,ENCHANTING_TABLE,STONE_SLAB,END_PORTAL_FRAME,CAULDRON,FLOWER_POT,OAK_STAIRS,COBBLESTONE_STAIRS,STONE_BRICK_STAIRS,SANDSTONE_STAIRS,SPRUCE_STAIRS,BIRCH_STAIRS,JUNGLE_STAIRS,BRICK_STAIRS,ACACIA_STAIRS,DARK_OAK_STAIRS,WOODEN_DOOR,IRON_DOOR,IRON_BARS,GLASS_PANE,STICKY_PISTON,PISTON,PISTON_HEAD,107,108,109,110,111,112,113,114,119,120,124,125,126,127,128,129,130,SHAPED_WOOD_SLAB,SHAPED_GATE,SHAPED_TRAPDOOR,SHAPED_COBBLE_WALL,TRAPPED_CHEST,ENDER_CHEST,...NOT_OPAQUE_NEW]); // 119-130: the redstone torches, button, plates, comparators, sensor and moving piston (redstone-blocks-2.js SEE_THROUGH2)
SEE_THROUGH.add(172); // BlockSkull: not an opaque cube
SEE_THROUGH.add(CAKE); // BlockCake: not an opaque cube
SEE_THROUGH.add(END_PORTAL); // BlockEndPortal: not opaque, not a normal cube
SEE_THROUGH.add(DRAGON_EGG); // BlockDragonEgg: isOpaqueCube false (renderType 27), but renderAsNormalBlock stays true
export const opaqueCube=b=>!SEE_THROUGH.has(b)&&!isPlant(b);
// Block.isNormalCube: Material.tnt is translucent (isOpaque false), so TNT is an opaque
// cube that is not a normal cube (no torches/ladders/fire tops on it).
// BlockMobSpawner (ama) is not an opaque cube (isOpaqueCube false: it is drawn as a cage and
// hides nothing) but Material.rock and renderAsNormalBlock make it a normal cube.
// BlockEndPortalFrame is not an opaque cube either, but keeps renderAsNormalBlock and Material.rock, so it
// is a normal cube (Block.isNormalCube 120 is true in pushout-reference.json).
export const normalCube=b=>(opaqueCube(b)&&b!==5&&b!==LEAVES2&&b!==TNT&&b!==123&&b!==131)||b===MOB_SPAWNER||b===END_PORTAL_FRAME;
// setBlockBoundsBasedOnState: chests are inset by 1/16 except towards a partner.
// A snow layer's collision box is meta * 1/8 tall (BlockSnow.getCollisionBoundingBoxFromPool: meta 0
// is flat and has none); its selection box is (meta + 1) / 8 (snowSelectionHeight).
// Block.slipperiness (field_149765_K): 0.6 for every block here but ice, 0.98 (BlockIce).
export const slipperiness=b=>b===ICE||b===PACKED_ICE?Math.fround(0.98):Math.fround(0.6);
export const snowSelectionHeight=meta=>((meta&7)+1)/8;
// The solid-neighbour test of BlockWall.canConnectWallTo: the fence rule (fences.js) without the fence block itself.
export const wallSolid=b=>b!==FENCE&&fenceConnectsTo(b);
export function blockBounds(world,x,y,z){
  const b=world.get(x,y,z);
  // BlockAnvil.setBlockBoundsBasedOnState: metadata low bits 0/2 narrow X,
  // 1/3 narrow Z. The render model itself uses four native component boxes.
  if(b===ANVIL)return (world.getMeta(x,y,z)&1)?[0,0,1/8,1,1,7/8]:[1/8,0,0,7/8,1,1];
  if(b===75||b===76)return[.3,0,.3,.7,.4,.7];
  if(b===PUMPKIN_STEM||b===MELON_STEM)return stemBounds(world.getMeta(x,y,z)); // BlockStem.setBlockBoundsBasedOnState
  if(b===DRAGON_EGG)return EGG_BOUNDS; // BlockDragonEgg: 1/16 in from the sides
  if(b===END_PORTAL)return END_PORTAL_BOUNDS; // BlockEndPortal.setBlockBoundsBasedOnState: 1/16 high
  if(b===CAKE)return cakeBounds(world.getMeta(x,y,z)); // BlockCake: shrinks 2/16 per bite from the west
  if([79,83,84].includes(b))return[0.09999999403953552,0,0.09999999403953552,0.8999999761581421,0.800000011920929,0.8999999761581421];
  if(b===VINE){const m=world.getMeta(x,y,z),boxes=[];if(m&1)boxes.push([0,0,15/16,1,1,1]);if(m&2)boxes.push([0,0,0,1/16,1,1]);if(m&4)boxes.push([0,0,0,1,1,1/16]);if(m&8)boxes.push([15/16,0,0,1,1,1]);return boxes.length?[...Array(3)].map((_,i)=>Math.min(...boxes.map(b=>b[i]))).concat([...Array(3)].map((_,i)=>Math.max(...boxes.map(b=>b[i+3])))):[0,15/16,0,1,1,1];}
  if(b===SANDSTONE_SLAB)return[0,0,0,1,.5,1];
  if(b===CARPET)return[0,0,0,1,1/16,1]; // BlockCarpet.setBlockBoundsForCarpet (colored-blocks.js)
  if(isShaped(b))return shapedBounds(world,x,y,z,wallSolid);
  // Stone slabs (half-high, top bit), the end portal frame (13/16), the cauldron (full selection) and the flower pot box.
  if(isStoneUtility(b))return stoneUtilityBounds(b,world.getMeta(x,y,z));
  // Redstone components (redstone-blocks.js): per-metadata boxes; only the repeater collides.
  if(isRedstoneBlock(b))return redstoneBounds(b,world.getMeta(x,y,z));
  // BlockPistonBase / BlockPistonExtension.setBlockBoundsBasedOnState (an extended base is cut 4/16, the head is its plate).
  if(isDispenserPiston(b))return dispenserPistonBounds(b,world.getMeta(x,y,z));
  if(b===COCOA){const m=world.getMeta(x,y,z),age=(m>>2)&3,w=(4+age*2)/16,h=(5+age*2)/16;const d=m&3;return d===0?[.5-w/2,.75-h,15/16-w,.5+w/2,.75,15/16]:d===1?[1/16,.75-h,.5-w/2,1/16+w,.75,.5+w/2]:d===2?[.5-w/2,.75-h,1/16,.5+w/2,.75,1/16+w]:[15/16-w,.75-h,.5-w/2,15/16,.75,.5+w/2];}
  if(b===SNOW_LAYER)return[0,0,0,1,(world.getMeta(x,y,z)&7)*.125,1];
  if(b===LADDER)return ladderBounds(world.getMeta(x,y,z));
  // BlockCactus.getCollisionBoundingBoxFromPool: 1/16 in from the sides and the top.
  if(b===CACTUS)return CACTUS_COLLISION;
  // BlockFence.setBlockBoundsBasedOnState (union of post and arms, 1 high), BlockRailBase (0.125, or
  // 0.625 ascending) and BlockTorch's per-metadata box (collisionRayTrace).
  if(isFence(b))return fenceBounds(fenceMask(world,x,y,z));
  // BlockDoor.func_150011_b (per facing, open, hinge) and BlockPane.setBlockBoundsBasedOnState.
  if(isDoor(b))return doorBounds(world,x,y,z);
  if(isPane(b))return paneBounds(paneMask(world,x,y,z));
  if(b===RAIL)return railBounds(world.getMeta(x,y,z));
  if(b===134)return[...BREWING_SELECTION]; // brewing stand (brewing.js)
  if(isRailBlock2(b))return railBounds(world.getMeta(x,y,z)&7); // powered/detector/activator rails: bit 3 is the powered flag (BlockRailBase.setBlockBoundsBasedOnState)
  if(b===TORCH)return torchBounds(world.getMeta(x,y,z));
  if(b===172)return skullBounds(world.getMeta(x,y,z)); // BlockSkull.setBlockBoundsBasedOnState
  if(b===SIGN_POST||b===WALL_SIGN)return signBounds(b,world.getMeta(x,y,z)); // BlockSign.setBlockBoundsBasedOnState
  if(b===ENDER_CHEST)return[1/16,0,1/16,15/16,.875,15/16]; // BlockEnderChest: 0.0625 inset, never joins a neighbour
  if(!isChestShaped(b))return[0,0,0,1,blockHeight(b),1];
  const c=(dx,dz)=>world.get(x+dx,y,z+dz)===b; // a chest joins only its own kind
  return[c(-1,0)?0:1/16,0,c(0,-1)?0:1/16,c(1,0)?1:15/16,.875,c(0,1)?1:15/16];
}
// Block.getCollisionBoundingBoxFromPool: as blockBounds, except BlockFarmland (aky) collides
// as a full cube although it renders and selects 15/16 high.
export function collisionBounds(world,x,y,z){
  const b=world.get(x,y,z);
  // A fence collides 1.5 high (BlockFence.addCollisionBoxesToList). Callers that take one box get
  // the union of its arms; collisionBoxes has the original separate boxes.
  if(b===SOUL_SAND)return SOUL_SAND_COLLISION; // BlockSoulSand: 0.125 lower collision box, full selection box
  if(isFence(b))return fenceCollisionUnion(fenceMask(world,x,y,z));
  if(b===SHAPED_COBBLE_WALL)return shapedBoxes(world,x,y,z,wallSolid)[0];
  if(b===SHAPED_GATE){const g=shapedBoxes(world,x,y,z,wallSolid);return g[0]||blockBounds(world,x,y,z);}
  // A cauldron's walls and an eyed end portal frame collide as several boxes; one-box callers take the cell's bounds.
  if(isDispenserPiston(b))return unionBox(dispenserPistonBoxes(b,world.getMeta(x,y,z)));
  if(isStoneUtility(b)){const boxes=stoneUtilityBoxes(b,world.getMeta(x,y,z));return[0,1,2].map(i=>Math.min(...boxes.map(v=>v[i]))).concat([3,4,5].map(i=>Math.max(...boxes.map(v=>v[i]))));}
  // BlockPane adds an x arm and a z arm; one-box callers take their union.
  if(isPane(b))return paneCollisionUnion(paneMask(world,x,y,z));
  // BlockStairs adds two or three boxes (stairBoxes); one-box callers get their union.
  if(isStair(b)){const boxes=stairBoxes(world,x,y,z);return[0,1,2].map(i=>Math.min(...boxes.map(v=>v[i]))).concat([3,4,5].map(i=>Math.max(...boxes.map(v=>v[i]))));}
  return b===29||b===30?[0,0,0,1,1,1]:blockBounds(world,x,y,z);
}
// Block.addCollisionBoxesToList: the cell's collision boxes in block-local coordinates ([] without one).
export function collisionBoxes(world,x,y,z){
  if(!world.solid(x,y,z))return[];
  const b=world.get(x,y,z);
  return b===134?BREWING_BOXES.map(v=>[...v]):b===133?HOPPER_BOXES.map(v=>[...v]):isShaped(b)?shapedBoxes(world,x,y,z,wallSolid):isFence(b)?fenceCollisionBoxes(fenceMask(world,x,y,z)):isPane(b)?paneCollisionBoxes(paneMask(world,x,y,z)):isStair(b)?stairBoxes(world,x,y,z):isStoneUtility(b)?stoneUtilityBoxes(b,world.getMeta(x,y,z)):isDispenserPiston(b)?dispenserPistonBoxes(b,world.getMeta(x,y,z)):[collisionBounds(world,x,y,z)];
}
// One-box-per-block collision consumers (items, particles, carts, projectiles) take a stair's two or three boxes
// and every other block's single collisionBounds box.
export const collisionBoxList=(world,x,y,z)=>isShaped(world.get(x,y,z))?shapedBoxes(world,x,y,z,wallSolid):world.get(x,y,z)===134?BREWING_BOXES.map(v=>[...v]):world.get(x,y,z)===133?HOPPER_BOXES.map(v=>[...v]):isDispenserPiston(world.get(x,y,z))?dispenserPistonBoxes(world.get(x,y,z),world.getMeta(x,y,z)):isStoneUtility(world.get(x,y,z))?stoneUtilityBoxes(world.get(x,y,z),world.getMeta(x,y,z)):isStair(world.get(x,y,z))?stairBoxes(world,x,y,z):isPane(world.get(x,y,z))?paneCollisionBoxes(paneMask(world,x,y,z)):[collisionBounds(world,x,y,z)];
// Block.getSelectedBoundingBoxFromPool (the drawn outline), block-local. BlockCactus draws its
// collision box inset; sugar cane its block bounds.
export function selectionBounds(world,x,y,z){
  const b=world.get(x,y,z);
  if(b===SNOW_LAYER)return[0,0,0,1,snowSelectionHeight(world.getMeta(x,y,z)),1];
  if(b===REEDS)return[...REED_BOUNDS];
  return blockBounds(world,x,y,z);
}
// World.solid's test for one cell: what has a collision box. Sugar cane has none
// (BlockReed.getCollisionBoundingBoxFromPool returns null).
export function solidBlock(b, meta = 0) {
  // A flat snow layer (meta 0) has no collision box, so it is not an obstacle.
  if (b === SNOW_LAYER) return (meta & 7) !== 0;
  // An open fence gate has no collision box (BlockFenceGate.getCollisionBoundingBoxFromPool).
  if (b === SHAPED_GATE) return !gateOpen(meta);
  // Rails have no collision box either (BlockRailBase.getCollisionBoundingBoxFromPool is null).
  return b !== 0 && b !== 10 && b !== 42 && b !== 20 && b !== CARPET && b !== END_PORTAL && b !== FIRE && b !== WEB && b !== REEDS && b !== RAIL && !isRailBlock2(b) && b !== VINE && b !== SIGN_POST && b !== WALL_SIGN && !(b >= 107 && b <= 114 && !redstoneHasCollision(b)) && !(b === 119 || b === 120 || b === 124 || b === 125 || b === 126 || b === 130) && !isPlant(b);
}
// One 16 x 16 chunk column of the live world (WORLD-02b): port block ids and 4-bit metadata, one byte
// each, at (lx * 16 + lz) * HEIGHT + y, and the random-tick refcount of each 16-high section
// (ExtendedBlockStorage.tickRefCount), built on first use. Ids are this build's internal ones;
// chunk-store.js holds the original-id form.
export class WorldChunk {
  constructor(x, z, height = HEIGHT) {
    this.height = height;
    this.x = x;
    this.z = z;
    this.blocks = new Uint8Array(16 * 16 * this.height);
    this.meta = new Uint8Array(16 * 16 * this.height);
    this.tickCounts = null;
  }
  sectionTickCount(s) {
    if (!this.tickCounts) {
      this.tickCounts = new Int32Array(this.height / 16);
      for (let i = 0; i < this.blocks.length; i++) if (ticksRandomly(this.blocks[i])) this.tickCounts[(i % this.height) >> 4]++;
    }
    return this.tickCounts[s];
  }
}
const cellIndex = (x, y, z, height) => ((x & 15) * 16 + (z & 15)) * height + y;
// Coordinate pairs stay distinct throughout the native world border.
const columnKey = (cx, cz) => `${cx},${cz}`;
export class World {
  // Streamed worlds: version 12 is terrain, caves and ravines only; 13 adds per-cell Java population
  // (streaming-population.js); 15 adds villages, strongholds and temples. Finite Java worlds: 11 mineshafts, 14 all
  // structures. Saved worlds keep their generator.
  constructor(seed = "Overworld", biome = "meadow", generationVersion = biome === 'javaStreamed' ? 13 : isJavaLandscape(biome) ? 11 : 8, worldType = 'default') {
    if (biome === 'javaStreamed' && ![12, 13, 15].includes(generationVersion)) throw new Error('Unsupported streamed world generation version');
    this.seed = String(seed);
    this.biome = biome;
    this.generationVersion = generationVersion;
    this.streaming = biome === 'javaStreamed';
    // WorldType of the generator (java-world.js streamedWorldType); finite Java landscapes derive it from the biome.
    this.worldType = this.streaming ? streamedWorldType(worldType) : (JAVA_LANDSCAPES[biome] ?? 'default');
    this.minX = this.minZ = 0;
    this.maxX = this.maxZ = SIZE;
    this.height = generationVersion >= 9 && isJavaLandscape(biome) ? 256 : HEIGHT;
    this.seaLevel = this.height === 256 ? 63 : SEA;
    this.numericSeed = hashSeed(seed);
    // Cells live in 16 x 16 columns keyed by chunk coordinate; this world still has exactly the
    // SIZE / 16 x SIZE / 16 columns at 0..SIZE - 1. Metadata is a 4-bit value per cell, like Chunk's
    // nibble array. Generated water is level 0, a source.
    this.chunks = new Map();
    for (let cx = 0; cx < SIZE / 16; cx++) for (let cz = 0; cz < SIZE / 16; cz++) this.chunks.set(columnKey(cx, cz), new WorldChunk(cx, cz, this.height));
    this.lastChunk = null;
    this.edits = new Map();
    // Streamed worlds: each column's edits by cell index, stored as order * 4096 + value, where
    // order is a monotonic first-edit ordinal, retained even after cache eviction; and the columns edited since
    // the last takeDirtyColumns (world-storage.js writes those).
    this.chunkEdits = new Map();
    this.dirtyColumns = new Set();
    this.savingColumns = new Map();
    this.nextEditOrder = 0;
    this.onChange = null;
    // Saved block light (World.getSavedLightValue(EnumSkyBlock.Block)): the scene sets this to
    // its LightVolume; until then snow.js works it out from the lava.
    this.blockLight = null;
    this.generate();
  }
  // Legacy numeric cell order; streaming uses a coordinate key without finite-width aliases.
  index(x, y, z) {
    if (this.streaming) return `${x},${y},${z}`;
    return (x * SIZE + z) * this.height + y;
  }
  inside(x, y, z) {
    if (this.streaming) return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
      && x + this.originX >= -30000000 && x + this.originX < 30000000
      && z + this.originZ >= -30000000 && z + this.originZ < 30000000 && y >= 0 && y < this.height;
    return x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < this.height;
  }
  isLoaded(x, z) { return !!this.chunkAt(Math.floor(x / 16), Math.floor(z / 16)); }
  // A one-chunk halo keeps block and entity updates away from unloaded neighbours.
  // This is a browser working set, not the native spawn-ticket/watch-distance policy.
  isTicking(x, z) {
    return !this.streaming || x >= this.minX + 16 && x < this.maxX - 16 && z >= this.minZ + 16 && z < this.maxZ - 16;
  }
  // The resident square's corner for a player at (x, z): eight columns per axis, clamped to the border.
  windowAt(x, z) {
    return {
      minX: Math.max(-30000000-this.originX, Math.min(29999872-this.originX, (Math.floor(x / 16) - 4) * 16)),
      minZ: Math.max(-30000000-this.originZ, Math.min(29999872-this.originZ, (Math.floor(z / 16) - 4) * 16)),
    };
  }
  streamAround(x, z) {
    if (!this.streaming || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    const { minX, minZ } = this.windowAt(x, z);
    if (this.minX === minX && this.minZ === minZ) return null;
    // Generate the next working set before eviction. A generator failure leaves the old set intact.
    const next = new Map(), added = [], removed = [];
    for (let cx = minX / 16; cx < minX / 16 + 8; cx++) for (let cz = minZ / 16; cz < minZ / 16 + 8; cz++) {
      const key = columnKey(cx, cz);
      let c = this.chunks.get(key);
      if (!c) {
        const generated = this.generateTerrainChunk(cx, cz);
        c = new WorldChunk(cx, cz, this.height);
        c.blocks.set(generated.blocks); c.meta.set(generated.metadata);
        for (const [cell, stored] of this.chunkEdits.get(key) ?? []) {
          const value = stored % 4096;
          c.blocks[cell] = value & 255; c.meta[cell] = value >> 8;
        }
        added.push(c);
      }
      next.set(key, c);
    }
    for (const [key, c] of this.chunks) if (!next.has(key)) removed.push(c);
    this.chunks = next; this.lastChunk = null;
    this.minX = minX; this.minZ = minZ; this.maxX = minX + SIZE; this.maxZ = minZ + SIZE;
    // WorldChunkManager's standalone cache has no expiry. Retain the working set
    // and a biome halo here instead of retaining every explored biome array.
    for (const key of this.javaGenerator.manager.cache.keys()) {
      const [cx,cz] = key.split(',').map(Number);
      const x = cx*16-this.originX, z = cz*16-this.originZ;
      if (x < minX-16 || x >= this.maxX+16 || z < minZ-16 || z >= this.maxZ+16) this.javaGenerator.manager.cache.delete(key);
    }
    return { added, removed };
  }
  // Population records (chests, animals, spawners, carts, liquid ticks) of resident columns that have
  // never been claimed, once each; [] for worlds without streamed population.
  claimFreshColumns() {
    return this.population ? this.population.claim([...this.chunks.values()].map((c) => [c.x, c.z])) : [];
  }
  saveClaimedColumns() { return this.population ? this.population.saveMaterialized() : null; }
  restoreClaimedColumns(saved) { this.population?.restoreMaterialized(saved); }
  // The column holding chunk (cx, cz), or null.
  chunkAt(cx, cz) {
    const c = this.lastChunk;
    if (c && c.x === cx && c.z === cz) return c;
    const found = this.chunks.get(columnKey(cx, cz)) || null;
    if (found) this.lastChunk = found;
    return found;
  }
  // World.getBlock: below y 0 (and above the top) is air, so a hole in the floor opens onto the void.
  get(x, y, z) {
    if (!this.inside(x, y, z)) return 0;
    return this.chunkAt(x >> 4, z >> 4)?.blocks[cellIndex(x, y, z, this.height)] ?? 0;
  }
  // The block ids of column (x, z) bottom to top, as a view of the chunk's array; null when the
  // column is outside the world or not resident (all air to get).
  columnBlocks(x, z) {
    if (!this.inside(x, 0, z)) return null;
    const c = this.chunkAt(x >> 4, z >> 4), start = ((x & 15) * 16 + (z & 15)) * this.height;
    return c ? c.blocks.subarray(start, start + this.height) : null;
  }
  getMeta(x, y, z) {
    return this.inside(x, y, z) ? this.chunkAt(x >> 4, z >> 4)?.meta[cellIndex(x, y, z, this.height)] ?? 0 : 0;
  }
  solid(x, y, z) {
    const b = this.get(x, y, z);
    return solidBlock(b, b === SNOW_LAYER || b === SHAPED_GATE ? this.getMeta(x, y, z) : 0);
  }
  // Section (16 high) random-tick refcounts, kept up to date by put() once built.
  sectionTickCount(cx, cz, s) {
    return this.chunkAt(cx, cz)?.sectionTickCount(s) ?? 0;
  }
  // Every cell as flat block and metadata arrays in index() order (tests and whole-world copies).
  snapshot() {
    if (this.streaming) throw new Error('Streamed worlds use chunk columns, not a finite snapshot');
    const data = new Uint8Array(SIZE * SIZE * this.height), meta = new Uint8Array(SIZE * SIZE * this.height);
    for (const c of this.chunks.values())
      for (let lx = 0; lx < 16; lx++)
        for (let lz = 0; lz < 16; lz++) {
          const from = (lx * 16 + lz) * this.height, to = this.index(c.x * 16 + lx, 0, c.z * 16 + lz);
          data.set(c.blocks.subarray(from, from + this.height), to);
          meta.set(c.meta.subarray(from, from + this.height), to);
        }
    return { data, meta };
  }
  // Writes a cell with no bounds, edit or tick-count bookkeeping (generation and migration).
  // Tick counts are rebuilt on next use.
  setRaw(x, y, z, b, meta = 0) {
    const c = this.chunkAt(x >> 4, z >> 4), i = cellIndex(x, y, z, this.height);
    c.blocks[i] = b;
    c.meta[i] = meta;
    c.tickCounts = null;
  }
  // Writes a block and its metadata without telling onChange (fluids.js uses it
  // for its own edits). A tracked edit is saved as block | meta << 8, so saves
  // from before metadata existed (plain block ids) read back as meta 0.
  put(x, y, z, b, meta = 0, track = true) {
    if (
      !this.inside(x, y, z) ||
      !this.isLoaded(x, z) ||
      !Number.isInteger(b) ||
      b < 0 ||
      b >= BLOCKS.length ||
      !Number.isInteger(meta) ||
      meta < 0 ||
      meta > 15
    )
      return false;
    const c = this.chunkAt(x >> 4, z >> 4), i = cellIndex(x, y, z, this.height);
    if (c.tickCounts) {
      const section = y >> 4;
      if (ticksRandomly(c.blocks[i])) c.tickCounts[section]--;
      if (ticksRandomly(b)) c.tickCounts[section]++;
    }
    // A flower pot's plant belongs to the pot block: replacing or removing the block clears it (TileEntity removal).
    if (this.pots?.size && c.blocks[i] === FLOWER_POT && b !== FLOWER_POT) this.pots.delete(`${x},${y},${z}`);
    c.blocks[i] = b;
    c.meta[i] = meta;
    if (track) this.rememberEdit(x, y, z, b | (meta << 8));
    return true;
  }
  rememberEdit(x, y, z, value) {
    const order = this.streaming ? this.nextEditOrder : this.edits.size;
    this.edits.set(`${x},${y},${z}`, value);
    if (this.streaming) {
      const key = columnKey(x >> 4, z >> 4), cell = cellIndex(x, y, z, this.height);
      let edits = this.chunkEdits.get(key);
      if (!edits) this.chunkEdits.set(key, edits = new Map());
      const old = edits.get(cell);
      if (old === undefined) this.nextEditOrder++;
      edits.set(cell, (old === undefined ? order : Math.floor(old / 4096)) * 4096 + value);
      this.dirtyColumns.add(key);
    }
  }
  // Hydrate a saved column without notifications, new scheduling, or marking it dirty.
  restoreColumns(records) {
    // Validate the batch before touching any column, including resident ones.
    for (const r of records) {
      const n=r?.cells?.length;
      if (!Number.isInteger(r?.x)||!Number.isInteger(r?.z)||!Number.isInteger(n)||r.values?.length!==n||r.order?.length!==n) throw new Error('Saved chunk is damaged');
      for(let i=0;i<n;i++)if(!Number.isInteger(r.cells[i])||r.cells[i]<0||r.cells[i]>65535||!Number.isInteger(r.values[i])||r.values[i]<0||r.values[i]>4095||(r.values[i]&255)>=BLOCKS.length||!Number.isInteger(r.order[i])||r.order[i]<0||r.order[i]>4294967295)throw new Error('Saved chunk is damaged');
    }
    for (const r of records) {
      const key=columnKey(r.x,r.z);
      if (this.dirtyColumns.has(key) || this.savingColumns.has(key)) continue;
      const edits=new Map(), chunk=this.chunks.get(key);
      for (let i=0;i<r.cells.length;i++) {
        const cell=r.cells[i], value=r.values[i];
        edits.set(cell,r.order[i]*4096+value);
        this.nextEditOrder=Math.max(this.nextEditOrder,r.order[i]+1);
        this.edits.set(`${r.x*16+(cell>>12)},${cell&255},${r.z*16+((cell>>8)&15)}`,value);
        if (chunk) {chunk.blocks[cell]=value&255;chunk.meta[cell]=value>>8;chunk.tickCounts=null;}
      }
      this.chunkEdits.set(key,edits);
    }
  }
  // Column records (world-storage.js chunkRecords form, without the world id) of every column
  // edited since the last call. Each holds all of that column's edits.
  takeDirtyColumns() {
    const out = [];
    for (const key of this.dirtyColumns) {
      const edits = this.chunkEdits.get(key), [x, z] = key.split(",").map(Number), n = edits.size,
        cells = new Uint16Array(n), values = new Uint16Array(n), order = new Uint32Array(n);
      let i = 0;
      for (const [cell, stored] of edits) {
        cells[i] = cell; values[i] = stored % 4096; order[i++] = Math.floor(stored / 4096);
      }
      out.push({ x, z, cells, values, order });
    }
    this.dirtyColumns.clear();
    return out;
  }
  // After a failed write: those columns are written again with the next save.
  markColumnsDirty(columns) {
    for (const c of columns) this.dirtyColumns.add(columnKey(c.x, c.z));
  }
  // A taken dirty batch is still the only copy until its transaction commits.
  // Counts protect columns shared by overlapping saves, including newer edits.
  beginColumnSave(columns) {
    for (const c of columns) {
      const key = columnKey(c.x, c.z);
      this.savingColumns.set(key, (this.savingColumns.get(key) ?? 0) + 1);
    }
  }
  finishColumnSave(columns, ok) {
    if (!ok) this.markColumnsDirty(columns);
    for (const c of columns) {
      const key = columnKey(c.x, c.z), remaining = (this.savingColumns.get(key) ?? 1) - 1;
      if (remaining) this.savingColumns.set(key, remaining);
      else this.savingColumns.delete(key);
    }
  }
  // Forget only durable, nonresident edits. Returning must read the column again.
  forgetColumn(key) {
    if (!this.streaming || this.chunks.has(key) || this.dirtyColumns.has(key) || this.savingColumns.has(key)) return false;
    const [x, z] = key.split(',').map(Number);
    for (const cell of this.chunkEdits.get(key)?.keys() ?? [])
      this.edits.delete(`${x*16+(cell>>12)},${cell&255},${z*16+((cell>>8)&15)}`);
    this.chunkEdits.delete(key);
    return true;
  }
  // `onChange(x, y, z, oldBlock, newBlock)` plays World.setBlock's neighbour
  // notification for tracked edits that change the block or its metadata.
  set(x, y, z, b, track = true, meta = 0) {
    const old = this.get(x, y, z), oldMeta = this.getMeta(x, y, z);
    if (!this.put(x, y, z, b, meta, track)) return false;
    if (track && (old !== b || oldMeta !== meta)) this.onChange?.(x, y, z, old, b);
    return true;
  }
  surface(x, z) {
    for (let y = this.height - 1; y > 0; y--) if (this.solid(x, y, z)) return y + 1;
    return 1;
  }
  generate() {
    if (this.height === 256) { generateJavaWorld(this); return; }
    const s = this.numericSeed;
    const heights = new Uint8Array(SIZE * SIZE);
    for (let x = 0; x < SIZE; x++)
      for (let z = 0; z < SIZE; z++) {
        const river = Math.abs(
          x - (57 + Math.sin(z * 0.052) * 14 + Math.sin(z * 0.018) * 11),
        );
        let h =
          16 +
          noise(x / 38, z / 38, s) * 18 +
          noise(x / 13, z / 13, s + 1) * 5 +
          noise(x / 5, z / 5, s + 2) * 2;
        if (this.biome === "alpine") h += noise(x / 24, z / 24, s + 5) * 13;
        if (this.biome === "island")
          h -= Math.pow(Math.hypot(x - 64, z - 64) / 65, 2) * 18;
        h = Math.floor(h - Math.max(0, 1 - river / 14) * 18);
        h = Math.max(4, Math.min(49, h));
        heights[x * SIZE + z] = h;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let b =
            y === 0
              ? 11
              : y > h
                ? 10
                : y === h
                  ? h <= SEA + 1
                    ? 6
                    : 1
                  : y > h - 4
                    ? h <= SEA + 1
                      ? 6
                      : 2
                    : 3;
          if (this.generationVersion >= 2 && b === 3 && y > 0) {
            const ore = hash(x + y * 257, z - y * 31, s + 445);
            if (y < 9 && ore < 0.006) b = 17;
            else if (y < 15 && ore < 0.014) b = 18;
            else if (y < 25 && ore < 0.038) b = 16;
            else if (ore > 0.965) b = 15;
            if (
              y < h - 5 &&
              y > 2 &&
              Math.abs(
                Math.sin(x * 0.19) + Math.sin(z * 0.17) + Math.sin(y * 0.37),
              ) < 0.11
            )
              b = 0;
          }
          if (b) this.setRaw(x, y, z, b);
        }
      }
    // Lakes are carved before trees, as in populate, so trees skip columns a lake took.
    const lakes = this.generationVersion >= 5 ? generateLakes(this) : null;
    // Version 8: BiomeDecorator's sand discs (WorldGenSand) come first in decoration, before
    // the trees; the same per-chunk randoms then place the sugar cane after the flowers.
    const plants = this.generationVersion >= 8 ? decorateSand(this) : null;
    for (let x = 4; x < SIZE - 4; x++)
      for (let z = 4; z < SIZE - 4; z++) {
        const h = heights[x * SIZE + z];
        if (
          h < SEA + 3 ||
          hash(x, z, s + 99) < 0.988 ||
          (Math.abs(x - 35) < 4 && Math.abs(z - 80) < 4) ||
          (lakes && this.get(x, h, z) !== 1)
        )
          continue;
        // Version 7 grows the original WorldGenTrees oak (trees.js) from a per-tree Random at the
        // same positions; older versions keep the hand-made shape below.
        if (this.generationVersion >= 7) {
          generateTreeAt(this, x, h + 1, z, hash(x, z, s + 51), hash(x, z, s + 52));
          continue;
        }
        const trunk = 4 + Math.floor(hash(x, z, s + 51) * 3);
        for (let y = h + 1; y <= h + trunk; y++) this.set(x, y, z, 4, false);
        for (let dy = -2; dy <= 1; dy++)
          for (let dx = -2; dx <= 2; dx++)
            for (let dz = -2; dz <= 2; dz++) {
              if (Math.abs(dx) + Math.abs(dz) > 3 + (dy < 0 ? 1 : 0)) continue;
              if (dx === 0 && dz === 0 && dy < 1) continue;
              this.set(x + dx, h + trunk + dy, z + dz, 5, false);
            }
      }
    if(this.generationVersion>=3)for(let x=2;x<SIZE-2;x++)for(let z=2;z<SIZE-2;z++){const y=heights[x*SIZE+z]+1;if(this.get(x,y-1,z)===1&&this.get(x,y,z)===0&&hash(x,z,s+603)<.095)this.set(x,y,z,39,false);}
    // Version 4 adds BiomeDecorator's flowers; older saves keep their terrain.
    if(this.generationVersion>=4)decorateFlowers(this,{yellow:YELLOW_FLOWER,red:RED_FLOWER,heights,biome:this.biome,size:SIZE});
    if (plants) decorateReeds(this, plants);
    // BiomeDecorator runs its liquid springs after the flowers (version 5).
    if (lakes) generateSprings(this, lakes);
    // Version 6: ChunkProviderGenerate.populate's last pass freezes exposed still water and lays
    // snow where the biome is cold enough. Only the snowy preset is (Ice Plains, 0.0); the other
    // presets are above 0.15, so they come out exactly as before.
    if (this.generationVersion >= 6) populateSnow(this);

  }
  spawn() {
    if (this.height === 256) {
      // Prefer dry land near the viewport centre, with two clear cells for the player.
      for (let radius=0;radius<61;radius++) for(let dx=-radius;dx<=radius;dx++) for(const dz of [-radius,radius]) {
        const x=64+dx,z=64+dz;if(x<3||z<3||x>=SIZE-3||z>=SIZE-3)continue;
        const y=this.surface(x,z);if(y+2>=this.height)continue;
        // A column opened onto the void has no ground (surface() falls back to 1), so it is skipped.
        if(this.get(x,y,z)===0&&this.get(x,y+1,z)===0&&this.solid(x,y-1,z)&&this.get(x,y-1,z)!==11)return {x:x+0.5,y:y+0.01,z:z+0.5};
      }
      // Ocean-only viewports start above the water, rather than inside it or in stone.
      return {x:64.5,y:Math.max(this.seaLevel+1,this.surface(64,64))+0.01,z:64.5};
    }
    for (let r = 0; r < 40; r++)
      for (let dx = -r; dx <= r; dx++)
        for (const dz of [-r, r]) {
          const x = 35 + dx,
            z = 80 + dz,
            y = this.surface(x, z);
          if (
            x > 3 &&
            x < SIZE - 3 &&
            z > 3 &&
            z < SIZE - 3 &&
            this.get(x, y - 1, z) === 1
          )
            return { x: x + 0.5, y: y + 0.01, z: z + 0.5 };
        }
    return { x: 35.5, y: 50, z: 80.5 };
  }
  restore(edits) {
    if (!Array.isArray(edits) || edits.length > (this.streaming ? 2000000 : 100000))
      throw new Error("Invalid world edits");
    for (const entry of edits) {
      if (!Array.isArray(entry) || entry.length !== 2)
        throw new Error("Invalid edit");
      const [key, v] = entry;
      const b = v & 255,
        meta = v >> 8;
      const p = String(key).split(",").map(Number);
      if (
        p.length !== 3 ||
        !p.every(Number.isInteger) ||
        !this.inside(...p) ||
        !Number.isInteger(v) ||
        v < 0 ||
        v > 0xfff ||
        b >= BLOCKS.length
      )
        throw new Error("Invalid block");
      if (this.streaming && !this.isLoaded(p[0], p[2])) this.rememberEdit(...p, v);
      else this.set(...p, b, true, meta);
    }
  }
}
export function collides(world, x, y, z) {
  const r = PHYSICS.width / 2;
  for (let bx = Math.floor(x - r + 1e-6); bx <= Math.floor(x + r - 1e-6); bx++)
    for (
      // One cell lower too: a fence's 1.5-high box reaches into the cell above it.
      let by = Math.floor(y + 1e-6) - 1;
      by <= Math.floor(y + PHYSICS.height - 1e-6);
      by++
    )
      for (
        let bz = Math.floor(z - r + 1e-6);
        bz <= Math.floor(z + r - 1e-6);
        bz++
      )
        for (const [x0, y0, z0, x1, y1, z1] of collisionBoxes(world, bx, by, bz)) {
          if (y < by + y1 - 1e-6 && y + PHYSICS.height > by + y0 + 1e-6 && x - r < bx + x1 - 1e-6 && x + r > bx + x0 + 1e-6 && z - r < bz + z1 - 1e-6 && z + r > bz + z0 + 1e-6) return true;
        }
  return false;
}
export function raycast(world, origin, dir, reach = 6) {
  let last = null, passed = null;
  for (let d = 0; d <= reach; d += 0.025) {
    const p = [
      Math.floor(origin.x + dir.x * d),
      Math.floor(origin.y + dir.y * d),
      Math.floor(origin.z + dir.z * d),
    ];
    if (passed && !p.every((v, i) => v === passed[i])) {
      last = passed;
      passed = null;
    }
    if (last && p.every((v, i) => v === last[i])) continue;
    const hit = world.get(...p);
    // BlockFire.isCollidable is false, so the ray passes through it (clicks reach the block behind).
    if (hit !== 0 && !isLiquid(hit) && hit !== FIRE) {
      // A snow layer is only selectable up to its selection height; above it the ray goes on
      // (and keeps being tested while it is inside the cell).
      if (hit === SNOW_LAYER && origin.y + dir.y * d - p[1] > snowSelectionHeight(world.getMeta(...p))) {
        passed = p;
        continue;
      }
      // A ladder is only selectable on its 0.125 plate, sugar cane inside its block bounds. BlockCactus
      // never changes its block bounds, so Block.collisionRayTrace hits the full cube (only the
      // drawn selection box is inset).
      // Fences, rails and torches are only hit inside their selection box (Block.collisionRayTrace
      // after setBlockBoundsBasedOnState).
      if (isFence(hit) || hit === RAIL || isRailBlock2(hit) || hit === TORCH || isRedstoneBlock(hit) || isDoor(hit) || isPane(hit) || hasPartialBounds(hit) || hit === END_PORTAL || hit === DRAGON_EGG || hit === SIGN_POST || hit === WALL_SIGN || hit === 172 || isShaped(hit) || hit === PISTON_HEAD || (isPistonBase(hit) && pistonExtended(world.getMeta(...p)))) {
        const [x0, y0, z0, x1, y1, z1] = blockBounds(world, ...p), lx = origin.x + dir.x * d - p[0], ly = origin.y + dir.y * d - p[1], lz = origin.z + dir.z * d - p[2];
        if (lx < x0 || lx > x1 || ly < y0 || ly > y1 || lz < z0 || lz > z1) {
          passed = p;
          continue;
        }
      }
      // BlockStairs.collisionRayTrace only hits the octants its shape fills.
      if (isStair(hit)) {
        const lx = origin.x + dir.x * d - p[0], ly = origin.y + dir.y * d - p[1], lz = origin.z + dir.z * d - p[2];
        if (stairExcludedOctants(world.getMeta(...p)).includes((lx >= 0.5 ? 1 : 0) | (ly >= 0.5 ? 2 : 0) | (lz >= 0.5 ? 4 : 0))) {
          passed = p;
          continue;
        }
      }
      if (hit === LADDER || hit === REEDS) {
        const [x0, , z0, x1, , z1] = hit === LADDER ? ladderBounds(world.getMeta(...p)) : REED_BOUNDS, lx = origin.x + dir.x * d - p[0], lz = origin.z + dir.z * d - p[2];
        if (lx < x0 || lx > x1 || lz < z0 || lz > z1) {
          passed = p;
          continue;
        }
      }
      // `hit` is the ray's entry point into the block's selection shape (Block.collisionRayTrace's hit vector,
      // which BlockStairs and onBlockPlaced use), or the sampled point when the start is inside the cell.
      const start = [origin.x, origin.y, origin.z], end = [origin.x + dir.x * reach, origin.y + dir.y * reach, origin.z + dir.z * reach],
        exact = isStair(hit) ? stairRayTrace(world.getMeta(...p), ...p, start, end)?.vec
          : interceptBox(blockBounds(world, ...p), [0, 1, 2].map((i) => start[i] - p[i]), [0, 1, 2].map((i) => end[i] - p[i]))?.vec.map((v, i) => v + p[i]);
      return { block: p, adjacent: last, distance: d, hit: exact ?? [origin.x + dir.x * d, origin.y + dir.y * d, origin.z + dir.z * d] };
    }
    last = p;
  }
  return null;
}
