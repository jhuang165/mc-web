// BlockPortal (amp, original block 90) and its BlockPortal.Size scan (amq), Java 1.7.10. Evidence: tools/probes/PortalWartProbe.java ->
// public/research/portal-wart-reference.json, replayed by src/nether-portal-wart.test.js; notes in public/research/nether.md.
// No imports: world.js reads this file, so the ids below are the internal ones world.js assigns (164 portal; 22 obsidian and 45 fire are
// the existing internal ids of original blocks 49 and 51).
//
// Not ported (see public/research/nether.md "Gaps"): Entity.setInPortal (standing in a portal does nothing), the Nether dimension
// switch, the portal-creation Teleporter, and the portal sound/particles runtime (portal-particles.js has the particle).
export const PORTAL = 164, PORTAL_ITEM = 164, OBSIDIAN = 22, FIRE = 45;
export const PORTAL_LIGHT = 11; // setLightLevel(0.75F): (int)(0.75 * 15)
export const PORTAL_SOUND = "portal.portal";
// Direction.offsetX / offsetZ (0 south, 1 west, 2 north, 3 east) and BlockPortal.field_150001_a: meta -> [left, right] directions.
const DX = [0, -1, 0, 1], DZ = [1, 0, -1, 0];
const SIDES = [[3, 1], [3, 1], [2, 0]];
const DIRECTIONS = [null, [3, 1], [2, 0]];
const MAX = 21;
const f = Math.fround;
const NEIGHBOURS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

// BlockPortal.Size.func_150857_a: air-material blocks, fire and portal blocks do not obstruct. `isAir(b)` covers Material.air only.
const passable = (b, isAir) => isAir(b) || b === FIRE || b === PORTAL;
const defaultAir = (b) => b === 0;

export class PortalSize {
  constructor(world, x, y, z, meta, isAir = defaultAir) {
    this.world = world; this.meta = meta; this.isAir = isAir;
    this.portals = 0; this.corner = null; this.width = 0; this.height = 0;
    const [d, c] = DIRECTIONS[meta];
    this.dirLeft = d; this.dirRight = c;
    for (const j = y; y > j - MAX && y > 0 && this.passable(world.get(x, y - 1, z));) y--;
    const i = this.count(x, y, z, d) - 1;
    if (i >= 0) {
      this.corner = [x + i * DX[d], y, z + i * DZ[d]];
      this.width = this.count(this.corner[0], this.corner[1], this.corner[2], c);
      if (this.width < 2 || this.width > MAX) { this.corner = null; this.width = 0; }
    }
    if (this.corner) this.height = this.measureHeight();
  }
  passable(b) { return passable(b, this.isAir); }
  // Size.func_150853_a: cells along `dir` that are passable with obsidian underneath, then obsidian must close the row.
  count(x, y, z, dir) {
    const w = this.world, dx = DX[dir], dz = DZ[dir];
    let i;
    for (i = 0; i < 22; i++) {
      if (!this.passable(w.get(x + dx * i, y, z + dz * i))) break;
      if (w.get(x + dx * i, y - 1, z + dz * i) !== OBSIDIAN) break;
    }
    return w.get(x + dx * i, y, z + dz * i) === OBSIDIAN ? i : 0;
  }
  // Size.func_150858_a: grows the height row by row; the two side columns must be obsidian and the top row obsidian.
  measureHeight() {
    const w = this.world, [cx, cy, cz] = this.corner, [left, right] = DIRECTIONS[this.meta];
    let g = 0;
    outer: for (; g < MAX; g++) {
      const y = cy + g;
      for (let i = 0; i < this.width; i++) {
        const x = cx + i * DX[right], z = cz + i * DZ[right], b = w.get(x, y, z);
        if (!this.passable(b)) break outer;
        if (b === PORTAL) this.portals++;
        if (i === 0) { if (w.get(x + DX[left], y, z + DZ[left]) !== OBSIDIAN) break outer; }
        else if (i === this.width - 1) { if (w.get(x + DX[right], y, z + DZ[right]) !== OBSIDIAN) break outer; }
      }
    }
    for (let i = 0; i < this.width; i++) if (w.get(cx + i * DX[right], cy + g, cz + i * DZ[right]) !== OBSIDIAN) { g = 0; break; }
    if (g > MAX || g < 3) { this.corner = null; this.width = 0; this.height = 0; return 0; }
    return g;
  }
  valid() { return this.corner !== null && this.width >= 2 && this.width <= MAX && this.height >= 3 && this.height <= MAX; }
  // Size.func_150859_c: fills the interior with portal blocks of this axis (World.setBlock flags 2: no neighbour notification).
  create(set) {
    const [cx, cy, cz] = this.corner, c = this.dirRight;
    const cells = [];
    for (let i = 0; i < this.width; i++) for (let j = 0; j < this.height; j++) { const p = [cx + DX[c] * i, cy + j, cz + DZ[c] * i]; cells.push(p); set(p[0], p[1], p[2], PORTAL, this.meta); }
    return cells;
  }
}

// BlockPortal.func_150000_e (also BlockFire.onBlockAdded and ItemFlintAndSteel's last step): try both axes at (x, y, z). Returns the filled
// cells, or null. `set(x, y, z, block, meta)` writes without notifying neighbours.
export function tryLightPortal(world, x, y, z, set = (px, py, pz, b, m) => world.set(px, py, pz, b, true, m), isAir = defaultAir) {
  const a = new PortalSize(world, x, y, z, 1, isAir), b = new PortalSize(world, x, y, z, 2, isAir);
  if (a.valid() && a.portals === 0) return a.create(set);
  if (b.valid() && b.portals === 0) return b.create(set);
  return null;
}
// BlockPortal.onNeighborBlockChange: does the portal block at (x, y, z) still sit in a complete frame? (false: it is removed).
export function portalIntact(world, x, y, z, isAir = defaultAir) {
  const meta = world.getMeta(x, y, z) & 3;
  const full = (m) => { const s = new PortalSize(world, x, y, z, m, isAir); return s.valid() && s.portals >= s.width * s.height; };
  if (meta === 1) return full(1);
  if (meta === 2) return full(2);
  if (meta === 0) return full(1) || full(2);
  return true; // meta 3 matches no branch: the block stays
}
// The cascade of World.setBlock(..., air): each of the six neighbours that is a portal block runs onNeighborBlockChange; a failing one
// is set to air, which notifies its own neighbours in turn (depth first, in World.notifyBlocksOfNeighborChange order).
// `remove(x, y, z)` must clear the cell (the default uses world.set(.., 0)); call this after any cell at (x, y, z) changed.
export function portalNeighborsChanged(world, x, y, z, remove = (px, py, pz) => world.set(px, py, pz, 0), isAir = defaultAir) {
  const removed = [];
  const visit = (px, py, pz) => {
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nx = px + dx, ny = py + dy, nz = pz + dz;
      if (world.get(nx, ny, nz) !== PORTAL || portalIntact(world, nx, ny, nz, isAir)) continue;
      remove(nx, ny, nz); removed.push([nx, ny, nz]);
      if (world.get(nx, ny, nz) === PORTAL) continue; // the host refused: avoid looping
      visit(nx, ny, nz);
    }
  };
  visit(x, y, z);
  return removed;
}
// BlockPortal.setBlockBoundsBasedOnState: meta 0 resolves to 1 when a portal block lies to the west or east, else 2 (the original also
// stores that meta); meta 1 spans x (0.125 half width in z), meta 2 spans z. [minX, minY, minZ, maxX, maxY, maxZ].
export function portalAxis(world, x, y, z) {
  let meta = world.getMeta(x, y, z) & 3;
  if (meta === 0) meta = world.get(x - 1, y, z) === PORTAL || world.get(x + 1, y, z) === PORTAL ? 1 : 2;
  return meta;
}
export function portalBounds(meta) {
  let fx = f(0.125), fz = f(0.125);
  if (meta === 1) fx = f(0.5);
  if (meta === 2) fz = f(0.5);
  return [f(0.5 - fx), 0, f(0.5 - fz), f(0.5 + fx), 1, f(0.5 + fz)];
}
export const portalBoundsAt = (world, x, y, z) => portalBounds(portalAxis(world, x, y, z));
// BlockPortal.shouldSideBeRendered(world, x, y, z, side): (x, y, z) is the neighbour cell the face looks at; sides are vanilla 0 -y .. 5 +x.
export function portalSideRendered(world, x, y, z, side) {
  let meta = 0;
  if (world.get(x, y, z) === PORTAL) {
    meta = world.getMeta(x, y, z) & 3;
    if (meta === 0) return false;
    if (meta === 2 && side !== 5 && side !== 4) return false;
    if (meta === 1 && side !== 3 && side !== 2) return false;
  }
  const end = (dx, dy, dz) => world.get(x + dx, y + dy, z + dz) === PORTAL && world.get(x + 2 * dx, y + 2 * dy, z + 2 * dz) !== PORTAL;
  const alongX = end(-1, 0, 0) || end(1, 0, 0) || meta === 1, alongZ = end(0, 0, -1) || end(0, 0, 1) || meta === 2;
  return (alongX && (side === 4 || side === 5)) || (alongZ && (side === 2 || side === 3));
}
// BlockPortal.updateTick, the zombie pigman part: with a surface (Overworld) provider and doMobSpawning, a roll of nextInt(2000) below
// the difficulty id (peaceful 0 .. hard 3) searches down for a solid-top cell and spawns a pigman 1.1 above it unless the cell above
// the landing cell is a normal cube. Returns the spawn position or null. `random.nextInt(n)` is a java.util.Random; the game's random
// tick stream decides when this runs. `solidTop(x, y, z)` is World.doesBlockHaveSolidTopSurface and `normalCube(block)` Block.isNormalCube.
export function portalSpawnPosition(world, x, y, z, random, { difficulty = 2, mobSpawning = true, surfaceWorld = true, solidTop, normalCube } = {}) {
  if (!surfaceWorld || !mobSpawning || !(random.nextInt(2000) < difficulty)) return null;
  const top = solidTop ?? ((px, py, pz) => world.solid(px, py, pz)), normal = normalCube ?? (() => false);
  let yy = y;
  while (!top(x, yy, z) && yy > 0) yy--;
  if (yy > 0 && !normal(world.get(x, yy + 1, z))) return [x + 0.5, yy + 1.1, z + 0.5];
  return null;
}

// BlockPortal.randomDisplayTick, written from the 1.7.10 decompile rather than a probe (unverified
// against the JAR): a 1 in 100 "portal.portal" ambience, then four portal particles drifting across
// the portal plane. `fx.spawn(name,x,y,z,vx,vy,vz)` and `sound(name,x,y,z,volume,pitch)` are injected.
export function portalDisplayTick(world, x, y, z, random, fx, sound = () => {}) {
  const f = Math.fround;
  if (random.nextInt(100) === 0) sound(PORTAL_SOUND, f(x + 0.5), f(y + 0.5), f(z + 0.5), 0.5, f(f(random.nextFloat() * f(0.4)) + f(0.8)));
  for (let i = 0; i < 4; i++) {
    let px = f(x + random.nextFloat()), py = f(y + random.nextFloat()), pz = f(z + random.nextFloat());
    const side = random.nextInt(2) * 2 - 1;
    let vx = f(f(random.nextFloat() - 0.5) * f(0.5)), vy = f(f(random.nextFloat() - 0.5) * f(0.5)), vz = f(f(random.nextFloat() - 0.5) * f(0.5));
    if (world.get(x - 1, y, z) !== PORTAL && world.get(x + 1, y, z) !== PORTAL) { pz = z + 0.5 + 0.25 * side; vz = f(random.nextFloat() * 2 * side); }
    else { px = x + 0.5 + 0.25 * side; vx = f(random.nextFloat() * 2 * side); }
    fx.spawn("portal", px, py, pz, vx, vy, vz);
  }
}
