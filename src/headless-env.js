// Light for spawn attempts in headless columns (headless-columns.js): the spawner's light environment (entities.js spawnerState)
// reads the scene's light volume, which covers only the resident window, so a cell in a chunk that has only a headless column is
// answered by RingLight instead. `ring()` is the EntityWorld's current HeadlessColumns (or null); `dim` its dimension (0 Overworld).
export function wrapRingEnv(env, ring, dim, subtracted) {
  const wrap = (name, fromRing) => {
    const base = env[name];
    env[name] = (x, y, z) => {
      const r = ring();
      return r && r.outside(x, z) ? fromRing(r.light, x, y, z) : base(x, y, z);
    };
  };
  if (dim) {
    // Nether and End: block light only (skylight is 0 in the port's dimension environment).
    for (const name of ["lightValue", "thunderLightValue", "fullLight"]) wrap(name, (l, x, y, z) => l.blockAt(x, y, z));
    return;
  }
  wrap("skyLight", (l, x, y, z) => l.skyAt(x, y, z));
  wrap("lightValue", (l, x, y, z) => l.level(x, y, z, subtracted()));
  wrap("thunderLightValue", (l, x, y, z) => l.level(x, y, z, 10));
  wrap("fullLight", (l, x, y, z) => l.level(x, y, z, 0));
}

// Light and sky for mobs ticking in ring chunks (EntityWorld.tick): the brightness tables (ai.js `brightness`, EntityMob path weights
// and sunburn) read mobs.lightAt, and the sunburn and sun tasks read mobs.canSeeSky. Both answer from the scene's light volume and
// the resident columns, which do not reach the ring, so a cell in a ring-only chunk is answered by RingLight instead (the same
// fixed point as the volume, headless-columns.js). `subtracted()` is skylightSubtracted.
export function wrapMobHooks(mobs, ring, subtracted) {
  const light = mobs.lightAt, sky = mobs.canSeeSky;
  mobs.lightAt = (x, y, z) => (ring.outside(x, z) ? ring.light.level(x, y, z, subtracted()) : light(x, y, z));
  // Chunk.canBlockSeeTheSky: at or above the height map.
  mobs.canSeeSky = (x, y, z) => (ring.outside(x, z) ? y >= ring.light.heightAt(x, z) : sky(x, y, z));
}
