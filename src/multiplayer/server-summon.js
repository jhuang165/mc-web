// Batch 67 mpsummon: /summon on the dedicated server (CommandSummon, bu, level 2).
//
// The single-player implementation is reused, not copied: command-host.js `summon` (the data tag merge, Riding chains, onSpawnWithEgg only without a tag, one creation path per
// EntityList name) runs over an `env` made of this server's live systems, inside the sender's dimension (ServerDimensions.within: sim.mobs, vehicles, dispense, falling, items and the
// orbs are that dimension's). The messages (usage, outOfWorld, failed, success) are commands.js's.
// Routing: mobs go through ServerMobs' EntityWorld (restore / spawnNatural; ServerMobs.track sends them), minecarts (spawner cart included) and boats through the dimension's
// ServerVehicles, arrows / snowballs / pearls / potions / eyes through ServerProjectiles (`adopt` adds the one entity, so a live ghast ball or arrow keeps its owner and id), blaze and
// ghast fireballs and wither skulls into the mobs' own Fireballs, primed TNT into the dispenser's `primed`, falling blocks into the dimension's FallingBlocks, items and orbs into the
// dimension's lists (an orb takes a world entity id), rockets into the dispenser's FireworkRockets.
// A kind the server cannot keep is a failed creation (`commands.summon.failed`, also as a Riding mount, which ends the chain): the mobs outside SUPPORTED (the giant); paintings, item frames and leash knots are kept by server-hanging.js since batch 68 (mppaintings).
// Coordinates are native (b68 summon2): `~` starts from the sender's native position and the End's origin maps them into the shifted window; the "out of world" refusal tests the mapped cell.
// No mob cap: native /summon creates past the natural spawn limit (the b67 MOB_LIMIT refusal is gone; the new mobs carry summonKeep so ServerMobs' cull leaves them).
import { createCommandHost } from '../command-host.js';
import { SUMMONABLE } from '../commands.js';
import { entityIdOfSummon } from '../entity-summon.js';
import { cartTypeOfSummon } from '../cart-summon.js';
import { SUPPORTED } from './server-mobs.js';
import { Projectiles } from '../projectiles.js';
import { Arrows } from '../bow.js';
import { WitchPotions } from '../witch-potions.js';
import { EyesOfEnder } from '../eye-of-ender-live.js';
import { JavaRandom } from '../java-random.js';

// b68 summon2: the native World a command position belongs to: End windows are stored shifted (native = local + origin), the Overworld and the Nether (no scaling in the world itself) are 0.
export const nativeOrigin = world => ({ x: world?.originX ?? 0, z: world?.originZ ?? 0 });
export const toLocal = (world, x, z) => { const o = nativeOrigin(world); return [x - o.x, z - o.z]; };
export const toNative = (world, x, z) => { const o = nativeOrigin(world); return [x + o.x, z + o.z]; };
// Extra hosts by kind: push `(sim, player, dim, world) => ({ <host>: ... })` here (b68 summon2); mppaintings sets `hanging` on the hosts directly.
export const SUMMON_HOSTS = [];
// b69 mpfixes69: the absolute coordinate tags of a /summon data tag are native too (the End window is shifted): TileX/TileZ of a painting or frame, the Leash compound's X/Z of a mob (the knot's block),
// and xTile/zTile (the block an arrow, ball or fireball sticks in; -1 is unset). Y is not shifted. Pos is replaced by the command position, so it needs no mapping. The Riding chain is walked.
// Returns a copy with the tags in the stored window's coordinates (the tag is returned as is when the origin is 0: Overworld and Nether).
const shiftNum = (t, d, floor = -Infinity) => { if (t && typeof t.value === 'number') t.value = Math.max(floor, t.value - d); };
export function tagToLocal(tag, ox, oz) {
  if (!tag || (!ox && !oz)) return tag;
  const copy = structuredClone(tag);
  for (let t = copy; t instanceof Map; t = t.get('Riding')?.value) {
    shiftNum(t.get('TileX'), ox); shiftNum(t.get('TileZ'), oz);
    const leash = t.get('Leash')?.value;
    if (leash instanceof Map) { shiftNum(leash.get('X'), ox); shiftNum(leash.get('Z'), oz); }
    for (const [k, d] of [['xTile', ox], ['zTile', oz]]) { const v = t.get(k); if (v && v.value >= 0) shiftNum(v, d, -1); }
  }
  return copy;
}
export const UNKEPT_ENTITIES = new Set([]); // b68 mppaintings: paintings, item frames and leash knots are kept now (server-hanging.js)

// Adds one converted projectile record (java-projectiles.js) to the live list of `d`, the dimension's ServerProjectiles. Returns false when the list is not kept here.
export function adoptProjectile(sim, d, mobs, dim, list, record) {
  if (list === 'projectiles') { const s = new Projectiles(Math.random); s.load([record]); if (!s.balls[0]) return false; d.balls.balls.push(s.balls[0]); return true; }
  if (list === 'arrows') { const s = new Arrows(Math.random); s.load([record]); if (!s.list[0]) return false; d.arrows.list.push(s.list[0]); return true; }
  if (list === 'thrownPotions') {
    const s = new WitchPotions(mobs); s.load([record]);
    if (!s.projectiles.balls[0]) return false;
    d.potionsOf(d).projectiles.balls.push(s.projectiles.balls[0]);
    return true;
  }
  if (list === 'fireballs') {
    const holder = record.kind === 'witherSkull' ? mobs.skulls : mobs.fireballs, ok = Number.isFinite;
    if (!holder || !holder.accepts(record.kind)) return false;
    const ball = holder.build({ ...record, ax: ok(record.ax) ? record.ax : 0, ay: ok(record.ay) ? record.ay : 0, az: ok(record.az) ? record.az : 0 });
    if (ok(record.ticks)) ball.ticks = Math.max(0, record.ticks | 0);
    if (record.blue === true) ball.blue = true;
    holder.list.push(ball);
    return true;
  }
  if (list === 'eyes') {
    const s = new EyesOfEnder(new JavaRandom(1n)); s.load({ eyes: [record] });
    if (!s.eyes[0]) return false;
    d.eyeSystem.system.eyes.push(s.eyes[0]);
    return true;
  }
  return false;
}

// The host properties /summon needs (`inWorld`, `summon`) for the player `p`, who is the sender (the dimension and the position). Merge them into the command host.
export function summonHost(sim, p) {
  const dim = p.dimension | 0, dims = sim.dimensions;
  const run = fn => (dim && dims ? dims.within(p, fn) : fn());
  const worldNow = () => sim.world; // inside `run` this is the sender's dimension
  const refuses = type => {
    const mobs = sim.mobs?.mobs;
    if (!mobs) return true;
    const entity = entityIdOfSummon(type);
    if (entity) return UNKEPT_ENTITIES.has(entity) || (entity === 'Boat' && !sim.vehicles);
    if (cartTypeOfSummon(type) !== null) return !sim.vehicles;
    if (type === 'firework_rocket') return !sim.dispense?.rockets;
    return !SUPPORTED.has(type); // b68 summon2: no mob cap (native /summon ignores the natural spawn limit; summonKeep below keeps the tick's cull off the new mobs)
  };
  // b68 summon2: the command's coordinates are native (End: local + origin); the world stores local ones.
  const originOf = () => run(() => nativeOrigin(worldNow()));
  return {
    summonPosition: () => { const o = originOf(); return { x: p.position.x + o.x, y: p.position.y, z: p.position.z + o.z }; },
    inWorld: (x, y, z) => run(() => { const w = worldNow(), [lx, lz] = toLocal(w, x, z); return y >= 0 && y < 256 && w.inside(Math.floor(lx), Math.floor(y), Math.floor(lz)); }),
    summon: (type, nx, y, nz, tag) => run(() => {
      const w = worldNow(), [x, z] = toLocal(w, nx, nz); // the entity is made at its local place
      const mobs = sim.mobs.mobs, d = sim.dispense, xp = sim.serverItems.xp;
      d.hook?.(); // the witch's potion lane and the skeleton's bow are wired on first use
      const orbs = { get orbs() { return { push: o => { if (xp.ids) o.id = xp.ids.take(); xp.orbs.push(o); xp.joined?.(o); } }; } };
      const hosts = {
        items: sim.items, xpOrbs: orbs, primed: d.primed, falling: sim.falling, boats: sim.vehicles?.boats, projectiles: d.balls, arrows: d.arrows, mobs, eyes: null, hanging: sim.vehicles?.hanging?.h ?? null /* b68 mppaintings: the dimension's Hanging */, dimension: dim,
        adopt: (list, record) => adoptProjectile(sim, d, mobs, dim, list, record),
      };
      for (const extra of SUMMON_HOSTS) Object.assign(hosts, extra(sim, p, dim, w)); // b68 summon2: the hook of mppaintings (hanging entities)
      const env = {
        mobs: () => mobs, minecarts: () => sim.vehicles?.carts, rockets: () => d.rockets, entityHosts: () => hosts, changed() {},
        summonRefuses: refuses,
      };
      const before = new Set(mobs.entities);
      const result = createCommandHost(env).summon(type, x, y, z, tagToLocal(tag, nativeOrigin(w).x, nativeOrigin(w).z)); // b69 mpfixes69: the tag's absolute coordinates map like the position
      for (const e of mobs.entities) if (!before.has(e)) e.summonKeep = true; // native /summon ignores the mob cap: the tick's cull (server-mobs.js) skips these
      return result;
    }),
  };
}
export { SUMMONABLE };
