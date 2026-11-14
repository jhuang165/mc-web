// Batch 65 (mpspawners2): the client's half of a dedicated server's mob spawners (server-spawners.js has the native facts).
// The client keeps the tile entities the server described (tile-sync.js applyTiles) and runs MobSpawnerBaseLogic's client branch on them itself: smoke and flame while the player's eye is within 16,
// the display mob's spin (structure-simulation.js tickSpawnersClient, now also called from the multiplayer tick for the server's minecart copies). What arrives on the wire is the block event
// (agq.b(1): the client's delay becomes its minSpawnDelay) and, from playAuxSFX 2004, the burst after a spawn.
import { receiveClientEvent } from '../mob-spawner.js';

// `spawners`: the client MobSpawners. `copies`: RemoteVehicles.copies (key -> { v }). A block spawner at (x, y, z) or, with `key` ('c<id>'), that minecart copy's logic.
export function applySpawnerDelay({ spawners, copies }, x, y, z, key = null) {
  if (key) {
    const cart = copies?.get(key)?.v;
    return cart?.type === 4 && cart.spawner ? receiveClientEvent(cart.spawner, 1) : false;
  }
  const s = spawners?.get(x, y, z);
  return s ? receiveClientEvent(s, 1) : false;
}
