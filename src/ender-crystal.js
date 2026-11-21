// EntityEnderCrystal (wz) from Minecraft Java 1.7.10. Pure rules, no imports. Evidence:
// public/research/end-reference.json (crystal*, facts), notes in public/research/end.md.
export const ENDER_CRYSTAL = "ender_crystal";
export const CRYSTAL_WIDTH = 2, CRYSTAL_HEIGHT = 2, CRYSTAL_HEALTH = 5;
export const CRYSTAL_EXPLOSION_POWER = 6;
// b88 boatray88 (bytecode-read, javap -c -p): wz.<init> calls setSize(2.0F, 2.0F) and then puts height / 2 = 1.0F in yOffset (sa.L); Entity.setPosition (sa.b(DDD))
// builds the box from posY - yOffset + ySize, and the port's crystal `y` is posY (WorldGenSpikes asl spawns it through setLocationAndAngles, which adds yOffset:
// posY = top of the pillar + 1; the client's spawn object packet 51 builds wz(world, x, y, z), whose setPosition takes the packet's posY). So the box is centred on
// posY: [x - 1, posY - 1, z - 1, x + 1, posY + 1, z + 1], not a feet box. canBePushed (sa.S) and getBoundingBox (sa.J) are not overridden (false / null).
export const crystalBox = (x, posY, z) => [x - 1, posY - 1, z - 1, x + 1, posY + 1, z + 1];
export const CRYSTAL_FIRE = 51;
// b89 mpobjects89 (bytecode-read): wz overrides no getEyeHeight (sa.g()F is fconst_0), so the crystal's eye height is 0; sv.g()F (EntityLivingBase) is
// height * 0.85F, which the crystal (an sa, not an sv) never runs. EntityPlayerMP's attack and interact reach check (NetHandlerPlayServer) reads it.
export const CRYSTAL_EYE_HEIGHT = 0;
// b89 mpobjects89: CommandSummon (bu.b, bytecode-read) builds the entity with EntityList.createEntityFromNBT and places it with setLocationAndAngles
// (sa.b(DDDFF): posY = y + yOffset), so a summoned crystal's posY is the command y + 1 (executed: summon87-reference.json `base` EnderCrystal Pos[1] 65.5
// where Pig and FireworksRocketEntity read 64.5 at the same command position). The port's crystal `y` is posY.
export const CRYSTAL_Y_OFFSET = 1;
export function liftSummonedCrystal(e) {
  if (!e || e.type !== ENDER_CRYSTAL) return e;
  e.y += CRYSTAL_Y_OFFSET;
  if (e.py !== undefined) e.py = e.y;
  return e;
}
// b89 mpobjects89 (bytecode-read): TileEntityPiston moves a crystal with Entity.moveEntity (sa.d), which moves the posY-centred box and sets posY =
// minY + yOffset - ySize. The crystal's stepHeight (sa.W) is never set (0), canTriggerWalking (wz.g_) is false (no step sound) and Entity.fall does nothing
// for it. `move` is entities.js moveEntity(world, e, w, h, dx, dy, dz, step): it moves the box whose bottom is e.y, so e.y is the box bottom during the call.
export function crystalPushMove(world, e, dx, dy, dz, move, hooks) {
  e.y -= CRYSTAL_Y_OFFSET;
  try { return move(world, e, CRYSTAL_WIDTH, CRYSTAL_HEIGHT, dx, dy, dz, 0, hooks); } finally { e.y += CRYSTAL_Y_OFFSET; }
}
// b90 mpobjects90 (bytecode-read): sa.d ends with doBlockCollisions (sa.I at offset 1887, called with no class test) and the burning-box test (ahb.e(box.contract(0.001)) at 1955, then
// dealFireDamage f(1)); wz overrides neither, and wz.a(ro, float) explodes the crystal for ANY source (only isEntityInvulnerable refuses). So a crystal a piston pushes into a cactus or
// into fire or lava is hurt (cactus 1, inFire 1) and goes off at its posY. The hooks are block-collisions.js's: `hurt` explodes through `attack`; wet is false (wz.h never runs sa.h,
// so the crystal's inWater is never set, and a burning crystal is dead already). While the move runs e.y is the box bottom, so the attack sees posY again.
export function crystalPushHooks(e, attack) {
  return { wet: false, hurt: () => { e.y += CRYSTAL_Y_OFFSET; try { attack(e); } finally { e.y -= CRYSTAL_Y_OFFSET; } } };
}
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
// living crystal drops to health 0, dies and explodes at power 6 (createExplosion: smoking, NOT flaming; b65 bytecode). The client
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
