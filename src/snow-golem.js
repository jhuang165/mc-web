// EntitySnowman (wr, "SnowMan", id 97) rules recorded from the unchanged 1.7.10 classes by tools/probes/MooshroomGolemProbe.java
// (public/research/mooshroom-golem-reference.json): size, health, the pumpkin construction (BlockPumpkin.onBlockAdded, amw.b),
// the snow trail and melting of EntitySnowman.onLivingUpdate (wr.e), the ranged attack aim (wr.a(sv, F)) and the drops.
const f = Math.fround;
export const SNOW_GOLEM = Object.freeze({
  width: f(0.4), height: f(1.8), health: 4, speed: f(0.2), eyeHeight: f(f(1.8) * f(0.85)),
  tasks: { arrowAttack: { priority: 1, speed: 1.25, min: 20, max: 20, range: 10 }, wander: { priority: 2, speed: 1 }, watch: { priority: 3, range: 6 }, lookIdle: { priority: 4 } },
  followRange: 16, ballVelocity: f(1.6), ballInaccuracy: 12, ballOffsetY: 1.100000023841858, shootSound: "random.bow",
  meltTemperature: 1.0, trailTemperature: f(0.8),
});
export const SNOW_BLOCK = 23; // original 80, a full block
export const IRON_BLOCK = 26;
// Monsters that EntityAINearestAttackableTarget(EntityLiving, 0, true, false, IMob.selector) picks (every IMob type of this build).
export const SNOW_GOLEM_TARGETS = new Set(["zombie", "skeleton", "spider", "cave_spider", "creeper", "silverfish", "witch", "slime", "enderman"]);

// BlockPumpkin.onBlockAdded, snow branch: a pumpkin or jack o'lantern above two snow blocks. Returns the cells to clear and where the
// golem spawns, or null.
export function snowGolemShape(isSnow, x, y, z) {
  if (!isSnow(x, y - 1, z) || !isSnow(x, y - 2, z)) return null;
  return { cells: [[x, y, z], [x, y - 1, z], [x, y - 2, z]], at: { x: x + 0.5, y: y - 1.95, z: z + 0.5 } };
}

// EntitySnowman.onLivingUpdate: the four trail cells, (i % 2) * 2 - 1 and (i / 2 % 2) * 2 - 1 quarter blocks off the centre.
export function snowTrailCells(e) {
  const out = [];
  for (let i = 0; i < 4; i++)
    out.push([Math.floor(e.x + ((i % 2) * 2 - 1) * 0.25), Math.floor(e.y), Math.floor(e.z + ((Math.floor(i / 2) % 2) * 2 - 1) * 0.25)]);
  return out;
}

// One onLivingUpdate step after the base update. ctx: {wet, temperature(x,y,z), hurt(amount, name), isAir(x,y,z), canLayer(x,y,z), setLayer(x,y,z)}.
export function updateSnowGolem(e, ctx) {
  if (ctx.wet) ctx.hurt(1, "drown");
  if (ctx.temperature(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) > 1.0) ctx.hurt(1, "onFire");
  const placed = [];
  for (const [x, y, z] of snowTrailCells(e))
    if (ctx.isAir(x, y, z) && ctx.temperature(x, y, z) < f(0.8) && ctx.canLayer(x, y, z)) { ctx.setLayer(x, y, z); placed.push([x, y, z]); }
  return placed;
}

// EntitySnowman.attackEntityWithRangedAttack: the EntitySnowball spawns at the shooter's eye; the aim is
// (dx, target eye - 1.1 - ball y + horizontal * 0.2, dz) with velocity 1.6 and inaccuracy 12.
export function aimFor(shooter, target, ballY) {
  const dx = target.x - shooter.x, dy = target.y + target.eyeHeight - SNOW_GOLEM.ballOffsetY - ballY, dz = target.z - shooter.z;
  const flat = f(Math.sqrt(dx * dx + dz * dz) * f(0.2));
  return { dx, dy: dy + flat, dz };
}

// dropFewItems: nextInt(16) snowballs (item 332, internal 312).
export const SNOWBALL_ITEM = 312;
export function snowGolemDrops(rand) {
  const n = rand.nextInt(16);
  return n > 0 ? [{ id: SNOWBALL_ITEM, count: n }] : [];
}
