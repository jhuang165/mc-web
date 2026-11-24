// Player Survival state on the dedicated server (batch 59). Each server player already owns a real `Survival` (health, food, saturation, exhaustion);
// this module runs it the way the single-player tick does, so nothing is re-derived: tickPlayerEnvironment (Survival.tick: regeneration, starvation by
// difficulty, void, drowning, suffocation, fire) and finishPlayerMovement (walk/sprint exhaustion, landing: Entity.fallDistance -> EntityLivingBase.fall damage).
// Bytecode-read (javap, 1.7.10 jar, EntityPlayerMP = mw): onUpdateEntity (mw.i) sends S06 (ib: health, food, saturation) whenever getHealth, the food
// level or "saturation == 0" differs from the last values it sent, then stores them; this module does the same (`status`).
import { ITEMS } from '../survival.js';
import { jsonFloat } from '../player-nbt.js'; // b99 entnbt99
import { Effects } from '../status-effects.js';
import { makeStack } from '../inventory.js';
import { tickPlayerEnvironment, finishPlayerMovement } from '../player-environment.js';
import { CombatTracker } from '../combat-tracker.js';
import { deathComponent } from '../team-names.js';
import { STAT } from '../stats.js';
import { NORMAL } from '../difficulty.js';
import { Experience } from '../experience.js';
import { finishDrinking } from '../buckets.js';
import { finishPotion } from '../potion-use.js';
import { setClientHealth } from './client-health.js';
import { applyDeathThrow } from './server-death-throw.js'; // b75 mpplayerfx75
import { markVelocityChanged } from './server-velocity.js'; // b77 mpvelocity77

const APPLE = 260, DEATH_XP_TICKS = 20;

const finite = Number.isFinite;

/** The vitals a saved player record carries (the Survival constructor reads them back on join). */
// b61: `effects` is EntityLivingBase.writeEntityToNBT's ActiveEffects (Id, Amplifier, Duration, Ambient per effect, in HashMap order; Effects.serialize) and `absorption` is AbsorptionAmount.
export const vitalsOf = (s) => ({ health: jsonFloat(s.health), food: s.food, saturation: jsonFloat(s.saturation), exhaustion: jsonFloat(s.exhaustion), timer: s.timer, effects: s.effects.serialize(), absorption: s.absorption || 0 });

export class ServerSurvival {
  constructor(simulation) { this.sim = simulation; }
  /** Survival and Adventure players take part; Creative keeps the old server behaviour (immune, no hunger). */
  managed(p) { return !p.survival.creative; }
  attach(p) {
    const s = p.survival;
    p.vitals = { sent: null, ready: true };
    s.furnaceActive = () => false; // the furnaces of the shared tile set are not ticked once per player
    if (s.health <= 0) p.dead = true; else s.protection = 60; // EntityPlayerMP.field_147101_bU after a join
  }
  /** After movePlayer in the simulation tick. `moved` is its return value. Returns true while the player is dead. */
  tick(p, moved) {
    if (!this.managed(p)) return false;
    if (!p.vitals) this.attach(p);
    const s = p.survival;
    s.difficulty = this.sim.difficulty ?? NORMAL;
    if (!p.dead) {
      const env = tickPlayerEnvironment({ world: p.world, weather: this.sim.weather, position: p.position, survival: s, motion: p.motion, flying: p.flying, sleeping: !!p.sleeping }, moved, { tickWeather() {} });
      // b95 horse95 (Executed: Horse95Probe, horse95-reference.json): EntityLivingBase.onEntityUpdate (sv.C 278-310) ends the water branch with `!isRemote && isRiding() && ridingEntity instanceof
      // EntityLivingBase -> mountEntity(null)`: a rider whose eyes are in water steps off a horse or pig at once (no health or damage test; boats and carts are not living, so they keep it).
      if (env.underwater && p.mount?.mob && s.health > 0) this.sim.vehicles?.dismount(p, true); // b98 horse98: mountEntity(null): S08, S1B, S08
      finishPlayerMovement(p, moved); p.inWater = !!moved?.inWater; // b63 mppvp: the critical-hit test of a melee attack reads it
      if (s.health <= 0) this.die(p);
    } else this.tickDeath(p);
    if (s.broken) this.sim.stats?.broken(p, s.broken); // b63 mpstats: the break stat of a tool that ran out
    this.takeHurt(p); s.hurtSounds.length = 0; s.died = false; s.broken = 0; s.drowned = false; // client-only flags the dedicated server never plays
    return !!p.dead;
  }
  /** EntityPlayerMP.onDeath: the CombatTracker message goes to every player (ServerSocial.drain). */
  die(p) {
    p.dead = true; p.itemInUse = null; p.dig?.abort?.();
    p.deathTime = 0; // b88 boatray88: EntityLivingBase.deathTime (sv.aA) of this EntityPlayerMP, counted by tickDeath
    this.sim.stats?.death(p); // b63 mpstats: stat.deaths and the killed-by stat
    this.dropOnDeath(p);
    applyDeathThrow(p); // b75 mpplayerfx75: EntityPlayer.onDeath's motion (the S12 of the owner and the viewers is the position stream)
    const component = deathComponent(p.survival.combat, this.sim.scoreboard?.formatName(p.name) ?? p.name /* b64 mpscoreboard: team-coloured */, { rawName: p.name });
    const killer = this.killerOf(p); // b89 credit89: sv.aX (the CombatTracker's choice, else attackingPlayer, else the revenge target), not the last blow (b63 mppvp read lastAttacker)
    (this.sim.events ??= []).push({ type: 'death', id: p.id, component, ...(killer !== undefined && killer !== p.id ? { killer } : {}) });
    if (killer !== undefined && killer !== p.id) { const k = this.sim.players.get(killer); if (k) this.sim.stats?.add(k, STAT.playerKills); } // b63 lead: EntityPlayer.addToPlayerScore of a player victim (stat.playerKills)
    if (killer === p.id) this.sim.stats?.add(p, STAT.playerKills); // b88 blast88 (bytecode-read mw.a(ro), yz.b(sa, int)): aX() is the player himself after his own TNT, and addToPlayerScore has no self test
  }
  /**
   * b98 credit98 (bytecode-read mw.a(ro, F), yz.a(ro, F), sv.a(ro, F), mw.a(ro)): an EntityPlayerMP that logged out is still the shooter (zc.c) of its arrow, and neither attackEntityFrom
   * nor the player list tests whether it is online: a Thorns hit takes its health like any other (spawn protection `bU` and Creative refuse, as they froze at logout). A lethal one runs
   * onDeath: the CombatTracker message goes to the whole server (oi.a(fj)) and dropAllItems throws the body's inventory where it was removed (the file saved at logout keeps the same
   * stacks). Not modelled because the removed entity never ticks: no S19 view, no death throw, no XP orbs (onDeathUpdate), no kill credit (the mob is no player).
   * b99 credit99 (bytecode-read sv.a(ro, F) 453-528, mw.a(ph, int), oi.e(mw)): the hit also plays the hurt sound (the death sound when lethal) through yz.a(String, F, F), a playSoundToNearExcept
   * from the removed body's world; and onDeath runs addStat(deaths) and, for the mob that dealt the hit, the killed-by stat plus the deathCount objectives. The StatisticsFile and the scoreboard
   * are server-side and outlive the logout, so the saved record's stats are refreshed (the damage-taken stat of any hit too, non-lethal included).
   */
  goneHit(p, attacker) {
    const s = p.survival, sim = this.sim, names = s.hurtSounds, lethal = s.health <= 0;
    const name = names.includes('game.player.die') ? 'game.player.die' : names.includes('game.player.hurt') ? 'game.player.hurt' : null;
    names.length = 0;
    if (name && sim.soundRand && sim.soundsOut) sim.soundsOut.push({ name: lethal ? 'game.player.die' : name, x: p.position.x, y: p.position.y, z: p.position.z, volume: 1, pitch: Math.fround(Math.fround(Math.fround(sim.soundRand.nextFloat() - sim.soundRand.nextFloat()) * Math.fround(0.2)) + 1), except: p.id, dim: p.dimension | 0 }); // b99 lead: the removed body is no longer in sim.players, so deliverSounds cannot look its dimension up
    if (lethal) this.dieGone(p, attacker);
    const record = sim.savedPlayers?.get(p.resumeKey); // the logout's file: the in-memory StatisticsFile is what the next login reads
    if (record) { delete record.stats; Object.assign(record, sim.stats?.savedFields(p)); }
  }
  dieGone(p, attacker) {
    if (p.dead || p.survival.health > 0) return false;
    p.dead = true; p.survival.hurtSounds.length = 0;
    if (attacker?.type) p.statsLive?.hurtBy(attacker.type); // sv.aX is the mob whose Thorns killed it (sg.a(entity): entityKilledBy)
    this.sim.stats?.death(p);
    this.dropOnDeath(p); p.deathXp = null;
    const component = deathComponent(p.survival.combat, this.sim.scoreboard?.formatName(p.name) ?? p.name, { rawName: p.name });
    (this.sim.events ??= []).push({ type: 'death', id: p.id, component });
    return true;
  }
  /**
   * b89 credit89: the player id EntityPlayerMP.onDeath (mw.a(ro), bytecode-read) credits through func_94060_bK (sv.aX: rn.c(), else aR, else i; combat-tracker.js `fighter`), or undefined.
   * A killing hit empties the tracker first (rn.g sees the victim dead), so a fatal fall or fire after a player's hit credits him through attackingPlayer while recentlyHit lasts
   * (100 of the victim's ticks), though the message is the plain one. The tracker entity is the DamageSource entity: pvpRules.fromOf's record (playerId), or the self entity.
   */
  killerOf(p) {
    const who = p.survival.combat?.fighter?.();
    if (!who?.player) return undefined;
    if (who.self) return p.id;
    const raw = who.raw;
    return raw?.playerId ?? (raw?.name != null ? [...this.sim.players.values()].find(q => q.name === raw.name)?.id : undefined);
  }
  /** gamerule keepInventory (default false); the rule table keeps strings. */
  keepInventory() { return String(this.sim.gameRules?.keepInventory ?? 'false').toLowerCase() === 'true'; }
  /**
   * EntityPlayer.onDeath (yz.a, bytecode-read): a player named Notch drops an apple; unless keepInventory, InventoryPlayer.dropAllItems throws every stack with the scatter
   * (the single-player path, ItemEntities.dropPlayer). EntityLivingBase.onDeathUpdate (sv.aF) makes the XP orbs at deathTime 20 from the level then (EntityPlayer.getExperiencePoints
   * min(level * 7, 100), 0 under keepInventory) when doMobLoot is on; a respawn before that tick (the entity is replaced) drops none.
   */
  dropOnDeath(p) {
    const s = p.survival, items = this.sim.items, v = (p.vitals ??= { sent: null });
    if (p.name === 'Notch') items.dropPlayer(makeStack(APPLE, 1), p.position, p.yaw, p.pitch, true, false);
    v.die = true; v.keep = this.keepInventory(); // the S19 status 3 message tells the client whether its own inventory goes
    if (v.keep) return;
    for (const stack of s.inventory.takeAll()) items.dropPlayer(stack, p.position, p.yaw, p.pitch, true, true);
    p.deathXp = { ticks: 0, value: p.experience?.death() ?? 0 };
  }
  tickDeath(p) {
    p.deathTime = (p.deathTime ?? 0) + 1; // b88 boatray88: sv.aF's ++deathTime (processPlayer's onUpdateEntity); setDead at 20 (boat-place-entities.js playerListed)
    const d = p.deathXp;
    if (!d || ++d.ticks < DEATH_XP_TICKS) return;
    p.deathXp = null;
    if (String(this.sim.gameRules?.doMobLoot ?? 'true').toLowerCase() === 'true' && d.value > 0) this.sim.serverItems.xp.spawn(d.value, p.position);
  }
  /**
   * S19 status 2 (a fresh hit) comes from the hurt sound Survival.damage queued; it is drained here since the tick clears them. Status 3 is set by dropOnDeath (EntityPlayerMP.onDeath).
   * b61: EntityLivingBase.attackEntityFrom (sv.a(ro, float), bytecode-read) also calls playSound(death sound if health <= 0, else hurt sound, volume 1, pitch (r - r) * 0.2 + 1); for a player
   * that is World.playSoundToNearExcept(self), an S29 to everyone near but the victim (the victim hears its own client's status 2 sound, and EntityOtherPlayerMP plays none).
   */
  takeHurt(p) {
    const v = (p.vitals ??= { sent: null }), s = p.survival, sim = this.sim;
    if (s.hurtSounds.includes('game.player.hurt')) v.hurt = true;
    if (s.hurtSounds.length) markVelocityChanged(p, sim.ticks); // b77 mpvelocity77: setBeenAttacked -> S12 to the player himself (server-velocity.js)
    const name = s.hurtSounds.includes('game.player.die') ? 'game.player.die' : s.hurtSounds.includes('game.player.hurt') ? 'game.player.hurt' : null;
    if (name && sim.soundRand && sim.soundsOut) sim.soundsOut.push({ name, x: p.position.x, y: p.position.y, z: p.position.z, volume: 1, pitch: Math.fround(Math.fround(Math.fround(sim.soundRand.nextFloat() - sim.soundRand.nextFloat()) * Math.fround(0.2)) + 1), except: p.id });
    s.hurtSounds.length = 0; // taken: the dedicated server plays none itself
  }
  /**
   * b61: the end of the simulation tick, after the mobs and the actions hit. A mob's blow lands after this player's own tick, so health <= 0 used to be seen one tick later (the die message
   * and the drops were a tick late). Natively EntityLivingBase.attackEntityFrom calls onDeath at once; this runs the same death step in the tick of the hit and queues its hurt flag in time for the
   * presence of this tick (other players' hurt tint).
   */
  settle(p) {
    if (!this.managed(p) || !p.vitals || p.dead) return;
    this.takeHurt(p);
    if (p.survival.health <= 0) this.die(p);
  }
  /**
   * The health-side messages of a tick, in wire order. `healthHurt` is S19 (EntityTracker.func_151248_b sends it to the player too, bytecode-read mn.b -> my.b): `hurt` for status 2,
   * `die` for status 3 with `keep` (keepInventory). `healthEffect` / `healthEffectEnd` are S1D / S1E: sent when an effect is new, changed (another amplifier or a longer duration), every
   * 600 ticks (EntityLivingBase.updatePotionEffects) and when it ends. Eating, milk, beacons and /effect all reach the client through this one diff.
   */
  outgoing(p) {
    const v = (p.vitals ??= { sent: null }), out = [];
    this.takeHurt(p);
    if (v.hurt || v.die) { out.push({ type: 'healthHurt', ...(v.hurt ? { hurt: true } : {}), ...(v.die ? { die: true, keep: !!v.keep } : {}) }); v.hurt = v.die = false; }
    const sent = (v.effects ??= new Map()), now = p.survival.effects.active;
    for (const e of p.survival.effects.ordered()) { // HashMap order (the S1D burst at login walks getActivePotionEffects)
      const old = sent.get(e.id);
      if (!old || old.amplifier !== e.amplifier || !!old.ambient !== !!e.ambient || e.duration > old.duration || (e.duration !== old.duration && e.duration % 600 === 0)) out.push({ type: 'healthEffect', id: e.id, amplifier: e.amplifier, duration: e.duration, ambient: !!e.ambient });
      sent.set(e.id, { amplifier: e.amplifier, duration: e.duration, ambient: e.ambient });
    }
    for (const id of [...sent.keys()]) if (!now.has(id)) { sent.delete(id); out.push({ type: 'healthEffectEnd', id }); }
    return out;
  }
  /**
   * S1D for every active effect again, in HashMap order. Bytecode-read (ServerConfigurationManager `oi`): the login handler (a(ej, mw)) and transferPlayerToDimension (a(mw, int)) each end with
   * `for (PotionEffect e : player.getActivePotionEffects()) send S1D(id, e)`; respawnPlayer (a(mw, int, boolean)) sends none (the new EntityPlayerMP copies no effects). `outgoing` sends them on its
   * next call: a new join has nothing sent yet, and a dimension change calls this.
   */
  resendEffects(p) { if (p?.vitals) p.vitals.effects = new Map(); }
  /** ItemBucketMilk.onEaten: one bucket is used up and clearActivePotions runs (also in Creative). */
  finishDrinking(p) { return !p.dead && (finishPotion(p.survival) || finishDrinking(p.survival)); } // b63: ItemPotion.onEaten (effects, glass bottle, Creative keeps the stack) or milk
  /** ItemFood.onEaten through ItemInWorldManager: the food and saturation the single-player rules give (Survival.eat), and the bowl/bottle containers. */
  finishEating(p, itemId) {
    const s = p.survival, item = ITEMS[itemId];
    if (!item?.food || s.creative || p.dead) return false;
    if (!s.eat(itemId, () => p.rand.nextFloat())) return false;
    return true;
  }
  /** C16 client status 0 (perform respawn): a dead player starts again at the world spawn with full vitals. */
  respawn(p) {
    if (!p?.dead) return false;
    this.sim.vehicles?.release?.(p); // b96 horse96: the dead rider's link ends with the removed EntityPlayerMP (ahb.f, then ahb.h's unlink): the respawned player is nowhere near the mount
    this.leaveBody(p); // b89 credit89: before anything is reset, the dead entity's TNT stays his
    const s = p.survival, spawn = this.sim.sleep.respawnPoint(p); // b66 mpsleep: the bed or /spawnpoint verified in the Overworld (ServerConfigurationManager.respawnPlayer), else the world spawn
    Object.assign(s, { health: 20, food: 20, saturation: 5, exhaustion: 0, timer: 0, air: 300, fire: 0, absorption: 0, hurtTicks: 0, hurtAmount: 0, protection: 60, combat: new CombatTracker(), lastDamage: '', lastSource: null, lastAttacker: null });
    s.effects = new Effects(); s.effects.player = s;
    this.discardWindow(p); // the new EntityPlayerMP has a fresh ContainerPlayer: the cursor and the 2x2 grid of the dead one are gone, not thrown
    p.deathXp = null; if (!this.keepInventory()) p.experience = new Experience(); // clonePlayer keeps the inventory and XP only under keepInventory
    p.position.copy(spawn);
    p.previous.copy(p.position);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    Object.assign(p, { dead: false, fallDistance: 0, landedFall: 0, flying: false, grounded: false });
    return true;
  }
  /**
   * b89 credit89 (bytecode-read oi.a(mw, int, boolean), ahb.f(sa), oi.a(yz), sv.a(ro, F), ro.a(agw)): respawnPlayer removes the old EntityPlayerMP from the world (setDead) and builds a
   * new one, but primed TNT keeps the old one as getExplosivePlacedBy. Its blast is "explosion.player" with that dead entity: attackEntityFrom has no test of the attacker's life, so the
   * knockback comes from where the old body was removed, his held item (empty after dropAllItems, kept under keepInventory, as clonePlayer copies the stacks) is what the message and
   * Looting read, and aX() is the old entity. Its addToPlayerScore writes the StatisticsFile oi.a(yz) keys by UUID, the same object the new entity uses, and the scoreboard by name,
   * so the kill stats still go to this record. The port reused the record, so the TNT acted from the new body; now each of this record's primed TNT gets a frozen body.
   */
  deadBody(p) {
    const s = p.survival, held = s.held ? { ...s.held } : null, look = { yaw: p.serverLook?.yaw ?? p.yaw, pitch: p.serverLook?.pitch ?? p.pitch };
    return { corpseOf: p, dead: true, id: p.id, name: p.name, position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: look.yaw, pitch: look.pitch, serverLook: look,
      dimension: p.dimension, sleeping: false, survival: { creative: !!s.creative, held, health: 0, inventory: { armor: (s.inventory?.armor ?? []).map(a => a ? { ...a } : a) } } }; // b94 credit94: the old EntityPlayerMP still wears what dropAllItems left (all of it under keepInventory)
  }
  leaveBody(p) {
    const dims = this.sim.dimensions, lists = new Set([this.sim.dispense, dims?.nether?.dispense, dims?.end?.n?.dispense].filter(Boolean).map(d => d.primed).filter(Array.isArray));
    let body = null;
    for (const list of lists) for (const t of list) if (t.placer === p) t.placer = body ??= this.deadBody(p);
    // b90 credit90 (bytecode-read zc.c, ze.a(ro, F)): an arrow in flight keeps the old EntityPlayerMP as its shooter and a punched fireball as the puncher, as the TNT does. `owner` stays the
    // record for credit (the StatisticsFile is shared), `ownerBody` is what the arrow's position, held item and revenge read.
    const insts = new Set([this.sim.dispense, dims?.nether?.dispense, dims?.end?.n?.dispense].filter(Boolean));
    for (const d of insts) {
      for (const lane of d.lanes ?? []) for (const a of lane.arrows?.list ?? []) if (a.owner === p && !a.dead) { a.ownerBody ??= body ??= this.deadBody(p); }
      // b92 credit92 (bytecode-read zk.j): thrown balls and potions hold the old EntityPlayerMP too (`thrower` stays the record for credit and the by-name lookup).
      for (const lane of d.lanes ?? []) for (const b of [...(lane.balls?.balls ?? []), ...(lane.potions?.projectiles?.balls ?? [])]) if (b.thrower === p && !b.dead) b.ownerBody ??= body ??= this.deadBody(p);
      for (const b of d.mobs?._fireballs?.list ?? []) if (b.punchedBy === p && !b.dead) b.punchedBy = body ??= this.deadBody(p);
    }
    return body;
  }
  /**
   * b61, bytecode-read (1.7.10 jar): EntityPlayerMP.onDeath (mw.a(ro)) and EntityPlayer.onDeath only call InventoryPlayer.dropAllItems (main and armour slots); neither it nor respawnPlayer
   * (oi.a(mw, int, boolean)) calls closeContainer (mw.m) or reads the cursor stack (InventoryPlayer.itemStack) or the crafting grid; clonePlayer copies the inventory only under keepInventory.
   * The cursor stack and the 2x2 grid stay in the old player's container and are lost with it at the respawn (recalled: the client's own container close on the death screen never throws
   * them, EntityPlayerSP.joinEntityItemWithWorld is empty). So "drop at death" was wrong; the respawn empties them without a drop. The server tick's invSet diff tells the client.
   */
  discardWindow(p) {
    // b62: a chest or station window still open at the respawn (the client's death screen normally sends C0D first, see below) belongs to the replaced entity: its cursor and grid are lost,
    // not thrown, and the window is closed (S2E) so the lid count and viewer sets let go. Bytecode-read: GuiContainer.updateScreen (bex.e) calls EntityPlayerSP.closeScreen (bjk.k: C0D
    // for openContainer.windowId) as soon as the player is dead, and the server's C0D handler closes the container whatever the health, so the usual path (client closes, cursor thrown at death
    // by Container.onContainerClosed) already exists via `closeWindow`; only a client that never sent it reaches this branch.
    if (p.window) { const c = p.window.container; p.survival.inventory.cursor = null; c.close(); c.drops.length = 0; this.sim.containers.close(p, true); }
    const w = p.invWin;
    if (!w) return;
    p.survival.inventory.cursor = null;
    for (let i = 0; i < w.container.grid.size; i++) w.container.grid.takeOnClose(i);
    w.container.updateResult?.();
  }
  /** The S06 message when health, food or "saturation is 0" changed since the last one (always on the first call), else null. */
  status(p) {
    if (!this.managed(p)) return null;
    const s = p.survival, v = (p.vitals ??= { sent: null }), now = { health: s.health, food: s.food, zero: s.saturation === 0 };
    const last = v.sent;
    if (last && last.health === now.health && last.food === now.food && last.zero === now.zero) return null;
    v.sent = now;
    const message = { type: 'health', health: s.health, food: s.food, saturation: s.saturation };
    return message;
  }
}

/**
 * The client half: apply an S06-style message to the local Survival. Values are validated; health and food are clamped like the Survival
 * constructor. The eaten stack is not in this message: the server's own inventory spends it and sends an S2F slot correction (server-items.js).
 * Returns { died, hotbar } so the caller can open the death screen and redraw.
 */
export function applyHealthMessage(survival, m) {
  if (!m || ![m.health, m.food, m.saturation].every(finite)) return { died: false, hotbar: false };
  setClientHealth(survival, m.health); // EntityPlayerSP.setPlayerSPHealth: hurt tilt and heart blink on a drop (client-health.js)
  survival.food = Math.max(0, Math.min(20, Math.floor(m.food)));
  survival.saturation = Math.max(0, Math.min(survival.food, m.saturation));
  return { died: survival.health <= 0, hotbar: false }; // the eaten stack comes back as an S2F slot correction (server-items.js)
}
