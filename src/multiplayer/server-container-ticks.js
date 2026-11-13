// Batch 60 (mpcontainers2): hoppers, dispensers and droppers, trapped chests and lit furnaces on the dedicated server's world.
// The single-player rules run unchanged over the server's tile stores (`sim.tiles`, shared with every player's Survival): Hoppers (hopper.js,
// TileEntityHopper.updateEntity, 8-tick cooldown), the dispense engine (dispense.js) installed on the server's LiveRedstone, and the trapped chest's
// power (BlockChest type 1 canProvidePower, viewers -> weak power, chests-reference.json). Open windows already see slot changes because every window reads
// the same tile arrays (ServerContainers.changes). Aux effects 1000/1001/1002/2000 of a dispense go out as `aux` messages (S28, WorldManager.a(yz,...):
// sendToAllNear 64 blocks, bytecode-read). Batch 61: the entities a dispense creates live in server-dispense.js; only carts and boats (no server entity yet)
// put the stack back and send nothing, as away-world.js does.
import { Hoppers, hopperBehaviour } from '../hopper.js';
import { installDispensers } from '../dispense.js';
import { trappedPower, trappedStrongPower } from '../chest-blocks.js';
import { burnTime } from '../survival.js';
import { WATER, LAVA } from '../world.js';
import { JavaRandom } from '../java-random.js';

const AUX_RANGE_SQ = 64 * 64;
export class ContainerTicks {
  constructor(sim) {
    this.sim = sim; this.buffer = []; this.unsupported = false;
    this.rand = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
    const tiles = () => sim.tiles, redstone = sim.redstone, live = redstone;
    this.hoppers = new Hoppers({
      get world() { return sim.world; }, chests: () => tiles().chests, furnaces: () => tiles().furnaces, dispensers: () => tiles().dispensers,
      hoppers: () => tiles().hoppers, brewing: () => tiles().brewing, maxStack: s => tiles().inventory.maxStack(s), burnTime,
      items: () => sim.items.items, active: () => true, changed: keys => this.changed(keys),
    });
    live.registerBehaviour(154, hopperBehaviour); // BlockHopper: power disables it (metadata bit 8)
    const viewers = (x, y, z) => tiles().chests[`${x},${y},${z}`]?.users ?? 0;
    live.registerBehaviour(146, { weak: (w, x, y, z) => trappedPower(viewers(x, y, z)), strong: (w, x, y, z, side) => trappedStrongPower(viewers(x, y, z), side) });
    const stop = () => { this.unsupported = true; };
    installDispensers(live, {
      tile: (x, y, z) => (tiles().dispensers[`${x},${y},${z}`] ??= { items: Array(9).fill(null) }),
      aux: (id, x, y, z, data) => this.buffer.push({ id, x, y, z, data: data | 0 }),
      rng: () => this.rand,
      spawnItem: (stack, x, y, z, mx, my, mz) => { sim.items.spawn(stack, x, y, z, { motion: [mx, my, mz] }); },
      ...sim.dispense.host(stop), // b61: arrows, thrown items, fireballs, fireworks, TNT, spawn eggs, armour (server-dispense.js); carts and boats stop until the vehicle track hooks in
      setLiquid: (x, y, z, id) => { sim.world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0); },
      setAir: (x, y, z) => { sim.world.set(x, y, z, 0, true, 0); },
      setFire: (x, y, z) => { sim.fire.ignite(x, y, z); },
      breakBlock: (x, y, z) => { const b = sim.world.get(x, y, z); if (b) sim.fluids.wash(x, y, z, b); },
      boneMeal: (x, y, z, original) => original === 6 && sim.trees.boneMeal(x, y, z) !== null,
      transfer: () => this.hoppers.host,
      maxStack: s => tiles().inventory.maxStack(s),
      changed: () => {},
    });
    sim.containers.adopt();
    for (const id of [23, 158]) { // a dispense that cannot run here keeps its stack and its effects
      const b = live.behaviours[id];
      if (!b) continue;
      live.behaviours[id] = { ...b, updateTick: (w, x, y, z) => {
        const key = `${x},${y},${z}`, before = structuredClone(tiles().dispensers[key]);
        this.unsupported = false; this.buffer.length = 0;
        b.updateTick(w, x, y, z);
        if (this.unsupported) { if (before) tiles().dispensers[key] = before; else delete tiles().dispensers[key]; this.buffer.length = 0; } else this.flushAux();
      } };
    }
  }
  // World.func_147453_f for a changed container: comparators beside it read the new contents.
  changed(keys) { for (const key of keys ?? []) this.sim.redstone.containerChanged(...String(key).split(',').map(Number)); }
  // TileEntityChest.func_145969_a / func_145976_d: a viewer count change notifies the chest's neighbours and the block beneath (trapped chest power).
  viewersChanged(key) {
    const [x, y, z] = key.split(',').map(Number), r = this.sim.redstone, id = r.getBlock(x, y, z);
    if (id !== 146 && id !== 54) return;
    r.notifyBlocksOfNeighborChange(x, y, z, id); r.notifyBlocksOfNeighborChange(x, y - 1, z, id);
  }
  // S28 to every player within 64 blocks of the cell.
  flushAux() {
    for (const e of this.buffer.splice(0)) for (const p of this.sim.players.values()) {
      const dx = e.x - p.position.x, dy = e.y - p.position.y, dz = e.z - p.position.z;
      if (dx * dx + dy * dy + dz * dz < AUX_RANGE_SQ) (p.itemsOut ??= []).push({ type: 'aux', events: [e] });
    }
  }
}
