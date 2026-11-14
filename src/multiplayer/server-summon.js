// Batch 67 mpsummon: /summon on the dedicated server (CommandSummon, bu, level 2).
//
// The single-player implementation is reused, not copied: command-host.js `summon` (the data tag merge, Riding chains, onSpawnWithEgg only without a tag, one creation path per
// EntityList name) runs over an `env` made of this server's live systems, inside the sender's dimension (ServerDimensions.within: sim.mobs, vehicles, dispense, falling, items and the
// orbs are that dimension's). The messages (usage, outOfWorld, failed, success) are commands.js's.
// Routing: mobs go through ServerMobs' EntityWorld (restore / spawnNatural; ServerMobs.track sends them), minecarts (spawner cart included) and boats through the dimension's
// ServerVehicles, arrows / snowballs / pearls / potions / eyes through ServerProjectiles (`adopt` adds the one entity, so a live ghast ball or arrow keeps its owner and id), blaze and
// ghast fireballs and wither skulls into the mobs' own Fireballs, primed TNT into the dispenser's `primed`, falling blocks into the dimension's FallingBlocks, items and orbs into the
// dimension's lists (an orb takes a world entity id), rockets into the dispenser's FireworkRockets.
// A kind the server cannot keep is a failed creation (`commands.summon.failed`, also as a Riding mount, which ends the chain): the mobs outside SUPPORTED (the giant), a full world
// (MOB_LIMIT), (paintings, item frames and leash knots are kept by server-hanging.js since batch 68).
// Coordinates are the server's own local ones, as /tp uses them (the Nether is not scaled; the End window's local origin is not added).
import { createCommandHost } from '../command-host.js';
import { SUMMONABLE } from '../commands.js';
import { entityIdOfSummon } from '../entity-summon.js';
import { cartTypeOfSummon } from '../cart-summon.js';
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';
import { Projectiles } from '../projectiles.js';
import { Arrows } from '../bow.js';
import { WitchPotions } from '../witch-potions.js';
import { EyesOfEnder } from '../eye-of-ender-live.js';
import { JavaRandom } from '../java-random.js';

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
    return !SUPPORTED.has(type) || mobs.entities.length >= MOB_LIMIT;
  };
  return {
    inWorld: (x, y, z) => run(() => { const w = worldNow(); return y >= 0 && y < 256 && w.inside(Math.floor(x), Math.floor(y), Math.floor(z)); }),
    summon: (type, x, y, z, tag) => run(() => {
      const mobs = sim.mobs.mobs, d = sim.dispense, xp = sim.serverItems.xp;
      d.hook?.(); // the witch's potion lane and the skeleton's bow are wired on first use
      const orbs = { get orbs() { return { push: o => { if (xp.ids) o.id = xp.ids.take(); xp.orbs.push(o); xp.joined?.(o); } }; } };
      const hosts = {
        items: sim.items, xpOrbs: orbs, primed: d.primed, falling: sim.falling, boats: sim.vehicles?.boats, projectiles: d.balls, arrows: d.arrows, mobs, eyes: null, hanging: sim.vehicles?.hanging?.h ?? null /* b68 mppaintings: the dimension's Hanging */, dimension: dim,
        adopt: (list, record) => adoptProjectile(sim, d, mobs, dim, list, record),
      };
      const env = {
        mobs: () => mobs, minecarts: () => sim.vehicles?.carts, rockets: () => d.rockets, entityHosts: () => hosts, changed() {},
        summonRefuses: refuses,
      };
      const result = createCommandHost(env).summon(type, x, y, z, tag);
      return result;
    }),
  };
}
export { SUMMONABLE };
