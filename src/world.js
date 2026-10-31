import { decorateFlowers } from "./flowers.js";
import { generateLakes, generateSprings } from "./lakes.js";
import { populateSnow } from "./snow.js";
import { generateTreeAt } from "./trees.js";
import { ladderBounds } from "./ladders.js";
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
];
export const WATER=10,LAVA=42;
export const SNOW_LAYER=46,ICE=47,SAPLING=48;
export const CARROTS=49,POTATOES=50,WEB=51,LADDER=52;
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
export const isPlant=b=>isCrop(b)||b===39||isFlower(b)||b===SAPLING;
export const blockHeight=b=>b===29||b===30?15/16:b===41?.875:b===SNOW_LAYER?.125:1;
// Blocks with Block.tickRandomly: they count towards a section's random-tick refcount
// (ExtendedBlockStorage.getNeedsRandomTick), which WorldServer reads to pick sections.
// Grass, leaves, farmland, crops, lava, snow layer, ice and saplings here; snow and ice act on a
// random tick in snow.js/weather.js, fire and still lava in fire.js, leaves (decay) and saplings (growth) in trees.js.
export const ticksRandomly=b=>b===1||b===5||b===29||b===30||isCrop(b)||b===LAVA||b===SNOW_LAYER||b===ICE||b===FIRE||b===SAPLING;
// Block.func_149730_j (opaque at construction) and isNormalCube for this
// build's blocks. Leaves count as opaque: BlockLeaves reports an opaque cube
// while its fancy-graphics flag is still unset in the Block constructor.
const SEE_THROUGH=new Set([0,9,10,20,29,30,41,42,SNOW_LAYER,ICE,FIRE,WEB,LADDER]);
export const opaqueCube=b=>!SEE_THROUGH.has(b)&&!isPlant(b);
export const normalCube=b=>opaqueCube(b)&&b!==5;
// setBlockBoundsBasedOnState: chests are inset by 1/16 except towards a partner.
// A snow layer's collision box is meta * 1/8 tall (BlockSnow.getCollisionBoundingBoxFromPool: meta 0
// is flat and has none); its selection box is (meta + 1) / 8 (snowSelectionHeight).
// Block.slipperiness (field_149765_K): 0.6 for every block here but ice, 0.98 (BlockIce).
export const slipperiness=b=>b===ICE?Math.fround(0.98):Math.fround(0.6);
export const snowSelectionHeight=meta=>((meta&7)+1)/8;
export function blockBounds(world,x,y,z){
  const b=world.get(x,y,z);
  if(b===SNOW_LAYER)return[0,0,0,1,(world.getMeta(x,y,z)&7)*.125,1];
  if(b===LADDER)return ladderBounds(world.getMeta(x,y,z));
  if(b!==41)return[0,0,0,1,blockHeight(b),1];
  const c=(dx,dz)=>world.get(x+dx,y,z+dz)===41;
  return[c(-1,0)?0:1/16,0,c(0,-1)?0:1/16,c(1,0)?1:15/16,.875,c(0,1)?1:15/16];
}
export class World {
  constructor(seed = "Overworld", biome = "meadow", generationVersion = 7) {
    this.seed = String(seed);
    this.biome = biome;
    this.generationVersion = generationVersion;
    this.numericSeed = hashSeed(seed);
    this.data = new Uint8Array(SIZE * SIZE * HEIGHT);
    // Block metadata (a 4-bit value per cell, like Chunk's nibble array); only
    // flowing water uses it. Generated water is level 0, a source.
    this.meta = new Uint8Array(SIZE * SIZE * HEIGHT);
    this.edits = new Map();
    this.onChange = null;
    // Saved block light (World.getSavedLightValue(EnumSkyBlock.Block)): the scene sets this to
    // its LightVolume; until then snow.js works it out from the lava.
    this.blockLight = null;
    this.tickCounts = null;
    this.generate();
  }
  index(x, y, z) {
    return (x * SIZE + z) * HEIGHT + y;
  }
  inside(x, y, z) {
    return x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HEIGHT;
  }
  get(x, y, z) {
    if (y < 0) return 11;
    if (!this.inside(x, y, z)) return 0;
    return this.data[this.index(x, y, z)];
  }
  getMeta(x, y, z) {
    return this.inside(x, y, z) ? this.meta[this.index(x, y, z)] : 0;
  }
  solid(x, y, z) {
    const b = this.get(x, y, z);
    // A flat snow layer (meta 0) has no collision box, so it is not an obstacle.
    if (b === SNOW_LAYER) return (this.meta[this.index(x, y, z)] & 7) !== 0;
    return b !== 0 && b !== 10 && b !== 42 && b !== 20 && b !== FIRE && b !== WEB && !isPlant(b);
  }
  // Section (16 high) random-tick refcounts, kept up to date by put() once built.
  sectionTickCount(cx, cz, s) {
    if (!this.tickCounts) {
      const n = SIZE / 16;
      this.tickCounts = new Int32Array(n * n * (HEIGHT / 16));
      for (let x = 0; x < SIZE; x++)
        for (let z = 0; z < SIZE; z++)
          for (let y = 0; y < HEIGHT; y++) if (ticksRandomly(this.data[this.index(x, y, z)])) this.tickCounts[this.tickSection(x, y, z)]++;
    }
    return this.tickCounts[(cx * (SIZE / 16) + cz) * (HEIGHT / 16) + s];
  }
  tickSection(x, y, z) {
    return ((x >> 4) * (SIZE / 16) + (z >> 4)) * (HEIGHT / 16) + (y >> 4);
  }
  // Writes a block and its metadata without telling onChange (fluids.js uses it
  // for its own edits). A tracked edit is saved as block | meta << 8, so saves
  // from before metadata existed (plain block ids) read back as meta 0.
  put(x, y, z, b, meta = 0, track = true) {
    if (
      !this.inside(x, y, z) ||
      y === 0 ||
      !Number.isInteger(b) ||
      b < 0 ||
      b >= BLOCKS.length ||
      !Number.isInteger(meta) ||
      meta < 0 ||
      meta > 15
    )
      return false;
    const i = this.index(x, y, z);
    if (this.tickCounts) {
      const section = this.tickSection(x, y, z);
      if (ticksRandomly(this.data[i])) this.tickCounts[section]--;
      if (ticksRandomly(b)) this.tickCounts[section]++;
    }
    this.data[i] = b;
    this.meta[i] = meta;
    if (track) this.edits.set(`${x},${y},${z}`, meta ? b | (meta << 8) : b);
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
    for (let y = HEIGHT - 1; y > 0; y--) if (this.solid(x, y, z)) return y + 1;
    return 1;
  }
  generate() {
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
          this.data[this.index(x, y, z)] = b;
        }
      }
    // Lakes are carved before trees, as in populate, so trees skip columns a lake took.
    const lakes = this.generationVersion >= 5 ? generateLakes(this) : null;
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
    if(this.generationVersion>=4)decorateFlowers(this,{yellow:YELLOW_FLOWER,red:RED_FLOWER,heights,biome:this.biome});
    // BiomeDecorator runs its liquid springs after the flowers (version 5).
    if (lakes) generateSprings(this, lakes);
    // Version 6: ChunkProviderGenerate.populate's last pass freezes exposed still water and lays
    // snow where the biome is cold enough. Only the snowy preset is (Ice Plains, 0.0); the other
    // presets are above 0.15, so they come out exactly as before.
    if (this.generationVersion >= 6) populateSnow(this);

  }
  spawn() {
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
    if (!Array.isArray(edits) || edits.length > 100000)
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
      this.set(...p, b, true, meta);
    }
  }
}
export function collides(world, x, y, z) {
  const r = PHYSICS.width / 2;
  for (let bx = Math.floor(x - r + 1e-6); bx <= Math.floor(x + r - 1e-6); bx++)
    for (
      let by = Math.floor(y + 1e-6);
      by <= Math.floor(y + PHYSICS.height - 1e-6);
      by++
    )
      for (
        let bz = Math.floor(z - r + 1e-6);
        bz <= Math.floor(z + r - 1e-6);
        bz++
      )
        if (world.solid(bx, by, bz)) {
          const [x0, , z0, x1, y1, z1] = blockBounds(world, bx, by, bz);
          if (y < by + y1 - 1e-6 && x - r < bx + x1 - 1e-6 && x + r > bx + x0 + 1e-6 && z - r < bz + z1 - 1e-6 && z + r > bz + z0 + 1e-6) return true;
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
      // A ladder is only selectable on its 0.125 plate.
      if (hit === LADDER) {
        const [x0, , z0, x1, , z1] = ladderBounds(world.getMeta(...p)), lx = origin.x + dir.x * d - p[0], lz = origin.z + dir.z * d - p[2];
        if (lx < x0 || lx > x1 || lz < z0 || lz > z1) {
          passed = p;
          continue;
        }
      }
      return { block: p, adjacent: last, distance: d };
    }
    last = p;
  }
  return null;
}
