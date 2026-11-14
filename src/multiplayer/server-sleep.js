// Beds and sleeping on the dedicated server (batch 66 mpsleep). The single-player modules do the rules (src/bed.js: BedSleep, activateBed, bedSpawnSpot,
// verifyRespawn, bedExplosion in dimension-live.js); this module is the server glue: WorldServer's all-players-asleep night skip, EntityPlayerMP's wake and
// S0A / S0B, NetHandlerPlayServer's C0B action 3, ServerConfigurationManager.respawnPlayer's bed check.
// Bytecode-read (1.7.10 jar: BlockBed ajh, EntityPlayer yz, EntityPlayerMP mw, WorldServer mt, World ahb, NetHandlerPlayServer nh, ServerConfigurationManager oi):
//  - ajh.a (onBlockActivated, server side): the foot half redirects to the head; !provider.canRespawnHere() (Nether, End) removes both halves and explodes at the head
//    centre, power 5, flaming and smoking; an occupied bit with no sleeper whose bedLocation is that cell is cleared, with one it answers tile.bed.occupied; then
//    sleepInBedAt: OK sets the occupied bit, NOT_POSSIBLE_NOW answers tile.bed.noSleep, NOT_SAFE tile.bed.notSafe (TOO_FAR_AWAY and OTHER_PROBLEM are silent).
//  - mw.a(III) (sleepInBedAt): on OK the EntityTracker sends S0A (hp) to the trackers, setPlayerLocation, then S0A to the player itself. mw.a(ZZZ) (wakeUpPlayer):
//    S0B animation 2 (gc) to the trackers and the player, EntityPlayer.wakeUpPlayer, then setPlayerLocation.
//  - mt.b (WorldServer.tick): after World.tick's weather, areAllPlayersAsleep (mt.e: the flag, not remote, every playerEntity isPlayerFullyAsleep) sets the world time to
//    (time + 24000) - (time + 24000) % 24000 when doDaylightCycle, then wakeAllPlayers (mt.d: the flag cleared, wakeUpPlayer(false, false, true) for each sleeper,
//    then resetRainAndThunder mt.Y: rain time 0, raining false, thunder time 0, thundering false). The world time then advances by one, later in the same tick.
//    mt.c (updateAllPlayersSleepingFlag) runs when a player sleeps, wakes with update, joins or leaves (ahb spawnEntityInWorld / removeEntity); it is a function of the
//    player list and their sleeping flags, so here it is computed when read.
//  - nh.a(jj) (C0B): action 3 is wakeUpPlayer(false, true, true) and hasMoved = false. nh.a(jd) (C03): a sleeping player's movement packets only run onUpdateEntity
//    and put it back at its last position.
//  - yz.a(ro, float) (attackEntityFrom): not invulnerable, not Creative (except the void), health above 0, then a sleeper is woken with wakeUpPlayer(true, true, false)
//    BEFORE the zero-amount and difficulty checks. EntityPlayerMP.attackEntityFrom returns first for spawn protection and for a PvP-disabled player attacker.
//  - oi.a(mw, int, boolean) (respawnPlayer): the new EntityPlayerMP is placed at EntityPlayer.verifyRespawnCoordinates(world, bedLocation, forced) + (0.5, 0.1, 0.5); only a
//    verified spawn is copied to the new player (setSpawnChunk(location, forced)). A failed one sends S2B game state 0 (tile.bed.notValid) and leaves the player at the world spawn
//    with NO spawn point any more (clonePlayer does not copy it).
//  - my (EntityTrackerEntry): a tracker that starts to see a sleeping player gets S0A as well (here: `sleep` in the presence rows).
// b67 bytecode-read: yz.a(III) sets yOffset 0.2 and setPosition(x, y + 0.9375, z), so the lying box minY is y + 0.7375 (BedSleep.boxY). A sleeper is never refused a click: NetHandlerPlayServer's C07/C08/C02/C0E/C09 have no sleeping test (only C03 movement and the C0B leave do), isMovementBlocked (yz.bh) zeroes the input in EntityLivingBase.onLivingUpdate.
// Wire (all `sleep` prefixed): server to player `sleepIn` {x, y, z, facing}, `sleepWake` {}, `sleepMsg` {key}; player to server `sleepLeave`. Other players see the pose through
// the presence row field `sleep: [x, y, z, facing]`.
import { BedSleep, BED, BED_TEXT, activateBed, bedRespawnPosition, isDaytime, mobInBox, nextMorning, verifyRespawn } from '../bed.js';
import { bedExplosion } from '../dimension-live.js';
import { ENTITY_TYPES } from '../entities.js';

const KEYS = Object.freeze({ noSleep: () => BED_TEXT.noSleep, notSafe: () => BED_TEXT.notSafe, occupied: () => BED_TEXT.occupied, notValid: () => BED_TEXT.notValid });

/** World.resetRainAndThunder (WorldServer.Y). The weather owner (mplightning) may define its own `resetRainAndThunder`; it is preferred. */
export function resetRainAndThunder(weather) {
  if (typeof weather.resetRainAndThunder === 'function') { weather.resetRainAndThunder(); return; }
  weather.rainTime = 0; weather.raining = false; weather.thunderTime = 0; weather.thundering = false;
}

export class ServerSleep {
  constructor(sim) { this.sim = sim; }
  out(p, message) { (p.itemsOut ??= []).push(message); }
  // EntityPlayer.attackEntityFrom wakes a sleeper first: the wrapper runs before every Survival.damage of a server player (hit, fall, fire, hunger, explosion).
  join(p) {
    const s = p.survival, damage = s.damage.bind(s);
    s.damage = (n, reason, ...rest) => { this.attacked(p, reason); return damage(n, reason, ...rest); };
  }
  attacked(p, reason = '', from = null) {
    const s = p.survival;
    if (!p.sleeping || p.dead || s.health <= 0) return false;
    const voidDamage = reason === 'the void' || reason === 'void';
    if (s.creative && !voidDamage) return false;
    if (s.protection > 0 && !voidDamage) return false; // EntityPlayerMP.attackEntityFrom: spawn protection returns before EntityPlayer's
    if (from && this.sim.pvpRules && !this.sim.pvpRules.allows(from, p)) return false; // canAttackPlayer
    return this.wake(p, true, true, false);
  }
  // The players of the Overworld (WorldServer.playerEntities of dimension 0).
  overworld() { return [...this.sim.players.values()].filter(p => !(p.dimension | 0)); }
  // mt.e areAllPlayersAsleep: every player of the world lies, and every one for 100 ticks.
  allAsleep() {
    const list = this.overworld();
    return list.length > 0 && list.every(p => p.bedSleep?.sleeping) && list.every(p => p.bedSleep.fullyAsleep);
  }
  // WorldServer.tick, run right after the weather update in the simulation tick: the night is skipped and everyone wakes.
  worldTick() {
    if (!this.allAsleep()) return false;
    const sim = this.sim;
    if (String(sim.gameRules?.doDaylightCycle ?? 'true').toLowerCase() === 'true') sim.time = nextMorning(sim.time - 1) + 1; // the port advances the clock earlier in the tick than WorldServer: undo this tick's +1 first
    for (const p of this.overworld()) if (p.sleeping) this.wake(p, false, false, true); // wakeAllPlayers
    resetRainAndThunder(sim.weather);
    return true;
  }
  // EntityPlayer.onUpdate's sleep branch for one player (the timer, the missing-bed and morning wake-ups); the lying body is held still by movePlayer (p.sleeping).
  tickPlayer(p) {
    const s = p.bedSleep;
    if (!s || (!s.sleeping && s.timer === 0) || (p.dimension | 0)) return;
    if (s.sleeping) { p.yaw = s.look.yaw; p.pitch = s.look.pitch; } // the head keeps the yaw and pitch of the bed entry
    const call = s.tick(this.sim.world, isDaytime(this.sim.darkness));
    if (call) this.wake(p, call[0], call[1], call[2]);
  }
  // BlockBed.onBlockActivated on the server world of the player's dimension. Returns true when the click is used up.
  use(p, x, y, z) {
    const sim = this.sim, world = sim.world;
    if (p.dead || world.get(x, y, z) !== BED) return false;
    const boom = bedExplosion(world, x, y, z); // Nether and End: both halves vanish, power 5 with fire
    if (boom) {
      if (boom.cells.length) { sim.mobs.explode({ x: boom.x, y: boom.y, z: boom.z, size: boom.size, source: null, smoking: true, flaming: true }); sim.mobs.burst(boom.x, boom.y, boom.z, boom.size); }
      return true;
    }
    const s = p.bedSleep ??= new BedSleep();
    const ctx = {
      player: { x: p.position.x, y: p.position.y, z: p.position.z, alive: !p.dead },
      daytime: isDaytime(sim.darkness),
      monsterNear: box => mobInBox(sim.mobs?.mobs?.entities, box, ENTITY_TYPES),
      otherSleeperAt: (hx, hy, hz) => this.overworld().some(q => q.bedSleep?.sleeping && q.bedSleep.bed[0] === hx && q.bedSleep.bed[1] === hy && q.bedSleep.bed[2] === hz),
    };
    const out = activateBed(world, x, y, z, s, ctx);
    if (out.message) this.out(p, { type: 'sleepMsg', key: Object.keys(KEYS).find(k => KEYS[k]() === out.message) });
    if (s.sleeping && !p.sleeping) this.enter(p);
    return out.handled !== false;
  }
  // EntityPlayerMP.sleepInBedAt after OK: S0A, the player lies on the mattress.
  enter(p) {
    const s = p.bedSleep, sim = this.sim;
    if (sim.vehicles?.riding(p)) sim.vehicles.dismount(p); // sleepInBedAt: if (isRiding()) mountEntity(null)
    s.look = { yaw: p.yaw, pitch: p.pitch };
    p.sleeping = true; p.itemInUse = null;
    p.position.copy({ x: s.pos.x, y: s.boxY, z: s.pos.z }); // b67: posY - yOffset = y + 0.7375 (bytecode-read), not the mattress top
    p.previous.copy(p.position);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    this.out(p, { type: 'sleepIn', x: s.bed[0], y: s.bed[1], z: s.bed[2], facing: s.facing });
  }
  // EntityPlayer.wakeUpPlayer(resetTimer, updateWorld, setSpawn) with EntityPlayerMP's S0B and relocation. Returns true when the player was sleeping.
  wake(p, resetTimer, _updateWorld, setSpawn) {
    const s = p.bedSleep;
    if (!s?.sleeping) return false;
    const head = s.bed, feet = s.wake(this.sim.world, resetTimer, setSpawn); // the occupied bit is cleared (a tracked world write)
    p.sleeping = false;
    p.position.copy(feet); p.previous.copy(feet);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    if (setSpawn) { p.spawnpoint = [head[0], head[1], head[2]]; p.spawnForced = false; } // setSpawnChunk(playerLocation, false)
    this.out(p, { type: 'sleepWake' });
    return true;
  }
  // C0B action 3 (leave bed): wakeUpPlayer(false, true, true).
  leave(id) {
    const p = this.sim.players.get(id);
    return !!p && this.wake(p, false, true, true);
  }
  // A player who disconnects while lying: the bed is freed and they stand beside it (the save restores them with wakeUpPlayer(true, true, false)).
  logout(p) { if (p?.sleeping) this.wake(p, true, true, false); }
  // ServerConfigurationManager.respawnPlayer: the spawn point is verified in the Overworld; a missing bed answers tile.bed.notValid and drops the spawn point.
  respawnPoint(p) {
    const world = this.sim.dimensions?.overworld ?? this.sim.world;
    if (p.spawnpoint) {
      const cell = verifyRespawn(world, p.spawnpoint, p.spawnForced !== false);
      if (cell) return bedRespawnPosition(cell);
      p.spawnpoint = null; p.spawnForced = undefined; // only a verified spawn is copied to the new player
      this.out(p, { type: 'sleepMsg', key: 'notValid' }); // S2B game state 0
    }
    return world.spawn();
  }
  // The presence row field (EntityTrackerEntry's S0A for a sleeper): the head cell and the facing.
  field(p) { const s = p.bedSleep; return p.sleeping && s?.sleeping ? { sleep: [s.bed[0], s.bed[1], s.bed[2], s.facing] } : {}; }
  // Targets for EntityFishHook: every other player of the dimension is collidable (a lying one has the 0.2 box on the mattress).
  fishTargets(angler) {
    const out = [];
    for (const q of this.sim.players.values()) {
      if (q === angler || (q.dimension | 0) !== (angler.dimension | 0)) continue;
      const hw = q.sleeping ? 0.1 : 0.3, h = q.sleeping ? 0.2 : 1.8;
      out.push({ ref: { playerTarget: q }, box: [q.position.x - hw, q.position.y, q.position.z - hw, q.position.x + hw, q.position.y + h, q.position.z + hw] });
    }
    return out;
  }
  // The hook's thrown hit (amount 0) on a player: it wakes a sleeper (before the zero-amount refusal) and never hooks the player (attackEntityFrom is false).
  fishHit(angler, q) { this.attacked(q, 'thrown', this.sim.pvpRules.fromOf(angler)); return false; }
}
