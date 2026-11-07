// The 1.7.10 BiomeGenBase registry (ahu.n(), 256 slots) as the unchanged client builds it, recorded by
// tools/verify-biome-layers.mjs into public/research/biome-layers-reference.json. The layer stack only ever handles
// these ids; terrain will read rootHeight/heightVariation and the surface blocks. Floats are Java float values.
// Quirk kept: slot 161 (megaTaigaHills' mutation) holds a biome whose own biomeID is 160 ("Mega Spruce Taiga").

// [slot, biomeID, name, class, temperature, rainfall, rootHeight, heightVariation, temp category, snowy,
//  top block, top metadata, filler block]; class is the MCP class name without its BiomeGen prefix.
const ROWS = [
  [0, 0, "Ocean", "Ocean", 0.5, 0.5, -1, 0.1, 0, 0, 2, 0, 3],
  [1, 1, "Plains", "Plains", 0.8, 0.4, 0.125, 0.05, 2, 0, 2, 0, 3],
  [2, 2, "Desert", "Desert", 2, 0, 0.125, 0.05, 3, 0, 12, 0, 12],
  [3, 3, "Extreme Hills", "Hills", 0.2, 0.3, 1, 0.5, 2, 0, 2, 0, 3],
  [4, 4, "Forest", "Forest", 0.7, 0.8, 0.1, 0.2, 2, 0, 2, 0, 3],
  [5, 5, "Taiga", "Taiga", 0.25, 0.8, 0.2, 0.2, 2, 0, 2, 0, 3],
  [6, 6, "Swampland", "Swamp", 0.8, 0.9, -0.2, 0.1, 2, 0, 2, 0, 3],
  [7, 7, "River", "River", 0.5, 0.5, -0.5, 0, 2, 0, 2, 0, 3],
  [8, 8, "Hell", "Hell", 2, 0, 0.1, 0.2, 3, 0, 2, 0, 3],
  [9, 9, "Sky", "End", 0.5, 0.5, 0.1, 0.2, 2, 0, 3, 0, 3],
  [10, 10, "FrozenOcean", "Ocean", 0, 0.5, -1, 0.1, 0, 1, 2, 0, 3],
  [11, 11, "FrozenRiver", "River", 0, 0.5, -0.5, 0, 1, 1, 2, 0, 3],
  [12, 12, "Ice Plains", "Snow", 0, 0.5, 0.125, 0.05, 1, 1, 2, 0, 3],
  [13, 13, "Ice Mountains", "Snow", 0, 0.5, 0.45, 0.3, 1, 1, 2, 0, 3],
  [14, 14, "MushroomIsland", "MushroomIsland", 0.9, 1, 0.2, 0.3, 2, 0, 110, 0, 3],
  [15, 15, "MushroomIslandShore", "MushroomIsland", 0.9, 1, 0, 0.025, 2, 0, 110, 0, 3],
  [16, 16, "Beach", "Beach", 0.8, 0.4, 0, 0.025, 2, 0, 12, 0, 12],
  [17, 17, "DesertHills", "Desert", 2, 0, 0.45, 0.3, 3, 0, 12, 0, 12],
  [18, 18, "ForestHills", "Forest", 0.7, 0.8, 0.45, 0.3, 2, 0, 2, 0, 3],
  [19, 19, "TaigaHills", "Taiga", 0.25, 0.8, 0.45, 0.3, 2, 0, 2, 0, 3],
  [20, 20, "Extreme Hills Edge", "Hills", 0.2, 0.3, 0.8, 0.3, 2, 0, 2, 0, 3],
  [21, 21, "Jungle", "Jungle", 0.95, 0.9, 0.1, 0.2, 2, 0, 2, 0, 3],
  [22, 22, "JungleHills", "Jungle", 0.95, 0.9, 0.45, 0.3, 2, 0, 2, 0, 3],
  [23, 23, "JungleEdge", "Jungle", 0.95, 0.8, 0.1, 0.2, 2, 0, 2, 0, 3],
  [24, 24, "Deep Ocean", "Ocean", 0.5, 0.5, -1.8, 0.1, 0, 0, 2, 0, 3],
  [25, 25, "Stone Beach", "StoneBeach", 0.2, 0.3, 0.1, 0.8, 2, 0, 1, 0, 1],
  [26, 26, "Cold Beach", "Beach", 0.05, 0.3, 0, 0.025, 1, 1, 12, 0, 12],
  [27, 27, "Birch Forest", "Forest", 0.6, 0.6, 0.1, 0.2, 2, 0, 2, 0, 3],
  [28, 28, "Birch Forest Hills", "Forest", 0.6, 0.6, 0.45, 0.3, 2, 0, 2, 0, 3],
  [29, 29, "Roofed Forest", "Forest", 0.7, 0.8, 0.1, 0.2, 2, 0, 2, 0, 3],
  [30, 30, "Cold Taiga", "Taiga", -0.5, 0.4, 0.2, 0.2, 1, 1, 2, 0, 3],
  [31, 31, "Cold Taiga Hills", "Taiga", -0.5, 0.4, 0.45, 0.3, 1, 1, 2, 0, 3],
  [32, 32, "Mega Taiga", "Taiga", 0.3, 0.8, 0.2, 0.2, 2, 0, 2, 0, 3],
  [33, 33, "Mega Taiga Hills", "Taiga", 0.3, 0.8, 0.45, 0.3, 2, 0, 2, 0, 3],
  [34, 34, "Extreme Hills+", "Hills", 0.2, 0.3, 1, 0.5, 2, 0, 2, 0, 3],
  [35, 35, "Savanna", "Savanna", 1.2, 0, 0.125, 0.05, 3, 0, 2, 0, 3],
  [36, 36, "Savanna Plateau", "Savanna", 1, 0, 1.5, 0.025, 3, 0, 2, 0, 3],
  [37, 37, "Mesa", "Mesa", 2, 0, 0.1, 0.2, 3, 0, 12, 1, 159],
  [38, 38, "Mesa Plateau F", "Mesa", 2, 0, 1.5, 0.025, 3, 0, 12, 1, 159],
  [39, 39, "Mesa Plateau", "Mesa", 2, 0, 1.5, 0.025, 3, 0, 12, 1, 159],
  [129, 129, "Sunflower Plains", "Plains", 0.8, 0.4, 0.125, 0.05, 2, 0, 2, 0, 3],
  [130, 130, "Desert M", "Mutated", 2, 0, 0.225, 0.25, 3, 0, 12, 0, 12],
  [131, 131, "Extreme Hills M", "Hills", 0.2, 0.3, 1, 0.5, 2, 0, 2, 0, 3],
  [132, 132, "Flower Forest", "Forest", 0.7, 0.8, 0.1, 0.4, 2, 0, 2, 0, 3],
  [133, 133, "Taiga M", "Mutated", 0.25, 0.8, 0.3, 0.4, 2, 0, 2, 0, 3],
  [134, 134, "Swampland M", "Mutated", 0.8, 0.9, -0.1, 0.3, 2, 0, 2, 0, 3],
  [140, 140, "Ice Plains Spikes", "Snow", 0, 0.5, 0.425, 0.45000002, 1, 1, 80, 0, 3],
  [149, 149, "Jungle M", "Mutated", 0.95, 0.9, 0.2, 0.4, 2, 0, 2, 0, 3],
  [151, 151, "JungleEdge M", "Mutated", 0.95, 0.8, 0.2, 0.4, 2, 0, 2, 0, 3],
  [155, 155, "Birch Forest M", "Forest$1", 0.6, 0.6, 0.2, 0.4, 2, 0, 2, 0, 3],
  [156, 156, "Birch Forest Hills M", "Forest$1", 0.6, 0.6, 0.55, 0.5, 2, 0, 2, 0, 3],
  [157, 157, "Roofed Forest M", "Forest$2", 0.7, 0.8, 0.2, 0.4, 2, 0, 2, 0, 3],
  [158, 158, "Cold Taiga M", "Mutated", -0.5, 0.4, 0.3, 0.4, 1, 1, 2, 0, 3],
  [160, 160, "Mega Spruce Taiga", "Taiga", 0.25, 0.8, 0.2, 0.2, 2, 0, 2, 0, 3],
  [161, 160, "Mega Spruce Taiga", "Taiga", 0.25, 0.8, 0.2, 0.2, 2, 0, 2, 0, 3],
  [162, 162, "Extreme Hills+ M", "Hills", 0.2, 0.3, 1, 0.5, 2, 0, 2, 0, 3],
  [163, 163, "Savanna M", "Savanna$Mutated", 1.1, 0, 0.3625, 1.225, 3, 0, 2, 0, 3],
  [164, 164, "Savanna Plateau M", "Savanna$Mutated", 1, 0, 1.05, 1.2125001, 3, 0, 2, 0, 3],
  [165, 165, "Mesa (Bryce)", "Mesa", 2, 0, 0.1, 0.2, 3, 0, 12, 1, 159],
  [166, 166, "Mesa Plateau F M", "Mesa", 2, 0, 0.45, 0.3, 3, 0, 12, 1, 159],
  [167, 167, "Mesa Plateau M", "Mesa", 2, 0, 0.45, 0.3, 3, 0, 12, 1, 159],
];

export const TEMP_OCEAN = 0, TEMP_COLD = 1, TEMP_MEDIUM = 2, TEMP_WARM = 3;

export class JavaBiome {
  constructor([slot, id, name, cls, temperature, rainfall, rootHeight, heightVariation, category, snowy, top, topMeta, filler]) {
    this.slot = slot;
    this.id = id;
    this.name = name;
    this.cls = cls;
    this.biomeClass = cls; // BiomeGenBase.getBiomeClass; mutated biomes take their base biome's below
    this.temperature = Math.fround(temperature);
    this.rainfall = Math.fround(rainfall);
    this.rootHeight = Math.fround(rootHeight);
    this.heightVariation = Math.fround(heightVariation);
    this.category = category;
    this.snowy = snowy === 1;
    this.topBlock = top;
    this.topMeta = topMeta;
    this.fillerBlock = filler;
    // BiomeGenBase.getIntRainfall: (int)(rainfall * 65536).
    this.rainfallInt = Math.trunc(Math.fround(this.rainfall * 65536));
  }
  // BiomeGenBase.isEqualTo (ahu.a): the same object or the same getBiomeClass (ahu.l). BiomeGenMutated (ain) overrides
  // both to ask its base biome, so Jungle M is a Jungle and Desert M is not equal to Taiga M.
  isEqualTo(other) {
    return this === other || this.biomeClass === other.biomeClass;
  }
}

export const BIOME_LIST = new Array(256).fill(null);
for (const row of ROWS) BIOME_LIST[row[0]] = new JavaBiome(row);
// BiomeGenMutated.getBiomeClass returns baseBiome.getBiomeClass; every mutated slot is its base slot + 128.
for (const b of BIOME_LIST) if (b && (b.cls === "Mutated" || b.cls === "Savanna$Mutated")) b.biomeClass = BIOME_LIST[b.slot - 128].biomeClass;

// BiomeGenBase.getBiome (ahu.d(int)): out-of-range ids fall back to ocean (the client logs a warning); empty slots
// are null.
export function getBiome(id) {
  if (id < 0 || id > BIOME_LIST.length) return BIOME_LIST[0];
  return BIOME_LIST[id] ?? null;
}

// The static BiomeGenBase fields the layers name.
export const B = {
  ocean: 0, plains: 1, desert: 2, extremeHills: 3, forest: 4, taiga: 5, swampland: 6, river: 7, hell: 8, sky: 9,
  frozenOcean: 10, frozenRiver: 11, icePlains: 12, iceMountains: 13, mushroomIsland: 14, mushroomIslandShore: 15,
  beach: 16, desertHills: 17, forestHills: 18, taigaHills: 19, extremeHillsEdge: 20, jungle: 21, jungleHills: 22,
  jungleEdge: 23, deepOcean: 24, stoneBeach: 25, coldBeach: 26, birchForest: 27, birchForestHills: 28,
  roofedForest: 29, coldTaiga: 30, coldTaigaHills: 31, megaTaiga: 32, megaTaigaHills: 33, extremeHillsPlus: 34,
  savanna: 35, savannaPlateau: 36, mesa: 37, mesaPlateau_F: 38, mesaPlateau: 39,
};
