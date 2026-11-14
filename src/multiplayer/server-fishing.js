// Batch 64 mpstats2: the fishing rod on the dedicated server (ItemFishingRod.onItemRightClick, EntityFishHook).
//
// The single-player runtime (src/fishing-simulation.js `Fishing`, src/fishing.js `FishHook`: casting, the bite timers, Luck of the Sea / Lure, the loot tables, reeling in, hooked mobs)
// runs once per player here; this module only supplies the server `host` it asks for. A C08 use with the rod held (and no block or entity used) casts or reels in
// (`use(p)`, from ServerSimulation.edit). The hook is an entity of the angler's dimension: it is ticked inside that dimension (`dimensions.within`), and the players of that
// dimension within range are told about it each tick.
//
// Wire (server -> client, queued on `p.dispOut` like dispEnts):
//   { type: 'fishHooks', hooks: [{ o: anglerId, i: entityId, x, y, z }] }   the bobbers near this player (an empty list once, to clear them). The client draws bobber and line (client-fishing.js).
//   { type: 'fishFx', events: [{ n: 'splash'|'bubble', x, y, z, vx, vy, vz }] }   one-shot particles (EntityFishHook's WorldServer.func_147487_a; the wake has no browser particle).
// Sounds go through sim.soundsOut (S29). Loot, XP orb (1-6 at the angler's feet + 0.5), rod wear (1 for a bite, 3 for a pulled mob, +2 on the ground; none in Creative)
// and the fishCaught / junkFished / treasureFished statistics follow the single-player rules. Hooks are not saved (EntityFishHook has no entity-list name, so a native
// server drops it on a restart), and one dies with a dimension change, the angler's death, leaving or putting the rod away.
import { Fishing } from '../fishing-simulation.js';
import { FISHING_ROD } from '../fishing-content.js';
import { liveFishStack } from '../fishing-loot.js';
import { mobTargets, thrownHit } from '../projectiles.js';
import { canSeeSky, canLightningStrikeAt } from '../weather.js';
import { PHYSICS } from '../world.js';

export const FISH_NEAR = 64 * 64; // EntityTracker range of a fish hook: 64 blocks
export const FX_NEAR = 32 * 32;
const f = Math.fround;

export class ServerFishing {
  constructor(sim) { this.sim = sim; this.byPlayer = new Map(); this.fx = []; this.sent = new Set(); }
  has(p) { return !!this.byPlayer.get(p.id)?.active; }
  hookOf(p) { const fishing = this.byPlayer.get(p.id); return fishing?.active ? fishing.hook : null; }
  drop(p) { this.byPlayer.delete(p.id); }

  // What EntityFishHook / ItemFishingRod need from the running server, for player `p` in the current (swapped) dimension.
  host(p) {
    const sim = this.sim, dim = p.dimension | 0, mobs = sim.mobs?.mobs, s = p.survival;
    const at = (x, y, z) => ({ x, y, z });
    return {
      world: sim.world, position: p.position, yaw: p.yaw, pitch: p.pitch, survival: s, mobs, itemRand: p.rand, worldRand: sim.weather.random,
      fx: { spawn: (name, x, y, z, vx, vy, vz) => this.fx.push({ n: name, x, y, z, vx, vy, vz, dim }) },
      canLightningStrike: (x, y, z) => canLightningStrikeAt(sim.weather, sim.world, x, y, z),
      canSeeSky: (x, y, z) => canSeeSky(sim.world, x, y, z),
      // World.playSoundAtEntity: heard by everyone near, the angler included
      sound: (name, volume, pitch, hook) => sim.soundsOut.push({ name, ...(hook ? at(hook.x, hook.y, hook.z) : at(p.position.x, p.position.y, p.position.z)), volume, pitch, except: null, dim }),
      targets: () => [...mobTargets(mobs?.entities ?? [], p.position, PHYSICS.width, PHYSICS.height), ...sim.sleep.fishTargets(p)], // b66 mpsleep: the other players are collidable too
      hitPlayer: q => sim.sleep.fishHit(p, q), // b66 mpsleep: a zero-damage hit wakes a sleeper (EntityPlayer.attackEntityFrom)
      // EntityFishHook's collision calls attackEntityFrom(causeThrownDamage(hook, angler), 0): a mob takes the 0-damage hit and the angler is its attacker
      hit: e => { let hit = false; sim.dispense.credit(p, () => { hit = thrownHit(mobs, e, p.position); }); return hit; },
      pull: (e, [dx, dy, dz]) => { if (Number.isFinite(e.vx)) { e.vx += dx; e.vy += dy; e.vz += dz; } },
      drop: (stack, x, y, z, motion) => { const live = liveFishStack(stack); if (live) sim.items.spawn(live, x, y, z, { motion }); },
      orb: n => sim.serverItems.xp.spawn(n, { x: p.position.x, y: p.position.y + 0.5, z: p.position.z + 0.5 }),
      wear: n => { if (!s.creative) s.wear(FISHING_ROD, n); }, // a rod that runs out sets s.broken, which ServerSurvival.settle turns into the break stat
    };
  }
  fishingOf(p) {
    let fishing = this.byPlayer.get(p.id);
    if (!fishing) { const ids = this.sim.mobs?.mobs?.ids; fishing = new Fishing(); fishing.ids = ids ?? { next: 1, take() { return this.next++; } }; this.byPlayer.set(p.id, fishing); }
    return fishing;
  }
  // The C08 use with the rod in hand. Returns true when the click was the rod's (cast or reel), whatever the result.
  use(p) {
    if (p.dead || !p.survival || p.survival.health <= 0 || (p.survival.held?.id ?? 0) !== FISHING_ROD) return false;
    const fishing = this.fishingOf(p);
    fishing.dimension = p.dimension | 0;
    fishing.use(this.host(p));
    this.settle(p, fishing);
    p.swing = 6;
    return true;
  }
  settle(p, fishing) { p.statsLive?.fishing(fishing); fishing.events.length = 0; }

  // Once per server tick (after the mobs): every hook runs inside its angler's dimension.
  tick() {
    for (const [id, fishing] of [...this.byPlayer]) {
      const p = this.sim.players.get(id);
      if (!p || !fishing.hook) { if (!p) this.byPlayer.delete(id); continue; }
      if ((p.dimension | 0) !== fishing.dimension) { this.byPlayer.delete(id); continue; } // the hook stays in the old world and is gone with the trip
      this.sim.dimensions.within(p, () => fishing.tick(this.host(p)));
      this.settle(p, fishing);
      if (!fishing.hook) this.byPlayer.delete(id);
    }
  }
  // Tail of the tick: queue fishHooks / fishFx for each player of the hook's dimension.
  flush() {
    const hooks = [];
    for (const [id, fishing] of this.byPlayer) if (fishing.active) { const h = fishing.hook; hooks.push({ o: id, i: h.entityId, x: h.x, y: h.y, z: h.z, dim: fishing.dimension }); }
    const fx = this.fx.splice(0), now = new Set();
    for (const p of this.sim.players.values()) {
      const dim = p.dimension | 0, q = p.position, msgs = p.dispOut ??= [];
      const list = hooks.filter(h => h.dim === dim && (h.x - q.x) ** 2 + (h.z - q.z) ** 2 < FISH_NEAR).map(({ dim: _d, ...h }) => h);
      if (list.length) { msgs.push({ type: 'fishHooks', hooks: list }); now.add(p.id); } else if (this.sent.has(p.id)) msgs.push({ type: 'fishHooks', hooks: [] });
      const events = fx.filter(e => e.dim === dim && (e.x - q.x) ** 2 + (e.z - q.z) ** 2 < FX_NEAR).slice(0, 64).map(({ dim: _d, ...e }) => e);
      if (events.length) msgs.push({ type: 'fishFx', events });
    }
    this.sent = now;
  }
}
