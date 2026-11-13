// Live glue for BlockDragonEgg.onBlockActivated / onBlockClicked (dragon-egg.js has the rules).
// In the integrated server both sides run: the client copy (World.isRemote) draws the 128 "portal"
// particles from its own random, the server copy moves the egg; their targets differ, as in the
// original. host: { world, serverRandom, clientRandom, updateBlock(x, y, z), spawnParticle(name, x, y, z, vx, vy, vz) }.
import { DRAGON_EGG, teleportEgg } from "./dragon-egg.js";

// The client half alone (PlayerControllerMP runs onBlockActivated / onBlockClicked on its own world at the click: probe 'dragonegg-*', 128 portal particles, no block change).
export function clientDragonEgg(host, x, y, z) {
  const { world } = host;
  return teleportEgg(x, y, z, host.clientRandom(), true, {
    isEgg: (i, j, k) => world.get(i, j, k) === DRAGON_EGG,
    isAir: (i, j, k) => world.get(i, j, k) === 0,
    place() {}, clear() {},
    particle: (name, ...v) => host.spawnParticle(name, ...v),
  });
}
// `skipClient`: the click already ran the client half (prediction5), so only the server's half runs now.
export function useDragonEgg(host, x, y, z, skipClient = false) {
  const { world } = host;
  const isEgg = (i, j, k) => world.get(i, j, k) === DRAGON_EGG;
  const meta = world.getMeta?.(x, y, z) ?? 0;
  if (!skipClient) clientDragonEgg(host, x, y, z); // client branch first (the click is handled by the client before the server packet)
  return teleportEgg(x, y, z, host.serverRandom(), false, {
    isEgg,
    isAir: (i, j, k) => world.get(i, j, k) === 0,
    // setBlock(i, j, k, egg, meta, 2) then setBlockToAir at the old cell; a target outside the world fails
    // but the old cell is still cleared (the egg is lost), exactly as in the original.
    place(i, j, k) { world.set(i, j, k, DRAGON_EGG, true, meta); host.updateBlock(i, j, k); },
    clear(i, j, k) { world.set(i, j, k, 0, true, 0); host.updateBlock(i, j, k); },
    particle() {},
  });
}
