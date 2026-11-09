// What an away run needs and which columns it covers (pure: no game modules, so dimension-live.js can import it without a cycle).
// Rules: public/research/dimensions.md "Batch 30" and the header of away-world.js.
export const AWAY_ENTITY_TICKS = 1200; // mt.h: the entity/tile-entity gate after the last player leaves
export const SPAWN_RADIUS = 128; // ms.b: chunk centres within +-128 blocks of the world spawn stay loaded
export const MAX_AWAY_TICKS = 72000; // one hour; longer trips are capped (a bound, not a native rule)
export const MAX_COLUMNS = 64;
export const WALL_BUDGET_MS = 4000;
const HALO = 1;

const key = (cx, cz) => `${cx},${cz}`;
// ChunkProviderServer.b: the chunk centre against the world spawn point, per axis.
export const inSpawnArea = (spawn, cx, cz) => Math.abs(cx * 16 + 8 - spawn[0]) <= SPAWN_RADIUS && Math.abs(cz * 16 + 8 - spawn[2]) <= SPAWN_RADIUS;
export const spawnOf = (root) => (Array.isArray(root?.worldSpawn) ? root.worldSpawn : [0, 0, 0]);

const col = (v) => Math.floor(v / 16);
const TILE_SIM = ["furnaces", "hoppers", "brewing"], TILE_DATA = ["dispensers", "chests"];
const tileCols = (map) => Object.keys(map ?? {}).map((k) => { const [x, , z] = k.split(",").map(Number); return [col(x), col(z)]; });

// The spawn-area columns that hold anything an away run advances: scheduled ticks, falling blocks, redstone state, tile entities.
// Returns [[cx, cz]] nearest the spawn first, with the halo, capped at MAX_COLUMNS. [] when there is no work.
export function stateColumns(root) {
  const spawn = spawnOf(root), work = new Map(), all = (list) => { for (const [cx, cz] of list) if (inSpawnArea(spawn, cx, cz)) work.set(key(cx, cz), [cx, cz]); };
  const xyz = (list) => (list ?? []).map((e) => [col(e.x ?? e[0]), col(e.z ?? e[2])]);
  const r = root.redstone ?? {};
  all(xyz(root.fluidTicks?.entries));
  all(xyz(root.fireTicks?.entries));
  all(xyz(root.fallingTicks?.entries));
  all(xyz(root.falling));
  all(xyz(r.pending)); all(xyz(r.deferred)); all(xyz(r.torches)); all(xyz(r.pistons));
  for (const list of r.events ?? []) all(xyz(list));
  all(xyz(root.pistons));
  // Entities (away-entities.js): the columns they stand in take part in the run, with the halo.
  all(xyz(root.drops)); all(xyz(root.xpOrbs)); all(xyz(root.tnt)); all(xyz(root.minecarts?.carts)); all(xyz(root.boats));
  for (const name of TILE_SIM) all(tileCols(root.player?.[name]));
  if (!work.size) return [];
  const out = new Map();
  for (const [cx, cz] of work.values()) for (let dx = -HALO; dx <= HALO; dx++) for (let dz = -HALO; dz <= HALO; dz++) {
    if (inSpawnArea(spawn, cx + dx, cz + dz)) out.set(key(cx + dx, cz + dz), [cx + dx, cz + dz]);
  }
  const dist = ([cx, cz]) => (cx * 16 + 8 - spawn[0]) ** 2 + (cz * 16 + 8 - spawn[2]) ** 2;
  return [...out.values()].sort((a, b) => dist(a) - dist(b)).slice(0, MAX_COLUMNS);
}

// Everything the main thread sends the worker: the world recipe, the column list is read separately (stored edits per column).
export function awayPlan(root, columns, ticks) {
  const tiles = {};
  for (const name of [...TILE_SIM, ...TILE_DATA]) tiles[name] = structuredClone(root.player?.[name] ?? {});
  return {
    seed: root.seed, biome: root.biome, generationVersion: root.generationVersion ?? 13, worldType: root.worldType, generatorOptions: root.generatorOptions ?? "",
    spawn: spawnOf(root), columns, ticks: Math.min(ticks | 0, MAX_AWAY_TICKS), editSequence: root.editSequence | 0,
    fluidTicks: root.fluidTicks, fireTicks: root.fireTicks, fallingTicks: root.fallingTicks, falling: root.falling ?? [],
    redstone: root.redstone, pistons: root.pistons, tiles, weather: root.weather,
    // The saved entity lists (the run returns them whole); mob riders keep their vehicles out of the run.
    entities: structuredClone({ drops: root.drops ?? [], xpOrbs: root.xpOrbs ?? [], tnt: root.tnt ?? [], minecarts: root.minecarts ?? null, boats: root.boats ?? [] }),
    ridden: (root.entities ?? []).map((m) => m?.riding).filter((r) => typeof r === "string"),
  };
}
