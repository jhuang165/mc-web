// The gun server's world (not 1.7.10 networking): the finite dedicated world (simulation.js) with Survival players whose inventories,
// health, ammunition, reloads, shots, knife strikes, deaths and respawns are decided here. Clients send only movement, look,
// the selected hotbar slot and button presses (protocol.js v3); nothing a client says about items, damage or hits is trusted.
// Players are keyed by their immutable website account ID; names are display only.
import { DedicatedSimulation } from './simulation.js';
import { IDLE_INPUT, cleanInput, cleanLook, cleanAction, cleanSlot } from './protocol.js';
import { PlayerCombat, PositionHistory, tickCombat, withinEvents } from './combat.js';
import { Survival } from '../survival.js';
import { makeStack } from '../inventory.js';
import { movePlayer } from '../player-physics.js';
import { drainKnockback } from '../player-knockback.js';
import { finishPlayerMovement } from '../player-environment.js';
import { GUNS, AMMO, P320, AKM, M870 } from '../mods/guns/catalog.js';
import { MELEE } from '../mods/guns/install.js';

export const STEAK = 205, IRON_ARMOR = [411, 410, 409, 408]; // armor[0] boots ... armor[3] helmet
export const JOIN_PROTECTION = 60; // EntityPlayerMP.field_147101_bU: ticks of invulnerability after a join or respawn
const MAX_ACTIONS = 16;
const DIFFICULTY = { 0: 0, 1: 1, 2: 2, 3: 3 };

const ammoStacks = (id, rounds) => {
  const out = [], size = AMMO[id]?.stack ?? 64;
  for (let left = rounds; left > 0; left -= size) out.push(makeStack(id, Math.min(size, left)));
  return out;
};
// The arena kit: three guns, a knife, ammunition, iron armour and food. A knife exists only with an installed melee pack.
export function arenaKit() {
  const knife = Object.keys(MELEE).map(Number).sort((a, b) => a - b)[0];
  const hotbar = [AKM, P320, M870, knife].map(id => (id && (GUNS[id] || MELEE[id]) ? makeStack(id, 1) : null));
  while (hotbar.length < 8) hotbar.push(null);
  hotbar.push(makeStack(STEAK, 16));
  const loose = [...ammoStacks(GUNS[AKM]?.ammo, 120), ...ammoStacks(GUNS[P320]?.ammo, 64), ...ammoStacks(GUNS[M870]?.ammo, 32)];
  return { main: [...hotbar, ...loose, ...Array(27 - loose.length).fill(null)].slice(0, 36), armor: IRON_ARMOR.map(id => makeStack(id, 1)) };
}

const describe = (victim, hit) => {
  if (hit && hit.kind === 'gun') return `${victim} was shot by ${hit.name}`;
  if (hit && hit.kind === 'melee') return `${victim} was slain by ${hit.name}`;
  return null;
};

export class GunSimulation extends DedicatedSimulation {
  // config: the server.properties values (properties.js readServerConfig), canEdit(p) -> op check for spawn protection.
  constructor(saved = {}, { world = null, config = {}, random = Math.random, isOp = () => false } = {}) {
    super({ ...saved, version: saved.version === 2 ? 1 : saved.version, players: [] }, { world });
    this.config = { gamemode: 'survival', difficulty: 2, pvp: true, spawnProtection: 16, forceGamemode: false, ...config };
    this.random = random; this.isOp = isOp;
    this.history = new PositionHistory();
    this.outbox = new Map(); // player id -> events for that player's next tick message
    this.chatOut = [];
    this.accounts = new Map(saved.accounts ?? []); // account id -> saved player
  }
  // A website account joins; its saved state (inventory, health, position) is restored, or it gets the kit.
  addPlayer(id, name, account, { skin = null } = {}) {
    if ([...this.players.values()].some(p => p.account === account)) throw new Error('That player is already connected.');
    const saved = this.accounts.get(account);
    const p = super.addPlayer(id, name, account, { skin });
    p.account = account;
    const mode = this.config.forceGamemode || !saved?.mode ? this.config.gamemode : saved.mode;
    p.survival = this.survivalFor(saved?.player ?? null, mode);
    if (saved?.position) p.position.copy(saved.position); else p.position.copy(this.spawnPoint());
    p.previous.copy(p.position);
    p.yaw = saved?.yaw ?? 0; p.pitch = saved?.pitch ?? 0;
    p.combat = new PlayerCombat();
    p.dead = p.survival.health <= 0;
    p.survival.protection = JOIN_PROTECTION;
    p.lastHit = null; p.sentInv = null; p.sentMode = null; p.idleSince = this.ticks;
    if (!saved) this.giveKit(p);
    return p;
  }
  survivalFor(data, mode) {
    const s = new Survival(data ?? {}, mode);
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles']) s[key] = this.tiles[key];
    s.difficulty = DIFFICULTY[this.config.difficulty] ?? 2;
    return s;
  }
  spawnPoint() { return this.world.spawn(); }
  giveKit(p) {
    const kit = arenaKit(), inv = p.survival.inventory;
    kit.main.forEach((s, i) => { inv.main[i] = s; });
    kit.armor.forEach((s, i) => { inv.armor[i] = s; });
    inv.current = 0;
    p.combat.reset();
  }
  setMode(p, mode) {
    const data = p.survival.serialize();
    p.survival = this.survivalFor(data, mode);
    p.flying = p.flying && p.survival.creative;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (p) this.accounts.set(p.account, this.savePlayer(p));
    this.players.delete(id);
    this.outbox.delete(id);
  }
  savePlayer(p) {
    const player = p.survival.serialize();
    for (const key of ['furnaces', 'chests', 'dispensers', 'brewing', 'hoppers']) delete player[key]; // world tiles are saved once
    return { name: p.name, mode: p.survival.mode, position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: p.yaw, pitch: p.pitch, player };
  }
  // v3 input: movement, look, the selected slot and the newest tick the client has drawn (for lag compensation).
  input(id, message) {
    const p = this.players.get(id), input = cleanInput(message.controls), look = cleanLook(message.yaw, message.pitch), slot = cleanSlot(message.slot);
    if (!p || !input || !look || slot === null || (message.view != null && !Number.isInteger(message.view))) return false;
    if (!p.dead) Object.assign(p, look, { input });
    p.lastInput = this.ticks;
    if (input.forward || input.strafe || input.jump || input.sneak) p.idleSince = this.ticks;
    if (!p.dead) p.survival.inventory.current = slot;
    if (message.view != null) p.combat.view = message.view;
    return true;
  }
  action(id, message) {
    const p = this.players.get(id), a = cleanAction(message);
    if (!p || !a || p.combat.queue.length >= MAX_ACTIONS) return false;
    p.combat.queue.push(a); p.idleSince = this.ticks;
    return true;
  }
  queueEdit(id, message) {
    const p = this.players.get(id);
    if (!p || !p.survival.creative) return false; // Survival building is a later milestone; creative players and ops in creative may edit
    return super.queueEdit(id, message);
  }
  edit(p, place) {
    if (!p.survival.creative || p.dead) return false;
    return super.edit(p, place);
  }
  // Java's spawn-protection: within the radius of the world spawn only operators change blocks. PvP is not affected.
  canBreak(p, [x, , z]) {
    const r = this.config.spawnProtection, s = this.world.spawn();
    if (!(r > 0) || this.isOp(p)) return true;
    return Math.max(Math.abs(Math.floor(x) - Math.floor(s.x)), Math.abs(Math.floor(z) - Math.floor(s.z))) > r;
  }
  respawn(id) {
    const p = this.players.get(id);
    if (!p || !p.dead) return false;
    const s = p.survival;
    Object.assign(s, { health: s.maxHealth, food: 20, saturation: 5, exhaustion: 0, fire: 0, air: 300, hurtTicks: 0, hurtTime: 0, died: false });
    s.effects = new (s.effects.constructor)(); s.effects.player = s;
    p.position.copy(this.spawnPoint()); p.previous.copy(p.position);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    p.fallDistance = 0; p.landedFall = 0; p.flying = false; p.dead = false; p.lastHit = null;
    s.protection = JOIN_PROTECTION;
    p.combat.reset();
    return true;
  }
  kill(p, message = `${p.name} died`) {
    if (p.dead) return;
    p.survival.health = 0; p.dead = true;
    this.chatOut.push(message);
  }
  send(p, event) { if (!this.outbox.has(p.id)) this.outbox.set(p.id, []); this.outbox.get(p.id).push(event); }
  near(p, event, includeSelf = false) { for (const o of this.players.values()) if ((includeSelf || o !== p) && withinEvents(o, p)) this.send(o, event); }
  damage(target, amount, { attacker, kind, weapon, knockback }) {
    const from = { type: 'player', isPlayer: true, name: attacker.name, ...(knockback ? { x: attacker.position.x, z: attacker.position.z } : {}) };
    const ok = target.survival.damage(amount, 'player', true, 'player', from);
    if (ok) target.lastHit = { by: attacker.id, name: attacker.name, kind, weapon: weapon?.id ?? null, tick: this.ticks };
    return ok;
  }
  tickPlayers() {
    const players = [...this.players.values()];
    const deps = {
      world: this.world, players: () => this.players.values(), history: this.history, tick: this.ticks - 1, random: this.random,
      pvp: () => this.config.pvp !== false,
      canBreak: null, breakGlass: ([x, y, z]) => this.world.put(x, y, z, 0),
      damage: (t, n, src) => this.damage(t, n, src),
      send: (p, e) => this.send(p, e), near: (p, e, self) => this.near(p, e, self),
    };
    // Weapons act first, against where everyone stood when the shooter last saw them (tick - 1 is the newest recorded tick).
    for (const p of players) { deps.canBreak = block => this.canBreak(p, block); tickCombat(p, deps); }
    for (const p of players) {
      if (p.dead) { Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); p.survival.time = this.time; continue; }
      const controls = this.ticks - p.lastInput > 10 ? IDLE_INPUT : p.input;
      drainKnockback(p.survival, p.velocity, p.position, this.random);
      const moved = movePlayer(p, controls);
      finishPlayerMovement(p, moved);
      if (p.position.y < -64) {
        if (p.survival.creative) { p.position.copy(this.spawnPoint()); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); }
        else { p.survival.damage(1000, 'void'); p.lastHit = null; }
      }
      p.survival.time = this.time;
      p.survival.tick({ inWater: moved.inWater, inLava: moved.inLavaNow });
      p.inWater = moved.inWater;
      if (p.swing) p.swing--;
    }
    for (const p of players) {
      if (p.dead || p.survival.health > 0) continue;
      p.dead = true;
      const hit = p.lastHit && this.ticks - p.lastHit.tick < 100 ? p.lastHit : null;
      const reason = p.survival.lastDamage;
      this.chatOut.push(describe(p.name, hit) ?? (reason === 'a fall' ? `${p.name} hit the ground too hard` : reason === 'void' ? `${p.name} fell out of the world` : `${p.name} died`));
      if (hit) { const killer = this.players.get(hit.by); if (killer) this.send(killer, { type: 'kill', target: p.id, name: p.name }); }
      p.combat.reset();
    }
    this.history.record(this.ticks, this.players.values());
  }
  presence() {
    return super.presence().map(entry => {
      const p = this.players.get(entry.id);
      return { ...entry, hurt: p.survival.hurtTime, dead: p.dead, mode: p.survival.mode };
    });
  }
  // What only player `p` sees each tick: its health, food and, when changed, its inventory.
  you(p) {
    const s = p.survival, out = { health: s.health, food: s.food, saturation: s.saturation, absorption: s.absorption, hurt: s.hurtTime,
      dead: p.dead, protection: s.protection, mode: s.mode, current: s.inventory.current, x: p.position.x, y: p.position.y, z: p.position.z,
      vx: p.velocity.x, vy: p.velocity.y, vz: p.velocity.z, flying: p.flying };
    const inv = JSON.stringify([s.inventory.serialize(), s.inventory.serializeArmor()]);
    if (inv !== p.sentInv) { p.sentInv = inv; out.inv = { slots: s.inventory.serialize(), armor: s.inventory.serializeArmor() }; }
    return out;
  }
  drainEvents(p) { const e = this.outbox.get(p.id) ?? []; this.outbox.delete(p.id); return e; }
  save() {
    for (const p of this.players.values()) this.accounts.set(p.account, this.savePlayer(p));
    const base = super.save();
    delete base.players;
    return { ...base, version: 2, accounts: [...this.accounts] };
  }
}
