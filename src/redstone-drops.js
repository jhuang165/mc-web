// b83 mppiston83: Block.dropBlockAsItem(world, x, y, z, meta, 0) (dropBlockAsItemWithChance with chance 1 and fortune 0) for the blocks a piston destroys
// (mobility 1, BlockPistonBase.tryExtend: dropBlockAsItem, then setBlockToAir) that the redstone engine (redstone.js) does not model itself. Its generic
// dropBlockAsItem drew one chance float and dropped the block's own id, so a piston pushing into water dropped a "Water" item, wheat dropped the crop
// block, tall grass itself, and so on. Every rule below is the 1.7.10 class's own (bytecode-read, javap -c -p; see .shared-memory/notes/mppiston83-b83-track.md):
//   Block (aji): quantityDroppedWithBonus loop; each pass draws rand.nextFloat() <= chance, then getItemDropped; a non-null item goes to dropBlockAsItem_do,
//     which skips without doTileDrops and otherwise draws three floats (rand * 0.7F + 0.15) for the EntityItem (pickup delay 10).
//   quantityDropped 0 (no draws at all): BlockLiquid (alw), BlockFire (alb), BlockSnow (ann), BlockCake (aju), BlockVine (aoh).
//   getItemDropped null (the chance float only): BlockDeadBush (akh), BlockStem (anu), the top half / double grass / large fern of BlockDoublePlant (ako).
//   BlockBed (ajh): the head half skips super (no draws); the foot drops the bed item. BlockWeb (aok): string. BlockReed (ane): the reeds item.
//   BlockTallGrass (anz): quantity 1 + nextInt(1), then nextInt(8) == 0 seeds. BlockMelon (aly): min(9, 3 + nextInt(5) + nextInt(1)) slices.
//   BlockStem (anu.a(ahb,IIIIFI)): super, then three nextInt(15) <= meta pumpkin / melon seeds. BlockNetherWart (amf): no super; 1 wart, 2 + nextInt(3) at meta >= 3.
//   BlockCocoa (ajz): no super; 1 bean, 3 at age (meta & 12) >> 2 >= 2. BlockSkull (anl): dropBlockAsItemWithChance is empty; breakBlock (the setBlockToAir
//     that follows) drops the tile's skull unless meta bit 8 is set. BlockLeaves / BlockCrops: as enchantment-effects.js (executed, enchantment-effects-reference.json).
//   damageDropped: BlockSapling clamp(meta & 7, 0, 5), BlockFlower the meta (plant-damage.js keeps a rose's rawDamage), BlockDoublePlant meta & 7.
// The blocks not listed (mushrooms, torch, ladder, cactus, pumpkins, lily pad, dragon egg, the redstone components, the pot) drop themselves through the engine.
import { plantDropDamage } from "./plant-damage.js";
import { skullDrops } from "./skull.js";
import { makeStack } from "./inventory.js";

const f = Math.fround, F07 = f(0.7), INSET = f(1 - F07) * 0.5;
// Original item id -> port item id for what these rules drop (redstone-drops83.test.js checks every entry against region-import's itemFromOriginal).
export const CRUSH_ITEMS = Object.freeze({ 6: 48, 37: 43, 38: 44, 175: 69, 260: 200, 287: 321, 295: 309, 296: 305, 338: 327, 351: 351, 355: 472, 360: 368, 361: 361, 362: 362, 372: 386, 391: 322, 392: 323, 394: 325 });
// The original ids handled here.
export const CRUSH_IDS = new Set([6, 8, 9, 10, 11, 18, 26, 30, 31, 32, 37, 38, 51, 59, 78, 83, 92, 103, 104, 105, 106, 115, 127, 141, 142, 144, 161, 175]);
const NO_DROPS = new Set([8, 9, 10, 11, 51, 78, 92, 106]); // quantityDropped 0
const SIMPLE = { 26: 355, 30: 287, 32: null, 83: 338 }; // one chance float, then this item (null: none)
const CROPS = { 59: [296, 295], 141: [391, 391], 142: [392, 392] };

// The drops of original block `id` with metadata `meta` at the cell (x, y, z): [{ id, count: 1, damage, tags?, x, y, z }] in port items with the EntityItem
// position, or null when `id` is not one of CRUSH_IDS (the engine keeps its own drop). `rand` is the world Random (nextFloat / nextInt). `cell` gives the port
// block and metadata ({ block, meta }) for the plant damage; `skull` is the TileEntitySkull ({ type, profile }) or null.
export function crushDrops(id, meta, x, y, z, rand, { tileDrops = true, cell = null, skull = null } = {}) {
  if (!CRUSH_IDS.has(id)) return null;
  const out = [];
  // Block.dropBlockAsItem_do: nothing without doTileDrops, else three floats.
  const emit = (item, damage = 0, tags) => {
    if (!tileDrops) return;
    const dx = f(rand.nextFloat() * F07) + INSET, dy = f(rand.nextFloat() * F07) + INSET, dz = f(rand.nextFloat() * F07) + INSET;
    out.push({ id: item, count: 1, damage, ...(tags ?? {}), x: x + dx, y: y + dy, z: z + dz });
  };
  const port = (item, damage = 0, tags) => emit(CRUSH_ITEMS[item], damage, tags);
  // The Block default with quantity `n` and getItemDropped `item()` (null: nothing).
  const loop = (n, item) => {
    for (let i = 0; i < n; i++) {
      if (!(rand.nextFloat() <= 1)) continue;
      const d = item();
      if (d) port(d[0], d[1] ?? 0, d[2]);
    }
  };
  if (NO_DROPS.has(id)) return out;
  if (id in SIMPLE) {
    if (id === 26 && (meta & 8) !== 0) return out; // BlockBed: the head half drops nothing and draws nothing
    loop(1, () => (SIMPLE[id] === null ? null : [SIMPLE[id]]));
    return out;
  }
  switch (id) {
    case 6: case 37: case 38: {
      // BlockSapling / BlockFlower damageDropped through the port cell (a rose past its variants keeps rawDamage).
      const pd = cell ? plantDropDamage(cell.block, cell.meta) : null;
      loop(1, () => [id, pd ? pd.damage : id === 6 ? Math.min(5, meta & 7) : id === 38 ? meta : 0, pd?.tags]);
      return out;
    }
    case 31: loop(1 + rand.nextInt(1), () => (rand.nextInt(8) === 0 ? [295] : null)); return out;
    case 103: loop(Math.min(9, 3 + rand.nextInt(5) + rand.nextInt(1)), () => [360]); return out;
    case 175: loop(1, () => ((meta & 8) !== 0 || (meta & 7) === 2 || (meta & 7) === 3 ? null : [175, meta & 7])); return out;
    case 104: case 105:
      loop(1, () => null);
      for (let i = 0; i < 3; i++) if (rand.nextInt(15) <= meta) port(id === 104 ? 361 : 362);
      return out;
    case 115: { const n = meta >= 3 ? 2 + rand.nextInt(3) : 1; for (let i = 0; i < n; i++) port(372); return out; }
    case 127: { const n = (meta & 12) >> 2 >= 2 ? 3 : 1; for (let i = 0; i < n; i++) port(351, 3); return out; }
    case 18: case 161: {
      // BlockLeaves.dropBlockAsItemWithChance: no chance roll; sapling 1/20 (jungle 1/40), then the oak / dark oak apple 1/200.
      const type = meta & 3;
      if (rand.nextInt(type === 3 && id === 18 ? 40 : 20) === 0) port(6, id === 161 ? type + 4 : type);
      if (type === (id === 18 ? 0 : 1) && rand.nextInt(200) === 0) port(260);
      return out;
    }
    case 59: case 141: case 142: {
      // BlockCrops: the crop (ripe) or seed on the chance roll, then three nextInt(15) <= age seeds when ripe; BlockPotato a 1/50 poisonous potato.
      const [crop, seed] = CROPS[id];
      loop(1, () => [meta === 7 ? crop : seed]);
      if (meta >= 7) {
        for (let i = 0; i < 3; i++) if (rand.nextInt(15) <= meta) port(seed);
        if (id === 142 && rand.nextInt(50) === 0) port(394);
      }
      return out;
    }
    case 144: {
      // BlockSkull.breakBlock (anl.a(ahb,III,aji,I)): the tile's skull, SkullOwner for a player head, unless bit 8 (a Creative harvest) is set.
      if ((meta & 8) === 0) for (const d of skullDrops(skull?.type ?? 0, skull?.profile ?? null)) emit(d.id, d.damage, d.tags);
      return out;
    }
  }
  return out;
}

// A LiveRedstone `drop` hook's stack as an EntityItem (Block.dropBlockAsItem_do): at the given position, which already holds the native offset, with pickup
// delay 10. Shared by single player (main.js) and the dedicated server (multiplayer/server-redstone-drops.js); the tags (rawDamage, SkullOwner) stay on the stack.
export function spawnRedstoneDrop(items, x, y, z, { id, count = 1, damage = 0, ...tags }) {
  return items.spawn(makeStack(id, count, damage || 0, undefined, tags), x, y, z, { delay: 10 });
}
