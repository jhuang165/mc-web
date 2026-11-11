// Command blocks and command minecarts in the away run (batch 33, public/research/dimensions.md "Batch 33").
//
// Native rules (bytecode-read with javap on the 1.7.10 jar, not executed):
//   - BlockCommandBlock.updateTick (akb.a) calls CommandBlockLogic.func_145755_a (agp.a) with no player test: it is a scheduled block tick, so a powered
//     command block runs for as long as the player is away, past the 1200-tick entity gate too. SuccessCount (agp.b) = CommandHandler.a's return.
//   - CommandHandler.a (z.a): when the command's username argument (ICommand.isUsernameIndex) is a selector token, the handler runs the command once per
//     player PlayerSelector.matchPlayers returns and counts the runs; no match means zero runs, no message, SuccessCount 0 and LastOutput untouched.
//     Username indices: give, clear, effect, enchant, spawnpoint, testfor, tell, tp, tellraw 0; gamemode, xp, playsound 1; achievement 2.
//   - PlayerSelector.c (ad.c) hands the sender's world to ServerConfigurationManager.findPlayers (oi.a) only when rm, r, x, y or z is given
//     (iload 15 is set by exactly those keys); without them the search covers players in every dimension. The player in the Nether or End is
//     therefore found by a plain @p or @a and is not found by @p[r=...] or @p[x=...], which compare mw.o (the player's world) with the sender's.
// Batch 34: commands that act on the player are QUEUED, in firing order, and the main thread replays them through the live command host when the run is
// applied (replayPlayerCommands below). Natively they run at the moment the block fires, on the player where he is (EntityPlayerMP.func_146097_a for give,
// his inventory/experience/effects/game mode for the rest); the player's state cannot change while he is away except through those very commands, so a
// replay in the same order reaches the same state. The block's SuccessCount and LastOutput are written by the replay (the native sender text, stamped with
// the wall time of the firing); until then the tile keeps what it had. /tp (CommandTeleport bv.b, bytecode-read) only moves the player inside his own
// dimension (the world test is mw.o != null; the entity form answers commands.tp.notSameDimension when the two worlds differ): the run prints the
// native success text and discards the move, because the portal return repositions the player anyway. /kill from a command block is
// PlayerNotFoundException natively (getCommandSenderAsPlayer) and fails the same way here. /playsound only sends a packet and /testfor only counts.
// Batch 35: the run also keeps a SHADOW of the player (a Survival and an Experience built from `plan.player.state` / `plan.player.experience`, the state the player
// has when he returns) and runs each queued command on it at the moment the block fires, so the block's SuccessCount and LastOutput are fresh, a later command in
// the same run sees an earlier one (/give then /clear, /xp then @p[lm=..], /gamemode then @p[m=..]) and a comparator reads the current count. The queue still replays on
// the live player at return (the shadow is not applied: the replay reaches the same state and also drops overflow, plays the feedback to the chat, etc.).
// /spawnpoint with four absolute integers (CommandSetSpawnpoint bp.b, bytecode-read: setSpawnChunk on each matched player, the Overworld respawn point, whatever
// dimension he stands in) writes the record's playerSpawn; without coordinates it takes the target's CURRENT position, which the run does not know: skipped and counted.
// /difficulty is global (every WorldServer): the run's mobs use it from then on and the main thread applies the last value on return.
// /setworldspawn moves the world spawn; ChunkProviderServer.b / ms.b load the chunks within 128 blocks of the spawn that the run reads once at plan time, and the
// loaded area of THIS run does not move (the planned columns are what the main thread copied): the new spawn is returned and takes effect for the next trip.
// What this host does with that: the world-only commands (setblock, summon, time, weather, gamerule, setworldspawn, say, me, testforblock, seed, help,
// defaultgamemode) run on the run's own world and entity systems through the same createCommandHost the live game uses. A selector the native
// code would resolve to no one (world-restricted) gives the silent zero. A command that would act on the player (the player is in another dimension
// with state the worker does not have: give, tp, xp, gamemode, effect, clear, kill, enchant, spawnpoint, difficulty, tellraw/tell to the player...)
// is SKIPPED: the block's SuccessCount and LastOutput stay as they were and the skip is counted in the run's stats. Skips are not native behaviour.
import { createCommandHost, DEFAULT_RULES } from "./command-host.js";
import { createCommandRunner, CommandException } from "./commands.js";
import { commandBlockSender } from "./command-block.js";
import { cartCommandPosition } from "./command-cart.js";
import { inSpawnArea } from "./away-plan.js";
import { selectLocalPlayer as selectLocal, USERNAME_INDEX } from "./command-selector.js";
import { PLAYER_NAME } from "./death-messages.js";
import { Survival } from "./survival.js";
import { Experience } from "./experience.js";
import { Effects } from "./status-effects.js";

// Inventory tally of a state snapshot ({ state: { slots, armor } }): per (id, damage) the first stack seen and the total count (armor counts with the inventory).
const keyOf = (st) => `${st.id}:${st.damage | 0}`;
const tally = (snap) => { const m = new Map(); for (const st of [...(snap?.state?.slots ?? []), ...(snap?.state?.armor ?? [])]) if (st && st.count > 0) { const e = m.get(keyOf(st)); if (e) e.count += st.count; else m.set(keyOf(st), { stack: st, count: st.count }); } return m; };
const ALIAS = { w: "tell", msg: "tell" };
// Queued for the return (they act on the player's state): see the header. spawnpoint would write the Nether record's spawn, so it stays skipped.
const DEFER = new Set(["give", "clear", "effect", "enchant", "gamemode", "xp", "tell", "tellraw", "achievement"]);
// Run in the away run at once: they need no player state (tp discards its move, see the header).
const NO_LASTING_EFFECT = new Set(["testfor", "tp", "playsound"]);
export const QUEUE_CAP = 2000;
// Commands that need the scoreboard store or the real server, which a run does not have.
const NEEDS_PLAYER = new Set(["scoreboard", "spreadplayers", "debug", "publish"]);
const SELECTOR = /^@([parf])(?:\[([\w=,!-]*)\])?$/;
const CHAT_CAP = 100;

export function awayCommands({ plan, world, rt, weather, tiles, entities, wanted, breakBlock, loadedChunk = (cx, cz) => inSpawnArea(plan.spawn ?? [0, 0, 0], cx, cz) }) {
  const spawn = plan.spawn ?? [0, 0, 0];
  const active = { allowCommands: true, gameRules: { ...DEFAULT_RULES, ...(plan.gameRules ?? {}) }, worldSpawn: [...spawn], defaultGameMode: plan.defaultGameMode };
  const initial = JSON.stringify(active), initialWeather = JSON.stringify(weather.save());
  const sv = { time: 0, mode: "survival", ...tiles };
  const state = { ran: 0, timeShift: 0, lastTime: 0 };
  const stats = { run: 0, silent: 0, skipped: 0, queued: 0, reasons: {} };
  const queue = []; // player commands in firing order (replayPlayerCommands)
  const chat = [];
  const skip = (reason) => { host.skipped ??= reason; throw new CommandException("commands.generic.exception", [reason], "unsupported"); };

  // The world the commands see: a write also tells the redstone runtime what changed, as the dispenser host does.
  const seen = new Proxy(world, { get(t, k) {
    if (k === "set") return (x, y, z, b, track, meta = 0) => { const old = t.get(x, y, z), ok = t.set(x, y, z, b, track, meta); if (ok && old !== t.get(x, y, z)) rt.fluidChanges([[x, y, z, old, t.get(x, y, z)]]); return ok; };
    const v = t[k];
    return typeof v === "function" ? v.bind(t) : v;
  } });
  // The saved clock is the end of the trip. `state.ran` is the 0-based index of the tick in progress: WorldServer.tick (mt.b, bytecode-read) adds 1 to the total time (ays.c) BEFORE it
  // runs tickUpdates (mt.a(Z), the block ticks and so the command blocks), so tick index n sees T0 + n + 1 (batch 42: it read T0 + n, one early; the last tick now sees plan.time).
  const now = () => (plan.time ?? 0) - (plan.ticks - state.ran - 1) + state.timeShift;
  const env = {
    active: () => active, world: () => seen, weather: () => weather, survival: () => sv,
    mobs: () => entities()?.mobs ?? null, minecarts: () => entities()?.minecarts, spawners: () => null, rockets: () => entities()?.rockets,
    entityHosts: () => { const e = entities(); return e && { items: e.items, xpOrbs: e.xp, primed: e.primed, falling: e.falling, boats: e.boats, projectiles: e.projectiles, arrows: e.arrows, mobs: e.mobs, hanging: e.hanging, dimension: 0 }; },
    position: () => ({ x: spawn[0], y: spawn[1], z: spawn[2] }), seed: () => plan.seed,
    commandTile: (x, y, z) => rt.commandBlocks.tile(x, y, z),
    stackName: () => "", changed() {}, refreshInventory() {},
    setTime: (t) => { const d = t - state.lastTime; state.lastTime = t; state.timeShift += d; entities()?.shiftTime(d); },
    updateBlock() {}, destroyBlock: (x, y, z) => breakBlock(x, y, z),
  };
  const host = createCommandHost(env);
  // The shadow player: the player's state, advanced by the queued commands at the moment they fire (see the header). Batch 36: it follows the main thread's TRACE of the
  // trip (plan.trace: [t, dimension, x, y, z] samples and, whenever the player's state changed, [t, {state, experience, mode, level}] snapshots), so each firing starts
  // from the state at its own tick, not from the return state. A trace snapshot has none of the earlier commands' effects (the live player only gets those at return),
  // so syncShadow carries the player's own changes between snapshots over onto the shadow instead. Without a trace the return state serves for the whole run.
  const traceSamples = plan.trace?.samples ?? [], traceStates = plan.trace?.states ?? [];
  const fallbackState = { state: plan.player?.state, experience: plan.player?.experience, mode: plan.player?.mode };
  let shadowSv, shadowXp, stateAt = 0, sampleAt = 0;
  const modeName = (m) => (m === 1 ? "creative" : m === 2 ? "adventure" : "survival");
  const buildShadow = (snap) => { shadowSv = new Survival(snap?.state ?? {}, modeName(snap?.mode)); shadowXp = new Experience(snap?.experience ?? {}); };
  buildShadow(traceStates[0]?.[1] ?? fallbackState);
  // Batch 37: health, hunger and effects. The trace's samples carry [health, food, saturation, exhaustion, effects] (dimension-live.js traceAway, index 5). The shadow follows what the
  // player's own body did between two samples as a DIFFERENCE (health, food, saturation, exhaustion; an effect he gained, lost or refreshed), on top of what the commands did to the
  // shadow. Effects the commands added tick on the shadow (`owned`: regeneration, poison, wither, hunger, saturation per tick, as Effects.tick does; instant health and damage are
  // applied at once by the command host, Potion.performEffect natively on the next tick); the player's own effects only count down, because what they did to his health is already
  // in the sample differences. `cmd` is what the commands changed in net; result() returns it as playerDelta. Bytecode-read: CommandEffect (am) only calls
  // EntityLivingBase.addPotionEffect (yz.c), removePotionEffect (yz.m) and clearActivePotions (yz.aP); no other away-reachable command (give, clear, xp, gamemode, enchant,
  // spawnpoint, achievement, tell, tellraw) touches health, the food stats or effects, so these are the only fields a command changes.
  const cmd = { health: 0, food: 0, saturation: 0, exhaustion: 0 }, owned = new Set(), removed = new Set();
  let shadowT = 0, prevVit = traceSamples[0]?.[5] ?? null, prevT = traceSamples[0]?.[0] ?? 0;
  const vitals = () => [shadowSv.health, shadowSv.food, shadowSv.saturation, shadowSv.exhaustion];
  const tracked = (fn) => { const b = vitals(); try { return fn(); } finally { const a = vitals(); cmd.health += a[0] - b[0]; cmd.food += a[1] - b[1]; cmd.saturation += a[2] - b[2]; cmd.exhaustion += a[3] - b[3]; } };
  // Counts the shadow's effects down by the ticks since the last call; the owned ones also run their per-tick effect.
  function ageTo(t) {
    const n = Math.min(Math.floor(t), plan.ticks) - shadowT;
    if (!(n > 0)) return;
    shadowT += n;
    shadowSv.hurtTicks = Math.max(0, (shadowSv.hurtTicks | 0) - n);
    const active = shadowSv.effects.active;
    for (const [id, e] of [...active]) {
      if (owned.has(id)) {
        const scratch = new Effects(); scratch.active.set(id, e);
        tracked(() => { for (let i = 0; i < n && e.duration > 0 && shadowSv.health > 0; i++) { shadowSv.hurtTicks = Math.max(0, (shadowSv.hurtTicks | 0) - 1); scratch.tick(shadowSv); } });
        if (e.duration <= 0) { active.delete(id); owned.delete(id); }
      } else { e.duration -= n; if (e.duration <= 0) shadowSv.effects.remove(id); }
    }
  }
  // The player's own change between two samples (taken `elapsed` ticks apart).
  function applyVitals(prev, next, elapsed) {
    const sv2 = shadowSv, clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (sv2.health > 0) sv2.health = clamp(Math.fround(sv2.health + (next[0] - prev[0])), 0, sv2.maxHealth);
    sv2.food = clamp(sv2.food + (next[1] - prev[1]), 0, 20);
    sv2.saturation = clamp(Math.fround(sv2.saturation + (next[2] - prev[2])), 0, sv2.food);
    sv2.exhaustion = clamp(Math.fround(sv2.exhaustion + (next[3] - prev[3])), 0, 40);
    const was = new Map((prev[4] ?? []).map((e) => [e.id, e])), now = new Map((next[4] ?? []).map((e) => [e.id, e]));
    for (const [id, e] of now) {
      const old = was.get(id);
      if (!old || old.amplifier !== e.amplifier || e.duration > old.duration - elapsed + 1) { sv2.effects.active.set(id, { id, duration: e.duration, amplifier: e.amplifier }); owned.delete(id); removed.delete(id); stats.vitalEffects = (stats.vitalEffects ?? 0) + 1; }
    }
    for (const [id, old] of was) if (!now.has(id) && old.duration - elapsed > 1) { sv2.effects.remove(id); owned.delete(id); }
  }
  const modeNumber = () => (shadowSv.mode === "creative" ? 1 : shadowSv.mode === "adventure" ? 2 : 0);
  const shadowHost = createCommandHost({ ...env, survival: () => shadowSv, experience: () => shadowXp, giveDrop: (stack) => shadowSv.inventory.add(stack), setTime() {},
    setMode: (m) => { shadowSv.mode = m; shadowSv.inventory.creative = shadowSv.creative; }, setDifficulty() {} });
  // The player where he is: the last sample at or before the firing tick (samples are about a second apart); null when the run has no trace.
  const shadowPosition = () => { const s = traceSamples[sampleAt]; return s ? { x: s[2], y: s[3], z: s[4] } : null; };
  const shared = {
    playerElsewhere: true, skipped: null, awaySkip: () => skip("a selector filter that needs the scoreboard"),
    playerMode: modeNumber, playerLevel: () => shadowXp.level,
    playerPosition: () => shadowPosition() ?? { x: spawn[0], y: spawn[1], z: spawn[2] },
  };
  // commandBlockSender takes the player's position from host.position(): the shadow's is the traced player, not the world spawn.
  Object.assign(shadowHost, shared, { print() {}, printPlayer() {}, teleport() {}, position: () => shadowPosition() ?? { x: spawn[0], y: spawn[1], z: spawn[2] } });
  // The commands' own changes to the shadow's body, kept apart from the player's (see above).
  const copyOf = (id) => { const e = shadowSv.effects.get(id); return e && { ...e }; };
  const addEffect = shadowHost.addEffect, removeEffect = shadowHost.removeEffect, clearEffects = shadowHost.clearEffects;
  shadowHost.addEffect = (id, ticks, amp) => {
    const before = copyOf(id);
    const r = tracked(() => addEffect(id, ticks, amp)), after = copyOf(id);
    if (after && (!before || after.amplifier !== before.amplifier || after.duration > before.duration)) { owned.add(id); removed.delete(id); }
    return r;
  };
  shadowHost.removeEffect = (id) => { const r = removeEffect(id); if (r) { owned.delete(id); removed.add(id); } return r; };
  shadowHost.clearEffects = () => { const ids = [...shadowSv.effects.active.keys()], r = clearEffects(); if (r) for (const id of ids) { owned.delete(id); removed.add(id); } return r; };
  // Batch 42: /xp from a command block acts on the shadow at its firing like give and clear (CommandXP, bytecode-read: addExperience / addExperienceLevel on the matched player). The
  // shadow's own calls are recorded in order and go back as `xpOps`; the return applies them to the live experience as one net change instead of re-running the command.
  const xpOps = [];
  const addExperience = shadowHost.addExperience, addLevels = shadowHost.addLevels;
  shadowHost.addExperience = (n) => { xpOps.push(["points", n]); return addExperience(n); };
  shadowHost.addLevels = (n) => { xpOps.push(["levels", n]); return addLevels(n); };
  Object.assign(host, {
    ...shared,
    print: (text) => { if (chat.length < CHAT_CAP) chat.push(String(text?.text ?? text)); },
    printPlayer: (text) => { if (chat.length < CHAT_CAP) chat.push(typeof text === "string" ? text : JSON.stringify(text)); },
    inWorld(x, y, z) {
      const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
      if (y < 0 || y >= 256 || !loadedChunk(cx, cz)) return false; // an unloaded chunk: setblock/summon report out of world
      if (!wanted(cx, cz)) { host.skipped ??= "a spawn-area column the run did not load"; return false; }
      return true;
    },
  });
  host.teleport = () => { stats.tpDiscarded = (stats.tpDiscarded ?? 0) + 1; }; // CommandTeleport moves the player inside the other dimension; the portal return replaces that position
  for (const name of ["give", "clear", "kill", "setGameMode", "clearEffects", "removeEffect", "addEffect", "enchant", "addLevels", "addExperience", "shareToLan", "saveFile"]) {
    host[name] = () => skip(`${name} acts on the player or needs state the run does not have`);
  }

  // The global difficulty (CommandDifficulty -> setDifficultyForAllWorlds): the run's mobs use it from now on; the last value goes back to the main thread.
  host.setDifficulty = (d) => { state.difficulty = d; const m = entities()?.mobs; if (m) m.difficulty = d; };
  // CommandSetSpawnpoint: the player's respawn point (the Overworld's), kept in the record like main.js /spawnpoint does.
  host.setSpawnpoint = (x, y, z) => { active.playerSpawn = [x, y, z]; };

  // Moves the shadow to tick `t`: the position sample in force and, for each newer state snapshot, what the player changed since the previous one (his own pickups, drops,
  // crafts, xp and game mode in the Nether/End) applied on top of the shadow, which has the earlier commands' effects the live player does not have yet. Inventory: per
  // (id, damage) count difference, gains added, losses removed (armor counts with the inventory, so equipping is neutral). Experience: points gained are added; a drop
  // in total (enchanting, death) takes the snapshot's experience. Game mode: the snapshot's when it changed. Health, hunger and effects are not carried.
  function syncShadow(t) {
    while (sampleAt + 1 < traceSamples.length && traceSamples[sampleAt + 1][0] <= t) {
      const next = traceSamples[++sampleAt], vit = next[5];
      if (vit && prevVit) { ageTo(next[0]); applyVitals(prevVit, vit, next[0] - (prevT ?? 0)); }
      if (vit) { prevVit = vit; prevT = next[0]; }
    }
    ageTo(t);
    while (stateAt + 1 < traceStates.length && traceStates[stateAt + 1][0] <= t) {
      const prev = traceStates[stateAt][1], next = traceStates[++stateAt][1];
      applyChange(prev, next);
      stats.traceChanges = (stats.traceChanges ?? 0) + 1;
    }
  }
  // What the commands that act on the inventory (give, clear) changed in net: the shadow's inventory against the last state the player was seen in (the last trace snapshot, or
  // the return state without a trace), as [{ stack, count }] with negative counts for losses. The live player already has everything else he picked up, so the return applies this
  // instead of re-running those commands on a state they did not fire in (a clear that found nothing at tick 20 would otherwise take what he found at tick 400).
  function inventoryDelta() {
    if (!queue.some((q) => q.inv)) return [];
    const base = tally(traceStates.length ? traceStates[traceStates.length - 1][1] : fallbackState.state ? { state: fallbackState.state } : null), now = tally({ state: shadowSv.serialize() }), out = [];
    for (const [k, e] of now) { const d = e.count - (base.get(k)?.count ?? 0); if (d !== 0) out.push({ stack: e.stack, count: d }); }
    for (const [k, e] of base) if (!now.has(k)) out.push({ stack: e.stack, count: -e.count });
    return out;
  }
  // What the effect commands changed in net, for the return (the live player already has everything the trace carried): health and hunger differences, the effects the commands
  // left on him with the time they have left, and the ones they took away that are still gone at the end.
  function playerDelta() {
    const add = [...owned].map((id) => shadowSv.effects.get(id)).filter(Boolean).map((e) => ({ id: e.id, duration: e.duration, amplifier: e.amplifier }));
    return { health: cmd.health, food: cmd.food, saturation: cmd.saturation, exhaustion: cmd.exhaustion, add, remove: [...removed].filter((id) => !shadowSv.effects.has(id)) };
  }
  function applyChange(prev, next) {
    const before = tally(prev), after = tally(next), inv = shadowSv.inventory;
    for (const [k, e] of after) { const gain = e.count - (before.get(k)?.count ?? 0); if (gain > 0) { const st = { ...e.stack, count: gain }; inv.add(st); } }
    for (const [k, e] of before) {
      let loss = e.count - (after.get(k)?.count ?? 0);
      for (let i = 0; i < 36 && loss > 0; i++) { const st = inv.getStack(i); if (st && keyOf(st) === k && st.count > 0) { const take = Math.min(loss, st.count); st.count -= take; loss -= take; if (st.count === 0) inv.setStack(i, null); } }
    }
    const was = prev?.experience?.total ?? 0, now = next?.experience?.total ?? 0;
    if (now > was) shadowXp.add(now - was); else if (now < was) shadowXp = new Experience(next.experience ?? {});
    if (next?.mode !== prev?.mode && next?.mode !== undefined) { shadowSv.mode = modeName(next.mode); shadowSv.inventory.creative = shadowSv.creative; }
  }
  // The command on the shadow player now: SuccessCount and LastOutput at fire time. false when the shadow cannot run it.
  const onShadow = (tile, position, before) => {
    try {
      const shadowSender = commandBlockSender(shadowHost, tile, position, Number.isFinite(plan.wall) ? { now: () => new Date(plan.wall + state.ran * 50) } : undefined);
      tile.successCount = createCommandRunner(shadowSender).run(tile.command) ? 1 : 0;
      stats.shadow = (stats.shadow ?? 0) + 1;
      return true;
    } catch { tile.successCount = before.successCount; tile.lastOutput = before.lastOutput; return false; }
  };

  function execute(tile, position, cartId) {
    syncShadow(state.ran);
    const before = { successCount: tile.successCount, lastOutput: tile.lastOutput };
    host.skipped = null;
    state.lastTime = sv.time = now();
    const parts = String(tile.command ?? "").trim().replace(/^\//, "").split(" "), word = parts.shift() ?? "", canon = ALIAS[word] ?? word;
    while (parts.length && parts[parts.length - 1] === "") parts.pop();
    const reason = (why) => { stats.skipped++; stats.reasons[why] = (stats.reasons[why] ?? 0) + 1; tile.successCount = before.successCount; tile.lastOutput = before.lastOutput; return before.successCount; };
    const enqueue = () => {
      if (queue.length >= QUEUE_CAP) return reason("the player-command queue is full");
      // Fire-time effect on the shadow player: SuccessCount and LastOutput now, and the state a later command sees. The replay at return redoes it on the live player.
      const ran = onShadow(tile, position, before);
      queue.push({ shadowRan: ran, ok: ran ? tile.successCount : 0, inv: ran && (canon === "give" || canon === "clear"), xpd: ran && canon === "xp", eff: ran && canon === "effect", tick: state.ran, wall: Number.isFinite(plan.wall) ? plan.wall + state.ran * 50 : null, command: String(tile.command), position: { ...position }, name: tile.customName, trackOutput: tile.trackOutput !== false, block: cartId === undefined ? [position.x, position.y, position.z] : null, cartId: cartId ?? null });
      stats.queued++;
      return ran ? tile.successCount : before.successCount; // the replay rewrites SuccessCount and LastOutput with the same values
    };
    // Batch 36: /spawnpoint with a target and no coordinates takes the TARGET's own block position (mw.f_: floor x, floor(y + 0.5), floor z) at the firing, which the trace
    // gives; the respawn point is forced and per player, whatever his dimension, so it is written now (not replayed: the live player is somewhere else at return). With no
    // argument at all a command block fails (CommandBase.b(sender) needs an EntityPlayerMP, bytecode-read), which the runner reports.
    const spawnOnPlayer = () => {
      if (parts.length < 4 && !shadowPosition()) return reason("/spawnpoint without coordinates needs the player's traced position");
      return onShadow(tile, position, before) ? (stats.shadowSpawn = (stats.shadowSpawn ?? 0) + 1, tile.successCount) : reason("the shadow player could not run /spawnpoint");
    };
    if (NEEDS_PLAYER.has(canon)) return reason(`/${word} needs the player or scoreboard`);
    const at = USERNAME_INDEX[canon];
    if (at !== undefined && parts.length > at) {
      if (SELECTOR.test(parts[at])) {
        let picked;
        try { picked = host.selectPlayerForAway(parts[at]); } catch (e) { if (host.skipped) return reason(host.skipped); picked = undefined; }
        if (picked === null) { tile.successCount = 0; stats.silent++; return 0; } // z.a: zero matches, zero runs, no message
        if (picked !== undefined) {
          if (canon === "spawnpoint") return spawnOnPlayer();
          if (DEFER.has(canon)) return enqueue();
          if (!NO_LASTING_EFFECT.has(canon) && canon !== "spawnpoint") return reason(`/${word} would act on the player in another dimension`);
        }
      } else if (parts[at].toLowerCase() === PLAYER_NAME.toLowerCase() && canon === "spawnpoint") return spawnOnPlayer();
      else if (DEFER.has(canon) && parts[at].toLowerCase() === PLAYER_NAME.toLowerCase()) return enqueue(); // a literal name finds the player in any dimension
    }
    const sender = commandBlockSender(host, tile, position, Number.isFinite(plan.wall) ? { now: () => new Date(plan.wall + state.ran * 50) } : undefined); // LastOutput carries the clock time of the firing
    const ok = createCommandRunner(sender).run(tile.command);
    if (host.skipped) return reason(host.skipped);
    tile.successCount = ok ? 1 : 0;
    stats.run++;
    return tile.successCount;
  }
  // The selector test the runner uses, on the run's host (null = nobody; a name = the player).
  host.selectPlayerForAway = (text) => selectLocal(text, host);

  return {
    host, stats, chat, state, queue,
    execute,
    spawn: () => active.worldSpawn,
    // The block: BlockCommandBlock.updateTick, then the comparator update.
    installBlock(live) {
      const b = live.behaviours[137];
      if (!b) return;
      live.behaviours[137] = { ...b, updateTick(w, x, y, z) { execute(rt.commandBlocks.tile(x, y, z), { x, y, z }); w.updateNeighbourForOutputSignal(x, y, z, 137); } };
    },
    cartRun: (cart) => { if (cart.command?.command) execute(cart.command, cartCommandPosition(cart), cart.id); else if (cart.command) cart.command.successCount = 0; },
    result() {
      syncShadow(Infinity);
      const out = { inventoryDelta: inventoryDelta(), ...(queue.some((q) => q.eff) ? { playerDelta: playerDelta() } : {}), ...(queue.some((q) => q.xpd) ? { xpOps } : {}), commandBlocks: rt.commandBlocks.save(), playerCommands: queue, commandStats: { ...stats, reasons: { ...stats.reasons } }, chat, timeShift: state.timeShift };
      if (JSON.stringify(weather.save()) !== initialWeather) out.weather = { ...weather.save(), rain: weather.rain, thunder: weather.thunder };
      if (JSON.stringify(active) !== initial) out.world = { gameRules: active.gameRules, worldSpawn: active.worldSpawn, ...(active.defaultGameMode !== undefined ? { defaultGameMode: active.defaultGameMode } : {}), ...(active.playerSpawn ? { playerSpawn: active.playerSpawn } : {}) };
      if (state.difficulty !== undefined) out.difficulty = state.difficulty;
      return out;
    },
  };
}

// The main thread's half: run the queued player commands, in order, through the live command host (the one main.js and command-host.js build).
// `records` are the saved command block tiles ({x, y, z, command, successCount, lastOutput, ...}), `carts` the saved cart records (type 6 carries `command`);
// each replay writes its tile's SuccessCount (1 when the runner reports success, else 0, as CommandBlockLogic does) and LastOutput.
// `giveStack(stack)` takes /give's item straight into the inventory: natively the dropped stack (pickup delay 0, owner the player) is collected at once,
// and here the player may already be leaving the dimension the entity would drop into. `chatCap` bounds the op-feedback lines the replay prints.
// Batch 37: the net change the effect commands made to health, hunger and effects (playerDelta above), applied to the live player's Survival. Effects first (an Absorption or
// Health Boost the commands removed changes the caps), then the numbers; a health total at or below 0 is a death by damage, taken through Survival.damage like any other.
export function applyPlayerDelta(survival, d) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  for (const id of d.remove ?? []) survival.effects.remove(id);
  for (const e of d.add ?? []) survival.effects.add(e);
  if (survival.health > 0) {
    const health = Math.fround(survival.health + d.health);
    if (health <= 0) { survival.hurtTicks = 0; survival.protection = 0; survival.damage(survival.health + 1, "magic"); } else survival.health = clamp(health, 0, survival.maxHealth);
  }
  survival.food = clamp(survival.food + d.food, 0, 20);
  survival.saturation = clamp(Math.fround(survival.saturation + d.saturation), 0, survival.food);
  survival.exhaustion = clamp(Math.fround(survival.exhaustion + d.exhaustion), 0, 40);
}

export function replayPlayerCommands(queue, { host, records = [], carts = [], giveStack = null, chatCap = 100, delta = null, inventory = null, playerDelta = null, survival = null, xpOps = null }) {
  const out = { applied: 0, succeeded: 0, failed: 0, muted: 0, byDelta: 0 };
  // Batch 36: give and clear the run's shadow ran at their firing (`inv`) take effect as one net inventory change (see inventoryDelta), not as re-runs on the return state.
  const byDelta = Array.isArray(delta) && !!inventory;
  if (byDelta && delta.length) {
    for (const d of delta) if (d.count < 0) { let loss = -d.count; for (let i = 0; i < 36 && loss > 0; i++) { const st = inventory.getStack(i); if (st && keyOf(st) === keyOf(d.stack) && st.count > 0) { const take = Math.min(loss, st.count); st.count -= take; loss -= take; if (st.count === 0) inventory.setStack(i, null); } } }
    for (const d of delta) if (d.count > 0) { const st = { ...d.stack, count: d.count }; if (giveStack) giveStack(st); else inventory.add(st); }
  }
  const byPlayer = !!playerDelta && !!survival;
  if (byPlayer) applyPlayerDelta(survival, playerDelta);
  // Batch 42: the /xp commands the shadow ran at their firing (`xpd`) arrive as the shadow's recorded calls, applied in order to the live experience.
  const byXp = Array.isArray(xpOps);
  if (byXp) for (const [kind, n] of xpOps) { if (kind === "levels") host.addLevels(n); else host.addExperience(n); }
  let lines = 0;
  const replay = Object.create(host);
  replay.print = (text) => { if (lines++ < chatCap) host.print(text); else out.muted++; };
  if (giveStack) replay.giveDrop = (stack) => giveStack(stack);
  for (const e of queue ?? []) {
    if (e.eff && byPlayer) { out.applied++; out.byDelta++; if (e.ok) out.succeeded++; else out.failed++; continue; } // applyPlayerDelta carries its effect
    if (e.xpd && byXp) { out.applied++; out.byDelta++; if (e.ok) out.succeeded++; else out.failed++; continue; } // the xpOps above carry its effect
    if (e.inv && byDelta) { out.applied++; out.byDelta++; if (e.ok) out.succeeded++; else out.failed++; continue; } // the delta above carries its effect
    const record = e.cartId !== null && e.cartId !== undefined ? carts.find((c) => c.type === 6 && c.id === e.cartId)?.command : records.find((r) => r.x === e.block?.[0] && r.y === e.block?.[1] && r.z === e.block?.[2]);
    const tile = { command: e.command, successCount: 0, customName: e.name ?? "@", trackOutput: e.trackOutput !== false, lastOutput: null };
    const sender = commandBlockSender(replay, tile, e.position, e.wall != null ? { now: () => new Date(e.wall) } : undefined);
    const ok = createCommandRunner(sender).run(e.command);
    tile.successCount = ok ? 1 : 0;
    out.applied++; if (ok) out.succeeded++; else out.failed++;
    if (record && !(e.shadowRan && byDelta)) { record.successCount = tile.successCount; if (tile.lastOutput != null) record.lastOutput = tile.lastOutput; }
  }
  return out;
}
