// Mob spawners ticking on the dedicated server (batch 63 mpnether3): MobSpawnerBaseLogic.updateSpawner for the Nether's blaze spawners (a fortress's throne room) and the Overworld's.
//
// The single-player logic is reused unchanged (mob-spawner.js `updateSpawner` through `MobSpawners.tick`, the hooks of `EntityWorld.spawnerHooks`: the nearby count, the spawn box, the
// canSpawnHere rules of every kind, SpawnData and riding chains). What the server adds is the player list: a spawner runs only while a player of ITS dimension is within the
// requiredPlayerRange (16) of its centre (World.getClosestPlayer of the spawner's own world), so the feet of that dimension's living players are passed.
// Tile entities tick after the entities (World.updateEntities), so the host calls this after the mobs' tick. A kind the server has no client copy for (SUPPORTED) is refused like any
// other port-side refusal: the rolls are spent and nothing spawns (a SpawnData Riding mount is not checked: custom spawners only). The spawn smoke and flame (RenderGlobal.playAuxSFX 2004) is client-only and not sent.
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';

// `mobs`: the dimension's ServerMobs. `spawners`: its MobSpawners. `players`: the server players of this dimension. `light`: { sky, block, thunder, thundering }, the dimension's reads.
// Returns the mobs spawned.
export function tickSpawners({ mobs, spawners, random, players, light, time = 0 }) {
  if (!spawners?.size || !players.length) return [];
  const world = mobs.mobs;
  const hooks = world.spawnerHooks({ skyLight: light.sky, lightValue: light.block, thunderLightValue: light.thunder, thundering: light.thundering, limit: MOB_LIMIT, time });
  const create = hooks.createMob;
  const ctx = {
    ...hooks, random,
    createMob: (type, ...rest) => (SUPPORTED.has(type) ? create(type, ...rest) : null),
    players: players.filter(p => !p.dead).map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z })),
  };
  const out = spawners.tick(ctx);
  world.noteMobSpawns?.(false); // the tile pass's spawns are reported like single player's (main.js)
  return out;
}

// The Overworld's reads: the light volume with the sky's darkness, the sky light itself and the weather's thunder.
export function overworldLight(sim) {
  return { sky: (x, y, z) => sim.light.skyAt(x, y, z), block: (x, y, z) => sim.light.level(x, y, z, sim.darkness), thunder: (x, y, z) => sim.light.level(x, y, z, 10), thundering: () => sim.weather.isThundering() };
}
// The Nether has no sky and no weather: block light only.
export function netherLight(n) {
  return { sky: () => 0, block: (x, y, z) => n.light.level(x, y, z, 0), thunder: (x, y, z) => n.light.level(x, y, z, 0), thundering: () => false };
}
