import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, SIZE, HEIGHT, BLOCKS, SNOW_LAYER, ICE, WATER, blockBounds, snowSelectionHeight, slipperiness, opaqueCube, ticksRandomly, raycast } from "./world.js";
import { BIOME_FACTS, biomeFacts } from "./biomes.js";
import { JavaRandom, lightOpacity, biomeTemperature } from "./lighting.js";
import { canBlockFreeze, canSnowAt, snowCanStay, snowFalls, meltResult, populateColumn, generationLight, stackedSnowMeta, snowballsFor } from "./snow.js";
import { Weather, stopsPrecipitation, precipitationHeight, rainsHere, canLightningStrikeAt, strikeRule, canSeeSky } from "./weather.js";

const reference = JSON.parse(await readFile(new URL("../public/research/snow-reference.json", import.meta.url)));
const f = Math.fround;

// 1.7.10 block ids (and metadata) of the fixtures, in this build's ids. Fixture blocks this
// build has no counterpart of (packed ice 174, fence 85) are skipped.
const MC = { 0: 0, 1: 3, 2: 1, 3: 2, 9: WATER, 8: WATER, 12: 6, 18: 5, 20: 9, 23: 23, 78: SNOW_LAYER, 79: ICE, 80: 23 };
const toMc = (b) => ({ 0: 0, [SNOW_LAYER]: 78, [ICE]: 79, [WATER]: 9 })[b];
const PRESET = { 1: "meadow", 3: "alpine", 12: "snowy" }; // Plains, Extreme Hills, Ice Plains

// A bare world for the rules: a sparse map over a default, with the probe's conventions.
class Cells {
  constructor(biome, base = () => [0, 0]) {
    this.biome = biome;
    this.base = base;
    this.cells = new Map();
    this.log = [];
    this.blockLight = null;
  }
  at(x, y, z) {
    return y < 0 ? [0, 0] : this.cells.get(`${x},${y},${z}`) || this.base(x, y, z);
  }
  put(x, y, z, b, meta = 0) {
    this.cells.set(`${x},${y},${z}`, [b, meta]);
  }
  get(x, y, z) {
    return this.at(x, y, z)[0];
  }
  getMeta(x, y, z) {
    return this.at(x, y, z)[1];
  }
  set(x, y, z, b, track, meta = 0) {
    this.put(x, y, z, b, meta);
    this.log.push([x, y, z, b, meta]);
    return true;
  }
}

test("the reference is the 1.7.10 client's snow classes", () => {
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  for (const c of ["ahb", "ahu", "alp", "ann", "mt", "aqz", "aec", "blt"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.equal(BLOCKS[SNOW_LAYER].name, "Snow");
  assert.equal(BLOCKS[ICE].name, "Ice");
  assert.equal(BLOCKS[23].name, "Snow block");
});

test("biome temperature, rainfall and snow flags match BiomeGenBase (probe)", () => {
  const rows = new Map(reference.biomes.map((r) => [r[0], r]));
  for (const [name, facts] of Object.entries(BIOME_FACTS)) {
    const [, vanillaName, temperature, rainfall, canSpawn, enableSnow] = rows.get(facts.id);
    assert.equal(facts.name, vanillaName, name);
    assert.equal(facts.temperature, f(temperature), name);
    assert.equal(facts.rainfall, f(rainfall), name);
    assert.equal(facts.canSpawnLightning, canSpawn === 1, name);
    assert.equal(facts.enableSnow, enableSnow === 1, name);
    assert.equal(biomeTemperature(name), f(temperature));
  }
  // Ice Plains is 0.0 and snows; every other preset is above the 0.15 freezing limit.
  assert.deepEqual([biomeFacts("snowy").temperature, biomeFacts("snowy").enableSnow], [0, true]);
  for (const name of ["meadow", "alpine", "island"]) assert.ok(biomeFacts(name).temperature > f(0.15), name);
  assert.equal(biomeFacts("nonsense"), BIOME_FACTS.meadow);
});

test("block facts: light opacity, opacity, slipperiness and random ticking match the original (probe)", () => {
  for (const [mc, opacity, , opaque, slip, ticks] of reference.blocks) {
    const id = MC[mc];
    if (id === undefined) continue;
    assert.equal(lightOpacity(id), opacity, `block ${mc}`);
    assert.equal(opaqueCube(id), opaque === 1, `block ${mc}`);
    assert.equal(slipperiness(id), f(slip), `block ${mc}`);
    // Grass, leaves and the like tick in the original; here only blocks with a port count.
    if (mc === 78 || mc === 79) assert.equal(ticksRandomly(id), ticks === 1, `block ${mc}`);
  }
  assert.equal(slipperiness(ICE), f(0.98));
  assert.equal(slipperiness(3), f(0.6));
});

test("snow layer collision and selection boxes are meta * 1/8 and (meta + 1) / 8 tall (probe)", () => {
  assert.equal(reference.bounds.length, 16);
  for (const [meta, collision, selection] of reference.bounds) {
    const w = new Cells("snowy");
    w.put(5, 40, 5, SNOW_LAYER, meta);
    assert.deepEqual(blockBounds(w, 5, 40, 5), collision.map(f), `collision ${meta}`);
    assert.equal(snowSelectionHeight(meta), selection[4], `selection ${meta}`);
    assert.deepEqual([selection[0], selection[1], selection[2], selection[3], selection[5]], [0, 0, 0, 1, 1]);
  }
});

test("canBlockFreeze: temperature, darkness, source water and the neighbour rule match ahb.d, r and s (probe)", () => {
  const blocks = [[0, 0], [WATER, 0], [WATER, 0], [WATER, 1], [WATER, 7], [ICE, 0]];
  let checked = 0;
  for (const [biome, light, bi, pattern, plain, naturally, r, s] of reference.freeze.rows) {
    if (!PRESET[biome]) continue; // taiga and frozen ocean are not presets of this build
    const w = new Cells(PRESET[biome]);
    w.put(5, 40, 5, ...blocks[bi]);
    [[4, 5], [6, 5], [5, 4], [5, 6]].forEach(([x, z], k) => {
      if (pattern === 0 || (pattern === 1 && k !== 2)) w.put(x, 40, z, WATER, 0);
      else if (pattern === 1) w.put(x, 40, z, 3, 0);
    });
    const l = () => light, name = `biome ${biome} light ${light} block ${bi} pattern ${pattern}`;
    assert.equal(canBlockFreeze(w, 5, 40, 5, false, l), plain === 1, name);
    assert.equal(canBlockFreeze(w, 5, 40, 5, true, l), naturally === 1, name);
    assert.equal(r, plain);
    assert.equal(s, naturally);
    checked++;
  }
  assert.equal(checked, 3 * 4 * 6 * 3);
  // y outside 0..255 never freezes or snows, and canSnowAt with the flag off only asks the temperature.
  for (const [y, freeze, snowTrueWater, snowFalseWater, snowTrueAir] of reference.freeze.ys) {
    const w = new Cells("snowy");
    w.put(5, y, 5, WATER, 0);
    const none = () => 0;
    assert.equal(canBlockFreeze(w, 5, y, 5, false, none), freeze === 1, `freeze y ${y}`);
    assert.equal(canSnowAt(w, 5, y, 5, true, none), snowTrueWater === 1, `snow on water y ${y}`);
    assert.equal(canSnowAt(w, 5, y, 5, false, none), snowFalseWater === 1, `snow flag off y ${y}`);
    const air = new Cells("snowy");
    air.put(5, y - 1, 5, 3, 0);
    assert.equal(canSnowAt(air, 5, y, 5, true, none), snowTrueAir === 1, `snow on air y ${y}`);
  }
});

test("canSnowAt and BlockSnow.canPlaceBlockAt match ahb.e and ann.c (probe)", () => {
  const { below, cells, rows } = reference.snowAt;
  let checked = 0;
  for (const [biome, light, bi, ci, snow, snowOff, place] of rows) {
    const [belowId, belowMeta] = below[bi], [cellId, cellMeta] = cells[ci];
    if (MC[belowId] === undefined) continue; // packed ice, fence
    const w = new Cells(PRESET[biome]);
    w.put(5, 39, 5, MC[belowId], belowMeta);
    w.put(5, 40, 5, MC[cellId], cellMeta);
    const l = () => light, name = `biome ${biome} light ${light} below ${belowId}/${belowMeta} cell ${cellId}`;
    assert.equal(canSnowAt(w, 5, 40, 5, true, l), snow === 1, name);
    assert.equal(canSnowAt(w, 5, 40, 5, false, l), snowOff === 1, name);
    assert.equal(snowCanStay(w, 5, 40, 5), place === 1, name);
    checked++;
  }
  assert.ok(checked > 400);
});

test("snow melts above light 11, ice above light 8, and a layer falls when its support goes (probe)", () => {
  for (const [light, id] of reference.melt.snow) assert.deepEqual(meltResult(SNOW_LAYER, light), id === 78 ? null : { block: 0, meta: 0 }, `snow ${light}`);
  for (const [light, id, meta] of reference.melt.ice) assert.deepEqual(meltResult(ICE, light), id === 79 ? null : { block: WATER, meta }, `ice ${light}`);
  assert.equal(meltResult(3, 15), null);
  const { below } = reference.snowAt;
  for (const [belowId, belowMeta, after] of reference.neighbor) {
    if (MC[belowId] === undefined) continue;
    const w = new Cells("snowy");
    w.put(5, 39, 5, MC[belowId], belowMeta);
    w.put(5, 40, 5, SNOW_LAYER, 3);
    assert.equal(snowFalls(w, 5, 40, 5), after === 0, `below ${belowId}/${belowMeta}`);
  }
  assert.ok(below.length > 0);
});

// The fixture terrain, in this build's ids.
function terrainWorld(biome) {
  const t = reference.terrain, at = (x, z) => t.columns[x * t.size + z];
  return new Cells(biome, (x, y, z) => {
    if (x < 0 || z < 0 || x >= t.size || z >= t.size) return [y <= 30 ? 3 : 0, 0];
    const [g, surface, pond, leaf, glass] = at(x, z);
    if (y > g) {
      if (pond && y <= t.pondTop) return [WATER, 0];
      if (y === leaf) return [5, 0];
      if (y === glass) return [9, 0];
      return [0, 0];
    }
    if (y === g) return [MC[surface], 0];
    return y > g - 3 ? [2, 0] : [3, 0];
  });
}
const manhattan = (lights) => (x, y, z) => Math.max(0, ...lights.map(([lx, ly, lz, v]) => v - (Math.abs(x - lx) + Math.abs(y - ly) + Math.abs(z - lz))));

test("the per-chunk freeze and snow tick replays WorldServer.func_147456_g (probe, transcribed loop)", () => {
  const chunks = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (const run of reference.tick) {
    const w = terrainWorld("snowy"), weather = new Weather({ random: new JavaRandom(run.seed), lcg: run.lcg });
    w.blockLight = manhattan(reference.terrain.lights);
    weather.rain = weather.prevRain = run.raining ? 1 : 0;
    assert.equal(weather.isRaining(), run.raining === 1);
    let tick = 0;
    const events = [];
    weather.apply = (world, x, y, z, b, meta) => {
      events.push([tick, toMc(b), x, y, z, meta]);
      world.set(x, y, z, b, true, meta);
    };
    for (tick = 1; tick <= run.ticks; tick++) for (const [cx, cz] of chunks) weather.tickChunk(w, cx, cz);
    assert.deepEqual(events, run.events, `seed ${run.seed}`);
    assert.ok(run.events.length > 0);
  }
  // Without rain the naturally-freezable edge of the pond still freezes; with rain, snow settles too.
  assert.ok(reference.tick[0].events.some((e) => e[1] === 78));
  assert.ok(!reference.tick[1].events.some((e) => e[1] === 78));
  assert.ok(reference.tick[1].events.every((e) => e[1] === 79));
});

test("the populate pass freezes still water and lays snow like ChunkProviderGenerate.populate (probe)", () => {
  for (const run of reference.populate) {
    const w = terrainWorld(PRESET[run.biome]);
    w.blockLight = manhattan(reference.terrain.lights);
    w.set = (x, y, z, b, track, meta = 0) => {
      w.put(x, y, z, b, meta);
      w.log.push([0, toMc(b), x, y, z, meta]);
    };
    const [bx, bz] = run.origin;
    for (let k = 0; k < 16; k++) for (let l = 0; l < 16; l++) populateColumn(w, bx + k, bz + l, w.blockLight);
    assert.deepEqual(w.log, run.events, `biome ${run.biome}`);
  }
  assert.equal(reference.populate[1].events.length, 0); // Plains: nothing
});

test("existing presets generate exactly as before at version 6; the snowy preset only adds ice and snow", () => {
  for (const seed of ["Minecraft", "d", "a", "Overworld"])
    for (const biome of ["meadow", "alpine", "island"]) {
      const old = new World(seed, biome, 5), now = new World(seed, biome, 6);
      assert.deepEqual(now.snapshot(), old.snapshot(), `${seed} ${biome}`);
    }
  assert.equal(new World("x").generationVersion, 8); // 7 regrows trees (trees.test.js), 8 adds sand and sugar cane (plants.test.js); 6 is pinned above
  for (const seed of ["Minecraft", "d"]) {
    const a = new World(seed, "snowy", 6), b = new World(seed, "snowy", 6), old = new World(seed, "snowy", 5);
    const A = a.snapshot(), O = old.snapshot();
    assert.deepEqual(A.data, b.snapshot().data);
    assert.equal(a.edits.size, 0); // generated blocks are not saved edits
    let ice = 0, snow = 0, grass = 0, change = 0;
    for (let i = 0; i < A.data.length; i++) {
      if (A.data[i] === ICE) ice++;
      if (A.data[i] === SNOW_LAYER) snow++;
      if (A.data[i] === 1) grass++;
      if (A.data[i] !== O.data[i]) {
        change++;
        assert.ok(A.data[i] === ICE || A.data[i] === SNOW_LAYER, "only ice and snow differ");
      }
      assert.ok(A.meta[i] === 0 || ![SNOW_LAYER, ICE].includes(A.data[i]));
    }
    // Grass stays the top layer (Ice Plains' spikes flag is off); the surface is snow and ice.
    assert.ok(ice > 100 && snow > 4000 && grass > 4000, `${seed}: ${ice} ice ${snow} snow ${grass} grass`);
    assert.equal(change, ice + snow);
    // Version 5 snowy worlds stay bare.
    assert.ok(!O.data.includes(SNOW_LAYER) && !O.data.includes(ICE));
    // Every exposed top is done: no unfrozen source water under the open sky (dark enough), and
    // every layer stands on something that can hold it.
    const light = generationLight(a);
    for (let x = 0; x < SIZE; x++)
      for (let z = 0; z < SIZE; z++) {
        const y = precipitationHeight(a, x, z);
        assert.ok(!(a.get(x, y - 1, z) === WATER && a.getMeta(x, y - 1, z) === 0 && light(x, y - 1, z) < 10), `${x},${z} water`);
        for (let h = 1; h < HEIGHT; h++) if (a.get(x, h, z) === SNOW_LAYER) assert.ok(snowCanStay(a, x, h, z), `${x},${h},${z}`);
      }
  }
});

test("snow layers: stacking, drops, selection ray and precipitation", () => {
  assert.equal(stackedSnowMeta(0), 1);
  assert.equal(stackedSnowMeta(6), 7);
  assert.equal(stackedSnowMeta(7), null);
  assert.equal(stackedSnowMeta(8 | 3), 8 | 4);
  assert.equal(snowballsFor(0), 1);
  assert.equal(snowballsFor(7), 8);
  assert.equal(stopsPrecipitation(SNOW_LAYER), false);
  assert.equal(stopsPrecipitation(ICE), true);
  const w = new World("snowray", "snowy", 6);
  w.set(50, 30, 50, 3, false);
  w.set(50, 31, 50, SNOW_LAYER, false, 1); // selection height 2/8
  const down = (y) => raycast(w, { x: 50.5, y, z: 50.5 }, { x: 0, y: -1, z: 0 }, 5);
  assert.deepEqual(down(33.5).block, [50, 31, 50]);
  // A ray crossing the cell above the layer is not blocked by it...
  const across = raycast(w, { x: 49.1, y: 31.6, z: 50.5 }, { x: 1, y: 0, z: 0 }, 3);
  assert.equal(across, null);
  // ...and one crossing below its top is.
  assert.deepEqual(raycast(w, { x: 49.1, y: 31.2, z: 50.5 }, { x: 1, y: 0, z: 0 }, 3).block, [50, 31, 50]);
  // A flat layer has no collision, so it is not solid; deeper ones are.
  w.set(50, 31, 50, SNOW_LAYER, false, 0);
  assert.equal(w.solid(50, 31, 50), false);
  w.set(50, 31, 50, SNOW_LAYER, false, 3);
  assert.equal(w.solid(50, 31, 50), true);
});

test("snow and ice change the weather rules of the snowy preset", () => {
  const w = new World("weather", "snowy");
  assert.equal(rainsHere(w), false);
  assert.equal(rainsHere(new World("weather", "meadow")), true);
  const weather = new Weather();
  weather.rain = weather.prevRain = 1;
  const column = { x: 60, z: 60 }, y = precipitationHeight(w, column.x, column.z);
  assert.ok(canSeeSky(w, column.x, y, column.z));
  assert.equal(canLightningStrikeAt(weather, w, column.x, y, column.z), false); // enableSnow
  assert.equal(strikeRule({ raining: true, sees: true, precipitation: 5, y: 5, temperature: f(0), canSpawn: false, enableSnow: true }), false);
  const meadow = new World("weather", "meadow");
  const my = precipitationHeight(meadow, column.x, column.z);
  assert.equal(canLightningStrikeAt(weather, meadow, column.x, my, column.z), true);
  // Ice blocks sky light (opacity 3), a snow layer does not.
  assert.equal(lightOpacity(ICE), 3);
  assert.equal(lightOpacity(SNOW_LAYER), 0);
});

test("rain falls as snow where the temperature is below 0.15, and a rain tick settles on every cold column in time", () => {
  const w = new World("tickworld", "snowy");
  const weather = new Weather({ random: new JavaRandom(5) });
  weather.rain = weather.prevRain = 1;
  w.blockLight = () => 0;
  const chunks = Weather.activeChunks(64, 64);
  const before = w.edits.size;
  for (let t = 0; t < 400; t++) weather.tickChunks(w, chunks);
  assert.equal(w.edits.size, before); // generation already covered every exposed column
  // Clear one snow layer: the weather lays it again, as a tracked (saved) edit.
  let spot = null;
  for (let x = 40; x < 80 && !spot; x++) for (let z = 40; z < 80 && !spot; z++) for (let y = HEIGHT - 1; y > 0; y--) if (w.get(x, y, z) === SNOW_LAYER) { spot = [x, y, z]; break; }
  assert.ok(spot);
  w.set(...spot, 0, true);
  for (let t = 0; t < 40000 && w.get(...spot) !== SNOW_LAYER; t++) weather.tickChunk(w, spot[0] >> 4, spot[2] >> 4);
  assert.equal(w.get(...spot), SNOW_LAYER);
  assert.ok(w.edits.has(spot.join(",")));
});

test("JavaRandom.nextGaussian matches java.util.Random", () => {
  const r = new JavaRandom(42);
  assert.deepEqual([...Array(6)].map(() => r.nextGaussian()), [1.1419053154730547, 0.9194079489827879, -0.9498666368908959, -1.1069902863993377, 0.2809776380727795, 0.6846227956326554]);
  r.setSeed(42);
  assert.equal(r.nextGaussian(), 1.1419053154730547);
});
