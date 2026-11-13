// Server-side achievement triggers of the dedicated world (batch 60 mpcommands2).
//
// In 1.7.10 the server awards almost every achievement (EntityPlayerMP's StatisticsFile announces the first unlock to everyone). Singleplayer here triggers them in
// main.js; on a dedicated server this module is the one entry point the windows and systems call. Awards are queued as `{ type: 'award', id, achievement }` in
// `simulation.events`; ServerSocial.drain (server-broadcast.js) unlocks them (locked parent: silent) and sends the batch 58 first-unlock chat line.
//
// Entry points (all take the server player record `p`):
//   onCrafted(p, stack)    SlotCrafting.onCrafting (aax): the output of a crafting grid (workbench, 2x2 inventory grid) was taken.
//   onSmelted(p, stack)    SlotFurnace.onCrafting (aak): the output of a furnace was taken (wired in server-containers.js).
//   onPotionTaken(p, stack) SlotBrewingStand.onPickup: a potion left a brewing stand slot (the window that owns the stand calls it).
//   dropThrown(p, all)     EntityPlayer.dropOneItem (yz.a(boolean)): Q / Ctrl+Q; the only drop that sets the item's Thrower (see below).
//   tick()                 per server tick: exploreAllBiomes (every 20 ticks) and beacon level 4 for players near the pyramid.
// Bytecode-read (javap on the 1.7.10 jar):
//   * xk.b_ (EntityItem.onCollideWithPlayer): server only (world.isRemote returns). When the stack fitted, a diamond with a Thrower name whose player is online
//     and is not the collector gives the THROWER diamondsToYou (pc.x). Names are compared with String.equals. NBT: Thrower (xk.f) and Owner (xk.g).
//   * yz.a(add, boolean, boolean) sets the Thrower only when its third argument is true. dropOneItem (yz.a(boolean)) passes (false, true); the container close and
//     the click outside (yz.a(add, boolean)) pass (false, false), and death drops (true, false): none of those carry a Thrower.
import { craftedAchievement, smeltedAchievement, watchMobs, ITEM } from '../achievements-live.js';
import { copyStack } from '../inventory.js';

export class ServerAchievements {
  constructor(sim) { this.sim = sim; this.sink = null; this.attacker = null; }

  award(p, achievement) { if (p && achievement) (this.sim.events ??= []).push({ type: 'award', id: p.id, achievement }); return !!achievement; }
  onCrafted(p, stack) { const a = craftedAchievement(stack?.id); this.award(p, a); return a; }
  onSmelted(p, stack) { const a = smeltedAchievement(stack?.id); this.award(p, a); return a; }
  onPotionTaken(p, stack) { return stack?.id === ITEM.potion && (stack.damage ?? 0) > 0 ? this.award(p, 'potion') : false; }

  // EntityPlayer.dropOneItem: one item (or the whole stack) leaves the held slot and flies along the view, tagged with the thrower's name.
  dropThrown(p, all = false) {
    if (!p || p.dead || p.window) return null;
    const inv = p.survival.inventory, held = inv.held;
    if (!held) return null;
    const taken = inv.decr(inv.current, all ? held.count : 1);
    const e = taken && this.sim.items.dropPlayer(copyStack(taken), p.position, p.yaw, p.pitch);
    if (e) e.thrower = p.name;
    return e;
  }

  // The thrower's id when `e` (an item entity) was a diamond thrown by another online player; ServerSocial awards diamondsToYou to it.
  diamondsToYou(collector, stack, e) {
    if (stack?.id !== ITEM.diamond || !e?.thrower) return false;
    for (const q of this.sim.players.values()) if (q.name === e.thrower && q !== collector) return this.award(q, 'diamondsToYou');
    return false;
  }

  // b61 mpvehicles (server-vehicles.js): EntityPlayer.addMovementStat for a player carried by a minecart (onARail at 1000 blocks from the first cell), and the start forgotten
  // when the player rides nothing or a boat. `moved` guards the Math.round(distance * 100) > 0 test of yz.k (bytecode-read).
  onMinecart(p) {
    const a = this.sink?.achievementsOf(p.id), at = p.position, prev = p.previous;
    if (!a || !(Math.hypot(at.x - prev.x, at.y - prev.y, at.z - prev.z) >= 0.005)) return false;
    return a.rideMinecart(at.x, at.y, at.z);
  }
  stopRiding(p) { this.sink?.achievementsOf(p.id).stopRiding(); }

  // Per tick: exploreAllBiomes and fullBeacon need the per-player Achievements object, which ServerSocial owns (`sink`).
  tick() {
    const sim = this.sim, sink = this.sink;
    if (!sink) return;
    const biomes = sim.ticks % 20 === 0, beacons = sim.tileEntities.beacons.tiles;
    for (const p of sim.players.values()) {
      const a = sink.achievementsOf(p.id), at = p.position;
      if (biomes) a.visit((p.world ?? sim.world).biomeAt?.(Math.floor(at.x), Math.floor(at.z))?.name, 0); // b61: the player's own dimension
      if (!p.dimension) for (const [key, tile] of beacons) { // b61: the Overworld's beacons only
        const [bx, by, bz] = key.split(',').map(Number);
        a.beacon(key, tile.levels | 0, at.x >= bx - 10 && at.x <= bx + 11 && at.y >= by - 5 && at.y <= by + 6 && at.z >= bz - 10 && at.z <= bz + 11);
      }
    }
  }

  // The mobs' kills credited to the player whose attack is running (ServerMobs.attack sets `attacker`): killEnemy, snipeSkeleton, overkill (achievements-live.js).
  watchMobs(mobs) {
    watchMobs(mobs, { achievements: { trigger: (id) => this.award(this.attacker, id) }, player: () => this.attacker?.position ?? { x: 0, z: 0 } });
  }
}
