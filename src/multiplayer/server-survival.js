// Player Survival state on the dedicated server (batch 59). Each server player already owns a real `Survival` (health, food, saturation, exhaustion);
// this module runs it the way the single-player tick does, so nothing is re-derived: tickPlayerEnvironment (Survival.tick: regeneration, starvation by
// difficulty, void, drowning, suffocation, fire) and finishPlayerMovement (walk/sprint exhaustion, landing: Entity.fallDistance -> EntityLivingBase.fall damage).
// Bytecode-read (javap, 1.7.10 jar, EntityPlayerMP = mw): onUpdateEntity (mw.i) sends S06 (ib: health, food, saturation) whenever getHealth, the food
// level or "saturation == 0" differs from the last values it sent, then stores them; this module does the same (`status`).
import { ITEMS } from '../survival.js';
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

const APPLE = 260, DEATH_XP_TICKS = 20;

const finite = Number.isFinite;

/** The vitals a saved player record carries (the Survival constructor reads them back on join). */
// b61: `effects` is EntityLivingBase.writeEntityToNBT's ActiveEffects (Id, Amplifier, Duration, Ambient per effect, in HashMap order; Effects.serialize) and `absorption` is AbsorptionAmount.
export const vitalsOf = (s) => ({ health: s.health, food: s.food, saturation: s.saturation, exhaustion: s.exhaustion, timer: s.timer, effects: s.effects.serialize(), absorption: s.absorption || 0 });

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
      tickPlayerEnvironment({ world: p.world, weather: this.sim.weather, position: p.position, survival: s, motion: p.motion, flying: p.flying }, moved, { tickWeather() {} });
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
    this.sim.stats?.death(p); // b63 mpstats: stat.deaths and the killed-by stat
    this.dropOnDeath(p);
    const component = deathComponent(p.survival.combat, p.name, { rawName: p.name });
    const by = p.survival.lastAttacker, killer = by?.isPlayer ? by.playerId ?? [...this.sim.players.values()].find(q => q.name === by.name)?.id : undefined; // b63 mppvp: a player's blow (melee, arrow, potion) credits the killer
    (this.sim.events ??= []).push({ type: 'death', id: p.id, component, ...(killer !== undefined && killer !== p.id ? { killer } : {}) });
    if (killer !== undefined && killer !== p.id) { const k = this.sim.players.get(killer); if (k) this.sim.stats?.add(k, STAT.playerKills); } // b63 lead: EntityPlayer.addToPlayerScore of a player victim (stat.playerKills)
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
    const s = p.survival, spawn = p.spawnpoint ? { x: p.spawnpoint[0] + 0.5, y: p.spawnpoint[1], z: p.spawnpoint[2] + 0.5 } : this.sim.world.spawn(); // /spawnpoint (servercommands-b59)
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
