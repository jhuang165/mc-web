// The gun server's world (not 1.7.10 networking): the finite dedicated world (simulation.js) with Survival players whose inventories,
// health, ammunition, reloads, shots, knife strikes, deaths and respawns are decided here. Clients send only movement, look,
// the selected hotbar slot and button presses (protocol.js v3); nothing a client says about items, damage or hits is trusted.
// Players are keyed by their immutable website account ID; names are display only.
import { DedicatedSimulation } from './simulation.js';
import { IDLE_INPUT, cleanInput, cleanLook, cleanAction, cleanSlot } from './protocol.js';
import { PlayerCombat, PositionHistory, tickCombat, withinEvents } from './combat.js';
import { Survival, ITEMS } from '../survival.js';
import { tickPlayerItemUse } from '../player-item-use.js';
import { finishDrinkingItem } from '../potion-use.js';
import { finishDrinking as finishMilk } from '../buckets.js';
import { ITEM_REGISTRY } from '../command-data.js';
import { itemFromOriginal } from '../region-import.js';
const MOD_ITEMS = 4000; // gun-mod item ids start here (mods/guns/catalog.js)
import { makeStack } from '../inventory.js';
import { movePlayer } from '../player-physics.js';
import { drainKnockback } from '../player-knockback.js';
import { finishPlayerMovement } from '../player-environment.js';
import { stepPlayer, landingHooks } from './server-contacts.js';
import { GUNS, AMMO, P320, AKM, M870 } from '../mods/guns/catalog.js';
import { MELEE, gunSmithRecipes } from '../mods/guns/install.js';
import { ATTACHMENTS, GUN_SMITH } from '../mods/guns/catalog.js';
import { ATTACHMENT_TYPES } from '../mods/guns/fit.js';
import { fitFromInventory } from '../mods/guns/attachment-screen.js';
import { smithCraft } from '../mods/guns/smith-screen.js';
import { isAmmoBox, fillBox, emptyBox } from '../mods/guns/ammo-box.js';
import { ServerPlay } from './server-play.js';
import { ServerMobs } from './server-mobs.js';
import { trackerMessage } from '../death-messages.js';
import { strikeEntities } from '../weather-simulation.js';
import { PHYSICS } from '../world.js';
import { Experience } from '../experience.js';
import { applyBookEdit, applyBookSign } from '../books.js';
import { releaseHeldBow } from '../player-throw-simulation.js';
import { playerStats, bindSurvival, saveStats, watchServerStats, fallStat, tickPlayerStats, brokenTool, deathStats, achievementList, statsMessage, trigger } from './server-stats.js';
import { riderFor, rideTick, seatTick, dismount, ridingOf, ridingKind } from './server-riding.js';
import { tickFishing, dropHook, hookOf } from './server-fishing.js';
import { ServerMaps } from './server-maps.js';
import { ServerHanging } from './server-hanging.js';
import { potionColor } from '../fx.js';
import { effectRows } from '../status-effects.js';
import { INVISIBILITY } from '../potion-fx.js';
import { restoreBed, saveBed, useBed, wake, tickBeds, bedRespawn, settleBedRespawn, sleepRow, sleeperPresence } from './server-beds.js';
import { ServerDimensions } from './server-dimensions.js';
import { PortalState, readPlayerPortalState, OVERWORLD, END, GAME_IDS } from '../dimensions.js';

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
  if (hit && hit.kind === 'arrow') return `${victim} was shot by ${hit.name}`;
  if (hit && hit.kind === 'explosion') return `${victim} was blown up by ${hit.name}`;
  return null;
};

const finishDrinking = player => finishDrinkingItem(player, finishMilk);
export class GunSimulation extends DedicatedSimulation {
  // config: the server.properties values (properties.js readServerConfig), canEdit(p) -> op check for spawn protection.
  // `root`: the Overworld's simulation when this one is its Nether or End (server-dimensions.js); `makePort()` makes those worlds'
  // generator workers.
  constructor(saved = {}, { world = null, port = null, config = {}, random = Math.random, isOp = () => false, root = null, makePort = null } = {}) {
    super({ ...saved, version: saved.version === 2 ? 1 : saved.version, players: [] }, { world, port });
    this.root = root;
    this.config = { gamemode: 'survival', difficulty: 2, pvp: true, spawnProtection: 16, forceGamemode: false, ...config };
    this.random = random; this.isOp = isOp;
    this.history = new PositionHistory();
    this.outbox = new Map(); // player id -> events for that player's next tick message
    this.chatOut = [];
    this.tellOut = []; // [player id, text]: lines for one player's chat (a bed's status messages)
    this.accounts = root?.accounts ?? new Map(saved.accounts ?? []); // account id -> saved player
    this.rules = root?.rules ?? { keepInventory: false, ...(saved.rules ?? {}) }; // /gamerule (GameRules defaults)
    if (root) { this.chatOut = root.chatOut; this.tellOut = root.tellOut; } // one server's chat
    this.play = new ServerPlay(this, saved.play ?? {}); // windows, mining, block use and dropped items (server-play.js)
    this.hanging = new ServerHanging(this, saved.hanging ?? null); // paintings and item frames (server-hanging.js)
    this.maps = this.mobs && !root ? new ServerMaps(this, saved.maps ?? null) : null; // the world's filled maps (server-maps.js; the Overworld's only)
    watchServerStats(this); // the statistics and achievements of drops, kills, hits and breeding (server-stats.js)
    // A streamed Overworld has the Nether and the End (server-dimensions.js), made when someone first travels there.
    this.dimension = world?.dimension ?? OVERWORLD;
    this.dims = !root && this.world.streaming && !this.world.dimension ? new ServerDimensions(this, saved.dimensions ?? {}, { makePort }) : null;
  }
  // The world player `id` is in (null while it travels), and the player wherever it is.
  simOf(id) { return this.dims ? this.dims.simOf(id) : this.players.has(id) ? this : null; }
  playerOf(id) { return this.dims ? this.dims.playerOf(id) : this.players.get(id) ?? null; }
  travelling(id) { return !!this.dims?.transit.has(id); }
  // Every connected player in every world, with its world.
  *everyone() { for (const sim of this.dims?.all() ?? [this]) for (const p of sim.players.values()) yield [p, sim]; }
  // A streamed world has mobs (server-mobs.js); the finite test arenas stay empty. Runs inside super(): config, random and play
  // are read later, when the mobs tick.
  createMobs(saved) { return this.world.streaming ? new ServerMobs(this, saved.mobs ?? {}) : null; }
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
    p.rider = riderFor(p); // what a pig, horse, cart or boat carries (server-riding.js)
    p.dead = p.survival.health <= 0;
    p.survival.protection = JOIN_PROTECTION;
    p.lastHit = null; p.sentInv = null; p.sentMode = null; p.idleSince = this.ticks;
    p.experience = new Experience(saved?.experience); p.xpCooldown = 0; p.sentXp = null;
    playerStats(this, p, saved); p.sentAchievements = null; // StatisticsFile (server-stats.js)
    restoreBed(this, p, saved?.bed); // the bed spawn point; a sleeper saved in bed wakes beside it (server-beds.js)
    p.portal = new PortalState().restore(readPlayerPortalState(saved?.portal)); // Entity's portalCounter and timeUntilPortal
    if (!saved) this.giveKit(p);
    this.play.reset(p);
    this.watch(p); // the saved position's window (the caller waited for its cells: whenReady)
    return p;
  }
  survivalFor(data, mode) {
    const s = new Survival(data ?? {}, mode);
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles']) s[key] = this.tiles[key];
    s.difficulty = DIFFICULTY[this.config.difficulty] ?? 2;
    s.furnaceActive = () => false; // the shared furnaces tick once per world tick (tickWorld), not once per player
    return s;
  }
  spawnPoint() { return this.root ? this.root.spawnPoint() : this.world.spawn(); }
  // WorldInfo's spawn point (spawn protection's centre): the native world spawn, which spawn() scatters players around.
  worldSpawn() { if (this.root) return this.root.worldSpawn(); const w = this.world, n = w.nativeSpawn; return n ? { x: n[0] - w.originX, y: n[1], z: n[2] - w.originZ } : w.spawn(); }
  // Where an account's player appears when it joins: its saved position, else null (the world spawn, always resident).
  startFor(account) { return this.accounts.get(account)?.position ?? null; }
  giveKit(p) {
    const kit = arenaKit(), inv = p.survival.inventory;
    kit.main.forEach((s, i) => { inv.main[i] = s; });
    kit.armor.forEach((s, i) => { inv.armor[i] = s; });
    inv.current = 0;
    p.combat.reset();
  }
  // CommandGive's item argument: a Java registry name (minecraft: optional) or Java numeric id, read through the save importer's
  // id table (this build numbers items its own way), else a gun-mod item by number or by name with underscores (creative_ammo_box).
  // Returns the stack's { id, damage }, or null.
  findItem(text, damage = 0) {
    const t = String(text ?? '').toLowerCase(), java = /^\d+$/.test(t) ? +t : new Map(ITEM_REGISTRY).get(t.includes(':') ? t : 'minecraft:' + t);
    const original = java === undefined ? null : itemFromOriginal(java, damage);
    if (original) return { id: original.id, damage: original.damage };
    if (java !== undefined && java >= MOD_ITEMS && ITEMS[java]) return { id: java, damage };
    const key = t.replace(/^[a-z0-9_]+:/, '');
    for (const [id, item] of Object.entries(ITEMS)) if (+id >= MOD_ITEMS && item?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_') === key) return { id: +id, damage };
    return null;
  }
  // CommandGive: the stack goes into the inventory; what does not fit is lost (this server has no dropped items yet).
  give(p, { id, damage }, count = 1) {
    const stack = makeStack(id, count, damage);
    p.survival.inventory.add(stack);
    return count - stack.count;
  }
  setMode(p, mode) {
    this.play.close(p, 0); this.play.closeWindow(p);
    const data = p.survival.serialize();
    p.survival = this.survivalFor(data, mode);
    p.flying = p.flying && p.survival.creative;
    bindSurvival(p);
    this.play.reset(p);
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p && this.dims?.drop(id)) { this.outbox.delete(id); return; } // left while travelling
    if (p) { p.statsLive?.leaveGame(); wake(this, p, true, false); dismount(this, p); dropHook(p); this.play.close(p, 0); this.play.closeWindow(p); this.accounts.set(p.account, this.savePlayer(p)); } // EntityPlayerMP logout closes its window and leaves its vehicle
    this.players.delete(id);
    this.outbox.delete(id);
  }
  savePlayer(p) {
    const player = p.survival.serialize();
    for (const key of ['furnaces', 'chests', 'dispensers', 'brewing', 'hoppers']) delete player[key]; // world tiles are saved once
    return { name: p.name, mode: p.survival.mode, position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: p.yaw, pitch: p.pitch, player,
      experience: p.experience?.serialize(), bed: saveBed(p), ...saveStats(p), portal: p.portal?.save(), ...(this.dimension ? { dimension: this.dimension } : {}) };
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
  // The use button with food in hand (ItemFood.onItemRightClick): start eating, or let go and stop. Each press eats one item;
  // the client presses again after its own four-tick delay while the button stays down (use-hold.js).
  use(p, down) {
    if (!down) { if (p.eating?.bow) this.releaseBow(p); p.eating = null; return; }
    const s = p.survival, held = s.inventory.held, item = held ? ITEMS[held.id] : null;
    if (p.eating || s.creative || !item?.food || (s.food >= 20 && !item.alwaysEdible) || !s.usable(held.id)) return;
    p.eating = { id: held.id, ticks: 32 };
  }
  // ItemBow.onPlayerStoppedUsing (C07 RELEASE_USE_ITEM): the drawn bow shoots this player's arrow; its random.bow is heard nearby.
  releaseBow(p) {
    const mobs = this.mobs;
    if (!mobs || p.dead) { p.eating = null; return false; }
    const state = { eating: p.eating, screen: 'playing', survival: p.survival, arrows: mobs.arrows, position: p.position, yaw: p.yaw, pitch: p.pitch };
    const made = mobs.mark(), events = mobs.arrows.events.length;
    const shot = releaseHeldBow(state);
    mobs.claim(made, p);
    for (const e of mobs.arrows.events.splice(events)) if (e?.sound) mobs.sound({ ...e, position: e.position ?? { x: p.position.x, y: p.position.y, z: p.position.z } });
    p.eating = state.eating;
    return shot.released;
  }
  // A use-button click (C08PacketPlayerBlockPlacement); digging comes from the held 'mine' action (ServerPlay.tickMining).
  queueEdit(id, message) {
    const p = this.players.get(id);
    if (!p || p.dead || p.bed?.sleeping) return false;
    return super.queueEdit(id, message);
  }
  edit(p, place) { return p.bed?.sleeping ? false : this.play.edit(p, place); }
  // BlockBed.onBlockActivated (server-play.js's useBed hook).
  useBed(p, x, y, z) { useBed(this, p, x, y, z); }
  // C0BPacketEntityAction 3 (the Leave Bed button): wakeUpPlayer(false, true, true), so the bed becomes the spawn point.
  wake(id) { const p = this.players.get(id); return !!p?.bed?.sleeping && wake(this, p, false, true); }
  tell(p, text) { this.tellOut.push([p.id, text]); }
  // The attack button (Minecraft.clickMouse(0) on the press, then sendClickBlockToController while held): a mob or player under the
  // crosshair is hit once on the press; a block is dug by the held button (ServerPlay.tickMining).
  mine(p, down) {
    const press = !!down && !p.mineHeld && !p.dead;
    p.mineHeld = !!down && !p.dead;
    if (!p.mineHeld && p.mining && !p.mining.auto) p.mining = null;
    if (press) this.play.attackPress(p);
  }
  // NetHandlerPlayServer's MC|BEdit and MC|BSign: the edited or signed book replaces the held book and quill; a bad tag is ignored
  // (the vanilla server logs and drops it). Returns false for a malformed message.
  book(id, message) {
    const p = this.players.get(id), channel = message?.channel;
    if (!p || (channel !== 'MC|BEdit' && channel !== 'MC|BSign') || !message.packet || typeof message.packet !== 'object') return false;
    if (p.dead) return true;
    try { (channel === 'MC|BSign' ? applyBookSign : applyBookEdit)(p.survival.held, message.packet, p.name); } catch { /* Invalid book tag! */ }
    return true;
  }
  click(id, message) { const p = this.players.get(id); return !!p && this.play.click(p, message); }
  closeWindow(id, window) { const p = this.players.get(id); if (p && Number.isInteger(window)) this.play.close(p, window); }
  trade(id, message) { const p = this.players.get(id); return !!p && this.play.trade(p, message); }
  station(id, message) { const p = this.players.get(id); return !!p && this.play.stations.message(p, message); } // enchant, anvil name, beacon
  drop(id, all) { const p = this.players.get(id); return !!p && this.play.dropHeld(p, !!all); }
  // The guns mod's own inventory actions, run on the server's copy as the single-player screens run them (main.js), on hotbar slot
  // `slot`: `fit` puts an attachment in that gun's part slot (or takes it off), `smith` crafts a gun smith recipe (by its index in gunSmithRecipes, which
  // the client's weapon-rules fingerprint matches) while a gun smith table is in that slot, and `box` fills or empties that ammo box.
  // What does not fit in the inventory is thrown. `seq` acknowledges the client's prediction, as for clicks. False: a malformed message.
  gun(id, message) {
    const p = this.players.get(id), m = message ?? {};
    if (!p || !Number.isInteger(m.seq) || !Number.isInteger(m.slot) || m.slot < 0 || m.slot > 8) return false;
    p.clickAck = Math.max(p.clickAck, m.seq);
    if (p.dead || p.window) return true; // a screen opened on the way: the action is dropped, as a stale click is
    // The hotbar slot the tab acted on: its own selection may be ahead of the last input this server read.
    const s = p.survival, inv = s.inventory, slot = m.slot, held = inv.main[slot], give = [];
    if (m.op === 'fit') {
      if (!ATTACHMENT_TYPES.includes(m.part) || !(m.attachment === null || Number.isInteger(m.attachment))) return false;
      const attachment = m.attachment === null ? null : ATTACHMENTS[m.attachment];
      if (m.attachment !== null && attachment?.type !== m.part) return false;
      const out = fitFromInventory(inv.main, slot, m.part, attachment, { creative: s.creative });
      if (out.ok) give.push(...out.give);
    } else if (m.op === 'smith') {
      const recipe = Number.isInteger(m.recipe) ? gunSmithRecipes()[m.recipe] : null;
      if (!recipe) return false;
      if (held?.id !== GUN_SMITH) return true;
      const out = smithCraft(inv.main, recipe);
      if (out) give.push(out);
    } else if (m.op === 'box') {
      if (!isAmmoBox(held?.id)) return true;
      if (m.empty === true) give.push(...emptyBox(inv.main, slot)); else fillBox(inv.main, slot);
    } else return false;
    for (const stack of give) {
      const rest = makeStack(stack.id, stack.count, stack.damage ?? 0);
      if (stack.modTag) rest.modTag = structuredClone(stack.modTag);
      inv.add(rest);
      if (rest.count > 0) this.play.items.dropPlayer(rest, p.position, p.yaw, p.pitch);
    }
    p.idleSince = this.ticks;
    return true;
  }
  // C10PacketCreativeInventoryAction: a Creative player sets a slot of window 0 (5-8 armour, 9-44 the inventory) or throws a stack (-1).
  creative(id, message) {
    const p = this.players.get(id);
    if (!p || p.dead || !p.survival.creative) return false;
    if (Number.isInteger(message?.seq)) p.clickAck = Math.max(p.clickAck, message.seq);
    const inv = p.survival.inventory, slot = message?.slot;
    const stack = message?.stack == null ? null : inv.read(message.stack);
    if (message?.stack != null && !stack) return false;
    if (slot === -1) { if (stack) this.play.items.dropPlayer(stack, p.position, p.yaw, p.pitch); return true; }
    if (!Number.isInteger(slot) || slot < 1 || slot > 44) return false;
    p.inventoryWindow.slots[slot].inventory.setStack(p.inventoryWindow.slots[slot].index, stack);
    return true;
  }
  // Java's spawn-protection: within the radius of the world spawn only operators change blocks. PvP is not affected.
  canBreak(p, [x, , z]) {
    if (this.root) return true; // spawn protection is the Overworld's (MinecraftServer.isBlockProtected: dimension 0)
    const r = this.config.spawnProtection, s = this.worldSpawn();
    if (!(r > 0) || this.isOp(p)) return true;
    return Math.max(Math.abs(Math.floor(x) - Math.floor(s.x)), Math.abs(Math.floor(z) - Math.floor(s.z))) > r;
  }
  respawn(id) {
    const p = this.players.get(id);
    if (!p || !p.dead) return false;
    const s = p.survival;
    Object.assign(s, { health: s.maxHealth, food: 20, saturation: 5, exhaustion: 0, fire: 0, air: 300, hurtTicks: 0, hurtTime: 0, died: false });
    s.effects = new (s.effects.constructor)(); s.effects.player = s;
    dismount(this, p); dropHook(p); wake(this, p, true, false);
    p.fallDistance = 0; p.landedFall = 0; p.flying = false; p.dead = false; p.lastHit = null;
    s.protection = JOIN_PROTECTION;
    p.combat.reset(); p.eating = null; this.play.reset(p);
    // WorldProvider.canRespawnHere: no respawning in the Nether or the End, it is the Overworld's bed or spawn.
    if (this.root) { this.root.dims.travel(p, OVERWORLD, { respawn: true }); return true; }
    p.position.copy(bedRespawn(this, p) ?? this.spawnPoint()); p.previous.copy(p.position); // by the bed (server-beds.js), else the world spawn
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    return true;
  }
  // A teleport moves the player and resets fall and velocity; the client takes the new position from its next tick (you.x).
  teleport(p, to) {
    dismount(this, p); // Entity.mountEntity(null) before the move (CommandTeleport, EntityPlayerMP.setPositionAndUpdate)
    p.position.copy(to); p.previous.copy(to); Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    p.fallDistance = 0; p.landedFall = 0; p.teleported = (p.teleported ?? 0) + 1;
  }
  // Off player p's vehicle (server-riding.js): a pearl, a teleport, a respawn.
  dismount(p) { return dismount(this, p); }
  kill(p, message = `${p.name} died`) {
    if (p.dead) return;
    p.survival.health = 0; p.dead = true;
    deathStats(p);
    this.chatOut.push(message);
  }
  // C16PacketClientStatus REQUEST_STATS: the S37PacketStatistics reply, every stat of the player (the tab's Statistics screen).
  requestStats(id) { const p = this.players.get(id); if (p) this.send(p, statsMessage(p)); }
  // C16PacketClientStatus OPEN_INVENTORY_ACHIEVEMENT: the one achievement a tab reports (it opened its inventory).
  clientStatus(id, status) { const p = this.players.get(id); if (p && status === 'openInventory') trigger(p, 'openInventory'); }
  send(p, event) { if (!this.outbox.has(p.id)) this.outbox.set(p.id, []); this.outbox.get(p.id).push(event); }
  // A sound at player p for the other players near it (p's tab plays its own prediction).
  heardFrom(p, sound, volume = 1, pitch = 1) {
    const r = v => Math.round(v * 100) / 100;
    this.near(p, { type: 'sound', sound, x: r(p.position.x), y: r(p.position.y), z: r(p.position.z), volume: r(volume), pitch: r(pitch) });
  }
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
      use: (p, down) => this.use(p, down),
      mine: (p, down) => this.mine(p, down),
      mobs: this.mobs,
      // A grenade or rocket's Explosion (hooks.js explode): `destroy_block` false keeps the blocks (isSmoking off).
      explode: this.mobs ? (p, x, y, z, radius, { destroy }) => this.mobs.explode([...this.players.values()].filter(q => !q.dead), x, y, z, radius,
        { exploder: null, attacker: 'player', smoking: destroy, by: p }) : null,
    };
    tickBeds(this); // the night skip and each sleeper's timer (server-beds.js)
    // Weapons act first, against where everyone stood when the shooter last saw them (tick - 1 is the newest recorded tick).
    for (const p of players) { if (p.bed?.sleeping) { p.combat.queue.length = 0; continue; } deps.canBreak = block => this.canBreak(p, block); tickCombat(p, deps); }
    for (const p of players) {
      if (p.dead) { Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); p.survival.time = this.time; continue; }
      if (p.bedCheck) settleBedRespawn(this, p); // a respawn whose bed's column just arrived
      if (this.frozen(p)) { p.survival.time = this.time; continue; } // its column is not ticking yet (simulation.js updateViews)
      if (p.bed?.sleeping) { // EntityPlayer lying in bed: no movement, still hungry, hurt and burning (survival.tick)
        p.survival.time = this.time;
        p.survival.tick({ inWater: false, inLava: false });
        this.play.checkWindow(p);
        continue;
      }
      const controls = this.ticks - p.lastInput > 10 ? IDLE_INPUT : p.input;
      drainKnockback(p.survival, p.velocity, p.position, this.random);
      // A ridden pig, horse, cart or boat takes the input instead (server-riding.js rideTick); sneak gets off.
      const from = { x: p.position.x, y: p.position.y, z: p.position.z };
      const riding = !!p.rider?.vehicle, moved = rideTick(this, p, controls) ?? movePlayer(p, controls);
      fallStat(p); // EntityPlayer.fall, before the landing resets the distance
      // The landing's farmland, dust and fall sounds, then the steps, splash and redstone ore (server-contacts.js); a rider takes no steps.
      finishPlayerMovement(p, moved, riding ? undefined : landingHooks(this, p));
      if (!riding) stepPlayer(this, p, from, moved, !!p.inWater);
      if (p.position.y < -64) {
        if (p.survival.creative) { p.position.copy(this.spawnPoint()); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); }
        else { p.survival.damage(1000, 'void'); p.lastHit = null; }
      }
      p.survival.time = this.time;
      // EntityPlayer.updateItemUse: 32 ticks of eating, then ItemFood.onEaten. The client only shows its own prediction.
      // ItemPotion.onEaten / ItemBucketMilk.onEaten when a drink ends: the potion's effects and its glass bottle, or milk's cure.
      // Its random.eat / random.drink / random.burp and the food crumbs are heard and seen by the others; its own tab predicted them.
      if (p.eating) p.eating = tickPlayerItemUse(p.eating, p.survival.inventory.held?.id ?? 0, p.survival, { random: this.random, finishDrinking,
        sound: (sound, { volume = 1, pitch = 1 } = {}) => this.heardFrom(p, sound, volume, pitch),
        foodEffects: (id, n) => { // EntityLivingBase.updateItemUse(stack, n) for EnumAction.eat
          this.heardFrom(p, 'random.eat', 0.5 + 0.5 * Math.floor(this.random() * 2), (this.random() - this.random()) * 0.2 + 1);
          this.near(p, { type: 'crumbs', id, by: p.id, n });
        } }).use;
      p.survival.tick({ inWater: moved.inWater, inLava: moved.inLavaNow });
      p.inWater = moved.inWater;
      tickPlayerStats(this, p, from);
      brokenTool(this, p); // EntityLivingBase.renderBrokenItemStack: a tool, rod or armour piece that wore out this tick
      if (p.swing) p.swing--;
      this.play.checkWindow(p);
      this.play.tickMining(p);
      this.portalTick(p, from); // last: a trip takes the player out of this world
    }
    for (const p of players) {
      if (p.dead || p.survival.health > 0 || !this.players.has(p.id)) continue;
      p.dead = true;
      const hit = p.lastHit && this.ticks - p.lastHit.tick < 100 ? p.lastHit : null;
      const reason = p.survival.lastDamage;
      this.chatOut.push(describe(p.name, hit) ?? (reason === 'a fall' ? `${p.name} hit the ground too hard` : reason === 'void' ? `${p.name} fell out of the world` : reason && reason !== 'player' ? this.trackerLine(p) : `${p.name} died`));
      const killer = hit ? this.players.get(hit.by) : null;
      if (killer) this.send(killer, { type: 'kill', target: p.id, name: p.name });
      deathStats(p, killer);
      p.combat.reset(); p.eating = null; dismount(this, p); dropHook(p);
      if (!this.rules.keepInventory) {
        this.play.dropAll(p);
        const dropped = p.experience.death(); // EntityPlayer.getExperiencePoints: 7 per level, at most 100
        if (dropped && this.mobs) this.mobs.orbs.spawn(dropped, { x: p.position.x, y: p.position.y, z: p.position.z });
      } else { this.play.closeWindow(p); this.play.close(p, 0); }
      p.mining = null; p.mineHeld = false;
    }
    this.history.record(this.ticks, this.players.values());
  }
  // BlockPortal / BlockEndPortal.onEntityCollidedWithBlock for the cells the player's box touches (Entity.func_145775_I, the box
  // shrunk by 0.001), then Entity.onEntityUpdate's portal timer. A rider or a ridden player is not taken. Starts the trip
  // (server-dimensions.js); `p.portalShown` is the tab's portal overlay.
  portalTick(p, from) {
    const dims = (this.root ?? this).dims, state = p.portal;
    if (!dims || !state) return false;
    const w = this.world, { x, y, z } = p.position, hw = 0.299;
    let nether = false, end = false;
    for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw); bx++) for (let by = Math.floor(y + 0.001); by <= Math.floor(y + 1.799); by++) for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw); bz++) {
      const b = w.get(bx, by, bz);
      if (b === GAME_IDS.portal) nether = true; else if (b === GAME_IDS.endPortal) end = true;
    }
    const riding = !!p.rider?.vehicle;
    if (end && !riding) { p.portalShown = false; return dims.travel(p, END); } // BlockEndPortal: travelToDimension(1) at once
    if (nether && !riding) state.setInPortal(from.x, from.z, x, z);
    p.portalShown = state.inPortal;
    const to = state.tick(this.dimension, { creative: p.survival.creative, riding });
    return to !== null && dims.travel(p, to);
  }
  // CombatTracker's line (death-messages.js) for a death no player caused: a mob, an arrow, a blast, lava, drowning.
  trackerLine(p) {
    try { const line = trackerMessage(p.survival.combat, p.name); if (line) return line; } catch { /* fall back below */ }
    return `${p.name} died`;
  }
  // The mobs (WorldServer.tick: spawning, then the entities), TileEntityFurnace.updateEntity once for the world, then EntityItem;
  // then the shared world systems (simulation.js).
  tickWorld(beforeLit) {
    this.mobs?.tick();
    for (const p of this.players.values()) seatTick(this, p); // the riders back on their moved seats
    tickFishing(this); // EntityFishHook.onUpdate (server-fishing.js)
    this.hanging.tick(); // EntityHanging.onUpdate: the wall check (server-hanging.js)
    this.maps?.tick(); // ItemMap.onUpdate for the carried and framed maps (server-maps.js)
    this.tiles.tickFurnaces();
    this.play.stations.tick(this.changes.values()); // brewing stands and beacons (server-stations.js)
    this.play.tickItems();
    return super.tickWorld(beforeLit);
  }
  hopperItems() { return this.play.items.items; }
  // A thunderstorm's bolts (EntityLightningBolt): thunder is heard by everyone (volume 10000), the strike's crack within its 16 x 2
  // blocks; the mobs and players in a flashing bolt's box are struck.
  weatherEvents(events, struck) {
    for (const e of events) {
      const event = { type: 'sound', sound: e.sound, x: e.x, y: e.y, z: e.z, volume: Math.min(e.volume, 10000), pitch: e.pitch };
      for (const p of this.players.values()) if (e.volume >= 10000 || Math.hypot(p.position.x - e.x, p.position.y - e.y, p.position.z - e.z) <= 16 * e.volume) this.send(p, event);
    }
    if (!struck.length) return;
    const players = [...this.players.values()].filter(p => !p.dead).map(p => ({ survival: p.survival, position: p.position, width: PHYSICS.width, height: PHYSICS.height }));
    for (const bolt of struck) strikeEntities(bolt, this.mobs?.ew ?? null, players);
  }
  presence() {
    return super.presence().map(entry => {
      const p = this.players.get(entry.id);
      const riding = ridingKind(p), hook = hookOf(p), sleeper = sleeperPresence(p); // lying in its bed (S0APacketUseBed)
      // EntityLivingBase's DataWatcher 7 and 8 and Entity flag 5: the potion particle colour, whether every effect is a beacon's, invisibility.
      const fx = p.dead ? 0 : potionColor(p.survival.effects.active.values()), shown = fx ? { fx, ...(p.survival.effects.allAmbient() ? { ambient: true } : {}) } : {};
      return { ...entry, hurt: p.survival.hurtTime, dead: p.dead, mode: p.survival.mode, ...(riding ? { riding } : {}), ...(hook ? { hook } : {}), ...shown,
        ...(p.survival.effects.has(INVISIBILITY) ? { invisible: true } : {}), ...(sleeper ? { sleeping: sleeper } : {}) };
    });
  }
  // What only player `p` sees each tick: its health, food and, when changed, its inventory.
  you(p) {
    const s = p.survival, out = { health: s.health, food: s.food, saturation: s.saturation, absorption: s.absorption, hurt: s.hurtTime,
      dead: p.dead, protection: s.protection, mode: s.mode, current: s.inventory.current, x: p.position.x, y: p.position.y, z: p.position.z,
      vx: p.velocity.x, vy: p.velocity.y, vz: p.velocity.z, flying: p.flying, shots: p.combat.shots };
    const window = this.play.windowState(p), inv = JSON.stringify([s.inventory.serialize(), s.inventory.serializeArmor(), window]);
    if (inv !== p.sentInv) { p.sentInv = inv; out.inv = { slots: s.inventory.serialize(), armor: s.inventory.serializeArmor(), window }; }
    const open = this.play.openState(p), openKey = JSON.stringify(open);
    if (openKey !== p.sentOpen) { p.sentOpen = openKey; out.open = open; } // a window the server opened (a block) or closed (reach, death)
    out.ack = p.clickAck;
    out.mining = p.mining ? { block: [...p.mining.block], progress: Math.min(1, p.mining.progress) } : null; // raycast cells may be typed arrays
    out.items = this.play.itemsNear(p);
    if (this.mobs) { out.mobs = this.mobs.rows(p); out.thrown = this.mobs.thrownRows(p); out.carts = this.mobs.cartRows(p); out.boats = this.mobs.boatRows(p); }
    out.riding = ridingOf(this, p);
    if (p.portalShown) out.portal = true; // in a Nether portal: the tab's swirl and nausea (EntityPlayerSP.timeInPortal)
    const sleep = sleepRow(p);
    if (sleep) out.sleep = sleep; // the bed and the fade timer (server-beds.js)
    const hanging = this.hanging.rows(p);
    if (hanging) out.hanging = hanging;
    const unlocked = achievementList(p), key = unlocked.join();
    if (key !== p.sentAchievements) { p.sentAchievements = key; out.achievements = unlocked; } // the tab's achievement screen
    const maps = this.maps?.rows(p);
    if (maps?.length) out.maps = maps;
    // S1DPacketEntityEffect / S1EPacketRemoveEntityEffect for the player's own effects: [id, amplifier, duration, ambient] when one starts,
    // changes or ends, and once a second for the remaining time (the tab counts down in between).
    const effects = effectRows(s.effects);
    const effectKey = effects.map(e => `${e[0]}:${e[1]}:${e[3]}`).join();
    if (effectKey !== p.sentEffects || (effects.length && this.ticks % 20 === 0)) { p.sentEffects = effectKey; out.effects = effects; }
    const x = p.experience, xp = x ? `${x.level},${x.progress},${x.points}` : '';
    if (x && xp !== p.sentXp) { p.sentXp = xp; out.xp = [x.level, x.progress, x.points, x.total]; }
    return out;
  }
  drainEvents(p) { const e = this.outbox.get(p.id) ?? []; this.outbox.delete(p.id); return e; }
  save() {
    const dimensions = this.dims?.save(); // the other worlds' players go into the shared accounts first
    for (const p of this.players.values()) this.accounts.set(p.account, this.savePlayer(p));
    for (const [, trip] of this.dims?.transit ?? []) { const saved = this.savePlayer(trip.p); if (trip.from) saved.dimension = trip.from; else delete saved.dimension; this.accounts.set(trip.p.account, saved); }
    const base = super.save();
    delete base.players;
    return { ...base, version: 2, accounts: [...this.accounts], rules: this.rules, play: this.play.save(), ...(this.mobs ? { mobs: this.mobs.save() } : {}), ...(this.maps ? { maps: this.maps.save() } : {}), hanging: this.hanging.save(),
      ...(dimensions && Object.keys(dimensions).length ? { dimensions } : {}) };
  }
}
