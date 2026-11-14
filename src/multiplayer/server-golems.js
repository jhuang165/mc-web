// Batch 66 mpgolems: player-built golems and silverfish on the dedicated server.
// Single player's EntityWorld (the world the server's mobs already run in) holds all the rules: `tryBuildGolem` (BlockPumpkin.onBlockAdded, mooshroom-golem-live.js), the iron golem's
// village AI and attack (iron-golem.js, village-ai.js), the snow golem's trail, melting and snowballs (snow-golem.js, GolemBalls), the silverfish' legacy AI and monster egg code
// (silverfish.js). This module only adds what a server needs around them:
//   * the kinds join ServerMobs' SUPPORTED set (GOLEM_KINDS),
//   * `ServerGolems.afterPlace` - the pumpkin or jack-o'-lantern a player just placed completes a snow golem (two snow blocks) or an iron golem (iron T), a player-created one,
//   * S19 status 4 / 11 for the iron golem (attack arm, flower arm) and the `spawnerPuff` clients draw for a silverfish that hides or comes out of a monster egg (status 20),
//   * a monster egg a player breaks lets silverfish out (`releaseSilverfish`, passed to breakPlayerBlock by simulation.js).
// Bytecode-read (javap on the unchanged 1.7.10 jar):
//   * BlockPumpkin.onBlockAdded (amw.b): inside `if (!world.isRemote)` the cells go to air with setBlock flag 2 (no break effect, no level event 2001) and the entity spawns;
//     the 120 `snowshovel` (snow) / `snowballpoof` (iron) world.spawnParticle calls follow. WorldManager.spawnParticle (mp.a(String, 6 doubles)) is a bare `return`, so a dedicated
//     server sends NO particles: nothing is sent here either. (The brief's "block break aux 2001 per removed block" is not what the class does.)
//   * EntityIronGolem (wt): a(byte) 4 -> attackTimer = 10 and playSound mob.irongolem.throw; 11 -> holdRoseTick = 400. wt.a(boolean) sets holdRoseTick to 400 or 0 AND ALWAYS sends
//     state 11, so the client copy raises its arm for 400 ticks even when the server ended the offer (kept: `golemStatuses` sends 11 on any server-side set).
//   * BlockSilverfish (amb): onBlockDestroyedByPlayer (b) and dropBlockAsItemWithChance (a) each spawn a yk at (x + 0.5, y, z + 0.5), yaw 0, then call yk.s() (the status 20 puff).
import { eggSpawn } from '../silverfish.js';
import { PUMPKIN } from '../world.js';

export const GOLEM_KINDS = ['iron_golem', 'snow_golem', 'silverfish'];
export const JACK_O_LANTERN = 148; // this build's lit pumpkin (original 91)

// Entity.worldObj.setEntityState(20): the puff of a silverfish that appears or hides. Rides the dispatcher's dispFx like a spawner's (client-spawners.js, spawnerPuff).
export function puff(sm, e) {
  const d = sm.host.dispense;
  if (!d) return;
  const [w, h] = sm.mobs.size(e);
  d.fx.push({ k: 'spawnerPuff', x: e.x, y: e.y, z: e.z, w, h });
}

export class ServerGolems {
  constructor(sim) { this.sim = sim; }
  // `put` is placeHeldBlock's result for a player's click. Returns the cleared cells (the world's change map carries them to the clients) or null.
  afterPlace(put) {
    if (!put?.placed || (put.block !== PUMPKIN && put.block !== JACK_O_LANTERN) || !put.position) return null;
    const [x, y, z] = Array.isArray(put.position) ? put.position : [put.position.x, put.position.y, put.position.z];
    return this.sim.mobs?.mobs.tryBuildGolem(x, y, z) ?? null;
  }
  // breakPlayerBlock's `releaseSilverfish` for the player's dimension (sim.mobs is that dimension's inside dimensions.within).
  release(x, y, z) { return this.sim.mobs?.mobs.spawnSilverfishAt(x, y, z) ?? null; }
}

// Called once by ServerMobs' constructor (every dimension's instance).
// `limit` is ServerMobs' MOB_LIMIT (passed in: this module is imported by server-mobs.js, a cycle otherwise).
export function installServerGolems(sm, limit) {
  const mobs = sm.mobs, seen = new WeakMap();
  // A silverfish out of an egg: the server's cap is `limit` (single player keeps 40 mobs in a save), and the clients draw the puff.
  mobs.spawnSilverfishAt = (x, y, z) => {
    if (mobs.entities.length >= limit) return null;
    const at = eggSpawn(x, y, z), e = mobs.create('silverfish', at.x, at.y, at.z);
    for (const k of ['rotationYaw', 'prevRotationYaw', 'renderYawOffset', 'prevRenderYawOffset', 'rotationYawHead', 'prevRotationYawHead', 'bodyHeadYaw']) e[k] = at.yaw;
    e.yaw = 0;
    mobs.entities.push(e);
    puff(sm, e);
    return e;
  };
  // A silverfish that hides in stone is removed through ai.despawn after the egg is set (yk.bq: explosion particles, setDead): the puff is drawn where it stood.
  const think = mobs.silverfishThink;
  mobs.silverfishThink = function (e) {
    const ai = this.ai, despawn = ai.despawn;
    let hid = false;
    ai.despawn = function (x) { if (x === e) hid = true; return despawn.call(this, x); };
    try { return think.call(this, e); } finally { ai.despawn = despawn; if (hid) puff(sm, e); }
  };
  // EntityIronGolem's state 4 / 11: the counters are set by the AI (attackTimer 10 on a strike, holdRose 400 / 0 around the poppy offer) and count down once a tick in golemTailTick,
  // so a value that is not the previous one minus one (down to 0) was set by the server this tick.
  const tail = mobs.golemTailTick;
  mobs.golemTailTick = function (e) {
    const r = tail.call(this, e), was = seen.get(e) ?? { attackTimer: 0, holdRose: 0 };
    if (e.attackTimer !== Math.max(was.attackTimer - 1, 0) && e.attackTimer > 0) sm.status(e, 4);
    if (e.holdRose !== Math.max(was.holdRose - 1, 0)) sm.status(e, 11);
    seen.set(e, { attackTimer: e.attackTimer, holdRose: e.holdRose });
    return r;
  };
  // b67: a snowball meets a player (Entity.canBeCollidedWith) and is consumed; the hit does 0 damage and, since EntityPlayer.attackEntityFrom returns false at 0 (yz.a, bytecode-read), no knockback.
  mobs.golemBalls.playerTargets = () => {
    const hw = Math.fround(0.3), out = [];
    for (const v of sm.views.values()) {
      const p = v.player;
      if (!p?.survival || p.dead || p.survival.health <= 0) continue;
      out.push({ ref: p, box: [p.position.x - hw, p.position.y, p.position.z - hw, p.position.x + hw, p.position.y + Math.fround(1.8), p.position.z + hw] });
    }
    return out;
  };
  mobs.golemBalls.projectiles.clientParticles = true; // the poof of a snowball is the clients' (they see the ball vanish: dispense snapshot)
}
