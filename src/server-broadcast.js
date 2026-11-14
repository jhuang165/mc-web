// The dedicated server's chat channel and player commands (batch 58): what 1.7.10 broadcasts to every player, commands that act on another
// connected player's record, and the S02PacketChat shape of every line (a chat component as JSON, not plain text).
// Bytecode-read on the unchanged classes (javap, see .shared-memory/notes/serverbroadcast-b58-track.md):
//  * EntityPlayerMP.onDeath (mw.a(ro)) begins with ServerConfigurationManager.func_148539_a(getCombatTracker().func_151521_b()) (oi.a(fj), every player).
//    No gamerule gates it: 1.7.10 has no showDeathMessages rule (GameRules lists only the nine rules of command-data.js).
//  * StatisticsFile.func_150873_a (pg.a(yz, ph, int)): after the base addStat, an achievement stat that read 0 before, with amount > 0, and
//    MinecraftServer.func_82356_Z (at(), true; the dedicated server's announce-player-achievements, recalled) sends chat.type.achievement to every player.
//  * CommandKill (aw.b) kills the sender only (b(ac) is getCommandSenderAsPlayer; the arguments are never read).
//  * CommandBase.func_152373_a (bl): the sender gets the plain feedback; every other op who may use the command gets chat.type.admin (sender name, the
//    message) in gray italic, except a command block's output when the commandBlockOutput rule is off.
import { serializeComponent, parseChatJson, translation, text as textComponent, isComponent } from "./chat-component.js";
import { chatTextComponent } from "./team-names.js";
import { achievementComponent } from "./chat-multi.js";
import { createCommandRunner, canUse, CommandException } from "./commands.js";
import { Achievements, BY_ID } from "./achievements.js";
import { deathComponent } from "./team-names.js";
import { CombatTracker, damageSource } from "./combat-tracker.js";
import { itemFromOriginal } from "./region-import.js";
import { makeStack } from "./inventory.js";
import { stackName } from "./item-names.js";
import { ITEMS } from "./survival.js";
import { itemComponent } from "./item-component.js";
import { worldHost, playerHost, serverInventory, SERVER_WORLD_COMMANDS } from "./servercommands-b59.js";
import { runCartCommand, setCartCommand } from "./multiplayer/server-cart-commands.js"; // b63
import { pickedAchievement } from "./achievements-live.js";
import { summonHost } from "./multiplayer/server-summon.js"; // b67 mpsummon

// Commands an operator can run on the dedicated server: the ones whose state this server holds or relays. The rest answer that they are unavailable.
export const SERVER_COMMANDS = new Set(["tell", "me", "say", "scoreboard", /* b64 mpscoreboard */ "help", "seed", "give", "clear", "xp", "effect", "gamemode", "tp", "achievement", "kill", "summon" /* b67 mpsummon */, /* b68 mpadmin */ "op", "deop", "kick", "ban", "ban-ip", "pardon", "pardon-ip", "banlist", "whitelist", "stop", "save-all", "save-on", "save-off", "setidletimeout", ...SERVER_WORLD_COMMANDS]);
export const SERVER_UNSUPPORTED_TEXT = (name) => `The /${name} command is not available on this server`;

/** An S02PacketChat of this build: the component as JSON beside the legacy text older clients print. */
export function chatMessage(component) {
  if (typeof component === "string") return { type: "chat", name: "", text: component };
  return { type: "chat", name: "", text: component.formatted(), json: serializeComponent(component) };
}
/** What a client prints for a chat message: the parsed component of a `json` field, else the legacy text; a plain sender line stays chat.type.text. */
export function chatDisplay(message) {
  if (typeof message.json === "string") {
    const parsed = parseChatJson(message.json);
    if (parsed.component) return parsed.component;
  }
  return message.name ? chatTextComponent(message.name, message.text) : message.text;
}
/** A player's plain chat line: NetHandlerPlayServer sends ChatComponentTranslation("chat.type.text", player component, text) to everyone. */
// `name` and `text` stay for clients that build the line themselves; `json` is the component.
export const playerChatMessage = (name, line, formatted = name) => ({ type: "chat", name, text: line, json: serializeComponent(chatTextComponent(formatted, line, name)) });

/** The CombatTracker message of a void death (Entity.G: attackEntityFrom(outOfWorld, 4), or /kill's 1000 damage). */
export function voidDeathComponent(name, rawName = name) {
  const tracker = new CombatTracker();
  tracker.record(damageSource("void"), 20, 1000, 0, { alive: false });
  return deathComponent(tracker, name, { rawName });
}

const unsupported = (text) => new CommandException("commands.generic.exception", [text], "unsupported");
const grayItalic = (c) => { c.style.color = "gray"; c.style.italic = true; return c; };

/**
 * Chat, commands, deaths and achievements for the connected players of one DedicatedSimulation.
 * `deliver(id, message)` sends one wire message to a player; `ops` is a Set of lower-case player names that hold operator rights (default none,
 * as before: the dedicated server has no operators unless its owner names them).
 */
export class ServerSocial {
  constructor({ simulation, deliver, ops = new Set() }) {
    Object.assign(this, { simulation, deliver, ops: new Set([...ops].map((n) => n.toLowerCase())), achievements: new Map() });
    if (simulation.achievements) simulation.achievements.sink = this; // b60: the biome and beacon observers read the per-player Achievements (server-achievements.js)
  }
  idOf(name) { for (const [id, p] of this.simulation.players) if (p.name.toLowerCase() === String(name).toLowerCase()) return id; return undefined; }
  // b68 mpadmin: an operator is a MC_WEB_OPS name (level = op-permission-level) or a /op entry of the admin lists (its own level).
  isOp(name) { return this.ops.has(String(name).toLowerCase()) || (this.simulation.admin?.isOpName(name) ?? false); }
  opLevel(name) { return this.simulation.admin?.levelOfName(name) ?? (this.ops.has(String(name).toLowerCase()) ? this.simulation.admin?.opLevel ?? 4 : 0); }
  everyone(message) { for (const id of this.simulation.players.keys()) this.deliver(id, message); }
  toPlayer(name, message) { const id = this.idOf(name); if (id !== undefined) this.deliver(id, message); }

  /** The team-formatted name of EntityPlayer.func_145748_c_ (prefix + name + suffix, b64 mpscoreboard); the plain name without a team. */
  formatted(name) { return this.simulation.scoreboard?.formatName(name) ?? name; }
  /** A plain chat line, to every player. */
  chat(id, line) { const name = this.simulation.players.get(id).name; this.everyone(playerChatMessage(name, line, this.formatted(name))); }
  /** b64 mpscoreboard: the S3B / S3C / S3D / S3E packets the scoreboard queued, to every player, in order. */
  flushScoreboard() { const packets = this.simulation.scoreboard?.take(); if (packets?.length) this.everyone({ type: "sb", packets }); }
  /** ServerConfigurationManager.func_96456_a: a joining player receives the whole scoreboard. */
  scoreboardJoin(id) { const sb = this.simulation.scoreboard, packets = sb ? sb.joinPackets() : []; if (packets.length) this.deliver(id, { type: "sb", packets }); }
  /** EntityPlayerMP.onDeath: the death message to every player. */
  death(id, component = null) {
    const p = this.simulation.players.get(id);
    if (p) this.everyone(chatMessage(component ?? voidDeathComponent(this.formatted(p.name), p.name)));
  }
  /** EntityPlayer.triggerAchievement: a locked-parent or repeated one is silent; the first unlock is announced to every player. */
  achievementsOf(id) {
    let a = this.achievements.get(id);
    if (!a) {
      const p = this.simulation.players.get(id);
      a = new Achievements({ onUnlock: (ach) => { p.achievementsSaved = a.save(); this.everyone(chatMessage(achievementComponent(p.name, ach.id, this.formatted(p.name)))); } });
      a.onTrigger = (achId) => this.simulation.scoreboard?.achievement(p.name, achId); // b64: the achievement.* criteria count every trigger
      if (p.achievementsSaved) a.load(p.achievementsSaved);
      this.achievements.set(id, a);
    }
    return a;
  }
  award(id, achievementId) { return BY_ID[achievementId] ? this.achievementsOf(id).trigger(achievementId) : false; }
  /** C16PacketClientStatus OPEN_INVENTORY_ACHIEVEMENT (nh.a(is)): the client opened its own survival inventory. */
  openInventory(id) { return this.simulation.players.has(id) && this.award(id, "openInventory"); }
  forget(id) { this.achievements.delete(id); }
  /** MC|AdvCdm for a command block minecart (b63): a Creative operator sets its command. */
  setCartCommand(id, key, command) { return setCartCommand(this, id, key, command); }
  /** Events the simulation queued this tick (`simulation.events`): { type: 'death', id }. */
  drain() {
    for (const p of this.simulation.players.values()) this.simulation.scoreboard?.tickHealth(p); // b64 mpscoreboard: EntityPlayerMP.onUpdate health criteria
    for (const cart of this.simulation.vehicles?.cartCommands?.splice(0) ?? []) if (!cart.dead) runCartCommand(this, cart, { commands: SERVER_COMMANDS, chatMessage }); // b63: command block carts that an activator rail triggered this tick
    const events = this.simulation.events?.splice(0) ?? [];
    for (const e of events) {
      if (e.type === "death") this.death(e.id, e.component);
      else if (e.type === "award") this.award(e.id, e.achievement); // server-achievements.js: crafted, smelted, thrown diamonds, mob kills
      else if (e.type === "pickup") { const a = pickedAchievement(e.item); if (a) this.award(e.id, a); } // EntityItem.onCollideWithPlayer (xk.b_)
    }
    this.flushScoreboard();
    return events.length;
  }

  /** A chat line starting with "/": the lines go to their recipients, and the state changes to the player records. */
  command(id, line) {
    const sim = this.simulation, sender = sim.players.get(id);
    const roster = [...sim.players.values()].map((p) => ({ name: p.name, position: { x: p.position.x, y: p.position.y, z: p.position.z }, mode: p.survival.mode === "creative" ? 1 : p.survival.mode === "adventure" ? 2 : 0 }));
    const op = this.isOp(sender.name), out = [];
    // b68 mpadmin: /op /kick /ban /whitelist /stop ... run in server-admin.js (they are not in the single-player registry)
    if (sim.admin.handles(line)) {
      const live = () => [...sim.players.values()];
      return sim.admin.run(line, { sender: sender.name, level: this.opLevel(sender.name), deliver: (name, c) => this.toPlayer(name, chatMessage(c)),
        ops: () => live().filter((p) => this.isOp(p.name)).map((p) => p.name), online: () => live().map((p) => ({ id: p.id, name: p.name, uuid: p.resumeKey })) });
    }
    const to = (name, message) => out.push({ to: name, message });
    const records = roster.map((r) => ({ name: r.name, position: () => r.position, mode: r.mode, level: 0 }));
    const rights = (name) => this.isOp(name);
    const forPlayer = (name) => this.playerOps(this.idOf(name), (n, m) => to(n, m));
    const host = Object.assign(Object.create(forPlayer(sender.name)), {
      name: sender.name, playerName: sender.name, cheats: op, scoreboard: sim.scoreboard, // b64 mpscoreboard: /scoreboard acts on the shared board
      canUse: (command) => (op ? (SERVER_COMMANDS.has(command.name) && this.opLevel(sender.name) >= command.permission) || canUse(command, false) : canUse(command, false) || command.name === "list"), // b68: op level
      unsupported: { has: (n) => op && !SERVER_COMMANDS.has(n) },
      players: () => records, forPlayer,
      positionOf: (name) => { const p = sim.players.get(this.idOf(name)); return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : undefined; },
      seed: () => sim.world.seed,
      print: (t, c) => to(sender.name, c ?? t),
      broadcast: (t, c) => { for (const r of records) to(r.name, c ?? t); },
      deliver: (name, t, c) => to(name, c ?? t),
      // CommandBase.func_152373_a: the sender's own line, and chat.type.admin (gray italic) to every other op.
      feedback: (t, c) => {
        const component = isComponent(t) ? t : c;
        to(sender.name, component ?? t);
        if (component) for (const r of records) if (r.name !== sender.name && rights(r.name)) to(r.name, grayItalic(translation("chat.type.admin", sender.name, component)));
      },
    });
    // World commands act on the simulation (time, weather, rules, difficulty); /list and /tellraw see every connected player.
    Object.defineProperties(host, Object.getOwnPropertyDescriptors(worldHost(sim)));
    host.listPlayers = (uuids) => ({ names: [...sim.players.values()].map((q) => (uuids ? `${q.name} (${q.resumeKey})` : q.name)), max: host.maxPlayers });
    host.printTo = (name, component) => to(name, component);
    Object.defineProperties(host, Object.getOwnPropertyDescriptors(summonHost(sim, sender))); // b67 mpsummon: inWorld, summon (CommandSummon, level 2)
    createCommandRunner(host).run(line);
    this.flushScoreboard();
    // The per-player achievements of a target are reached through forPlayer (below); deliver everything collected in order.
    for (const { to: name, message } of out) {
      const wire = typeof message === "string" || isComponent(message) ? chatMessage(message) : message;
      this.toPlayer(name, wire);
    }
    return out.length;
  }

  /** The state operations of /give, /clear, /xp, /effect, /gamemode, /tp, /kill, /achievement on one player's record (`id`); wire messages that the client applies go to that player. */
  playerOps(id, say) {
    const sim = this.simulation, p = sim.players.get(id), self = this;
    const op = (name, ...args) => this.deliver(id, { type: "playerOp", op: name, args });
    return {
      position: () => ({ x: p.position.x, y: p.position.y, z: p.position.z }),
      playerMode: () => (p.survival.mode === "creative" ? 1 : p.survival.mode === "adventure" ? 2 : 0),
      teleport: (x, y, z) => { p.position.copy({ x, y, z }); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); p.fallDistance = 0; p.moved = true; },
      setGameMode: (mode) => { p.survival.mode = mode; p.survival.inventory.creative = p.survival.creative; if (!p.survival.creative) p.flying = false; op("setGameMode", mode); },
      kill: () => { op("kill"); (sim.events ??= []).push({ type: "death", id }); },
      give: (original, count, damage, tag) => {
        const item = itemFromOriginal(original, damage);
        if (!item) throw unsupported("This item is not in this build");
        const stack = makeStack(item.id, count, item.damage), name = stackName(stack, ITEMS) || ITEMS[item.id]?.name || "Item";
        op("give", { id: item.id, count, damage: item.damage });
        return { name: "[" + name + "]", component: itemComponent(stack, name), ignored: tag ? ["NBT tag"] : [] };
      },
      // The server clears every slot it holds (serverInventory: the hotbar the client sends, and the rest when inventory authority fills it); the client clears its own.
      clear: (original, damage) => {
        const want = original === -1 ? null : itemFromOriginal(original, Math.max(damage, 0));
        if (original !== -1 && !want) return 0;
        let removed = 0;
        for (const list of serverInventory(p).lists) for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (!s || (want && (s.id !== want.id || (damage !== -1 && (s.damage ?? 0) !== want.damage)))) continue;
          removed += s.count; list[i] = null;
        }
        if (removed || !want) op("clear", want ? want.id : -1, want ? damage : -1);
        return removed;
      },
      addExperience: (n) => op("addExperience", n),
      addLevels: (n) => op("addLevels", n),
      addEffect: (effectId, ticks, amplifier) => {
        const e = { id: effectId, duration: ticks, amplifier };
        if (effectId === 6 || effectId === 7) return op("addEffect", effectId, ticks, amplifier); // instant health / damage are applied by the client's own record
        if (!p.survival.effects.add(e)) throw unsupported("This effect is not available in this build");
        (p.effectsOut ??= []).push({ id: effectId, amplifier, duration: ticks, ambient: false }); // S1D, as for a beacon grant
      },
      removeEffect: (effectId) => { if (!p.survival.effects.has(effectId)) return false; p.survival.effects.remove(effectId); op("removeEffect", effectId); return true; },
      clearEffects: () => { if (!p.survival.effects.active.size) return false; p.survival.effects.clear(); op("clearEffects"); return true; },
      ...playerHost(sim, p, op),
      get achievements() { return self.achievementsOf(id); },
    };
  }
}
