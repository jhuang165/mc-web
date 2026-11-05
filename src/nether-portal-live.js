// Nether portal and nether wart in a running world (see nether-portal.js / nether-wart.js for the evidence-backed rules): a fire block
// placed anywhere lights a complete obsidian frame (BlockFire.onBlockAdded -> BlockPortal.func_150000_e), a portal block whose frame
// is gone removes itself (onNeighborBlockChange, depth first through World.setBlock's re-entrant notification), a wart without soul
// sand drops its seeds, and the wart grows on random ticks. Standing in a portal does nothing yet and portals do not spawn pigmen
// here (portalSpawnPosition is exported as a pure function for the lead's dimension work). Wraps world.onChange like Beds/Doors.
import { PORTAL, FIRE, tryLightPortal, portalIntact } from "./nether-portal.js";
import { NETHER_WART, ITEM_NETHER_WART, wartCanStay, wartTick, wartDropCount } from "./nether-wart.js";

const NEIGHBOURS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

export class NetherLive {
  constructor(world, { random, drop = () => {}, apply = () => {} } = {}) {
    this.world = world; this.random = random; this.drop = drop; this.apply = apply; this.silent = 0;
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      if (this.silent || old === now) return;
      if (now === FIRE) this.light(x, y, z);
      for (const [dx, dy, dz] of NEIGHBOURS) this.neighbourChanged(x + dx, y + dy, z + dz);
    };
    return this;
  }
  light(x, y, z) {
    const changes = [];
    this.silent++;
    try {
      const w = this.world;
      tryLightPortal(w, x, y, z, (px, py, pz, b, meta) => { const old = w.get(px, py, pz); if (w.set(px, py, pz, b, true, meta)) changes.push([px, py, pz, old, b]); });
    } finally { this.silent--; }
    if (changes.length) this.apply(changes);
  }
  neighbourChanged(x, y, z) {
    const w = this.world, b = w.get(x, y, z);
    if (b === PORTAL && !portalIntact(w, x, y, z)) { w.set(x, y, z, 0); this.apply([[x, y, z, PORTAL, 0]]); }
    else if (b === NETHER_WART && !wartCanStay(w, x, y, z)) this.dropWart(x, y, z);
  }
  dropWart(x, y, z) {
    const w = this.world, meta = w.getMeta(x, y, z);
    w.set(x, y, z, 0);
    this.apply([[x, y, z, NETHER_WART, 0]]);
    const { count } = wartDropCount(meta, 0, this.random);
    this.drop(Array.from({ length: count }, () => ({ id: ITEM_NETHER_WART, count: 1 })), x, y, z);
  }
  // WorldServer random tick of one block: true when the block was a nether block.
  randomTick(x, y, z, b) {
    if (b === NETHER_WART) {
      const w = this.world, before = w.getMeta(x, y, z), r = wartTick(w, x, y, z, this.random);
      if (r.removed) this.dropWart(x, y, z);
      else if (r.meta !== before) this.apply([[x, y, z, NETHER_WART, NETHER_WART]]);
      return true;
    }
    return b === PORTAL;
  }
}
