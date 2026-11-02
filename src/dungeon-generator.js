// Minecraft Java 1.7.10 WorldGenDungeons and its level-30 enchanted-book loot.
// Original numeric IDs. Adapter: getBlock, isSolid(id), isAirBlock,
// setBlock(x,y,z,id,meta,flags), setBlockToAir, getTileEntity.
// Chest tile: {size, setSlot(index, stack)}; spawner: {setEntityName(name)}.
// Stack representation: [itemId,count,metadata,[[storedEnchantmentId,level],...]].
// Tables below are extracted from unchanged original classes by DungeonProbe.
export const DUNGEON_LOOT = [[[329,1,0,[]],1,1,10],[[265,1,0,[]],1,4,10],[[297,1,0,[]],1,1,10],[[296,1,0,[]],1,4,10],[[289,1,0,[]],1,4,10],[[287,1,0,[]],1,4,10],[[325,1,0,[]],1,1,10],[[322,1,0,[]],1,1,1],[[331,1,0,[]],1,4,10],[[2256,1,0,[]],1,1,10],[[2257,1,0,[]],1,1,10],[[421,1,0,[]],1,1,10],[[418,1,0,[]],1,1,2],[[417,1,0,[]],1,1,5],[[419,1,0,[]],1,1,1]];
export const BOOK_ENCHANTMENTS = [[0,10,[[1,1,21],[2,12,32],[3,23,43],[4,34,54]],[2,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[1,5,[[1,10,22],[2,18,30],[3,26,38],[4,34,46]],[2,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[2,5,[[1,5,15],[2,11,21],[3,17,27],[4,23,33]],[0,1,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[3,2,[[1,5,17],[2,13,25],[3,21,33],[4,29,41]],[2,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[4,5,[[1,3,18],[2,9,24],[3,15,30],[4,21,36]],[2,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[5,2,[[1,10,40],[2,20,50],[3,30,60]],[0,1,2,3,4,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[6,2,[[1,1,41]],[0,1,2,3,4,5,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[7,1,[[1,10,61],[2,30,71],[3,50,81]],[0,1,2,3,4,5,6,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61,62]],[16,10,[[1,1,21],[2,12,32],[3,23,43],[4,34,54],[5,45,65]],[0,1,2,3,4,5,6,7,19,20,21,32,33,34,35,48,49,50,51,61,62]],[17,5,[[1,5,25],[2,13,33],[3,21,41],[4,29,49],[5,37,57]],[0,1,2,3,4,5,6,7,19,20,21,32,33,34,35,48,49,50,51,61,62]],[18,5,[[1,5,25],[2,13,33],[3,21,41],[4,29,49],[5,37,57]],[0,1,2,3,4,5,6,7,19,20,21,32,33,34,35,48,49,50,51,61,62]],[19,5,[[1,5,61],[2,25,71]],[0,1,2,3,4,5,6,7,16,17,18,20,21,32,33,34,35,48,49,50,51,61,62]],[20,2,[[1,10,61],[2,30,71]],[0,1,2,3,4,5,6,7,16,17,18,19,21,32,33,34,35,48,49,50,51,61,62]],[21,2,[[1,15,61],[2,24,71],[3,33,81]],[0,1,2,3,4,5,6,7,16,17,18,19,20,32,34,35,48,49,50,51,61,62]],[32,10,[[1,1,61],[2,11,71],[3,21,81],[4,31,91],[5,41,101]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,33,34,35,48,49,50,51,61,62]],[33,1,[[1,15,61]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,34,48,49,50,51,61,62]],[34,5,[[1,5,61],[2,13,71],[3,21,81]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,35,48,49,50,51,61,62]],[35,2,[[1,15,61],[2,24,71],[3,33,81]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,34,48,49,50,51,61,62]],[48,10,[[1,1,16],[2,11,26],[3,21,36],[4,31,46],[5,41,56]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,49,50,51,61,62]],[49,2,[[1,12,37],[2,32,57]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,48,50,51,61,62]],[50,2,[[1,20,50]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,51,61,62]],[51,1,[[1,20,50]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,61,62]],[61,2,[[1,15,61],[2,24,71],[3,33,81]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,34,35,48,49,50,51,62]],[62,2,[[1,15,61],[2,24,71],[3,33,81]],[0,1,2,3,4,5,6,7,16,17,18,19,20,21,32,33,34,35,48,49,50,51,61]]];
const f = Math.fround;
const weighted = (random, rows, weight) => {
  let value = random.nextInt(rows.reduce((n,row) => n + weight(row),0));
  for (const row of rows) { value -= weight(row); if (value < 0) return row; }
  throw new Error("Empty dungeon weighted list");
};

export function bookCandidates(level) {
  const entries = [];
  for (const [id, weight, levels, compatible] of BOOK_ENCHANTMENTS) {
    let selected = null;
    for (const [l,min,max] of levels) if (level >= min && level <= max) selected = l;
    if (selected !== null) entries.push({id,level:selected,weight,compatible});
  }
  // HashMap<Integer,...>: default capacity16, threshold0.75, ascending registry
  // insertion. Integer hashes are the IDs; colliding buckets keep insertion order.
  let capacity = 16;
  while (entries.length > capacity * 0.75) capacity *= 2;
  return entries.sort((a,b) => (a.id & (capacity-1)) - (b.id & (capacity-1)));
}

export function dungeonEnchantedBook(random) {
  // ItemBook enchantability1: both nextInt(1) calls still consume the Java RNG.
  const bonus = 1 + random.nextInt(1) + random.nextInt(1), base = 30 + bonus;
  const variation = f(f(f(random.nextFloat() + random.nextFloat()) - 1) * f(0.15));
  const power = Math.max(1,Math.trunc(f(f(f(base) * f(1 + variation)) + f(0.5))));
  let candidates = bookCandidates(power);
  const selected = [];
  if (candidates.length) {
    selected.push(weighted(random,candidates,e=>e.weight));
    for (let remaining = power; random.nextInt(50) <= remaining; remaining >>= 1) {
      candidates = candidates.filter(e => selected.every(s => s.compatible.includes(e.id)));
      if (candidates.length) selected.push(weighted(random,candidates,e=>e.weight));
    }
  }
  // addRandomEnchantment only converts Items.book to enchanted_book when the
  // list is non-null; unreachable at level30, where candidates always exist.
  return selected.length ? [403,1,0,selected.map(e => [e.id,e.level])] : [340,1,0,[]];
}

export function fillDungeonChest(random, chest, book) {
  const table = [...DUNGEON_LOOT,[book,1,1,1]];
  for (let i = 0; i < 8; i++) {
    const [stack,min,max] = weighted(random,table,r=>r[3]);
    const count = min + random.nextInt(max-min+1);
    // All dungeon entries fit their native maximum stack size (singleton items
    // have count1). Slot choice overwrites rather than merging existing stacks.
    chest.setSlot(random.nextInt(chest.size),[stack[0],count,stack[2],stack[3].map(e=>[...e])]);
  }
}

export class WorldGenDungeons {
  generate(world, random, x, y, z) {
    const rx = random.nextInt(2) + 2, rz = random.nextInt(2) + 2;
    const minX = x-rx-1, maxX = x+rx+1, minZ = z-rz-1, maxZ = z+rz+1;
    let openings = 0;
    for (let bx = minX; bx <= maxX; bx++) for (let by = y-1; by <= y+4; by++) for (let bz = minZ; bz <= maxZ; bz++) {
      const id = world.getBlock(bx,by,bz);
      if (by === y-1 && !world.isSolid(id)) return false;
      if (by === y+4 && !world.isSolid(id)) return false;
      if ((bx === minX || bx === maxX || bz === minZ || bz === maxZ) && by === y &&
          world.isAirBlock(bx,by,bz) && world.isAirBlock(bx,by+1,bz)) openings++;
    }
    if (openings < 1 || openings > 5) return false;
    for (let bx = minX; bx <= maxX; bx++) for (let by = y+3; by >= y-1; by--) for (let bz = minZ; bz <= maxZ; bz++) {
      if (bx === minX || by === y-1 || bz === minZ || bx === maxX || by === y+4 || bz === maxZ) {
        if (by >= 0 && !world.isSolid(world.getBlock(bx,by-1,bz))) world.setBlockToAir(bx,by,bz);
        else if (world.isSolid(world.getBlock(bx,by,bz)))
          world.setBlock(bx,by,bz,by === y-1 && random.nextInt(4) !== 0 ? 48 : 4,0,2);
      } else world.setBlockToAir(bx,by,bz);
    }
    for (let chestIndex = 0; chestIndex < 2; chestIndex++) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const bx = x + random.nextInt(rx*2+1) - rx, bz = z + random.nextInt(rz*2+1) - rz;
        if (!world.isAirBlock(bx,y,bz)) continue;
        let walls = 0;
        for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]])
          if (world.isSolid(world.getBlock(bx+dx,y,bz+dz))) walls++;
        if (walls !== 1) continue;
        world.setBlock(bx,y,bz,54,0,2);
        const book = dungeonEnchantedBook(random); // Drawn even if the chest tile is absent.
        const chest = world.getTileEntity(bx,y,bz);
        if (chest) fillDungeonChest(random,chest,book);
        break;
      }
    }
    world.setBlock(x,y,z,52,0,2);
    const spawner = world.getTileEntity(x,y,z);
    if (spawner) spawner.setEntityName(["Skeleton","Zombie","Zombie","Spider"][random.nextInt(4)]);
    return true;
  }
}
