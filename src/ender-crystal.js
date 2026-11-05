// EntityEnderCrystal (wz) from Minecraft Java 1.7.10. Pure rules, no imports. Evidence:
// public/research/end-reference.json (crystal*, facts), notes in public/research/end.md.
export const ENDER_CRYSTAL = "ender_crystal";
export const CRYSTAL_WIDTH = 2, CRYSTAL_HEIGHT = 2, CRYSTAL_HEALTH = 5;
export const CRYSTAL_EXPLOSION_POWER = 6;
export const CRYSTAL_FIRE = 51;
// RenderEnderCrystal: the cube spins at innerRotation * 3 degrees and bobs by sin(t * 0.2) / 2 + 0.5.
// innerRotation starts at random.nextInt(100000) (unseeded in the original: only the range is checked).
export const CRYSTAL_ROTATION_MAX = 99999;

// EntityEnderCrystal.onUpdate: posX/Y/Z are stored, innerRotation++, and in the End (WorldProviderEnd)
// the cell the crystal stands in gets fire when it is not already fire (setBlock, flags 3).
export function crystalTick(e, end, getBlock, setBlock) {
  e.innerRotation = (e.innerRotation | 0) + 1;
  if (!end) return false;
  const i = Math.floor(e.x), j = Math.floor(e.y), k = Math.floor(e.z);
  if (getBlock(i, j, k) === CRYSTAL_FIRE) return false;
  setBlock(i, j, k, CRYSTAL_FIRE);
  return true;
}

// EntityEnderCrystal.attackEntityFrom: invulnerable -> false; otherwise true. On the server a
// living crystal drops to health 0, dies and explodes at power 6 with fire (flaming). The client
// copy changes nothing. A dead crystal answers true without a second explosion.
// Returns { result, explode }.
export function crystalHit(e, remote) {
  if (e.invulnerable) return { result: false, explode: false };
  if (!e.dead && !remote) {
    e.health = 0;
    e.dead = true;
    return { result: true, explode: true };
  }
  return { result: true, explode: false };
}
