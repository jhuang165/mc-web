// The fishing rod on the gun server (not 1.7.10 networking): each player owns one single-player Fishing runtime
// (fishing-simulation.js: EntityFishHook and ItemFishingRod.onItemRightClick), cast and reeled by the use button and ticked with
// the world. Its splashes and bubbles reach nearby tabs as particle lists; its bobber's position is in every tab's presence
// (RenderFish draws it and the line from the angler's rod). Catches drop as server items with their orbs.
import { Fishing } from '../fishing-simulation.js';
import { FISHING_ROD } from '../fishing-content.js';
import { mobTargets, thrownHit } from '../projectiles.js';
import { canLightningStrikeAt, canSeeSky } from '../weather.js';
import { JavaRandom } from '../java-random.js';
import { PHYSICS } from '../world.js';

const r3 = v => Math.round(v * 1000) / 1000;
// Item.itemRand, the static Random of every Item (the cast's random.bow pitch).
const itemRand = new JavaRandom(Math.floor(Math.random() * 2 ** 48));

export const fishingOf = p => (p.fishing ??= new Fishing());

// What the hook reads and does for player p (main.js fishingHost on the server's state). `fx` collects this tick's particles.
export function fishingHost(sim, p, particles = []) {
  const mobs = sim.mobs, ew = mobs?.ew ?? null, position = p.position;
  return {
    world: sim.world, position, yaw: p.yaw, pitch: p.pitch, survival: p.survival, mobs: ew, itemRand, worldRand: sim.weather.random,
    fx: { spawn: (name, x, y, z, vx, vy, vz) => { if (particles.length < 128) particles.push([name, r3(x), r3(y), r3(z), r3(vx), r3(vy), r3(vz)]); } },
    canLightningStrike: (x, y, z) => canLightningStrikeAt(sim.weather, sim.world, x, y, z),
    canSeeSky: (x, y, z) => canSeeSky(sim.world, x, y, z),
    sound: (name, volume, pitch, hook) => mobs?.sound({ sound: name, volume, pitch, position: hook ? { x: hook.x, y: hook.y, z: hook.z } : { x: position.x, y: position.y, z: position.z } }),
    targets: () => mobTargets(ew?.entities ?? [], position, PHYSICS.width, PHYSICS.height),
    hit: e => !!ew && thrownHit(ew, e, position),
    pull: (e, [dx, dy, dz]) => { if (Number.isFinite(e.vx)) { e.vx += dx; e.vy += dy; e.vz += dz; } },
    drop: (stack, x, y, z, motion) => sim.play.items.spawn(stack, x, y, z, { motion }),
    orb: n => mobs?.orbs.spawn(n, { x: position.x, y: position.y + 0.5, z: position.z + 0.5 }),
    wear: n => { if (!p.survival.creative) p.survival.wear(FISHING_ROD, n); },
  };
}
function flush(sim, p, particles) {
  if (particles.length) sim.near(p, { type: 'fx', kind: 'particles', list: particles }, true);
}
// ItemFishingRod.onItemRightClick (the edit's useFishingRod hook): 'cast', 'reel' or null.
export function useRod(sim, p) {
  const particles = [], used = fishingOf(p).use(fishingHost(sim, p, particles));
  flush(sim, p, particles);
  return used;
}
// EntityFishHook.onUpdate for every player's hook (it dies when its angler stops holding the rod, dies or goes too far).
export function tickFishing(sim) {
  for (const p of sim.players.values()) {
    const f = p.fishing;
    if (!f?.hook) continue;
    if (p.dead) { f.clear(); continue; }
    const particles = [];
    f.tick(fishingHost(sim, p, particles));
    f.events.length = 0; // the single-player statistics; this server keeps none
    flush(sim, p, particles);
  }
}
// The hook gone without a catch (a respawn, a teleport, leaving).
export function dropHook(p) { p.fishing?.clear(); }
// Player p's bobber for the presence ([x, y, z]), or null.
export function hookOf(p) {
  const h = p.fishing?.active ? p.fishing.hook : null;
  return h ? [r3(h.x), r3(h.y), r3(h.z)] : null;
}
