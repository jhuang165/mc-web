// 1.7.10 WorldGenLiquids (BiomeDecorator's water and lava springs). The spring block is placed
// and ticked once with scheduled updates immediate, so the whole flow it starts resolves at
// once through gen-world.js. Replayed natively in springs.test.js.
import { AIR, STONE } from "./gen-world.js";

export class WorldGenLiquids {
  constructor(block) { this.block = block; }
  generate(world, random, x, y, z) {
    if (world.getBlock(x, y + 1, z) !== STONE || world.getBlock(x, y - 1, z) !== STONE) return false;
    if (world.getBlock(x, y, z) !== AIR && world.getBlock(x, y, z) !== STONE) return false;
    let stone = 0, air = 0;
    if (world.getBlock(x - 1, y, z) === STONE) stone++;
    if (world.getBlock(x + 1, y, z) === STONE) stone++;
    if (world.getBlock(x, y, z - 1) === STONE) stone++;
    if (world.getBlock(x, y, z + 1) === STONE) stone++;
    if (world.isAirBlock(x - 1, y, z)) air++;
    if (world.isAirBlock(x + 1, y, z)) air++;
    if (world.isAirBlock(x, y, z - 1)) air++;
    if (world.isAirBlock(x, y, z + 1)) air++;
    if (stone === 3 && air === 1) {
      world.setBlock(x, y, z, this.block, 0, 2);
      world.immediate = true;
      world.updateTick(this.block, x, y, z, random);
      world.immediate = false;
    }
    return true;
  }
}
