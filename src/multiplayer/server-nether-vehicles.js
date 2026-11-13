// Vehicles, leads and animal clicks in the dedicated server's Nether (batch 63 mpnether3).
//
// Batch 61 and 62 kept minecarts, boats, pig riding, leads and fence knots Overworld only. The Nether gets its own copy of each, built over the Nether's world exactly like the
// Overworld's: a second `ServerVehicles` (carts, boats, the saddled pig seat, rail redstone) and a second `ServerLeads` over the Nether's `ServerMobs`. Both are swapped in as `sim.vehicles`
// and `sim.leads` while a Nether player's action runs or the Nether ticks (server-nether.js NETHER_CONTEXT), so every existing code path that reads `sim.vehicles` reaches the right one.
//   * Each instance sees only the players of its dimension: the Overworld instance's host is a view of `sim` whose `players` is the Overworld's, the Nether's host a view over the
//     Nether's world, items, mobs, containers and redstone with the Nether's players. A rider, a vehicle push, a blocker or a `vehicles` packet never crosses.
//   * A vehicle key ('c3', 'b2') is unique only within a dimension; the client rebuilds its vehicle list when it changes dimension (dimRespawn), and a player's `vehicles` view is
//     cleared whenever the instance does not own the player (server-vehicles.js track).
//   * `dismount` and `removePlayer` of the Overworld instance hand a Nether rider to the Nether instance.
// Native: each WorldServer keeps its own entity list and tracker, so a Nether cart is seen only by Nether players. EntityMinecart rails, EntityBoat on lava and EntityPig riding use the same
// rules in every dimension (bytecode-read in the earlier tracks); nothing here is dimension specific except the lists.
import { ServerVehicles } from './server-vehicles.js';
import { ServerLeads } from './server-leads.js';

const NETHER = -1;

// A Map-like read of `sim.players` restricted to one dimension (the methods the vehicle code uses).
export function dimensionPlayers(sim, dim) {
  const mine = p => !!p && (p.dimension | 0) === dim;
  return { values: () => [...sim.players.values()].filter(mine), has: id => mine(sim.players.get(id)), get: id => (mine(sim.players.get(id)) ? sim.players.get(id) : undefined),
    get size() { return this.values().length; }, [Symbol.iterator]() { return this.values().map(p => [p.id, p])[Symbol.iterator](); } };
}

// The Nether's leads: a holder is a player of the Nether (the Overworld's rule drops the lead of anyone out of the Overworld).
class NetherLeads extends ServerLeads {
  holder(e, views) {
    const v = views.get(e.leash.holderId); // the Nether's mob views hold only Nether players
    if (v) return v;
    this.mobs.unleash(e, true);
    return null;
  }
}

// Called once from ServerDimensions' constructor (after `sim.vehicles` exists): the Overworld instance sees only Overworld players and lets a Nether rider go to the Nether's.
export function pinOverworldVehicles(sim, dims) {
  const v = sim.vehicles;
  v.host = Object.create(sim, { players: { value: dimensionPlayers(sim, 0) } });
  const dismount = v.dismount.bind(v);
  v.dismount = p => (p?.dimension && dims.nether?.vehicles ? dims.nether.vehicles.dismount(p) : dismount(p));
}

// Inside the Nether's swap, after n.mobs and n.dispense exist (server-nether.js buildNetherInside). `host` is the same kind of view the Nether's ServerMobs has.
export function buildNetherVehicles(sim, n, saved = null) {
  const host = Object.create(sim, {
    world: { value: n.world }, items: { value: n.items }, mobs: { value: n.mobs }, containers: { value: n.containers }, redstone: { value: n.redstone },
    players: { value: dimensionPlayers(sim, NETHER) },
    soundsOut: { value: { push: s => sim.soundsOut.push({ ...s, dim: NETHER }) } },
  });
  n.vehicles = new ServerVehicles(host, saved); n.vehicles.dim = NETHER;
  n.vehicles.connect(n.redstone);
  n.leads = new NetherLeads(host);
  n.dispense.vehicles = { dispenseBoat: (x, y, z) => !!n.vehicles.spawnVehicle('boat', x, y, z), dispenseCart: (type, x, y, z) => !!n.vehicles.spawnVehicle({ 0: 'minecart', 1: 'chest_minecart', 2: 'furnace_minecart', 3: 'tnt_minecart', 5: 'hopper_minecart' }[type], x, y, z) };
}

// A Nether player who has no view yet gets one (ServerVehicles.addPlayer is the join hook of the Overworld's).
export function viewNetherPlayers(n, players) { for (const p of players) if (!n.vehicles.views.has(p.id)) n.vehicles.addPlayer(p); }
