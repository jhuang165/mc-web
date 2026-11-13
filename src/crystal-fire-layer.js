// Batch 57 crystalfire: the ender crystal copy's fire on the client block layer. EntityEnderCrystal.onUpdate (wz.h, bytecode-read) has no isRemote guard, so the
// client copy sets fire in its own cell on the client world when that cell is not fire, before the server's block change arrives. The port's client block layer is the
// predicted-cell overlay (client-prediction.js): the fire is an overlay cell drawn at once (Scene.showPredictedCells), and it ends once the real world holds the same
// block (the server's own crystal lit it, the S23 landing). A cell the client changed itself (a predicted break of the fire) reads as air here, so the copy lights it again.
import { clientCrystalFire } from "./ender-crystal-mobs.js";

export const CRYSTAL_FIRE_TOKEN = -57; // the overlay token of these entries (client-prediction.js tokens are positive)

// `host`: { world(), layer() (the prediction layer, created on demand), seen() (the client world view), scene() }
export function createCrystalFireLayer(host) {
  const owned = new Set();
  const layer = {
    ids: "port", // get and set speak port block ids (clientCrystalFire maps the rule's original fire id)
    get isEnd() { return host.world()?.isEnd === true; },
    get: (x, y, z) => host.seen().get(x, y, z),
    set(x, y, z, id) {
      const pred = host.layer();
      if (!pred.set(x, y, z, id, 0, CRYSTAL_FIRE_TOKEN)) { // the real world already holds it: an older overlay entry for the cell (a predicted break) is dropped
        if (!pred.clear(x, y, z)) return false;
        host.scene()?.updateBlock(x, z, y); // relit and meshed from the real world
        return true;
      }
      owned.add(`${x},${y},${z}`);
      host.scene()?.showPredictedCells([{ x, y, z }]);
      return true;
    },
    // The real world caught up: the overlay entry is dropped (the cell is meshed from the real world, which now agrees).
    reconcile() {
      const world = host.world(), pred = host.layer();
      for (const key of [...owned]) {
        const e = pred.cells.get(key);
        if (!e || e.token !== CRYSTAL_FIRE_TOKEN) { owned.delete(key); continue; }
        if (world.get(e.x, e.y, e.z) === e.block && world.getMeta(e.x, e.y, e.z) === e.meta) { pred.clear(e.x, e.y, e.z, CRYSTAL_FIRE_TOKEN); owned.delete(key); }
      }
    },
    tick(copy) { if (owned.size) layer.reconcile(); return clientCrystalFire(copy, layer); },
    forget() { owned.clear(); },
  };
  return layer;
}
