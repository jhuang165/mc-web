// Batch 57 crystalfire: the ender crystal copy's fire on the client block layer. EntityEnderCrystal.onUpdate (wz.h, bytecode-read) has no isRemote guard, so the
// client copy sets fire in its own cell on the client world when that cell is not fire, before the server's block change arrives. The port's client block layer is the
// predicted-cell overlay (client-prediction.js): the fire is an overlay cell drawn at once (Scene.showPredictedCells), and it ends once the real world holds the same
// block (the server's own crystal lit it, the S23 landing). A cell the client changed itself (a predicted break of the fire) reads as air here, so the copy lights it again.
import { clientCrystalFire } from "./ender-crystal-mobs.js";
import { canPlace } from "./fire.js";

export const CRYSTAL_FIRE_TOKEN = -57; // the overlay token of these entries (client-prediction.js tokens are positive)

// `host`: { world(), layer() (the prediction layer, created on demand), seen() (the client world view), scene() }
export function createCrystalFireLayer(host) {
  const owned = new Map(); // cell key -> the real block and meta when the entry was made (a later difference is the server's change landing)
  const layer = {
    ids: "port", // get and set speak port block ids (clientCrystalFire maps the rule's original fire id)
    get isEnd() { return host.world()?.isEnd === true; },
    get: (x, y, z) => host.seen().get(x, y, z),
    set(x, y, z, id) {
      // BlockFire.onBlockAdded (alb.b, bytecode-read) runs on the client world too: in a dimension above 0 the portal test is skipped, and a fire with no solid top
      // below and no flammable neighbour sets itself to air at once (World.setBlock flags 3 then setBlockToAir), so the client cell ends as air, not fire.
      if (!canPlace(host.seen(), x, y, z)) id = 0;
      const pred = host.layer(), world = host.world();
      if (!pred.set(x, y, z, id, 0, CRYSTAL_FIRE_TOKEN)) { // the real world already holds it: an older overlay entry for the cell (a predicted break) is dropped
        owned.delete(`${x},${y},${z}`);
        if (!pred.clear(x, y, z)) return false;
        host.scene()?.updateBlock(x, z, y); // relit and meshed from the real world
        return true;
      }
      owned.set(`${x},${y},${z}`, { block: world.get(x, y, z), meta: world.getMeta(x, y, z) });
      host.scene()?.showPredictedCells([{ x, y, z }]);
      return true;
    },
    // The client cell is replaced the way native replaces it. WorldClient.invalidateBlockReceiveRegion (bjf.a(IIIIII)) is an empty method and WorldClient.tick resets no
    // predicted block (bytecode-read), so there is no timeout: the client fire stays until the server's S23 / S22 for the cell or chunk data lands. Here that is the real
    // cell differing from what it was when the entry was made (any block, not only fire), or its chunk leaving the loaded set (the data that comes back replaces the client
    // chunk). The same real block as the entry also ends it (the server lit the cell itself). A fire whose support the client view lost goes out as onNeighborBlockChange does.
    reconcile() {
      const world = host.world(), pred = host.layer();
      for (const [key, base] of [...owned]) {
        const e = pred.cells.get(key);
        if (!e || e.token !== CRYSTAL_FIRE_TOKEN) { owned.delete(key); continue; }
        const loaded = world.isLoaded ? world.isLoaded(e.x, e.z) !== false : true;
        const rb = world.get(e.x, e.y, e.z), rm = world.getMeta(e.x, e.y, e.z);
        if (!loaded || (rb === e.block && rm === e.meta) || rb !== base.block || rm !== base.meta) {
          pred.clear(e.x, e.y, e.z, CRYSTAL_FIRE_TOKEN); owned.delete(key);
          if (loaded) host.scene()?.updateBlock(e.x, e.z, e.y);
        } else if (e.block && !canPlace(host.seen(), e.x, e.y, e.z)) { // alb.a(ahb,III,aji): neighbour change removes an unsupported fire
          if (pred.set(e.x, e.y, e.z, 0, 0, CRYSTAL_FIRE_TOKEN)) host.scene()?.showPredictedCells([{ x: e.x, y: e.y, z: e.z }]); // an entry that shows air over a real block
          else { pred.clear(e.x, e.y, e.z, CRYSTAL_FIRE_TOKEN); owned.delete(key); host.scene()?.updateBlock(e.x, e.z, e.y); } // the real cell is air too
        }
      }
    },
    tick(copy) { if (owned.size) layer.reconcile(); return clientCrystalFire(copy, layer); },
    forget() { owned.clear(); },
  };
  return layer;
}
