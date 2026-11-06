// /tellraw, /achievement, /spreadplayers and /debug of Minecraft Java 1.7.10 (CommandMessageRaw ba, CommandAchievement ae,
// CommandSpreadPlayers br with its Position bs, CommandDebug ak), merged into commands.js' handler table. The evidence is
// public/research/commands-b13-reference.json (tools/probes/CommandsProbe.java, tools/verify-commands-b13.mjs) and the notes are
// public/research/commands-b13.md. Feedback goes out as chat components (ChatComponentTranslation), so the client-side
// StringTranslate rule applies: %d and %.2f in the en_US pattern print the argument with %s.
import { parseChatJson, text, translation, Style, translateKey } from "./chat-component.js";
import { ACHIEVEMENTS, BY_ID as ACHIEVEMENT_BY_ID } from "./achievements.js";
import { isStat, GENERAL, EGGS } from "./stats.js";
import { STAT_DATA } from "./stats-data.js";
import { Profiler, profileResults, profileFileName, javaFixed } from "./profiler.js";

// ---- StatList.func_151177_a and StatBase.func_150955_j ----
const ACHIEVEMENT_PREFIX = "achievement.";
// The oneShotStats lookup by statId: "achievement.<id>" or a StatList id (stats.js); anything else (and "*") is null.
export function lookupStat(id) {
  if (id.startsWith(ACHIEVEMENT_PREFIX) && Object.hasOwn(ACHIEVEMENT_BY_ID, id.slice(ACHIEVEMENT_PREFIX.length))) return { id, achievement: ACHIEVEMENT_BY_ID[id.slice(ACHIEVEMENT_PREFIX.length)] };
  return isStat(id) ? { id, achievement: null } : null;
}
// StatList.allStats ids: the general stats first and the achievements last as natively; the per-item and entity stats between
// them are grouped by kind, not in StatList's registration order.
export const allStatIds = () => [
  ...GENERAL.map((g) => g.id),
  ...new Set(["mine", "use", "break", "craft"].flatMap((k) => Object.values(STAT_DATA[k])).filter(Boolean)),
  ...EGGS.flatMap((e) => [e.kills, e.killedBy]),
  ...ACHIEVEMENTS.map((a) => ACHIEVEMENT_PREFIX + a.id),
];
// StatBase.statName: the translation the StatList constructor gave the stat. Item stats wrap ItemStack.func_151000_E, a "[name]"
// text; the port names the item through `itemName` and gives it the common rarity colour (white).
function statName(id, itemName) {
  const m = /^stat\.(mineBlock|craftItem|useItem|breakItem)\.(\d+)$/.exec(id);
  if (m) {
    const n = Number(m[2]), item = text("[").append(text(itemName?.(n) ?? String(n))).append(text("]"));
    item.style.color = "white";
    item.style.hover = { action: "show_item", value: text(`{id:${n}s,Damage:0s,Count:1b}`) };
    return translation("stat." + m[1], item);
  }
  const e = /^stat\.(killEntity|entityKilledBy)\.(.+)$/.exec(id);
  if (e) return translation(e[1] === "killEntity" ? "stat.entityKill" : "stat.entityKilledBy", translation(`entity.${e[2]}.name`));
  return translation(id);
}
// StatBase.func_150955_j: "[" + func_150951_e() + "]" sharing its style. func_150951_e is the name in GRAY with a
// show_achievement hover of the id (Achievement: GREEN, or DARK_PURPLE when special). The native component's shared style makes a
// parent cycle that only the S02PacketChat JSON round trip removes, so this builds the round-tripped shape (the
// achievementComponent records).
export function statComponent(stat, itemName) {
  const color = stat.achievement ? (stat.achievement.special ? "dark_purple" : "green") : "gray";
  const hover = () => ({ action: "show_achievement", value: text(stat.id) });
  const name = stat.achievement ? translation(stat.id) : statName(stat.id, itemName);
  name.setStyle(new Style({ color, hover: hover() }));
  const out = text("[").append(name).append(text("]"));
  out.setStyle(new Style({ color, hover: hover() }));
  return out;
}
// GuiScreen.func_146283_a for show_achievement: the coloured name, the type and an achievement's description.
export function statHover(id, { itemName, inventoryKey = "E" } = {}) {
  const stat = lookupStat(id);
  if (!stat) return null;
  const name = stat.achievement ? translation(stat.id) : statName(stat.id, itemName);
  name.setStyle(new Style({ color: stat.achievement ? (stat.achievement.special ? "dark_purple" : "green") : "gray" }));
  let formatted;
  try { formatted = name.formatted(); } catch { formatted = stat.id; }
  // Achievement.getDescription: openInventory's formatter fills in the inventory key's name.
  const description = stat.achievement ? translateKey(stat.id + ".desc").replace("%1$s", inventoryKey) : null;
  return { name: formatted, achievement: !!stat.achievement, description };
}

// ---- CommandSpreadPlayers (br) and its Position (bs) ----
// MathHelper.getRandomDoubleInRange.
const randomIn = (random, min, max) => (min >= max ? min : random.nextDouble() * (max - min) + min);
export class SpreadPosition {
  constructor(x = 0, z = 0) { this.x = x; this.z = z; }
  distance(o) { const dx = this.x - o.x, dz = this.z - o.z; return Math.sqrt(dx * dx + dz * dz); } // bs.a(bs), double
  length() { return Math.fround(Math.sqrt(this.x * this.x + this.z * this.z)); } // bs.b(): MathHelper.sqrt_double (float)
  normalize() { const d = this.length(); this.x /= d; this.z /= d; }
  subtract(o) { this.x -= o.x; this.z -= o.z; }
  clamp(minX, minZ, maxX, maxZ) {
    let moved = false;
    if (this.x < minX) { this.x = minX; moved = true; } else if (this.x > maxX) { this.x = maxX; moved = true; }
    if (this.z < minZ) { this.z = minZ; moved = true; } else if (this.z > maxZ) { this.z = maxZ; moved = true; }
    return moved;
  }
  randomize(random, minX, minZ, maxX, maxZ) { this.x = randomIn(random, minX, maxX); this.z = randomIn(random, minZ, maxZ); }
}
// func_110670_a: `count` positions drawn x then z inside the square.
export function spreadPositions(random, count, minX, minZ, maxX, maxZ) {
  const out = [];
  for (let i = 0; i < count; i++) { const p = new SpreadPosition(); p.randomize(random, minX, minZ, maxX, maxZ); out.push(p); }
  return out;
}
export class SpreadFailure extends Error { constructor(minDistance) { super("spread failed"); this.minDistance = minDistance; } }
// func_110668_a: push apart every position closer than `distance` to another, clamp to the square, until a pass moves nothing
// (at most 10000 passes). bs.b(World), the "safe" check of the second phase, reads only the block at y 256, which World.getBlock
// answers with air, so it always passes in 1.7.10 and a position can land on lava or water.
export function spreadIterate(distance, random, minX, minZ, maxX, maxZ, ps, safe = () => true) {
  let moving = true, nearest = 3.4028234663852886e38, i;
  for (i = 0; i < 10000 && moving; i++) {
    moving = false;
    nearest = 3.4028234663852886e38;
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j], push = new SpreadPosition();
      let k = 0;
      for (let l = 0; l < ps.length; l++) {
        if (j === l) continue;
        const q = ps[l], d = p.distance(q);
        nearest = Math.min(d, nearest);
        if (d < distance) { k++; push.x += q.x - p.x; push.z += q.z - p.z; }
      }
      if (k > 0) {
        push.x /= k; push.z /= k;
        if (push.length() > 0) { push.normalize(); p.subtract(push); }
        else p.randomize(random, minX, minZ, maxX, maxZ);
        moving = true;
      }
      if (p.clamp(minX, minZ, maxX, maxZ)) moving = true;
    }
    if (!moving) for (const p of ps) if (!safe(p)) { p.randomize(random, minX, minZ, maxX, maxZ); moving = true; }
  }
  if (i >= 10000) throw new SpreadFailure(nearest);
  return i;
}
// func_110671_a's mean of each position's nearest other position (Double.MAX_VALUE for a lone one).
export function averageDistance(ps) {
  let total = 0;
  for (const p of ps) { let m = Number.MAX_VALUE; for (const q of ps) if (q !== p) m = Math.min(m, p.distance(q)); total += m; }
  return total / ps.length;
}
// java.util.Random for the command's own unseeded `new Random()`.
export function unseededRandom(JavaRandomClass) {
  const seed = BigInt(Math.floor(Math.random() * 2 ** 32)) << 16n | BigInt(Math.floor(Math.random() * 65536));
  return new JavaRandomClass(seed);
}

// Double.toString, Integer and Float.toString as the %s of a translation argument.
const javaDouble = (d) => {
  if (!Number.isFinite(d)) return Number.isNaN(d) ? "NaN" : d > 0 ? "Infinity" : "-Infinity";
  const a = Math.abs(d);
  if (a === 0) return Object.is(d, -0) ? "-0.0" : "0.0";
  if (a >= 1e-3 && a < 1e7) return Number.isInteger(d) ? d.toFixed(1) : String(d);
  const [m, e] = d.toExponential().split("e");
  return (m.includes(".") ? m : m + ".0") + "E" + Number(e);
};
// Float.toString: the shortest digits that read back as the same float.
export function javaFloat(f) {
  f = Math.fround(f);
  if (!Number.isFinite(f) || f === 0) return javaDouble(f);
  for (let p = 1; p <= 9; p++) {
    const s = f.toPrecision(p);
    if (Math.fround(Number(s)) === f) return javaDouble(Number(s));
  }
  return javaDouble(f);
}

// ---- the handlers ----
// ctx: { host, player, targetArg, usage, fail(key, ...args) -> CommandException, CommandException, parseCoordinate, parseDouble,
// parseBoolean, javaDouble }.
export function createExtraCommands(ctx) {
  const { host, player, usage, CommandException } = ctx;
  const send = (component) => {
    // A command block's sender keeps text output (LastOutput); the player gets the component.
    if (host.isCommandBlock) return (host.feedback ?? host.print)(component.formatted());
    return (host.feedback ?? host.print)(component);
  };
  const tellSender = (component) => (host.isCommandBlock ? host.print(component.formatted()) : host.print(component)); // ICommandSender.addChatMessage
  const notify = (key, ...args) => send(translation(key, ...args)); // CommandBase.func_152373_a: the sender's plain copy
  const profiler = host.profiler ?? (host.profiler = new Profiler());
  const debugState = { startMs: 0, startTicks: 0 };

  const handlers = {
    // CommandMessageRaw: the JSON is the rest of the line joined with spaces; Gson's JsonParseException becomes
    // commands.tellraw.jsonException with ExceptionUtils.getRootCause's message.
    tellraw(a) {
      if (a.length < 2) usage("commands.tellraw.usage");
      player(a[0]);
      const out = parseChatJson(a.slice(1).join(" "));
      if ("jsonError" in out) throw new CommandException("commands.tellraw.jsonException", [out.jsonError]);
      if (out.generic) throw new Error("tellraw: " + out.generic);
      if (out.component == null) { console.warn("tellraw: a null component (the native server throws a NullPointerException)"); return; }
      (host.printPlayer ?? host.print)(out.component);
    },
    // CommandAchievement: only "give" (1.7.10 has no "take"); another first word does nothing.
    achievement(a) {
      if (a.length < 2) usage("commands.achievement.usage");
      const stat = lookupStat(a[1]);
      if (!stat && a[1] !== "*") throw new CommandException("commands.achievement.unknownAchievement", [a[1]]);
      const target = a.length >= 3 ? player(a[2]) : ctx.targetArg([], 0);
      if (a[0].toLowerCase() !== "give") return;
      const achievements = host.achievements;
      if (a[1] === "*") {
        for (const ach of ACHIEVEMENTS) achievements?.trigger(ach.id);
        host.changed?.();
        return notify("commands.achievement.give.success.all", target);
      }
      if (stat.achievement) {
        // The locked parents, root first, then the achievement itself.
        const chain = [];
        for (let p = stat.achievement.parent; p && !achievements?.has(p); p = ACHIEVEMENT_BY_ID[p].parent) chain.push(p);
        for (const p of chain.reverse()) achievements?.trigger(p);
        achievements?.trigger(stat.achievement.id);
      } else host.stats?.increment(stat.id, 1);
      host.changed?.();
      notify("commands.achievement.give.success.one", target, statComponent(stat, host.statItemName));
    },
    // CommandSpreadPlayers for the local player (respectTeams counts the player's scoreboard team, if any, as the one team).
    spreadplayers(a) {
      if (a.length < 6) usage("commands.spreadplayers.usage");
      let i = 0;
      const x = ctx.parseCoordinate(NaN, a[i++]), z = ctx.parseCoordinate(NaN, a[i++]);
      const distance = ctx.parseDoubleMin(a[i++], 0), range = ctx.parseDoubleMin(a[i++], distance + 1);
      const teams = ctx.parseBoolean(a[i++]);
      const targets = [];
      while (i < a.length) targets.push(player(a[i++]));
      if (!targets.length) throw new CommandException("commands.generic.player.notFound", [], "player");
      const kind = teams ? "teams" : "players";
      tellSender(translation("commands.spreadplayers.spreading." + kind, targets.length, javaDouble(range), javaDouble(x), javaDouble(z), javaDouble(distance)));
      const random = host.spreadRandom?.() ?? unseededRandom(ctx.JavaRandom);
      const minX = x - range, minZ = z - range, maxX = x + range, maxZ = z + range;
      const count = teams ? new Set(targets.map((t) => host.teamOf?.(t) ?? null)).size : targets.length;
      const ps = spreadPositions(random, count, minX, minZ, maxX, maxZ);
      let iterations;
      try { iterations = spreadIterate(distance, random, minX, minZ, maxX, maxZ, ps); }
      catch (e) {
        if (!(e instanceof SpreadFailure)) throw e;
        throw new CommandException("commands.spreadplayers.failure." + kind, [ps.length, javaDouble(x), javaDouble(z), javaFixed(e.minDistance, 2)]);
      }
      // func_110671_a: each target goes to its position (one per team), at floor(x) + 0.5 (float), the top block + 1, floor(z) + 0.5.
      const byTeam = new Map();
      let n = 0, total = 0;
      for (const t of targets) {
        let p;
        if (teams) { const team = host.teamOf?.(t) ?? null; if (!byTeam.has(team)) byTeam.set(team, ps[n++]); p = byTeam.get(team); }
        else p = ps[n++];
        host.teleport(Math.fround(Math.floor(p.x) + 0.5), host.topY ? host.topY(p.x, p.z) : 257, Math.floor(p.z) + 0.5);
        let m = Number.MAX_VALUE;
        for (const q of ps) if (q !== p) m = Math.min(m, p.distance(q));
        total += m;
      }
      notify("commands.spreadplayers.success." + kind, ps.length, javaDouble(x), javaDouble(z));
      if (ps.length > 1) tellSender(translation("commands.spreadplayers.info." + kind, javaFixed(total / targets.length, 2), iterations));
    },
    // CommandDebug: profiling starts with the next tick (MinecraftServer.enableProfiling); stop writes debug/profile-results-*.txt,
    // which the browser offers as a download.
    debug(a) {
      if (a.length === 1 && a[0] === "start") {
        notify("commands.debug.start");
        profiler.pending = true;
        debugState.startMs = Date.now();
        debugState.startTicks = host.tickCounter?.() ?? 0;
        return;
      }
      if (a.length === 1 && a[0] === "stop") {
        if (!profiler.enabled) throw new CommandException("commands.debug.notStarted");
        const ms = Date.now() - debugState.startMs, ticks = (host.tickCounter?.() ?? 0) - debugState.startTicks;
        const name = profileFileName();
        try { host.saveFile?.(name, profileResults(profiler, ms, ticks)); }
        catch (e) { console.error("Could not save profiler results to debug/" + name, e); }
        profiler.enabled = false;
        return notify("commands.debug.stop", javaFloat(ms / 1000), ticks);
      }
      usage("commands.debug.usage");
    },
  };
  // addTabCompletionOptions of ba, ae and ak (br has none).
  function complete(name, index, args, playerOptions) {
    if (name === "tellraw" && index === 0) return playerOptions;
    if (name === "achievement") {
      if (index === 0) return ["give"];
      if (index === 1) return allStatIds();
      if (index === 2) return playerOptions;
    }
    if (name === "debug" && index === 0) return ["start", "stop"];
    return [];
  }
  return { handlers, complete, profiler };
}

// MinecraftServer.tick for the port's loop: enableProfiling takes effect at the next tick, which clears the map.
export function profilerTick(profiler) {
  if (profiler?.pending) { profiler.pending = false; profiler.enabled = true; profiler.clear(); }
}
