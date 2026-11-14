// Batch 68 fixes68: where a lying player's eye and posY are on the server (EntityPlayerMP, yz = EntityPlayer, bytecode-read).
// yz.a(III) (sleepInBedAt) does setSize(0.2, 0.2), yOffset = 0.2, setPosition(x, y + 0.9375, z): posY = bed y + 0.9375 and the box minY = posY - yOffset.
// EntityPlayerMP's yOffset is 0 otherwise, so posY is the box's minY. mw.g (getEyeHeight) is the fixed float 1.62 (eye-height-reference.json), also while lying,
// so the eye of a sleeper is posY + 1.62 = minY + 0.2 + 1.62. Explosion.doExplosionA, canEntityBeSeen and the use-entity reach read posY and posY + getEyeHeight.
const f = Math.fround;
export const SLEEP_Y_OFFSET = f(0.2), PLAYER_EYE = f(1.62), SLEEP_BOX = f(0.2);
// `y` is the port's box minY (position.y).
export const serverPosY = (y, sleeping) => (sleeping ? y + SLEEP_Y_OFFSET : y);
export const serverEyeY = (y, sleeping) => serverPosY(y, sleeping) + PLAYER_EYE;
// b69 mpfixes69: the server ray stands in for the aim of a native client, whose ray starts at getPosition(1.0) = (posX, posY, posZ) of EntityPlayerSP (sv.l, bytecode-read; the client posY is the eye,
// yOffset 1.62), and sleepInBedAt sets yOffset 0.2 on both sides: a lying player aims from posY = minY + 0.2, not from minY + 1.62. Standing, the origin is the port's eye (minY + `eye`).
export const aimOriginY = (y, sleeping, eye = PLAYER_EYE) => (sleeping ? serverPosY(y, true) : y + eye);
