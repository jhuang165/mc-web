// WorldChunkManagerHell (aie): one biome for every column. Research use only (the biome audit's forced regions for slots
// that never occur naturally); no live generation version selects it. Same surface as WorldChunkManager's terrain reads.
import { getBiome } from "./java-biomes.js";

export class ForcedBiomeManager {
  constructor(slot) { this.biome = getBiome(slot); }
  biomeAt() { return this.biome; }
  biomesForGeneration(x, z, w, h) { return new Array(w * h).fill(this.biome); }
  biomeArea(x, z, w, h) { return new Array(w * h).fill(this.biome); }
}
