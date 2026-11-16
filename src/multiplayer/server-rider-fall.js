// b73 mpriders73: the fall a server boat or cart passes to the player riding it (Entity.fall -> EntityPlayer.fall -> EntityLivingBase.fall).
// One path with single player: vehicle-simulation.js syncRider builds `rider.fall` (Jump Boost, the CombatTracker fall entry, landingEffects).
// The sounds it plays (game.player.hurt.fall.small/big or damage.fallsmall/fallbig, then the landing block's step sound) go out as S29
// (`sim.soundsOut`). EntityPlayer.playSound is World.playSoundToNearExcept(self) (bytecode-read yz.a), but the dedicated client predicts no
// riding fall of its own, so the sound is sent to everyone in range, the rider included (`except: null`). EntityPlayer.fall also adds the
// distance-fallen statistic (>= 2 blocks, not in Creative; stats-live.js addFallStat).
import { syncRider } from '../vehicle-simulation.js';
import { addFallStat } from '../stats-live.js';

export function serverRiderFall(host, p) {
  const probe = { player: true, x: 0, y: 0, z: 0, yaw: 0, fallDistance: 0, vehicle: null, dead: false };
  const state = { rider: probe, position: p.position, survival: p.survival, yaw: p.yaw, world: host.world, wasInWater: false,
    get fallDistance() { return p.fallDistance ?? 0; },
    fallSound: s => host.soundsOut?.push({ name: s.name, x: p.position.x, y: p.position.y, z: p.position.z, volume: s.volume, pitch: s.pitch, except: null }) };
  syncRider(state);
  const fall = probe.fall;
  const out = distance => {
    if (p.stats) addFallStat(p.stats, distance, p.survival.creative);
    state.yaw = p.yaw;
    fall(distance);
  };
  out.hit = points => { state.yaw = p.yaw; probe.fallHit(points); }; // b77 mphorserules77: EntityHorse.fall's damage to the rider
  return out;
}
