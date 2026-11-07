// Map features and populate for a Superflat world: ChunkProviderFlat (aqu) builds its structure generators from the feature
// map in the fixed order village, biome_1 (the scattered temples/huts), mineshaft, stronghold, searches them while building a
// chunk and, in populate, runs them on the provider Random before the lakes, dungeons and decoration the feature map enables.
// Bytecode-verified (flat-world-reference.json's method note): there is no animal spawning and no freezing in this populate,
// the water lake is not skipped in deserts, and the village size defaults to "1". The ported generators themselves
// are the ones the default world uses (structure-population.js).
import { MapGenMineshaft, MINESHAFT_CHANCE } from './mineshaft-generator.js';
import { MapGenVillage } from './village-generator.js';
import { MapGenStronghold } from './stronghold-generator.js';
import { MapGenScatteredFeature } from './scattered-feature-generator.js';
import { strongholdPositions } from './structure-placement.js';
import { populationSeed } from './ore-generator.js';
import { WorldGenLakes } from './lake-generator.js';
import { WorldGenDungeons } from './dungeon-generator.js';
import { javaParseInt } from './flat-world.js';

// The generators in ChunkProviderFlat's list order: [generator key, feature name].
export const FLAT_STRUCTURE_ORDER = Object.freeze([['village', 'village'], ['scatteredFeature', 'biome_1'], ['mineshaft', 'mineshaft'], ['stronghold', 'stronghold']]);
const intAtLeast = (value, fallback, min) => { const n = javaParseInt(value) ?? fallback; return n < min ? min : n; };
// qh.a(String, double, min) / Double.parseDouble.
const doubleOr = (value, fallback) => (typeof value === 'string' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?$/.test(value) ? Number.parseFloat(value) : fallback);

export class FlatStructureCache {
  constructor(seed, manager, info, mapFeatures = true) { this.seed = BigInt.asIntN(64, BigInt(seed)); this.manager = manager; this.info = info; this.mapFeatures = mapFeatures; this.strongholds = null; }
  strongholdPositions() {
    if (!this.strongholds) {
      const o = this.info.options('stronghold');
      // Map features off (generation 17) builds no generator natively; the inert objects here are never searched or populated.
      this.strongholds = this.mapFeatures && this.info.has('stronghold')
        ? strongholdPositions(this.seed, this.manager, {
          distance: Math.max(1, doubleOr(o.distance, 32)), count: intAtLeast(o.count, 3, 1), spread: intAtLeast(o.spread, 3, 1),
        })
        : [];
    }
    return this.strongholds;
  }
  generators() {
    const info = this.info, village = info.options('village'), scattered = info.options('biome_1');
    return {
      mineshaft: new MapGenMineshaft(this.seed, doubleOr(info.options('mineshaft').chance, MINESHAFT_CHANCE)),
      village: new MapGenVillage(this.seed, this.manager, { size: village.size ?? '1', distance: village.distance }),
      stronghold: new MapGenStronghold(this.seed, this.strongholdPositions()),
      scatteredFeature: new MapGenScatteredFeature(this.seed, this.manager, { distance: intAtLeast(scattered.distance, 32, 9) }),
    };
  }
}

// The base class is passed in: importing structure-population.js here would close an import cycle (it reaches population-world.js).
const made = new Map();
export const flatStructurePopulation = (Base) => { if (!made.has(Base)) made.set(Base, makeFlat(Base)); return made.get(Base); };
const makeFlat = (Base) => class FlatStructurePopulation extends Base {
  constructor({ worldSeed, manager, world, generators, info, mapFeatures = true }) {
    super({ worldSeed, manager, world, generators });
    this.info = info;
    this.active = mapFeatures ? FLAT_STRUCTURE_ORDER.filter(([, feature]) => info.has(feature)).map(([key]) => key) : [];
  }
  // ChunkProviderFlat.provideChunk: each enabled generator's recursive search, in list order.
  searchChunk(chunkX, chunkZ) {
    const starts = {};
    for (const name of this.active) {
      const generator = this.generators[name], before = generator.structureMap.size;
      generator.generate(chunkX, chunkZ);
      starts[name] = generator.structureMap.size - before;
    }
    return starts;
  }
  populateStructures(random, chunkX, chunkZ) {
    const result = {};
    let village = false;
    for (const name of this.active) {
      const found = this.generators[name].generateStructuresInChunk(this.world, random, chunkX, chunkZ);
      result[name] = found;
      if (name === 'village') village = found === true;
    }
    return { ...result, village };
  }
  // ChunkProviderFlat.populate up to the decoration: structures, the water lake (1 in 4), the lava lake (1 in 8, above sea
  // level only 1 in 10 of those) when no village was generated, then eight dungeon attempts. The caller decorates.
  populateChunk(random, chunkX, chunkZ) {
    const w = this.world, x0 = chunkX * 16, z0 = chunkZ * 16, info = this.info;
    const biome = w.biome(x0 + 16, z0 + 16);
    random.setSeed(populationSeed(this.worldSeed, chunkX, chunkZ));
    const village = this.populateStructures(random, chunkX, chunkZ).village, events = [];
    if (info.has('lake') && !village && random.nextInt(4) === 0) {
      const x = x0 + random.nextInt(16) + 8, y = random.nextInt(256), z = z0 + random.nextInt(16) + 8;
      events.push(['water', x, y, z, new WorldGenLakes(9).generate(w, random, x, y, z)]);
    }
    if (info.has('lava_lake') && !village && random.nextInt(8) === 0) {
      const x = x0 + random.nextInt(16) + 8, y = random.nextInt(random.nextInt(248) + 8), z = z0 + random.nextInt(16) + 8;
      if (y < 63 || random.nextInt(10) === 0) events.push(['lava', x, y, z, new WorldGenLakes(11).generate(w, random, x, y, z)]);
    }
    if (info.has('dungeon')) {
      for (let i = 0; i < 8; i++) {
        const x = x0 + random.nextInt(16) + 8, y = random.nextInt(256), z = z0 + random.nextInt(16) + 8;
        events.push(['dungeon', x, y, z, new WorldGenDungeons().generate(w, random, x, y, z)]);
      }
    }
    return { biome, village, events };
  }
};
