// Batch 66 mpgolems: the client half of the server's iron golems (server-golems.js has the native facts).
// EntityIronGolem.handleHealthUpdate (wt.a(byte), bytecode-read): status 4 sets attackTimer = 10 and plays mob.irongolem.throw (volume 1, pitch 1) at the copy; status 11 sets holdRoseTick = 400.
// Both counters count down once per client tick at the end of onLivingUpdate (iron-golem.js golemTail without the walking dust, which a copy draws from its own block): the renderer
// (iron-golem-renderer.js animateIronGolem) reads `attackTimer` and `holdRose` on the stand-in mob.
import { golemTail } from '../iron-golem.js';
export function golemStatus(mob, status, at, sound) {
  if (mob.type !== 'iron_golem') return false;
  if (status === 4) { mob.attackTimer = 10; sound?.('mob.irongolem.throw', at.x, at.y, at.z, 1, 1); return true; }
  if (status === 11) { mob.holdRose = 400; return true; }
  return false;
}
// EntityIronGolem.onLivingUpdate's walking dust runs on the client copy too (the particle call is under no isRemote test, bytecode-read wt.e): with the copy's own horizontal
// motion squared above 2.5E-7 (S12 velocity, then the copy's drag and the 0.005 clamp, so it is the ClientEntity's vx / vz) and a 1 in 5 roll on the copy's Entity.rand, a blockcrack of the
// block 0.2 below its feet is thrown across its width. iron-golem.js golemTail makes the draws; the counters belong to golemTick, so it gets a throwaway record.
export function golemDust(client, mob, rand, blockAt) {
  if (mob.type !== 'iron_golem' || mob.health <= 0 || client.gone) return null;
  return golemTail({ attackTimer: 0, holdRose: 0, x: client.x, y: client.y, z: client.z, vx: client.vx, vz: client.vz }, rand, blockAt);
}
export function golemTick(mob) {
  if (mob.type !== 'iron_golem') return;
  if (mob.attackTimer > 0) --mob.attackTimer;
  if (mob.holdRose > 0) --mob.holdRose;
}
