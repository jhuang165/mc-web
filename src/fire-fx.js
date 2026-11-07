// First-person screen overlays and the burning/liquid view terms of Minecraft Java 1.7.10, read from the client JAR with
// javap (public/research/fire-fx.md, fire-fx-reference.json). Nothing here draws: screen-overlays.js turns these numbers
// into quads. Class names are the obfuscated ones: bly ItemRenderer, blt EntityRenderer, baj ActiveRenderInfo, sa Entity,
// yz EntityPlayer, alw BlockLiquid, bma RenderGlobal.
import { normalCube } from "./world.js";

const f = Math.fround;

// ItemRenderer.renderOverlays [bly.b(F)]: alpha test off, then in this order
//   isBurning()                  -> renderFireInFirstPerson [bly.d]
//   isEntityInsideOpaqueBlock()  -> renderInsideOfBlock [bly.a(F,Icon)] for the block it reads
//   isInsideOfMaterial(water)    -> renderWarpedTextureOverlay [bly.c]
// EntityRenderer.renderHand [blt.b(FI)] calls it only when the third-person view is 0 and the view entity is not
// sleeping; it does not look at hideGUI or the game mode.
export function overlayPlan({ burning = false, thirdPerson = 0, sleeping = false, insideOpaque = false, inWater = false } = {}) {
  if (thirdPerson !== 0 || sleeping) return [];
  const plan = [];
  if (burning) plan.push("fire");
  if (insideOpaque) plan.push("block");
  if (inWater) plan.push("water");
  return plan;
}

// renderFireInFirstPerson: colour (1, 1, 1, 0.9), blend SRC_ALPHA / ONE_MINUS_SRC_ALPHA, and two passes of fire layer 1
// (BlockFire.getFireIcon(1), the animated frame of the block atlas). Pass i: translate(-(2i - 1) * 0.24, -0.3, 0),
// rotateY((2i - 1) * 10), then the quad (-0.5, -0.5) .. (0.5, 0.5) at z = -0.5 with u mirrored (the left edge takes maxU)
// and v running up the icon (the bottom edge takes maxV). The modelview is the identity, so the quads sit half a block in
// front of the eye.
export const FIRE_OVERLAY = Object.freeze({ alpha: f(0.9), offsetX: f(0.24), offsetY: f(-0.3), yawDegrees: f(10), half: f(0.5), z: f(-0.5), passes: 2 });
// `icon` is { minU, maxU, minV, maxV } in the native convention (v grows downwards). Returns the quads as four
// { x, y, z, u, v } vertices in the order the Tessellator receives them.
export function fireOverlayQuads(icon, o = FIRE_OVERLAY) {
  const quads = [];
  for (let i = 0; i < o.passes; i++) {
    const s = i * 2 - 1, tx = f(-s * o.offsetX), angle = f(f(s) * o.yawDegrees) * Math.PI / 180, c = Math.cos(angle), n = Math.sin(angle);
    const lo = f(f(0 - 1) / 2), hi = f(lo + 1), z = o.z; // f2 = (0 - f1) / 2, f3 = f2 + f1; the y pair is the same
    const corner = (x, y, u, v) => {
      // glRotatef(a, 0, 1, 0) after the translate: x' = x cos + z sin, z' = -x sin + z cos, then x += tx, y += ty.
      return { x: x * c + z * n + tx, y: y + o.offsetY, z: -x * n + z * c, u, v };
    };
    quads.push([corner(lo, lo, icon.maxU, icon.maxV), corner(hi, lo, icon.minU, icon.maxV), corner(hi, hi, icon.minU, icon.minV), corner(lo, hi, icon.maxU, icon.minV)]);
  }
  return quads;
}

// renderWarpedTextureOverlay: misc/underwater.png (a 16 x 16 tile, repeated), colour (b, b, b, 0.5) with b =
// getBrightness(partial) of the player, blend SRC_ALPHA / ONE_MINUS_SRC_ALPHA, a quad (-1, -1) .. (1, 1) at z = -0.5 with
// u from 4 + du down to du and v from 4 + dv down to dv, where du = -rotationYaw / 64 and dv = rotationPitch / 64. The two
// angles are the player's unwrapped yaw and pitch in degrees; no partial tick is involved.
export const WATER_OVERLAY = Object.freeze({ alpha: f(0.5), scale: f(4), half: 1, z: f(-0.5), divisor: f(64) });
export function waterOverlayQuad({ brightness = 1, yaw = 0, pitch = 0 } = {}, o = WATER_OVERLAY) {
  const du = f(f(-yaw) / o.divisor), dv = f(pitch / o.divisor), b = f(brightness);
  return {
    color: [b, b, b, o.alpha],
    vertices: [
      { x: -1, y: -1, z: o.z, u: f(o.scale + du), v: f(o.scale + dv) }, { x: 1, y: -1, z: o.z, u: f(0 + du), v: f(o.scale + dv) },
      { x: 1, y: 1, z: o.z, u: f(0 + du), v: f(0 + dv) }, { x: -1, y: 1, z: o.z, u: f(o.scale + du), v: f(0 + dv) },
    ],
  };
}

// renderInsideOfBlock: the block atlas, colour (0.1, 0.1, 0.1, 0.5) (blend is not enabled there, so the 0.5 alpha is
// ignored and the icon is just darkened to a tenth), the quad (-1, -1) .. (1, 1) at z = -0.5 with u mirrored like the fire
// and v running up the icon of the block's side 2 (north face).
export const INSIDE_BLOCK_OVERLAY = Object.freeze({ shade: f(0.1), alpha: f(0.5), z: f(-0.5), side: 2 });
export function insideBlockQuad(icon, o = INSIDE_BLOCK_OVERLAY) {
  return {
    color: [o.shade, o.shade, o.shade, o.alpha],
    vertices: [
      { x: -1, y: -1, z: o.z, u: icon.maxU, v: icon.maxV }, { x: 1, y: -1, z: o.z, u: icon.minU, v: icon.maxV },
      { x: 1, y: 1, z: o.z, u: icon.minU, v: icon.minV }, { x: -1, y: 1, z: o.z, u: icon.maxU, v: icon.minV },
    ],
  };
}

// The client player's posY is its eye (yOffset 1.62, less the sneak ySize), and EntityPlayer.getEyeHeight [yz.g] is 0.12, so
// both client-side tests below sample 0.12 above the camera. (The server's EntityPlayerMP answers 1.62 from its feet:
// suffocation.js.)
export const CLIENT_EYE_OFFSET = f(0.12);
export const PLAYER_YOFFSET = f(1.62);

// Entity.isEntityInsideOpaqueBlock [sa.aa] on the client player: the eight corners of the 0.8 wide, 0.1 tall box around
// (x, posY + 0.12, z), EntityPlayer.aa also false while sleeping. `inside` is suffocation.js insideOpaqueBlock.
export const clientInsideOpaque = (inside, world, x, posY, z, width, sleeping = false) => !sleeping && inside(world, x, posY, z, width, CLIENT_EYE_OFFSET);

// Entity.isInsideOfMaterial(water) [sa.a(Material)] at d0 = posY + getEyeHeight(): the block at (x, floor(d0), z) must be
// water and d0 below the cell's top minus (liquidHeightPercent(meta) - 1/9). `waterLevel(x, y, z)` returns the metadata of a
// water cell or -1 for anything else.
export function clientInWater(waterLevel, liquidHeightPercent, x, posY, z) {
  const d0 = posY + CLIENT_EYE_OFFSET, bx = Math.floor(x), by = Math.floor(f(d0)), bz = Math.floor(z), meta = waterLevel(bx, by, bz);
  if (meta < 0) return false;
  return d0 < f(f(by + 1) - f(liquidHeightPercent(meta) - f(0.11111111)));
}

// The block renderOverlays reads when the player is inside an opaque block: the cell (floor posX, floor posY, floor posZ) if
// it is a normal cube, otherwise the last normal cube among eight cells at offsets (+-0.45 width, +-0.1 height, +-0.45
// width) (x and z by width * 0.9, y by height * 0.2) from it, otherwise the first cell again. Air draws nothing.
export function insideOverlayBlock(get, x, posY, z, width, height, isNormal = normalCube) {
  const i = Math.floor(x), j = Math.floor(posY), k = Math.floor(z);
  let block = get(i, j, k);
  if (isNormal(block)) return block;
  for (let l = 0; l < 8; l++) {
    const dx = f(f(f((l >> 0) % 2 - 0.5) * f(width)) * f(0.9)), dy = f(f(f((l >> 1) % 2 - 0.5) * f(height)) * f(0.2)), dz = f(f(f((l >> 2) % 2 - 0.5) * f(width)) * f(0.9));
    const b = get(Math.floor(f(i + dx)), Math.floor(f(j + dy)), Math.floor(f(k + dz)));
    if (isNormal(b)) block = b;
  }
  return block;
}

// Entity.getBrightness(partial) [sa.d(F)] for the water overlay colour: World.getLightBrightness at (floor posX,
// floor(posY - yOffset + height * 0.66), floor posZ), i.e. the brightness table entry of the cell's light level. `feetY` is
// posY - yOffset. Zero when the column is not loaded.
export function playerBrightness(level, table, x, feetY, z, height, loaded = true) {
  if (!loaded) return 0;
  const y = Math.floor(feetY + (height - 0) * 0.66);
  return table[level(Math.floor(x), y, Math.floor(z))];
}

// EntityRenderer.getFOVModifier(partial, false), the hand's projection: 70, then * 60 / 70 while the view block is water
// (ActiveRenderInfo.getBlockAtEntityViewpoint material). With `useSetting` (the world pass) the base is the FOV option times
// the hand modifier, and the water factor applies the same way.
export const HAND_FOV = f(70);
export const WATER_FOV_FACTOR = (fov) => f(f(f(fov) * f(60)) / f(70));
export const handFov = (inWater) => (inWater ? WATER_FOV_FACTOR(HAND_FOV) : HAND_FOV);
export const worldFov = (fov, inWater) => (inWater ? WATER_FOV_FACTOR(fov) : f(fov));

// EntityRenderer.setupFog (blt.a(IF)): in water GL_EXP with density 0.05 under Water Breathing, else 0.1 - respiration * 0.03;
// in lava GL_EXP with density 2.0. Blindness (a linear 5 block fog) wins over both, as potion-fx.js has it.
export const WATER_FOG = Object.freeze({ breathing: f(0.05), base: f(0.1), perRespiration: f(0.03) });
export const LAVA_FOG_DENSITY = f(2);
export const waterFogDensity = ({ breathing = false, respiration = 0 } = {}) => (breathing ? WATER_FOG.breathing : f(WATER_FOG.base - f(f(respiration) * WATER_FOG.perRespiration)));
// EntityRenderer.updateFogColor in water: (0.02 + g, 0.02 + g, 0.2 + g) with g = respiration * 0.2; in lava (0.6, 0.1, 0).
export function waterFogColor(respiration = 0) {
  const g = f(f(respiration) * f(0.2));
  return [f(f(0.02) + g), f(f(0.02) + g), f(f(0.2) + g)];
}
export const LAVA_FOG_COLOR = Object.freeze([f(0.6), f(0.1), 0]);

// Sounds of the burning and extinguishing paths, each from the call site named. `r` is the draw source (nextFloat).
// Entity.moveEntity tail [sa.d, offset 2026]: wet and burning, playSoundAtEntity random.fizz 0.7, 1.6 + (r - r) * 0.4 on the
// entity's own Random (sa.Z), then the counter rests at -fireResistance.
export const entityFizz = (r) => ({ name: "random.fizz", volume: f(0.7), pitch: f(f(1.6) + f(f(f(r()) - f(r())) * f(0.4))) });
// RenderGlobal.playAuxSFX 1004 [bma, offset 1828] (World.extinguishFire's playAuxSFXAtEntity): random.fizz 0.5, 2.6 + (r - r) * 0.8
// at the cell centre, on the world Random.
export const punchFizz = (r) => ({ name: "random.fizz", volume: f(0.5), pitch: f(f(2.6) + f(f(f(r()) - f(r())) * f(0.8))) });
// BlockLiquid.func_149799_m [alw.m]: the same call as the punch (random.fizz 0.5, 2.6 + (r - r) * 0.8) at the cell centre on
// the world Random, followed by 8 largesmoke particles that the integrated server's WorldManager.spawnParticle drops.
export const liquidFizz = punchFizz;
// EntityItem.onUpdate [xk] and EntityXPOrb.onUpdate [sq] in lava: random.fizz 0.4, 2.0 + r * 0.4.
export const lavaFizz = (r) => ({ name: "random.fizz", volume: f(0.4), pitch: f(f(2) + f(f(r()) * f(0.4))) });
// ItemFlintAndSteel [acw], ItemFireball [acq] and EntityCreeper.interact [xz]: fire.ignite 1.0, nextFloat * 0.4 + 0.8.
export const igniteSound = (r) => ({ name: "fire.ignite", volume: 1, pitch: f(f(f(r()) * f(0.4)) + f(0.8)) });
// BlockFire.randomDisplayTick [alb] one in 24 and EntityBlaze [xx]: fire.fire 1 + r, r * 0.7 + 0.3 (display-ticks.js).
export const crackleSound = (r) => ({ name: "fire.fire", volume: f(1 + f(r())), pitch: f(f(f(r()) * f(0.7)) + f(0.3)) });
