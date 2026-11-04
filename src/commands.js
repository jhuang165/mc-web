// The singleplayer command layer of Minecraft Java 1.7.10: CommandHandler.executeCommand, the permission rule of
// EntityPlayerMP.canCommandSenderUseCommand, CommandBase's argument parsers and the vanilla commands the port can honour.
// Names, aliases, permission levels, usage keys, the registries and the en_US strings are generated into command-data.js by
// tools/verify-commands.mjs (public/research/commands-reference.json); public/research/commands.md lists which commands are
// native-verified, approximated or unsupported. The game state is reached through the host object (see main.js), so the same
// code runs against a real World / Survival in the tests.
import { COMMAND_LIST, LANG, ITEM_REGISTRY, BLOCK_REGISTRY, ENTITY_NAMES, POTION_NAMES, ENCHANTMENT_NAMES, GAME_RULES } from "./command-data.js";

// ---- java.lang.String.format subset used by the lang strings: %s %d %.Nf, with %n$ positions ----
export class FormatError extends Error {}
export function format(pattern, args = []) {
  let next = 0;
  return pattern.replace(/%(?:(\d+)\$)?(?:\.(\d+))?([sdf%])/g, (m, pos, prec, kind) => {
    if (kind === "%") return "%";
    const v = args[pos ? Number(pos) - 1 : next++];
    if (v === undefined) throw new FormatError("missing argument");
    if (kind === "s") return String(v);
    const n = typeof v === "number" ? v : NaN;
    if (!Number.isFinite(n) && typeof v !== "number") throw new FormatError("bad argument");
    return kind === "d" ? String(Math.trunc(n)) : n.toFixed(prec === undefined ? 6 : Number(prec));
  });
}
// StringTranslate.translateKeyFormat: a bad format shows "Format error: " + the pattern; an unknown key shows itself.
export function tr(key, ...args) {
  const pattern = LANG[key];
  if (pattern === undefined) return key;
  try { return format(pattern, args); } catch { return "Format error: " + pattern; }
}

export class CommandException extends Error {
  constructor(key, args = [], kind = "command") { super(key); this.key = key; this.args = args; this.kind = kind; }
}
const numberInvalid = (key, ...args) => new CommandException(key, args, "number");
const wrongUsage = (key, ...args) => new CommandException(key, args, "usage");
const playerNotFound = () => new CommandException("commands.generic.player.notFound", [], "player");

// ---- CommandBase parsers (parse results recorded in commands-reference.json) ----
const INT_RE = /^[+-]?\d+$/;
export function parseInt32(s) {
  if (!INT_RE.test(s)) throw numberInvalid("commands.generic.num.invalid", s);
  const n = Number(s);
  if (n < -2147483648 || n > 2147483647) throw numberInvalid("commands.generic.num.invalid", s);
  return n;
}
export function parseIntMin(s, min) { return parseIntBounded(s, min, 2147483647); }
export function parseIntBounded(s, min, max) {
  const n = parseInt32(s);
  if (n < min) throw numberInvalid("commands.generic.num.tooSmall", n, min);
  if (n > max) throw numberInvalid("commands.generic.num.tooBig", n, max);
  return n;
}
const DOUBLE_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[dDfF]?$/;
export function parseDouble(s) {
  const t = String(s).trim();
  if (!DOUBLE_RE.test(t)) throw numberInvalid("commands.generic.num.invalid", s);
  return Number(t.replace(/[dDfF]$/, ""));
}
export function parseBoolean(s) {
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  throw new CommandException("commands.generic.boolean.invalid", [s]);
}
// Double.toString, as the lang formats show a double with %s: plain between 1e-3 and 1e7, else d.dddE±n.
export function javaDouble(d) {
  if (!Number.isFinite(d)) return String(d);
  const a = Math.abs(d);
  if (a === 0 || (a >= 1e-3 && a < 1e7)) return Number.isInteger(d) ? d.toFixed(1) : String(d);
  const [m, e] = d.toExponential().split("e");
  return (m.includes(".") ? m : m + ".0") + "E" + Number(e);
}
// CommandBase.func_110665_a: "~" is relative to the sender, an absolute number without a decimal point is the block centre (+ 0.5).
export function parseCoordinate(base, s, min = -30000000, max = 30000000) {
  const relative = s.startsWith("~");
  let d = relative ? base : 0;
  if (!relative || s.length > 1) {
    const hasPoint = s.includes(".");
    d += parseDouble(relative ? s.slice(1) : s);
    if (!hasPoint && !relative) d += 0.5;
  }
  if (min !== 0 || max !== 0) {
    if (d < min) throw numberInvalid("commands.generic.double.tooSmall", javaDouble(d), min);
    if (d > max) throw numberInvalid("commands.generic.double.tooBig", javaDouble(d), max);
  }
  return d;
}
// CommandBase.doesStringStartWith / getListOfStringsMatchingLastWord.
export const startsWithIgnoreCase = (word, option) => option.toLowerCase().startsWith(word.toLowerCase());
export const matchLast = (args, options) => options.filter((o) => startsWithIgnoreCase(args[args.length - 1], o));

// ---- registries ----
const itemByName = new Map(ITEM_REGISTRY), itemById = new Map(ITEM_REGISTRY.map(([n, id]) => [id, n]));
const blockByName = new Map(BLOCK_REGISTRY), blockById = new Map(BLOCK_REGISTRY.map(([n, id]) => [id, n]));
const entityByName = new Map(ENTITY_NAMES);
const potionById = new Map(POTION_NAMES.map(([id, name]) => [id, name]));
const enchantById = new Map(ENCHANTMENT_NAMES.map(([id, name, max]) => [id, { name, max }]));
const withNamespace = (s) => (s.includes(":") ? s : "minecraft:" + s);
export const GAME_MODES = ["survival", "creative", "adventure"];
export const DIFFICULTIES = ["peaceful", "easy", "normal", "hard"];

// Original entity names the port can create (EntityList names -> entities.js types).
export const SUMMONABLE = { Pig: "pig", Cow: "cow", Sheep: "sheep", Chicken: "chicken", Zombie: "zombie", Spider: "spider", CaveSpider: "cave_spider", Skeleton: "skeleton", Creeper: "creeper", Villager: "villager", VillagerGolem: "iron_golem", Silverfish: "silverfish", Witch: "witch" };
// Commands the registry lists that this build cannot honour; they report instead of pretending.
export const UNSUPPORTED = new Set(["achievement", "debug", "scoreboard", "spreadplayers", "tellraw"]);

const REGISTERED = COMMAND_LIST.filter((c) => c.group !== "dedicated"); // singleplayer: the always group plus /publish
const BY_NAME = new Map();
for (const c of REGISTERED) { BY_NAME.set(c.name, c); for (const a of c.aliases) BY_NAME.set(a, c); }
export const registeredCommands = () => REGISTERED.slice();
// EntityPlayerMP.canCommandSenderUseCommand in a singleplayer world (ServerCommandManager.getPossibleCommands uses it too).
export const ALWAYS_ALLOWED = new Set(["tell", "help", "me", "seed"]);
// WorldInfo(NBTTagCompound): a save without "allowCommands" reads as cheats on for a creative world, off otherwise.
export const cheatsAllowed = (record) => (typeof record?.allowCommands === "boolean" ? record.allowCommands : record?.mode === "creative");
export const canUse = (command, cheats) => ALWAYS_ALLOWED.has(command.name) || (cheats && command.permission <= 4);

const PLAYER_ARG = { gamemode: [1], give: [0], clear: [0], xp: [1], effect: [0], enchant: [0], tp: [0, 1], tell: [0], spawnpoint: [0], testfor: [0], playsound: [1] };

export function createCommandRunner(host) {
  const name = () => host.name || "Player";
  const say = (text) => host.print(text);
  // CommandBase.notifyAdmins: in singleplayer the sender gets the plain message (flag 1 suppresses it).
  const feedback = (key, ...args) => say(tr(key, ...args));
  const player = (s) => {
    if (/^@[pare]$/.test(s) || s.toLowerCase() === name().toLowerCase()) return name();
    throw playerNotFound();
  };
  const targetArg = (a, i) => (a.length > i ? player(a[i]) : name());
  const gameMode = (s) => {
    const l = s.toLowerCase();
    if (l === "survival" || l === "s") return "survival";
    if (l === "creative" || l === "c") return "creative";
    if (l === "adventure" || l === "a") return "adventure";
    return GAME_MODES[parseIntBounded(s, 0, 2)];
  };
  const modeText = (m) => tr("gameMode." + m);
  const rules = () => host.rules ?? (host.rules = Object.fromEntries(GAME_RULES));
  // CommandBase.func_147179_f / func_147180_g: a registry name (minecraft: optional) or a numeric id with the deprecation warning in gray.
  const findItem = (text) => {
    const key = withNamespace(text);
    if (itemByName.has(key)) return itemByName.get(key);
    if (INT_RE.test(text) && itemById.has(Number(text))) {
      say("§7" + tr("commands.generic.deprecatedId", itemById.get(Number(text))));
      return Number(text);
    }
    throw numberInvalid("commands.give.notFound", text);
  };
  const findBlock = (text) => {
    const key = withNamespace(text);
    if (blockByName.has(key)) return blockByName.get(key);
    if (INT_RE.test(text) && blockById.has(Number(text))) {
      say("§7" + tr("commands.generic.deprecatedId", blockById.get(Number(text))));
      return Number(text);
    }
    throw numberInvalid("commands.give.notFound", text);
  };
  const pos = () => host.position();
  const usage = (key) => { throw wrongUsage(key); };

  const handlers = {
    help(a) {
      // CommandHelp: seven usages per page, sorted by name; a name instead of a page shows that command's usage.
      const list = REGISTERED.filter((c) => canUse(c, host.cheats)).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
      const pages = Math.floor((list.length - 1) / 7);
      let page = 0;
      if (a.length > 0) {
        if (INT_RE.test(a[0]) && Math.abs(Number(a[0])) <= 2147483647) page = parseIntBounded(a[0], 1, pages + 1) - 1;
        else {
          const c = BY_NAME.get(a[0]);
          if (!c) { const n = Number.parseInt(a[0], 10); if (Number.isNaN(n)) throw new CommandException("commands.generic.notFound", [], "notfound"); }
          throw wrongUsage(c.usage);
        }
      }
      say("§2" + tr("commands.help.header", page + 1, pages + 1));
      for (let i = page * 7; i < Math.min((page + 1) * 7, list.length); i++) say(tr(list[i].usage));
      if (page === 0) say("§a" + tr("commands.help.footer"));
    },
    me(a) {
      if (a.length < 1) usage("commands.me.usage");
      say(tr("chat.type.emote", name(), a.join(" ")));
    },
    say(a) {
      if (a.length < 1) usage("commands.say.usage");
      say(tr("chat.type.announcement", name(), a.join(" ")));
    },
    tell(a) {
      if (a.length < 2) usage("commands.message.usage");
      const target = player(a[0]);
      if (target === name()) throw new CommandException("commands.message.sameTarget");
      say(tr("commands.message.display.outgoing", target, a.slice(1).join(" ")));
    },
    seed() { feedback("commands.seed.success", String(host.seed())); },
    list() { say(tr("commands.players.list", 1, 8)); say(name()); },
    kill() {
      host.kill();
      feedback("commands.kill.success");
    },
    gamemode(a) {
      if (a.length < 1) usage("commands.gamemode.usage");
      const mode = gameMode(a[0]), target = targetArg(a, 1);
      host.setGameMode(mode);
      say(tr("gameMode.changed"));
      feedback(target === name() && a.length < 2 ? "commands.gamemode.success.self" : "commands.gamemode.success.other", ...(a.length < 2 ? [modeText(mode)] : [target, modeText(mode)]));
    },
    defaultgamemode(a) {
      if (a.length < 1) usage("commands.defaultgamemode.usage");
      const mode = gameMode(a[0]);
      host.setDefaultGameMode(mode);
      feedback("commands.defaultgamemode.success", modeText(mode));
    },
    gamerule(a) {
      const r = rules();
      if (a.length === 2) {
        const [key, value] = a;
        if (!(key in r)) { /* GameRules.setOrCreateGameRule: a new rule is created */ }
        host.setGameRule(key, value);
        feedback("commands.gamerule.success");
      } else if (a.length === 1) {
        if (!(a[0] in r)) throw new CommandException("commands.gamerule.norule", [a[0]]);
        say(`${a[0]} = ${r[a[0]]}`);
      } else if (a.length === 0) say(Object.keys(r).sort().join(", "));
      else usage("commands.gamerule.usage");
    },
    give(a) {
      if (a.length < 2) usage("commands.give.usage");
      const target = player(a[0]), item = findItem(a[1]);
      const count = a.length >= 3 ? parseIntBounded(a[2], 1, 64) : 1, damage = a.length >= 4 ? parseInt32(a[3]) : 0;
      if (a.length >= 5) throw new CommandException("commands.give.tagError", ["Data tags are not supported in this build"], "tag");
      const given = host.give(item, count, damage);
      if (!given) throw new CommandException("commands.give.notFound", ["This item is not in this build"], "unsupported");
      feedback("commands.give.success", given.name, count, target);
    },
    clear(a) {
      const target = targetArg(a, 0);
      const item = a.length >= 2 ? findItem(a[1]) : -1, damage = a.length >= 3 ? parseInt32(a[2]) : -1;
      const removed = host.clear(item, damage);
      if (removed === 0) throw new CommandException("commands.clear.failure", [target]);
      feedback("commands.clear.success", target, removed);
    },
    time(a) {
      if (a.length > 1) {
        if (a[0] === "set") {
          const n = a[1] === "day" ? 1000 : a[1] === "night" ? 13000 : parseIntMin(a[1], 0);
          host.setTime(n);
          return feedback("commands.time.set", n);
        }
        if (a[0] === "add") {
          const n = parseIntMin(a[1], 0);
          host.addTime(n);
          return feedback("commands.time.added", n);
        }
      }
      usage("commands.time.usage");
    },
    toggledownfall() { host.toggleDownfall(); feedback("commands.downfall.success"); },
    // CommandPublish: MinecraftServer.shareToLAN(GameType.SURVIVAL, false), started with its port or failed.
    publish() {
      const port = host.shareToLan("survival", false);
      if (port != null) feedback("commands.publish.started", port);
      else feedback("commands.publish.failed");
      if (port != null && host.lanNotice) say("§7" + host.lanNotice);
    },
    weather(a) {
      if (a.length < 1 || a.length > 2) usage("commands.weather.usage");
      let ticks = (300 + Math.floor(Math.random() * 600)) * 20;
      if (a.length >= 2) ticks = parseIntBounded(a[1], 1, 1000000) * 20;
      const kind = a[0].toLowerCase();
      if (kind === "clear") { host.setWeather("clear", ticks); return feedback("commands.weather.clear"); }
      if (kind === "rain") { host.setWeather("rain", ticks); return feedback("commands.weather.rain"); }
      if (kind === "thunder") { host.setWeather("thunder", ticks); return feedback("commands.weather.thunder"); }
      usage("commands.weather.usage");
    },
    tp(a) {
      if (a.length < 1) usage("commands.tp.usage");
      // /tp <target> | /tp <x> <y> <z> | /tp <player> <target> | /tp <player> <x> <y> <z>
      let i = 0, who = name();
      if (a.length === 2 || a.length === 4) { who = player(a[0]); i = 1; }
      const here = pos();
      if (a.length - i === 3) {
        const x = parseCoordinate(here.x, a[i]), y = parseCoordinate(here.y, a[i + 1], 0, 0), z = parseCoordinate(here.z, a[i + 2]);
        host.teleport(x, y, z);
        return feedback("commands.tp.success.coordinates", who, x, y, z);
      }
      if (a.length - i === 1) {
        const target = player(a[i]);
        const p = pos();
        host.teleport(p.x, p.y, p.z);
        return feedback("commands.tp.success", who, target);
      }
      usage("commands.tp.usage");
    },
    spawnpoint(a) {
      if (a.length > 0 && a.length !== 1 && a.length < 4) usage("commands.spawnpoint.usage");
      const target = targetArg(a, 0), here = pos();
      let x = Math.floor(here.x), y = Math.floor(here.y), z = Math.floor(here.z);
      if (a.length >= 4) {
        x = Math.floor(parseCoordinate(here.x, a[1])); y = Math.floor(parseCoordinate(here.y, a[2], 0, 256)); z = Math.floor(parseCoordinate(here.z, a[3]));
      }
      host.setSpawnpoint(x, y, z);
      feedback("commands.spawnpoint.success", target, x, y, z);
    },
    setworldspawn(a) {
      const here = pos();
      let x = Math.floor(here.x), y = Math.floor(here.y), z = Math.floor(here.z);
      if (a.length === 3) { x = Math.floor(parseCoordinate(here.x, a[0])); y = Math.floor(parseCoordinate(here.y, a[1], 0, 256)); z = Math.floor(parseCoordinate(here.z, a[2])); }
      else if (a.length !== 0) usage("commands.setworldspawn.usage");
      host.setWorldSpawn(x, y, z);
      feedback("commands.setworldspawn.success", x, y, z);
    },
    difficulty(a) {
      if (a.length < 1) usage("commands.difficulty.usage");
      const l = a[0].toLowerCase();
      let d = DIFFICULTIES.indexOf(l);
      if (d < 0) { const short = ["p", "e", "n", "h"].indexOf(l); d = short >= 0 ? short : parseIntBounded(a[0], 0, 3); }
      host.setDifficulty(d);
      feedback("commands.difficulty.success", tr("options.difficulty." + DIFFICULTIES[d]) === "options.difficulty." + DIFFICULTIES[d] ? DIFFICULTIES[d] : tr("options.difficulty." + DIFFICULTIES[d]));
    },
    effect(a) {
      if (a.length < 2) usage("commands.effect.usage");
      const target = player(a[0]);
      if (a[1].toLowerCase() === "clear") {
        const cleared = host.clearEffects();
        if (!cleared) throw new CommandException("commands.effect.failure.notActive.all", [target]);
        return feedback("commands.effect.success.removed.all", target);
      }
      const id = parseIntBounded(a[1], 0, 2147483647);
      if (!potionById.has(id)) throw numberInvalid("commands.effect.notFound", id);
      let seconds = 600, amplifier = 0;
      if (a.length >= 3) {
        seconds = parseIntBounded(a[2], 0, 1000000);
        if (a.length >= 4) amplifier = parseIntBounded(a[3], 0, 255);
      }
      if (seconds === 0) {
        if (!host.removeEffect(id)) throw new CommandException("commands.effect.failure.notActive", [tr(potionById.get(id)), target]);
        return feedback("commands.effect.success.removed", tr(potionById.get(id)), target);
      }
      host.addEffect(id, seconds * 20, amplifier);
      feedback("commands.effect.success", tr(potionById.get(id)), id, amplifier, target, seconds);
    },
    enchant(a) {
      if (a.length < 2) usage("commands.enchant.usage");
      player(a[0]);
      const id = parseIntBounded(a[1], 0, 256);
      const info = enchantById.get(id);
      if (!info) throw numberInvalid("commands.enchant.notFound", id);
      const level = a.length >= 3 ? parseIntBounded(a[2], 1, info.max) : 1;
      const out = host.enchant(id, level);
      if (out === "noItem") throw new CommandException("commands.enchant.noItem");
      if (out === "cantEnchant") throw new CommandException("commands.enchant.cantEnchant");
      if (out && out.conflict) throw new CommandException("commands.enchant.cantCombine", [tr(info.name), tr(out.conflict)]);
      feedback("commands.enchant.success");
    },
    xp(a) {
      if (a.length < 1) usage("commands.xp.usage");
      let text = a[0];
      const levels = text.endsWith("l") || text.endsWith("L");
      if (levels && text.length > 1) text = text.slice(0, -1);
      let n = parseInt32(text);
      const negative = n < 0;
      if (negative) n = -n;
      const target = targetArg(a, 1);
      if (levels) {
        host.addLevels(negative ? -n : n);
        return feedback(negative ? "commands.xp.success.negative.levels" : "commands.xp.success.levels", n, target);
      }
      if (negative) usage("commands.xp.failure.widthdrawXp");
      host.addExperience(n);
      feedback("commands.xp.success", n, target);
    },
    summon(a) {
      if (a.length < 1) usage("commands.summon.usage");
      const here = pos();
      let x = here.x, y = here.y, z = here.z;
      if (a.length >= 4) { x = parseCoordinate(here.x, a[1]); y = parseCoordinate(here.y, a[2], 0, 0); z = parseCoordinate(here.z, a[3]); }
      if (a.length >= 5) throw new CommandException("commands.summon.tagError", ["Data tags are not supported in this build"], "tag");
      if (!host.inWorld(x, y, z)) throw new CommandException("commands.summon.outOfWorld");
      const type = entityByName.has(a[0]) ? SUMMONABLE[a[0]] : null;
      if (!type || !host.summon(type, x, y, z)) throw new CommandException("commands.summon.failed");
      feedback("commands.summon.success");
    },
    setblock(a) {
      if (a.length < 4) usage("commands.setblock.usage");
      const here = pos();
      const x = Math.floor(parseCoordinate(here.x, a[0])), y = Math.floor(parseCoordinate(here.y, a[1], 0, 0)), z = Math.floor(parseCoordinate(here.z, a[2]));
      const id = findBlock(a[3]);
      const meta = a.length >= 5 ? parseIntBounded(a[4], 0, 15) : 0;
      const mode = a.length >= 6 ? a[5] : "replace";
      if (a.length >= 6 && !["replace", "destroy", "keep"].includes(mode)) usage("commands.setblock.usage");
      if (a.length >= 7) throw new CommandException("commands.setblock.tagError", ["Data tags are not supported in this build"], "tag");
      if (!host.inWorld(x, y, z) || y < 0 || y > 255) throw new CommandException("commands.setblock.outOfWorld");
      const out = host.setBlock(x, y, z, id, meta, mode);
      if (out === "unsupported") throw new CommandException("commands.generic.exception", ["This block is not in this build"], "unsupported");
      if (out !== true) throw new CommandException("commands.setblock.noChange");
      feedback("commands.setblock.success");
    },
    testforblock(a) {
      if (a.length < 4) usage("commands.testforblock.usage");
      const here = pos();
      const x = Math.floor(parseCoordinate(here.x, a[0])), y = Math.floor(parseCoordinate(here.y, a[1], 0, 0)), z = Math.floor(parseCoordinate(here.z, a[2]));
      const id = findBlock(a[3]);
      const meta = a.length >= 5 ? parseIntBounded(a[4], -1, 15) : -1;
      if (!host.inWorld(x, y, z)) throw new CommandException("commands.testforblock.outOfWorld");
      const got = host.blockAt(x, y, z);
      if (got.id !== id) throw new CommandException("commands.testforblock.failed.tile", [x, y, z, blockById.get(got.id) ?? "minecraft:air", a[3]]);
      if (meta > -1 && got.meta !== meta) throw new CommandException("commands.testforblock.failed.data", [x, y, z, got.meta, meta]);
      feedback("commands.testforblock.success", x, y, z);
    },
    testfor() { throw new CommandException("commands.testfor.failed"); },
    playsound(a) {
      if (a.length < 2) usage("commands.playsound.usage");
      const target = player(a[1]);
      const here = pos();
      const x = a.length >= 5 ? parseCoordinate(here.x, a[2]) : here.x, y = a.length >= 5 ? parseCoordinate(here.y, a[3], 0, 0) : here.y, z = a.length >= 5 ? parseCoordinate(here.z, a[4]) : here.z;
      const volume = a.length >= 6 ? parseDoubleBounded(a[5], 0, 3.4028234663852886e38) : 1, pitch = a.length >= 7 ? parseDoubleBounded(a[6], 0, 2) : 1;
      host.playSound?.(a[0], x, y, z, volume, pitch);
      feedback("commands.playsound.success", a[0], target);
    },
  };
  const parseDoubleBounded = (s, min, max) => {
    const d = parseDouble(s);
    if (d < min) throw numberInvalid("commands.generic.double.tooSmall", javaDouble(d), min);
    if (d > max) throw numberInvalid("commands.generic.double.tooBig", javaDouble(d), max);
    return d;
  };

  // CommandHandler.func_71556_a: the failure texts are red; unknown name, permission, usage, then the exception text.
  function fail(e) {
    if (!(e instanceof CommandException)) {
      say("§c" + tr("commands.generic.exception"));
      if (typeof console !== "undefined") console.error(e);
      return;
    }
    if (e.kind === "unsupported") say("§c" + e.args[0]);
    else if (e.kind === "usage") say("§c" + tr("commands.generic.usage", tr(e.key, ...e.args)));
    else say("§c" + tr(e.key, ...e.args));
  }
  function run(text) {
    let line = text.trim();
    if (line.startsWith("/")) line = line.slice(1);
    const parts = line.split(" ");
    while (parts.length && parts[parts.length - 1] === "") parts.pop(); // String.split drops trailing empty strings
    const word = parts.shift() ?? "";
    const command = BY_NAME.get(word);
    try {
      if (!command) throw new CommandException("commands.generic.notFound");
      if (!canUse(command, host.cheats)) throw new CommandException("commands.generic.permission");
      if (UNSUPPORTED.has(command.name)) throw new CommandException("commands.generic.exception", [`The /${command.name} command is not available in this build`], "unsupported");
      handlers[command.name](parts);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }
  // ServerCommandManager.getPossibleCommands + each command's addTabCompletionOptions (text before the cursor, with its "/").
  function complete(before) {
    if (!before.startsWith("/")) return matchLast(before.split(" "), [name()]);
    const line = before.slice(1), parts = line.split(" ");
    if (parts.length === 1) return REGISTERED.filter((c) => canUse(c, host.cheats) && startsWithIgnoreCase(parts[0], c.name)).map((c) => "/" + c.name).sort();
    const command = BY_NAME.get(parts[0]);
    if (!command || !canUse(command, host.cheats)) return [];
    const args = parts.slice(1), index = args.length - 1;
    let options = [];
    const n = command.name;
    if (PLAYER_ARG[n]?.includes(index)) options = [name()];
    if (n === "gamemode" && index === 0 || n === "defaultgamemode" && index === 0) options = GAME_MODES;
    else if (n === "time" && index === 0) options = ["set", "add"];
    else if (n === "time" && index === 1 && args[0] === "set") options = ["day", "night"];
    else if (n === "weather" && index === 0) options = ["clear", "rain", "thunder"];
    else if (n === "difficulty" && index === 0) options = DIFFICULTIES;
    else if (n === "gamerule" && index === 0) options = Object.keys(rules());
    else if (n === "gamerule" && index === 1) options = ["true", "false"];
    else if (n === "give" && index === 1) options = ITEM_REGISTRY.map(([k]) => k);
    else if (n === "setblock" && index === 3 || n === "testforblock" && index === 3) options = BLOCK_REGISTRY.map(([k]) => k);
    else if (n === "summon" && index === 0) options = Object.keys(SUMMONABLE);
    else if (n === "help" && index === 0) options = REGISTERED.filter((c) => canUse(c, host.cheats)).map((c) => c.name);
    else if (n === "effect" && index === 1) options = ["clear"];
    return matchLast(args, options);
  }
  return { run, complete, handlers };
}

// Chat that is not a command: ServerConfigurationManager prints chat.type.text, "<Player> message".
export const chatLine = (name, message) => tr("chat.type.text", name, message);
