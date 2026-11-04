// EntityCreature's home area (td: homePosition r, maximumHomeDistance bW, hasHome bY, isWithinHomeDistance b(III),
// isWithinHomeDistanceCurrentPosition bU, setHomeArea a(IIII), detachHome bZ) and the home / direction rules of
// RandomPositionGenerator (vx.c). Entity records keep `home` ({x, y, z}) and `homeRadius` (-1 = none).
const f = Math.fround;
export const hasHome = (e) => (e?.homeRadius ?? -1) !== -1;
// td.b(III): no home accepts every cell; else the float distance squared from the home must be below radius squared.
export const isWithinHome = (e, x, y, z) => {
  if (!hasHome(e)) return true;
  const dx = e.home.x - x, dy = e.home.y - y, dz = e.home.z - z;
  return f(dx * dx + dy * dy + dz * dz) < f(e.homeRadius * e.homeRadius);
};
export const isWithinHomeHere = (e) => isWithinHome(e, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
export function setHomeArea(e, x, y, z, radius) {
  e.home = { x, y, z };
  e.homeRadius = radius;
}
export function detachHome(e) {
  e.homeRadius = -1;
}
// vx.c's start: with a home, the draw loop only keeps cells inside it while the mob is within (radius + xz) of it
// (distance squared + 4 below (radius + xz) squared). Returns a cell test, or null for "no filter".
export function homeFilter(e, xz) {
  if (!hasHome(e)) return null;
  const dx = e.home.x - Math.floor(e.x), dy = e.home.y - Math.floor(e.y), dz = e.home.z - Math.floor(e.z);
  const d = f(f(dx * dx + dy * dy + dz * dz) + 4), r = f(e.homeRadius + xz);
  return d < f(r * r) ? (x, y, z) => isWithinHome(e, x, y, z) : null;
}
// vx.c with an optional direction (dirX, dirZ): ten offsets (nextInt(2n) - n for x, y, z), those against the
// direction skipped after their three draws, then the home test, the best getBlockPathWeight kept.
export function findRandomTargetDirected(m, xz, yz, dirX, dirZ) {
  const r = m.rand, keep = homeFilter(m.e, xz);
  let found = false, best = f(-99999), bx = 0, by = 0, bz = 0;
  for (let i = 0; i < 10; i++) {
    const dx = r.nextInt(2 * xz) - xz, dy = r.nextInt(2 * yz) - yz, dz = r.nextInt(2 * xz) - xz;
    if (dirX !== undefined && dx * dirX + dz * dirZ < 0) continue;
    const x = dx + Math.floor(m.x), y = dy + Math.floor(m.y), z = dz + Math.floor(m.z);
    if (keep && !keep(x, y, z)) continue;
    const w = m.getBlockPathWeight(x, y, z);
    if (w > best) { best = w; bx = x; by = y; bz = z; found = true; }
  }
  return found ? { x: bx, y: by, z: bz } : null;
}
// vx.a(td, xz, yz, Vec3): a cell towards `to` (direction = to - position, doubles).
export const findRandomTargetTowards = (m, xz, yz, to) => findRandomTargetDirected(m, xz, yz, to.x - m.x, to.z - m.z);
