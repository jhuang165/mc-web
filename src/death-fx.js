// Batch 59: the client copy of a dying mob (EntityLivingBase.onEntityUpdate -> onDeathUpdate, sv.aF, on every client entity).
// Executed (tools/probes/DeathFxProbe.java, public/research/deathfx-reference.json: the unchanged sv.C on a client world double for a zombie, pig, piglet and horse) and bytecode-read (sv.aF):
// each onEntityUpdate of a copy whose health is 0 does ++deathTime; at 20 it calls setDead (the xp / drops part is server only: `!isRemote`), then draws 20 "explode" particles
// from the copy's OWN Entity.rand: per particle three nextGaussian() * 0.02 (velocity), then x = posX + nextFloat * width * 2 - width, y = posY + nextFloat * height, z likewise.
// The copy's position is the one it has when onEntityUpdate runs, i.e. BEFORE onLivingUpdate's interpolation of that tick. A dead copy draws no living sound roll.
// The server's copy of the same call draws on the live mob's Random and spawns nothing visible (World.spawnParticle is a no-op there).
import { JavaRandom } from "./java-random.js";
import { burst } from "./fx.js";
import { deathTipAngle } from "./damage-fx.js";

export const DEATH_TIME_MAX = 20;
const NO_DEATH_FX = new Set(["ender_dragon", "ender_crystal"]); // their client classes have their own death code (dragon.js, crystal)

// Entity.rand of a copy: unseeded in Java (a replay may set c.rand first).
export const deathRandom = (c) => (c.rand ??= new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))));

// One onDeathUpdate on the copy `c` (a ClientEntity with .dead, .x/.y/.z, .width/.height, .fx). Returns true on the tick that makes the particles.
export function copyDeathUpdate(c, rand = null) {
  if (!c.dead || c.deathDone || NO_DEATH_FX.has(c.type)) return false;
  c.deathTime = (c.deathTime || 0) + 1;
  if (c.deathTime !== DEATH_TIME_MAX) return false;
  c.deathDone = true; // setDead: the copy is no longer updated
  const sink = { spawn: (name, x, y, z, vx, vy, vz) => c.fx.push({ particle: name, x, y, z, vx, vy, vz }) };
  burst(sink, "explode", 20, { x: c.x, y: c.y, z: c.z, width: c.width ?? 0.6, height: c.height }, rand ?? deathRandom(c));
  return true;
}

// RendererLivingEntity.rotateCorpse's angle of the copy (0 while alive).
export const copyDeathAngle = (c, partial) => (c.deathTime > 0 ? deathTipAngle(c.deathTime, partial) : 0);
