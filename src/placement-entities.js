// b81 collide81: World.checkNoEntityCollision(box, null) [ahb.a(azt, sa), bytecode-read] for block placement: false when any entity that is not
// isDead and has preventEntitySpawning [sa.k] meets the box (AxisAlignedBB.intersectsWith, strict). preventEntitySpawning is set (bytecode-read,
// the only putfield sites) by EntityLivingBase (every mob and player), EntityEnderCrystal, EntityBoat, EntityFallingBlock, EntityMinecart and
// EntityTNTPrimed; items, orbs, arrows, thrown items and hanging entities never block. ItemBlock (canPlaceEntityOnSide), ItemSnow and ItemSlab call it
// with the placed block's collision box; the placing player is tested by the caller's `collides`, so this covers the other entities.
import { crystalBox } from './ender-crystal.js'; // b88 boatray88: EntityEnderCrystal's box [y - 1, y + 1] (bytecode-read wz.<init>)
import { pushable } from './entities.js';
import { mobBox, boxesIntersect } from './mob-spawner.js';
import { FALLING_SIZE } from './falling.js';

const f = Math.fround;
// A living mob counts until EntityLivingBase.onDeathUpdate sets it dead (deathTime 20): `pushable` already keeps a dying mob, and the bat, the
// dragon and the crystal are not pushable but still prevent spawning.
const mobBlocks = (o) => o.type === 'bat' || o.type === 'ender_dragon' || o.type === 'ender_crystal' || pushable(o);

// `sources`: { mobs: EntityWorld (entities, size(o)), vehicles: [cart or boat lists], falling: [falling entities], primed: [primed TNT] }, each
// optional and read when the returned test runs. Returns (box) => true when an entity blocks the box.
export function placementEntityBlocker(sources) {
  return (box) => {
    const { mobs, vehicles = [], falling = [], primed = [] } = typeof sources === 'function' ? sources() : sources;
    for (const o of mobs?.entities ?? []) {
      if (!mobBlocks(o)) continue;
      const [w, h] = mobs.size(o);
      if (boxesIntersect(box, o.type === 'ender_crystal' ? crystalBox(o.x, o.y, o.z) : mobBox(o.x, o.y, o.z, w, h))) return true;
    }
    for (const list of vehicles) for (const c of list ?? []) if (!c.dead && c.bb && boxesIntersect(box, c.bb)) return true;
    const half = f(FALLING_SIZE) / 2;
    for (const e of falling ?? []) if (!e.dead && boxesIntersect(box, [e.x - half, e.y, e.z - half, e.x + half, e.y + f(FALLING_SIZE), e.z + half])) return true;
    for (const t of primed ?? []) if (!t.dead && t.bb && boxesIntersect(box, t.bb)) return true;
    return false;
  };
}
