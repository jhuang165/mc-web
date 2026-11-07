// EntityDragon.getParts (xa.at()): the seven EntityDragonPart boxes that World.getEntitiesWithinAABB* lists in place of the dragon
// itself (the dragon is not collidable: Entity.canBeCollidedWith is false). Projectile sweeps and explosions test each part; the part
// that was hit is remembered on the dragon state (`lastPart`) for dragon-mobs.js, whose attackEntityFrom routes the damage through
// attackEntityFromPart for that part. No imports, so projectiles.js, fireballs.js and explosion-simulation.js can all use it.
export const isDragon = (e) => e?.type === "ender_dragon" && !!e.dragon?.parts;
// The dragon's own bounding box (setSize(16, 8), yOffset 0): Chunk.getEntitiesWithinAABBForEntity lists the parts only while this box meets the query.
export const dragonBox = (e) => [e.x - 8, e.y, e.z - 8, e.x + 8, e.y + 8, e.z + 8];
// Whether World.getEntitiesWithinAABBExcludingEntity(area) lists the dragon's parts (probed, DragonSweepProbe `sweepList`): the dragon sits in the entity list of
// its chunk and 16-high slice, which the query visits only for chunks floor((min - 2) / 16)..floor((max + 2) / 16) (slices clamped to 0..15), and then
// the dragon's box must meet the area before its seven parts are tested one by one (each part against the area as well).
export function reachesDragon(e, area) {
  const b = dragonBox(e), c = (v) => Math.floor(v / 16), slice = (v) => Math.min(15, Math.max(0, c(v)));
  if (!(b[3] > area[0] && b[0] < area[3] && b[4] > area[1] && b[1] < area[4] && b[5] > area[2] && b[2] < area[5])) return false;
  if (c(e.x) < c(area[0] - 2) || c(e.x) > c(area[3] + 2) || c(e.z) < c(area[2] - 2) || c(e.z) > c(area[5] + 2)) return false;
  const s = slice(e.y);
  return s >= slice(area[1] - 2) && s <= slice(area[4] + 2);
}
// `[{ target, part, box, reach }]` for a living dragon (the part boxes are the ones updateParts placed this tick); a sweep skips a target whose reach(area) is false.
export const dragonPartTargets = (e) => (isDragon(e) ? e.dragon.parts.map((p, part) => ({ target: e, part, box: p.box, reach: (area) => reachesDragon(e, area) })) : []);
// Remember the part a projectile hit (a target record carrying `part`).
export function aimPart(hit) {
  const e = hit?.ref ?? hit?.target;
  if (hit?.part !== undefined && isDragon(e)) e.dragon.lastPart = hit.part;
}
// ze.h / zp.h's query box for a fireball or skull: boundingBox.addCoord(motion).expand(1, 1, 1) (square box of `width`, feet at y).
export const sweepArea = (b) => [b.x - b.width / 2 + Math.min(0, b.vx) - 1, b.y + Math.min(0, b.vy) - 1, b.z - b.width / 2 + Math.min(0, b.vz) - 1, b.x + b.width / 2 + Math.max(0, b.vx) + 1, b.y + b.width + Math.max(0, b.vy) + 1, b.z + b.width / 2 + Math.max(0, b.vz) + 1];
