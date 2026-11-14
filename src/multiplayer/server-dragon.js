// Batch 64 mpdragon: the Ender Dragon and the End crystals on the dedicated server.
// Single player's dragon (dragon.js rules, dragon-mobs.js adapter, ender-crystal-mobs.js) already runs inside the EntityWorld each ServerMobs wraps, so this module adds what a server needs:
//   * The kinds (`DRAGON_KINDS`) join ServerMobs' SUPPORTED set, so the End's mob list keeps them, saves them and the trackers send them (S0F / S1C health, the copies are client-side).
//   * `installServerDragon(sm)`: the dragon reads EVERY player of its world (`mobs.dragonViews`): its targets (EntityDragon.setNewTarget: rand.nextInt(2) == 0, a random entry of
//     World.playerEntities), the wing sweep, the head's hit and the push all see each player in the End, not only the nearest.
//   * `setupEnd(n, source, fresh)`: ChunkProviderEnd.populate on the End's first generation: the crystals of the spikes inside the window, then the dragon at (0, 128, 0) with a random
//     heading, in the window's shifted coordinates. The fight is centred on the middle of the End (host.center) and the exit portal the dying dragon builds is kept inside the window.
//   * `dragonReach` / `dragonState`: the C02 attack on a dragon is tested against its seven parts; the state saved with the End is `dragon: 'alive' | 'dead'`.
// Evidence: the rules are single player's (verified against the original in dragon-reference.json, b49-b56 notes); the multi-player parts (a random entry of the player list, every player in the
// wing sweep) are bytecode-read in b45 (`xa.bQ`: World.playerEntities, `xa.a(List)`: getEntitiesWithinAABB). That the 1.7.10 jar keeps no per-player aggro for the dragon is recalled.
import { ENDER_DRAGON, spawnDragonIfAbsent, dragonHit } from '../dragon-mobs.js';
import { ENDER_CRYSTAL } from '../ender-crystal-mobs.js';
import { PHYSICS } from '../world.js';
import { END_OFFSET } from './client-dimensions.js'; // the 0.93.0 window's offset: END_CENTRE below stays its centre

export const DRAGON_KINDS = [ENDER_DRAGON, ENDER_CRYSTAL];
const PORTAL_MARGIN = 6; // the exit portal is 9 wide (radius 4): keep its disc inside the window
export const END_CENTRE = Object.freeze({ x: END_OFFSET.x, z: END_OFFSET.z }); // the native origin (0, 0) in the 0.93.0 window
// b65 mpendwindow: the native origin (0, 0) in a world's own window, and the chunk window it holds (native chunk coordinates).
export const centreOf = world => ({ x: -world.originX, z: -world.originZ });
export const windowOf = world => ({ cx0: Math.floor(world.originX / 16), cx1: Math.floor((world.size - 1 + world.originX) / 16), cz0: Math.floor(world.originZ / 16), cz1: Math.floor((world.size - 1 + world.originZ) / 16) });

// Called by ServerMobs' constructor, once per dimension's instance.
export function installServerDragon(sm) {
  const mobs = sm.mobs;
  mobs.dragonViews = () => {
    const out = [];
    for (const v of sm.views.values()) {
      const p = v.player, q = p.position;
      out.push({ x: q.x, y: q.y, z: q.z, survival: v.survival, push: (x, y, z) => { p.velocity.x += x; p.velocity.y += y; p.velocity.z += z; } });
    }
    return out;
  };
  // b64 lead: EntityDragon.func_82195_e is super.attackEntityFrom, so the blow that takes the last health runs EntityLivingBase.onDeath (recalled from the 1.7.10 source; the dragon's
  // dropFewItems is empty and its orbs come from onDeathUpdate). The adapter (dragon-mobs.js) skips the base attackEntityFrom, so this calls the server's onDeath chain for that blow:
  // onKillEntity (killEnemy, the dragon is an IMob) and addToPlayerScore (mobKills, then the scoreboard's totalKillCount) for the attacker of the moment.
  const hit = mobs.attackEntityFrom;
  mobs.attackEntityFrom = function (e, amount, source = {}) {
    const was = e?.type === ENDER_DRAGON ? e.health : 0, result = hit.call(this, e, amount, source);
    if (was > 0 && e.health <= 0) this.onDeath(e, source);
    return result;
  };
}


// The End's dragon part. `n` is the End's state ({ world, mobs: ServerMobs }); `source` the DimensionWorld the terrain came from; `fresh` is true for an End nobody saved yet.
export function setupEnd(n, source, fresh) {
  const mobs = n.mobs.mobs, world = n.world, size = world.size, centre = centreOf(world);
  mobs.dragonCenter = centre;
  mobs.dragonPortalAt = (x, z) => [Math.max(PORTAL_MARGIN, Math.min(size - 1 - PORTAL_MARGIN, x)), Math.max(PORTAL_MARGIN, Math.min(size - 1 - PORTAL_MARGIN, z))];
  if (!fresh) return;
  addEndCrystals(n, source);
  spawnDragonIfAbsent(n.world, mobs, Math.random, centre);
}

// The crystals of the spikes inside the world's window (a spike's chunk population), except the native keys `skip` (b66 mpend3: an upgraded End's crystals that exist or were destroyed).
export function addEndCrystals(n, source, skip = null) {
  const mobs = n.mobs.mobs, world = n.world, size = world.size;
  for (const c of source.endCrystals(10, windowOf(world))) {
    const x = c.x - world.originX, z = c.z - world.originZ;
    if (x < 1 || x >= size - 1 || z < 1 || z >= size - 1) continue; // a crystal on the cut-off edge has no pillar here
    if (skip?.has(`${c.x},${c.z}`)) continue;
    const e = mobs.create(ENDER_CRYSTAL, x, c.y, z);
    e.yaw = (-c.yaw * Math.PI) / 180;
    mobs.entities.push(e);
  }
}

// b66 mpend3: the native keys of the crystals a 0.93.0 End (128 window) made at its first load; an upgrade adds the others.
export function legacyCrystalKeys(source) {
  const old = { originX: -END_OFFSET.x, originZ: -END_OFFSET.z, size: 128 }, keys = new Set();
  for (const c of source.endCrystals(10, windowOf(old))) {
    const x = c.x - old.originX, z = c.z - old.originZ;
    if (x >= 1 && x < 127 && z >= 1 && z < 127) keys.add(`${c.x},${c.z}`);
  }
  return keys;
}

// What the End saves about the fight: a dragon (even one dying) is 'alive', none is 'dead' (its exit portal and egg are edits of the world).
export const dragonState = n => n.mobs.mobs.entities.some(e => e.type === ENDER_DRAGON && !e.dragonGone) ? 'alive' : 'dead';

// C02 on the dragon: the 3 block survival reach is the client's aim; the server allows 6 like every other mob (a little over the Creative reach). The ray of the player's look
// picks the part (EntityDragonPart is the collidable entity); a ray that just misses (the client aimed a tick ago) takes the nearest part within 6 blocks of the eye.
export function dragonReach(p, e) {
  const s = e.dragon;
  if (!s?.parts) return false;
  const eye = { x: p.position.x, y: p.position.y + PHYSICS.eye, z: p.position.z };
  const dir = { x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
  if (dragonHit(eye, dir, e, 6) !== null) return true; // sets lastPart
  let best = -1, bd = 36;
  s.parts.forEach((part, i) => {
    const b = part.box, dx = Math.max(b[0] - eye.x, 0, eye.x - b[3]), dy = Math.max(b[1] - eye.y, 0, eye.y - b[4]), dz = Math.max(b[2] - eye.z, 0, eye.z - b[5]), d = dx * dx + dy * dy + dz * dz;
    if (d <= bd) { bd = d; best = i; }
  });
  if (best < 0) return false;
  s.lastPart = best;
  return true;
}
