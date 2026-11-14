// Batch 66 mplightning: thunderstorm lightning on the dedicated server.
//
// What already ran on the server: `sim.weather` is a Weather, and Weather.tick rolls WorldServer.func_147456_g's lightning (per chunk nextInt(100000) while thundering, updateLCG,
// the precipitation-height column, canLightningStrikeAt: bytecode-read mt.class) and makes an EntityLightningBolt (LightningBolt in weather.js) whose constructor places the fire
// through `weather.fire` (fire.js boltStart: difficulty >= 2 and doFireTick). Nothing used the bolt: no damage, no pig / creeper change, no packet. This module adds those.
//
//   * Fire: the server's Fire keeps a fixed difficulty, so ServerLightning makes `fire.L.difficulty` read the simulation's difficulty (/difficulty, --difficulty).
//   * Strike (EntityLightningBolt.onUpdate, every tick the bolt's state is >= 0): every entity in the box x/z +-3, y -3..+9 gets Entity.onStruckByLightning (sa.a(xh), 5 fire damage then
//     ++fire, setFire(8) at 0). Only Entity, EntityPig (pigman) and EntityCreeper (powered) override it in 1.7.10 (bytecode-read: javap over every class); the villager has no override, so no witch
//     (the batch 66 brief's "villager to witch" is a later version), nor does the mooshroom. Mobs take the single-player path (weather-simulation.js strikeMobs). Items and experience orbs
//     are Entities with health 5, so the 5 fire damage kills them. Players in the Overworld take it through Survival.damage like single player (a Creative player is skipped as there).
//   * Sending: WorldServer.addWeatherEffect (mt.c(sa), bytecode-read) sends S2C spawn global entity (fy) with sendToAllNear(x, y, z, 512, dimension) (oi.a, 3D distance, dimension filtered).
//     Wire: { type: 'boltSpawn', i, x, y, z } on `p.dispOut` for each Overworld player within 512 blocks. The client makes its own bolt (client-lightning.js), which flashes the sky and plays
//     ambient.weather.thunder (volume 10000) and random.explode (2) at the bolt, so the server sends no sound packet for them.
import { strikeBox, overlaps, entityBox, struckByLightning } from '../weather.js';
import { strikeMobs, strikeThings } from '../weather-simulation.js';
import { PHYSICS } from '../world.js';

export const BOLT_NEAR = 512;

export class ServerLightning {
  constructor(sim) {
    this.sim = sim;
    this.seen = new WeakSet();
    this.next = 1;
    const L = sim.fire?.L;
    if (L) Object.defineProperty(L, 'difficulty', { get: () => sim.difficulty, set() {}, configurable: true });
  }
  // After Weather.tick: announce new bolts, then hit what stands in the box of every bolt that flashed this tick.
  tick() {
    const w = this.sim.weather;
    for (const b of w.bolts) if (!this.seen.has(b)) { this.seen.add(b); this.spawn(b); }
    for (const b of w.struck) this.strike(b);
  }
  spawn(b) {
    const msg = { type: 'boltSpawn', i: this.next++, x: b.x, y: b.y, z: b.z };
    for (const p of this.sim.players.values()) {
      if (p.dimension | 0) continue;
      const q = p.position;
      if ((b.x - q.x) ** 2 + (b.y - q.y) ** 2 + (b.z - q.z) ** 2 < BOLT_NEAR * BOLT_NEAR) (p.dispOut ??= []).push(msg);
    }
  }
  strike(b) {
    const sim = this.sim, box = strikeBox(b);
    strikeMobs(sim.mobs.mobs, b);
    strikeThings({ items: sim.items, orbs: sim.serverItems.xp, minecarts: sim.vehicles.carts, boats: sim.vehicles.boats, arrows: sim.dispense.arrows }, b); // b67: items, orbs, carts, boats, arrows (weather-simulation.js)
    for (const p of sim.players.values()) {
      const s = p.survival;
      if (p.dimension | 0 || p.dead || s.creative || s.health <= 0 || !overlaps(entityBox(p.position, PHYSICS.width, PHYSICS.height), box)) continue;
      const hit = struckByLightning(s.fire || 0, s.inventory?.armor ?? []);
      sim.damagePlayer(p, hit.damage, { name: 'lightning' });
      s.fire = hit.fire;
    }
  }
}
