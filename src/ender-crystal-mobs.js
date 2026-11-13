// EntityEnderCrystal (wz) inside EntityWorld (entities.js). Rules are in ender-crystal.js.
// The crystal is no EntityLiving: no AI, gravity, knockback, hurt window, drops or death animation.
import { ENDER_CRYSTAL, CRYSTAL_WIDTH, CRYSTAL_HEIGHT, CRYSTAL_HEALTH, CRYSTAL_EXPLOSION_POWER, CRYSTAL_FIRE, crystalTick, crystalHit } from "./ender-crystal.js";

export const ENDER_CRYSTAL_TYPE = Object.freeze({ health: CRYSTAL_HEALTH, width: CRYSTAL_WIDTH, height: CRYSTAL_HEIGHT, movement: 0, ai: {}, drop: 0 });
export { ENDER_CRYSTAL };

// EntityEnderCrystal.onUpdate. `world.isEnd` is the End dimension flag the dimension-travel code sets
// (WorldProviderEnd); until then it is undefined and the crystal never lights fire.
export function crystalUpdate(mobs, e) {
  crystalTick(e, mobs.world.isEnd === true, (x, y, z) => mobs.world.get(x, y, z), (x, y, z, id) => {
    if (mobs.world.set(x, y, z, id, false, 0)) mobs.events.push({ blockEdit: [[x, y, z]] });
  });
}

// The crystal's client copy runs the same wz.h (no isRemote guard, bytecode-read): in a WorldProviderEnd client world it sets fire in the cell it
// stands in with setBlock(x, y, z, fire) = flags 3, meta 0, on the client's chunks only. `layer` is the client block view { isEnd, get, set };
// the copy's position is its client position (floor of x, y, z). No layer is wired in the browser yet (see end.md Gaps): this is the rule for it.
export function clientCrystalFire(copy, layer) {
  return crystalTick({ x: copy.x, y: copy.y, z: copy.z, innerRotation: 0 }, layer.isEnd === true, layer.get, layer.set);
}

// EntityEnderCrystal.attackEntityFrom (any damage source and amount). A killed crystal is setDead at
// once and explodes with power 6 and fire (World.newExplosion(null, x, y, z, 6.0F, true, true)): no
// exploder, so nearby crystals chain. Returns the attackEntityFrom result.
export function crystalAttack(mobs, e) {
  const state = { health: e.health, dead: e.health <= 0 || e.death >= 20, invulnerable: false };
  const out = crystalHit(state, false);
  if (!out.explode) return out.result;
  e.health = 0;
  e.death = 20; // removed by the end-of-tick filter, with no death animation
  e.crystalGone = true;
  mobs.events.push({ explode: { x: e.x, y: e.y, z: e.z, size: CRYSTAL_EXPLOSION_POWER, source: null, smoking: true, flaming: true } });
  return true;
}
export { CRYSTAL_FIRE };
