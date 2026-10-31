// Player input, sprinting and sneaking rules of Minecraft Java 1.7.10, ported from the
// original bytecode (names are the obfuscated 1.7.10 ones; see public/research/sneaking.md).
// Pure functions plus one small state holder, so main.js only wires keys to them.
const f = Math.fround;

// Entity.moveEntity (sa.d(DDD)V): while a sneaking EntityPlayer stands on the ground, the
// horizontal move is shrunk in 0.05 steps until the player's box, shifted by that move and
// one block DOWN, touches a block, so the player never walks off an edge. `empty(ox, oz)`
// reports that the box offset by (ox, -1, oz) overlaps no block (World.getCollidingBoundingBoxes
// is empty). The three loops (x alone, z alone, both) and the [-0.05, 0.05) snap to zero are
// the bytecode's. Returns the shortened [dx, dz]; the entity's motion itself is not touched.
export const EDGE_STEP = 0.05;
export function sneakEdge(dx, dz, empty) {
  const shrink = (d) => (d < EDGE_STEP && d >= -EDGE_STEP ? 0 : d > 0 ? d - EDGE_STEP : d + EDGE_STEP);
  while (dx !== 0 && empty(dx, 0)) dx = shrink(dx);
  while (dz !== 0 && empty(0, dz)) dz = shrink(dz);
  while (dx !== 0 && dz !== 0 && empty(dx, dz)) {
    dx = shrink(dx);
    dz = shrink(dz);
  }
  return [dx, dz];
}

// MovementInputFromOptions.updatePlayerMoveState (blj.a()V): forward/strafe are sums of
// key presses (+1 / -1); sneaking multiplies both by 0.3 (as a double, narrowed to float).
// `forward` is W minus S; `strafe` is this build's D minus A (right positive; Java's
// moveStrafe is left positive, the sign is flipped by the caller's convention only).
export const SNEAK_FACTOR = 0.3;
// EntityPlayerSP.onLivingUpdate (blk.e) scales both by 0.2 while using an item (eating).
export const USING_ITEM_FACTOR = 0.2;
export function moveInput({ forward = 0, strafe = 0, sneak = false, usingItem = false } = {}) {
  let fw = f(forward), st = f(strafe);
  if (sneak) {
    fw = f(fw * SNEAK_FACTOR);
    st = f(st * SNEAK_FACTOR);
  }
  if (usingItem) {
    fw = f(fw * f(USING_ITEM_FACTOR));
    st = f(st * f(USING_ITEM_FACTOR));
  }
  return { forward: fw, strafe: st };
}

// EntityLivingBase.onLivingUpdate (sv.e()V) scales moveForward/moveStrafing by 0.98F, then
// Entity.moveFlying (sa.a(FFF)V) divides by max(1, hypot) so diagonals are not faster and
// ignores input below 0.01. Returns the strafe/forward weights to multiply by the friction
// (or fly speed); both are zero for no input.
export function moveWeights({ forward, strafe }) {
  const s = f(strafe * f(0.98)), fw = f(forward * f(0.98));
  let d = f(f(s * s) + f(fw * fw));
  if (d < f(1e-4)) return { forward: 0, strafe: 0 };
  d = f(Math.sqrt(d));
  if (d < 1) d = 1;
  return { forward: fw / d, strafe: s / d };
}

// Entity.yOffset is 1.62 for the player; EntityPlayerSP.onLivingUpdate lifts ySize to
// at least 0.2 while the sneak key is down, and Entity.moveEntity scales ySize by 0.4 every
// tick and places posY at minY + yOffset - ySize. So a sneaking eye sits 0.2 * 0.4 = 0.08
// lower the moment the key is down, and rises back as 0.08, 0.032, 0.0128... (no easing of
// its own). Steps up stairs also feed ySize in the original; this build has no step-up.
export const SNEAK_YSIZE = 0.2;
export const YSIZE_DECAY = 0.4;
export function nextYSize(ySize, sneaking) {
  if (sneaking && ySize < f(SNEAK_YSIZE)) ySize = f(SNEAK_YSIZE);
  return f(ySize * f(YSIZE_DECAY));
}

// EntityPlayerSP.onLivingUpdate sprint rules plus the sneak state of the player.
// Fields: sprinting (flag 3 of the entity flags), sprintToggleTimer (blk.e), last tick's
// moveForward (the "flag1" local), ySize and last tick's ySize for interpolation.
export class PlayerMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.inWeb = false;
    this.sprinting = false;
    this.sneaking = false;
    this.sprintToggleTimer = 0;
    this.lastForward = 0;
    this.ySize = 0;
    this.prevYSize = 0;
  }
  // One onLivingUpdate. `keys` are the pressed key counts, `state` the world-side flags:
  // onGround, collidedHorizontally, canSprint (food > 6 or may fly), usingItem, sprintKey.
  // Returns the post-slowdown move input for this tick.
  update(keys, { onGround = false, collidedH = false, canSprint = true, usingItem = false, sprintKey = false, blind = false } = {}) {
    this.prevYSize = this.ySize;
    if (this.sprintToggleTimer > 0) this.sprintToggleTimer--;
    // EntityPlayerSP.isSneaking (blk.an): movementInput.sneak && !sleeping.
    this.sneaking = !!keys.sneak;
    const wasForward = this.lastForward >= 0.8;
    const input = moveInput({ forward: keys.forward, strafe: keys.strafe, sneak: this.sneaking, usingItem });
    if (usingItem) this.sprintToggleTimer = 0;
    const walking = input.forward >= 0.8;
    // Double-tap forward starts a sprint: the timer arms on the first tap and a second tap
    // within seven ticks (or the sprint key) sets the flag.
    if (onGround && !wasForward && walking && !this.sprinting && canSprint && !usingItem && !blind) {
      if (this.sprintToggleTimer > 0 || sprintKey) this.sprinting = true;
      else this.sprintToggleTimer = 7;
    }
    if (!this.sprinting && walking && canSprint && !usingItem && !blind && sprintKey) this.sprinting = true;
    if (this.sprinting && (!walking || collidedH || !canSprint)) this.sprinting = false;
    this.lastForward = input.forward;
    return input;
  }
  // Entity.moveEntity's tail: ySize decays after update() raised it for a sneaking player.
  endMove() {
    this.ySize = nextYSize(this.ySize, this.sneaking);
  }
  // The eye (and the model) sit this far below the standing height at partial tick t.
  drop(t = 1) {
    return this.prevYSize + (this.ySize - this.prevYSize) * t;
  }
}

// EntityPlayer.attackTargetEntityWithCurrentItem (yz.r(Entity)V). `critical` is the
// jump-attack test: fallDistance > 0, not on the ground, not on a ladder, not in water, no
// blindness, not riding, and the target is a living entity. Damage then becomes damage * 1.5F.
export function isCritical({ fallDistance = 0, onGround = false, onLadder = false, inWater = false, blind = false, riding = false } = {}) {
  return fallDistance > 0 && !onGround && !onLadder && !inWater && !blind && !riding;
}
export function criticalDamage(damage) {
  return damage > 0 ? f(damage * f(1.5)) : damage;
}
// The sprint (or Knockback enchantment) push: target.addVelocity(-sin(yaw)*i*0.5F, 0.1, cos(yaw)*i*0.5F)
// with Java float arithmetic, then the attacker's own motionX/Z * 0.6 and sprinting off.
export const ATTACK_SLOWDOWN = 0.6;
