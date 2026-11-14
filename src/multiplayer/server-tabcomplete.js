// Batch 69 mptabcomplete: the dedicated server's answer to C14PacketTabComplete (S3APacketTabComplete).
//
// Evidence (see .shared-memory/notes/mptabcomplete-b69-track.md):
//  * bytecode-read: NetHandlerPlayServer.func_147341_a (nh.a(iq)) calls MinecraftServer.func_71248_a (a(ac, String)) and sends every returned string in S3A.
//  * bytecode-read: MinecraftServer.func_71248_a: a text starting with "/" drops the slash and asks CommandHandler.getPossibleCommands (z.b); when the rest has no space each
//    answer is returned with "/" in front, otherwise as is. A text that does not start with "/" splits on " " (limit -1) and returns every online player name (func_71213_z)
//    that CommandBase.doesStringStartWith (y.a, case-insensitive) the last word.
//  * bytecode-read and executed (tabcomplete-reference.json): CommandHandler.getPossibleCommands splits on " " (limit -1). One word: every key of the HashMap command map (names AND aliases)
//    that starts with the word and whose command canCommandSenderUseCommand, in HashMap iteration order (not sorted). More words: the command found by the exact (case-sensitive) first word
//    answers addTabCompletionOptions(sender, the other words), with NO permission check; an unknown command answers nothing.
//  * bytecode-read: the dedicated commands' addTabCompletionOptions (op, deop, ban, ban-ip, pardon, pardon-ip, banlist, whitelist, kick), /say, /me and /tell (every word: player names).
//  * recalled: the order of a UserList's names (a HashMap keyed by profile UUID) is not reproduced; the lists answer in insertion order. The HashMap order of the command map is
//    java.util.HashMap's (Java 8 and later: spread hash, power-of-two table, split-preserving bin order), compared with the executed run of the JDK that ran the probe.
import { COMMAND_LIST } from '../command-data.js';
import { createCommandRunner, startsWithIgnoreCase, matchLast } from '../commands.js';

/** Java's String.hashCode. */
export function javaStringHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }
/** Iteration order of a java.util.HashMap<String, ?> after `keys` were put in order (duplicates keep their first place): bucket index ascending, insertion order inside a bucket. */
export function javaHashOrder(keys) {
  const seen = new Set(); let capacity = 16, size = 0;
  for (const k of keys) { if (seen.has(k)) continue; seen.add(k); if (++size > capacity * 0.75) capacity *= 2; }
  const bucket = (k) => { const h = javaStringHash(k); return (h ^ (h >>> 16)) & (capacity - 1); };
  return [...seen].map((k, i) => ({ k, b: bucket(k), i })).sort((x, y) => x.b - y.b || x.i - y.i).map((e) => e.k);
}
// ServerCommandManager's registrations on a dedicated server (the "lan" group, /publish, is registered by the integrated server only): CommandHandler.registerCommand puts the
// name, then each alias. Every command keeps its permission level.
const DEDICATED = COMMAND_LIST.filter((c) => c.group !== 'lan');
const KEYS = []; const BY_KEY = new Map();
for (const c of DEDICATED) for (const key of [c.name, ...c.aliases]) { KEYS.push(key); if (!BY_KEY.has(key)) BY_KEY.set(key, c); }
export const COMMAND_KEY_ORDER = javaHashOrder(KEYS);

/** CommandHandler.getPossibleCommands for the single word: the command keys (names and aliases) a sender of permission `level` may use. */
export function possibleCommandNames(level, word) {
  return COMMAND_KEY_ORDER.filter((key) => startsWithIgnoreCase(word, key) && level >= BY_KEY.get(key).permission);
}

// addTabCompletionOptions of the dedicated commands, as bytecode-read. `args` are the words after the command; ctx supplies the server's lists.
function adminOptions(name, args, ctx) {
  const n = args.length, last = args;
  const online = ctx.online, admin = ctx.admin;
  const names = (rows) => [...rows].map((r) => r.name).filter((x) => typeof x === 'string');
  if (name === 'op' && n === 1) return matchLast(last, online.filter((p) => !ctx.isOp(p))); // MinecraftServer.func_152357_F profiles that are not ops
  if (name === 'deop' && n === 1) return matchLast(last, names(admin?.ops.values() ?? [])); // ServerConfigurationManager.func_152606_n: the ops list
  if ((name === 'ban' || name === 'kick') && n >= 1) return matchLast(last, online); // MinecraftServer.func_71213_z
  if (name === 'ban-ip' && n === 1) return matchLast(last, online);
  if (name === 'pardon' && n === 1) return matchLast(last, names(admin?.bans.values() ?? [])); // UserListBans.func_152685_a
  if (name === 'pardon-ip' && n === 1) return matchLast(last, [...(admin?.ipBans.keys() ?? [])]); // BanList.func_152685_a
  if (name === 'banlist' && n === 1) return matchLast(last, ['players', 'ips']);
  if (name === 'whitelist') {
    if (n === 1) return matchLast(last, ['on', 'off', 'list', 'add', 'remove', 'reload']);
    if (n === 2 && args[0] === 'remove') return matchLast(last, names(admin?.allow.values() ?? [])); // oi.func_152598_l: the whitelist
    if (n === 2 && args[0] === 'add') return matchLast(last, names(admin?.profiles.values() ?? [])); // PlayerProfileCache.func_152654_a: known names
  }
  return [];
}
const ADMIN = new Set(['op', 'deop', 'ban', 'ban-ip', 'pardon', 'pardon-ip', 'banlist', 'whitelist', 'kick']);
const ALL_WORDS = new Set(['say', 'me', 'tell']); // /say (every word), /me and /tell/w/msg (CommandMessage): getAllUsernames at any position

/** CommandHandler.getPossibleCommands(sender, text without the slash). ctx: { sender, level, online: string[], admin, isOp(name), scoreboard }. */
export function possibleCommands(line, ctx) {
  const parts = line.split(' ');
  if (parts.length === 1) return possibleCommandNames(ctx.level, parts[0]);
  const command = BY_KEY.get(parts[0]);
  if (!command) return [];
  const args = parts.slice(1);
  if (ADMIN.has(command.name)) return adminOptions(command.name, args, ctx);
  if (ALL_WORDS.has(command.name)) return matchLast(args, ctx.online);
  // The single-player argument lists (commands.js), with every online player and no permission gate (CommandHandler has none for arguments).
  const host = { name: ctx.sender, playerName: ctx.sender, cheats: true, tabUnchecked: true, canUse: () => true, playerNames: () => ctx.online, scoreboard: ctx.scoreboard, print() {} };
  return createCommandRunner(host).complete('/' + line);
}

/** MinecraftServer.func_71248_a. */
export function tabComplete(text, ctx) {
  if (text.startsWith('/')) {
    const line = text.slice(1), slash = !line.includes(' ');
    return possibleCommands(line, ctx).map((s) => (slash ? '/' + s : s));
  }
  const words = text.split(' ');
  return ctx.online.filter((name) => startsWithIgnoreCase(words[words.length - 1], name));
}

/** The reply to one C14 from player `id`: `social` is the ServerSocial (server-broadcast.js). */
export function socialTabComplete(social, id, text) {
  const sim = social.simulation, sender = sim.players.get(id);
  if (!sender || typeof text !== 'string') return [];
  return tabComplete(text.slice(0, 32767), {
    sender: sender.name, level: social.opLevel(sender.name), online: [...sim.players.values()].map((p) => p.name),
    admin: sim.admin, isOp: (n) => social.isOp(n), scoreboard: sim.scoreboard,
  });
}
