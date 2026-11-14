// Mob spawners ticking on the dedicated server (batch 63 mpnether3): MobSpawnerBaseLogic.updateSpawner for the Nether's blaze spawners (a fortress's throne room) and the Overworld's.
//
// The single-player logic is reused unchanged (mob-spawner.js `updateSpawner` through `MobSpawners.tick`, the hooks of `EntityWorld.spawnerHooks`: the nearby count, the spawn box, the
// canSpawnHere rules of every kind, SpawnData and riding chains). What the server adds is the player list: a spawner runs only while a player of ITS dimension is within the
// requiredPlayerRange (16) of its centre (World.getClosestPlayer of the spawner's own world), so the feet of that dimension's living players are passed.
// Tile entities tick after the entities (World.updateEntities), so the host calls this after the mobs' tick. A kind the server has no client copy for (SUPPORTED) is refused like any
// other port-side refusal: the rolls are spent and nothing spawns (b65: so is a SpawnData Riding mount of one, `chainSupported`). The effects go to the clients as `dispFx` events (below).
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';
import { liveCartSpawners, spawnerVehicle } from '../structure-simulation.js';
import { updateSpawner, spawnerType, boxesIntersect } from '../mob-spawner.js';
import { ridingChain } from '../spawner-riding.js';
import { importedMobType } from '../java-mobs.js';

// Batch 65 (mpspawners2). Natively (bytecode-read, agq / xu / mt / mp / oi): updateSpawner (agq.g) runs on the client world too, which draws one smoke and one flame at a random point of the
// block while a player is within 16 and spins the display mob; the server sends only (a) the tile description (S35 action 1, tile-sync.js), (b) `addBlockEvent(spawner, 1, 0)` after every timer reset
// (agq.j -> agq.a(1); the client's agq.b(1) sets ITS delay to minSpawnDelay: the delay value itself is not on the wire), sent to players within 64 blocks of the same dimension (mt.c(IIILaji;II): sendToAllNear 64.0),
// (c) `playAuxSFX(2004, x, y, z, 0)` after a spawn (mp.a(yz, IIIII): sendToAllNearExcept 64.0, strict 3-D distance, same dimension), and (d) entity status 20 on the mob. A spawner minecart (xt/xu) sends no EntityId at all:
// its logic's a(int) is `world.setEntityState(cart, 1)` (S19 to the cart's trackers) and the client copy keeps the default Pig. Here these ride `dispFx` events (client-dispense.js): spawnerBurst, spawnerDelay, spawnerPuff.
const FX_RANGE_SQ = 64 * 64; // sendToAllNear 64.0 (squared)
const CART_RANGE = 80; // EntityTracker range of a minecart (server-vehicles.js RANGE)
// b67 mpsummon (bytecode-read mn.a(sa), the EntityTracker.addEntityToTracker table, and my.b(mw), updatePlayerEntity): a status (S19) goes to the entity's tracking players, and a player tracks
// when |dx| <= range and |dz| <= range (a square, inclusive, height ignored) from the tracker's own range: EntityMinecart (xl, so the spawner cart) 80, EntitySquid 64, the dragon 160 and
// every other IAnimals / IMob (the spawner's mobs) 80. The batch 65 circle of 64 blocks for the puff was wrong. (The server's view-distance clamp, 144 at the default 10, is not modelled.)
export const mobTrackRange = type => (type === 'squid' ? 64 : type === 'ender_dragon' ? 160 : 80);
const FX_CAP = 64;

// Every mob of a SpawnData Riding chain must be a kind the server keeps (a mount outside SUPPORTED would be a mob nobody can see). A vehicle id (minecart, boat) or an unmakeable id is not a mob kind here.
export function chainSupported(spawnData) {
  for (const { id } of ridingChain(spawnData?.props)) {
    const type = importedMobType(id) ?? spawnerType(id);
    if (type && !SUPPORTED.has(type)) return false;
  }
  return true;
}

// `mobs`: the dimension's ServerMobs. `spawners`: its MobSpawners. `players`: the server players of this dimension. `light`: { sky, block, thunder, thundering }, the dimension's reads.
// `vehicles`: the dimension's ServerVehicles (spawner minecarts tick here; a SpawnData Riding minecart or boat is made in it). Returns the mobs spawned.
export function tickSpawners({ mobs, spawners, random, players, light, time = 0, vehicles = null }) {
  const carts = liveCartSpawners(vehicles?.carts);
  if ((!spawners?.size && !carts.length) || !players.length) return [];
  const world = mobs.mobs, events = [], cartOf = new Map();
  for (const c of vehicles?.carts.carts ?? []) if (c.type === 4 && c.spawner) cartOf.set(c.spawner, c);
  const extraCollision = box => !!(vehicles?.all ?? []).some(v => !v.dead && v.bb && boxesIntersect(box, v.bb)); // carts and boats set preventEntitySpawning
  const hooks = world.spawnerHooks({ skyLight: light.sky, lightValue: light.block, thunderLightValue: light.thunder, thundering: light.thundering, limit: MOB_LIMIT, time, extraCollision,
    spawnVehicle: vehicles ? (id, tag, rider) => spawnerVehicle({ minecarts: vehicles.carts, boats: vehicles.boats }, id, tag, rider) : undefined });
  const create = hooks.createMob;
  const living = players.filter(p => !p.dead).map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z }));
  const ctx = {
    ...hooks, random, players: living,
    spawnParticles: (x, y, z) => events.push({ k: 'spawnerBurst', x, y, z }), // playAuxSFX 2004
    explosionParticles: mob => { const [w, h] = world.size(mob); events.push({ k: 'spawnerPuff', x: mob.x, y: mob.y, z: mob.z, w, h, sq: mobTrackRange(mob.type) }); }, // entity status 20 (spawnExplosionParticle)
  };
  const run = (s, key = null) => {
    const own = {
      ...ctx,
      // A kind the server has no client copy for, or a Riding mount of one, is refused: the rolls are spent and nothing spawns.
      createMob: (type, ...rest) => (SUPPORTED.has(type) && chainSupported(s.spawnData) ? create(type, ...rest) : null),
      blockEvent: key ? () => events.push({ k: 'spawnerDelay', x: s.x, y: s.y, z: s.z, v: key, sq: CART_RANGE }) : () => events.push({ k: 'spawnerDelay', x: s.x, y: s.y, z: s.z }), // addBlockEvent(1, 0) / setEntityState 1
    };
    return updateSpawner(s, own);
  };
  const out = [];
  for (const s of spawners?.values() ?? []) out.push(...run(s));
  for (const s of carts) { const c = cartOf.get(s); out.push(...run(s, c ? 'c' + c.id : null)); } // EntityMinecartMobSpawner.onUpdate: the cart moves, then its logic runs at its block
  world.noteMobSpawns?.(false); // the tile pass's spawns are reported like single player's (main.js)
  sendSpawnerFx(players, events, cartOf);
  return out;
}

// Queue the events on each player's `dispOut` (sent by server.js after the tick) as one `dispFx`: a block event or burst reaches players within 64 blocks, a minecart's or a mob's status the players its tracker holds (`sq`: the square range).
export function sendSpawnerFx(players, events, cartOf = null) {
  if (!events.length) return;
  for (const p of players) {
    const q = p.position, list = [];
    for (const e of events) {
      const dx = e.x - q.x, dz = e.z - q.z, dy = e.y - q.y;
      const sq = e.sq ?? (e.v ? CART_RANGE : 0);
      if (sq ? Math.abs(dx) <= sq && Math.abs(dz) <= sq : dx * dx + dy * dy + dz * dz < FX_RANGE_SQ) list.push(e);
    }
    if (list.length) (p.dispOut ??= []).push({ type: 'dispFx', events: list.slice(0, FX_CAP) });
  }
}

// The Overworld's reads: the light volume with the sky's darkness, the sky light itself and the weather's thunder.
export function overworldLight(sim) {
  return { sky: (x, y, z) => sim.light.skyAt(x, y, z), block: (x, y, z) => sim.light.level(x, y, z, sim.darkness), thunder: (x, y, z) => sim.light.level(x, y, z, 10), thundering: () => sim.weather.isThundering() };
}
// The Nether has no sky and no weather: block light only.
export function netherLight(n) {
  return { sky: () => 0, block: (x, y, z) => n.light.level(x, y, z, 0), thunder: (x, y, z) => n.light.level(x, y, z, 0), thundering: () => false };
}
