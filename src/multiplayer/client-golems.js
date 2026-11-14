// Batch 66 mpgolems: the client half of the server's iron golems (server-golems.js has the native facts).
// EntityIronGolem.handleHealthUpdate (wt.a(byte), bytecode-read): status 4 sets attackTimer = 10 and plays mob.irongolem.throw (volume 1, pitch 1) at the copy; status 11 sets holdRoseTick = 400.
// Both counters count down once per client tick at the end of onLivingUpdate (iron-golem.js golemTail without the walking dust, which a copy draws from its own block): the renderer
// (iron-golem-renderer.js animateIronGolem) reads `attackTimer` and `holdRose` on the stand-in mob.
export function golemStatus(mob, status, at, sound) {
  if (mob.type !== 'iron_golem') return false;
  if (status === 4) { mob.attackTimer = 10; sound?.('mob.irongolem.throw', at.x, at.y, at.z, 1, 1); return true; }
  if (status === 11) { mob.holdRose = 400; return true; }
  return false;
}
export function golemTick(mob) {
  if (mob.type !== 'iron_golem') return;
  if (mob.attackTimer > 0) --mob.attackTimer;
  if (mob.holdRose > 0) --mob.holdRose;
}
