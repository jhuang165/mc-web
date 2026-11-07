// EntityDragon.getParts (xa.at()): the seven EntityDragonPart boxes that World.getEntitiesWithinAABB* lists in place of the dragon
// itself (the dragon is not collidable: Entity.canBeCollidedWith is false). Projectile sweeps and explosions test each part; the part
// that was hit is remembered on the dragon state (`lastPart`) for dragon-mobs.js, whose attackEntityFrom routes the damage through
// attackEntityFromPart for that part. No imports, so projectiles.js, fireballs.js and explosion-simulation.js can all use it.
export const isDragon = (e) => e?.type === "ender_dragon" && !!e.dragon?.parts;
// `[{ target, part, box }]` for a living dragon (the part boxes are the ones updateParts placed this tick).
export const dragonPartTargets = (e) => (isDragon(e) ? e.dragon.parts.map((p, part) => ({ target: e, part, box: p.box })) : []);
// Remember the part a projectile hit (a target record carrying `part`).
export function aimPart(hit) {
  const e = hit?.ref ?? hit?.target;
  if (hit?.part !== undefined && isDragon(e)) e.dragon.lastPart = hit.part;
}
