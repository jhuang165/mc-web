// Native ChunkProviderGenerate map-feature orchestration (1.7.10), standalone.
// This package deliberately does not change a live generation version. It joins the
// separately replayed structure generators in the provider's actual search and
// population order, including the shared World.rand mutation done by village/temple
// placement and village lake suppression in populateBeforeDecoration.
import { MapGenMineshaft } from "./mineshaft-generator.js";
import { MapGenVillage } from "./village-generator.js";
import { MapGenStronghold } from "./stronghold-generator.js";
import { MapGenScatteredFeature } from "./scattered-feature-generator.js";
import { populateBeforeDecoration } from "./population-stage.js";

const A = 341873128712n, B = 132897987541n;
export const STRUCTURE_SEARCH_ORDER = Object.freeze(["mineshaft", "village", "stronghold", "scatteredFeature"]);
export const STRUCTURE_POPULATE_ORDER = STRUCTURE_SEARCH_ORDER;

// World.setRandomSeed(x,z,salt): seed the world-owned Random and return it.
function setWorldRandomSeed(world, worldSeed, x, z, salt) {
  if (typeof world.setRandomSeed === "function") {
    const random = world.setRandomSeed(x, z, salt) ?? world.rand ?? world.random;
    if (!random || typeof random.nextInt !== "function") throw new TypeError("World.setRandomSeed must expose its Random stream");
    return random;
  }
  const random = world.rand ?? world.random;
  if (!random || typeof random.setSeed !== "function" || typeof random.nextInt !== "function")
    throw new TypeError("Structure search needs World.rand or World.setRandomSeed");
  random.setSeed(BigInt.asIntN(64, BigInt(x) * A + BigInt(z) * B + BigInt(worldSeed) + BigInt(salt)));
  return random;
}
function preservePlacementWorldRandom(generator, world, worldSeed, salt, distance) {
  const candidate = generator.canSpawnStructureAtCoords.bind(generator);
  generator.canSpawnStructureAtCoords = (x, z) => {
    // The native methods first floor negative coordinates into their spacing cell,
    // then call World.setRandomSeed(cellX, cellZ, salt) and draw the two offsets.
    const cellX = Math.floor(x / distance), cellZ = Math.floor(z / distance);
    const random = setWorldRandomSeed(world, worldSeed, cellX, cellZ, salt);
    const span = distance - 8;
    random?.nextInt(span); random?.nextInt(span);
    return candidate(x, z);
  };
}

export class StructurePopulation {
  constructor({ worldSeed, manager, world, options = {}, generators = null }) {
    if (worldSeed === undefined || !manager || !world) throw new TypeError("StructurePopulation needs worldSeed, manager, and world");
    this.worldSeed = BigInt.asIntN(64, BigInt(worldSeed));
    this.world = world;
    this.generators = generators ?? {
      mineshaft: new MapGenMineshaft(this.worldSeed),
      village: new MapGenVillage(this.worldSeed, manager, options.village),
      stronghold: MapGenStronghold.forSeed(this.worldSeed, manager, options.stronghold),
      scatteredFeature: new MapGenScatteredFeature(this.worldSeed, manager, options.scatteredFeature),
    };
    for (const name of STRUCTURE_SEARCH_ORDER) {
      if (!this.generators[name] || typeof this.generators[name].generate !== "function" ||
          typeof this.generators[name].generateStructuresInChunk !== "function")
        throw new TypeError(`Missing MapGenStructure-compatible generator: ${name}`);
    }
    preservePlacementWorldRandom(this.generators.village, world, this.worldSeed, 10387312, this.generators.village.distance);
    preservePlacementWorldRandom(this.generators.scatteredFeature, world, this.worldSeed, 14357617, this.generators.scatteredFeature.distance);
  }

  // ChunkProviderGenerate.provideChunk: called after terrain, surface, caves and ravines.
  // Each generator performs its own range-8 recursive search in this order.
  searchChunk(chunkX, chunkZ) {
    const starts = {};
    for (const name of STRUCTURE_SEARCH_ORDER) {
      const generator = this.generators[name];
      const before = generator.structureMap.size;
      generator.generate(chunkX, chunkZ);
      starts[name] = generator.structureMap.size - before;
    }
    return starts;
  }

  // ChunkProviderGenerate.populate's mapFeaturesEnabled branch. Structure writes share
  // the exact provider Random; village's return value suppresses both lakes.
  populateStructures(random, chunkX, chunkZ) {
    const result = {};
    let village = false;
    for (const name of STRUCTURE_POPULATE_ORDER) {
      const found = this.generators[name].generateStructuresInChunk(this.world, random, chunkX, chunkZ);
      result[name] = found;
      if (name === "village") village = found === true;
    }
    return { ...result, village };
  }

  // Full pre-decoration population driver lets the verified provider stage own
  // population-seed reseeding, water/lava lake suppression, and dungeon ordering.
  populateChunk(random, chunkX, chunkZ, { trace = null } = {}) {
    return populateBeforeDecoration(this.world, random, this.worldSeed, chunkX, chunkZ, {
      structures: (stream, x, z) => this.populateStructures(stream, x, z).village,
      trace,
    });
  }
}
