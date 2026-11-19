// b83 tracker83: Entity.handleWaterMovement's splash for EntityFireball and its subclasses (ghast and blaze fireballs, wither skulls) and their multiplayer client copies.
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * ze.h (EntityFireball.onUpdate) calls super.onUpdate -> sa.h -> sa.C (onEntityUpdate), which calls sa.N (handleWaterMovement) at offset 467 and clears `firstUpdate`
//     (sa.f) at 623. ze, zg, zi and zp override neither N() nor O() (getSplashSound: "game.neutral.swim.splash").
//   * sa.N: when World.handleMaterialAcceleration(box.expand(0, -0.4, 0).contract(0.001), water, this) answers true and the entity was not in water (sa.ac) and it is not its
//     first update: volume = min(1, sqrt(mx^2 * 0.2 + my^2 + mz^2 * 0.2) * 0.2F) of the motion with the flow push already added, then playSound(O(), volume,
//     1 + (nextFloat - nextFloat) * 0.4F), then 1 + width * 20 "bubble" (two floats for the spread, a third for the downward speed) and as many "splash" (two floats) at
//     floor(box.minY) + 1, all on Entity.rand. Then inWater = true and extinguish; out of water inWater = false.
//   * playSound (sa.a(String, F, F)) is World.playSoundAtEntity: on the server WorldManager sends S29 to the players near; on a client world RenderGlobal.playSound is empty.
//     World.spawnParticle reaches nobody on the server (WorldManager.spawnParticle is empty), so the server ball only draws its Random, and the client copy draws the particles
//     (and the silent sound's two floats) on its own Entity.rand.
import { enterWater } from "./fx.js";
import { JavaRandom } from "./java-random.js";

export const SPLASH_SOUND = "game.neutral.swim.splash"; // Entity.getSplashSound (sa.O)

const ownRandom = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48)); // Entity.rand: new Random()

/**
 * One handleWaterMovement splash test for ball `b` (x/y/z its position before the move, vx/vy/vz its motion with the flow push). `wet`: this update's water test; `minY` the
 * box bottom the test used; `width` Entity.width. `sound(volume, pitch)`: the server side's S29 (null: silent), `fx`: { spawn } for the particles (null: draws only).
 * `rand`: the entity's Random (made on first use when absent). Tracks `b.inWater` and the first update (`b.splashSeen`). Returns { volume, pitch } when it splashed.
 */
export function ballSplash(b, wet, minY, width, { sound = null, fx = null, rand = null } = {}) {
  const first = !b.splashSeen, was = !!b.inWater;
  b.splashSeen = true; b.inWater = !!wet;
  if (!wet || was || first) return null;
  return enterWater(fx, { x: b.x, z: b.z, minY, width, mx: b.vx, my: b.vy, mz: b.vz }, rand ?? ownRandom(), sound);
}

/**
 * The server ball's splash (dedicated server and single player): the sound event on the ball's own Random (`b.rand`), plus, where `mobs.fx` exists (single player draws the
 * integrated client's copy too), the particles on a second Random standing for the client copy's.
 */
export function serverBallSplash(mobs, b, wet, minY, width) {
  const was = !!b.inWater, first = !b.splashSeen;
  const hit = ballSplash(b, wet, minY, width, { rand: (b.rand ??= ownRandom()), sound: (volume, pitch) => mobs.events?.push({ sound: SPLASH_SOUND, volume, pitch, position: { x: b.x, y: b.y, z: b.z } }) });
  if (hit && mobs.fx) enterWater(mobs.fx, { x: b.x, z: b.z, minY, width, mx: b.vx, my: b.vy, mz: b.vz }, (b.copyRand ??= ownRandom()));
  return hit && { ...hit, was, first };
}
