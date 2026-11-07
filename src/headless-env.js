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
