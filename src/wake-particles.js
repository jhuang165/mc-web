// EntityFishWakeFX (ble, "wake"), Java 1.7.10: the ripple a fishing bobber makes. Bytecode-read (javap on ble.class and the
// "wake" branch of RenderGlobal.doSpawnParticle, bma); the only native caller of "wake" is EntityFishHook (xe), found by
// scanning every class of the jar for the string. Replayed by src/particles73-b73.test.js against the same arithmetic.
import { setSize } from "./effect-renderer.js";
import { moveParticleEntity } from "./particles.js";

const f = Math.fround;
const DRAG = 0.9800000190734863; // (double)0.98F

// new EntityFishWakeFX(world, x, y, z, vx, vy, vz): the EntityFX constructor with ZERO velocity (five Math.random draws),
// then motionX/Z * 0.3 and a motionY of (float)Math.random() * 0.2F + 0.1F (one more draw, then thrown away: the
// velocity arguments overwrite all three), colour 1, texture 19, a 0.01 box, gravity 0 and a lifetime of
// (int)(8 / (Math.random() * 0.8 + 0.2)).
export function makeWakeParticle(fx, x, y, z, vx, vy, vz) {
  const r = fx.random, p = fx.base("wake", x, y, z, 0, 0, 0);
  r(); // motionY's Math.random(): the value is replaced below
  p.r = p.g = p.b = 1;
  p.tex = 19;
  setSize(p, f(0.01), f(0.01));
  p.max = Math.trunc(8 / (r() * 0.8 + 0.2));
  p.gravity = 0;
  p.mx = vx;
  p.my = vy;
  p.mz = vz;
  return p;
}

// EntityFishWakeFX.onUpdate: motionY -= gravity (0), move, drag 0.98, then with k = 60 - maxAge (the lifetime counts down
// to zero here) the box shrinks to k * 0.001, the texture is 19 + k % 4, and the particle dies when the counter was
// already <= 0 before this tick's decrement.
export function stepWake(world, p) {
  p.px = p.x;
  p.py = p.y;
  p.pz = p.z;
  p.my -= p.gravity;
  moveParticleEntity(world, p, p.mx, p.my, p.mz);
  p.mx *= DRAG;
  p.my *= DRAG;
  p.mz *= DRAG;
  const k = 60 - p.max, size = f(k * f(0.001));
  setSize(p, size, size);
  p.tex = 19 + (k % 4);
  if (p.max-- <= 0) p.dead = true;
}
