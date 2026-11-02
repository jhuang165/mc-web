// Minecraft Java 1.7.10 WorldGenLakes, original numeric block IDs.
// Adapter: getBlock/setBlock(x,y,z,id,meta,flags), isSolid(id), isLiquid(id),
// getSkyLight(x,y,z), biomeTop(x,z), canFreeze(x,y,z). Material predicates must
// use Material.isSolid/isLiquid, not collision or normal-cube flags.
export class WorldGenLakes {
  constructor(block) { this.block = block; }
  generate(world, random, x, y, z) {
    x -= 8;
    z -= 8;
    while (y > 5 && world.getBlock(x, y, z) === 0) y--;
    if (y <= 4) return false;
    y -= 4;
    const cells = new Uint8Array(2048), index = (a,b,c) => (a * 16 + c) * 8 + b;
    const count = random.nextInt(4) + 4;
    for (let i = 0; i < count; i++) {
      const dx = random.nextDouble() * 6 + 3,
        dy = random.nextDouble() * 4 + 2,
        dz = random.nextDouble() * 6 + 3,
        cx = random.nextDouble() * (16 - dx - 2) + 1 + dx / 2,
        cy = random.nextDouble() * (8 - dy - 4) + 2 + dy / 2,
        cz = random.nextDouble() * (16 - dz - 2) + 1 + dz / 2;
      for (let a = 1; a < 15; a++) for (let c = 1; c < 15; c++) for (let b = 1; b < 7; b++) {
        const px = (a - cx) / (dx / 2), py = (b - cy) / (dy / 2), pz = (c - cz) / (dz / 2);
        if (px * px + py * py + pz * pz < 1) cells[index(a,b,c)] = 1;
      }
    }
    const boundary = (a,b,c) => !cells[index(a,b,c)] && (
      (a < 15 && cells[index(a+1,b,c)]) || (a > 0 && cells[index(a-1,b,c)]) ||
      (c < 15 && cells[index(a,b,c+1)]) || (c > 0 && cells[index(a,b,c-1)]) ||
      (b < 7 && cells[index(a,b+1,c)]) || (b > 0 && cells[index(a,b-1,c)]));
    for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++) for (let b = 0; b < 8; b++) {
      if (!boundary(a,b,c)) continue;
      const id = world.getBlock(x+a,y+b,z+c);
      if (b >= 4 && world.isLiquid(id)) return false;
      // Native asks World for the block again on the non-solid lower path.
      if (b < 4 && !world.isSolid(id) && world.getBlock(x+a,y+b,z+c) !== this.block) return false;
    }
    for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++) for (let b = 0; b < 8; b++)
      if (cells[index(a,b,c)]) world.setBlock(x+a,y+b,z+c,b >= 4 ? 0 : this.block,0,2);
    for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++) for (let b = 4; b < 8; b++) {
      if (cells[index(a,b,c)] && world.getBlock(x+a,y+b-1,z+c) === 3 && world.getSkyLight(x+a,y+b,z+c) > 0)
        world.setBlock(x+a,y+b-1,z+c,world.biomeTop(x+a,z+c) === 110 ? 110 : 2,0,2);
    }
    if (this.block === 10 || this.block === 11) {
      for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++) for (let b = 0; b < 8; b++)
        if (boundary(a,b,c) && (b < 4 || random.nextInt(2) !== 0) && world.isSolid(world.getBlock(x+a,y+b,z+c)))
          world.setBlock(x+a,y+b,z+c,1,0,2);
    }
    if (this.block === 8 || this.block === 9) {
      // Native checks every column at base+4, including outside the cavity.
      for (let a = 0; a < 16; a++) for (let c = 0; c < 16; c++)
        if (world.canFreeze(x+a,y+4,z+c)) world.setBlock(x+a,y+4,z+c,79,0,2);
    }
    return true;
  }
}
