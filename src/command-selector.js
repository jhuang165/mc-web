// PlayerSelector (ad) + ServerConfigurationManager.findPlayers (oi.a), restricted to the one local player.
// 1.7.10 has @p/@a/@r (and the dead @f token), no @e. The parser, defaults and int parsing are replayed from the jar through
// public/research/selector-reference.json (tools/verify-selector.mjs); the filter loop of oi.a is read from its bytecode.
const TOKEN = /^@([parf])(?:\[([\w=,!-]*)\])?$/;
const INT_LIST = /([-!]?[\w-]*)(?:$|,)/y;       // \G([-!]?[\w-]*)(?:$|,)
const KEY_VALUE = /(\w+)=([-!]?[\w-]*)(?:$|,)/y; // \G(\w+)=([-!]?[\w-]*)(?:$|,)
const POSITIONAL = ['x', 'y', 'z', 'r'];

// ICommand.isUsernameIndex per command (bytecode-read): the argument CommandHandler.a (z.a) feeds to PlayerSelector.c when it is a selector token.
export const USERNAME_INDEX = { give: 0, clear: 0, effect: 0, enchant: 0, spawnpoint: 0, testfor: 0, tell: 0, tp: 0, tellraw: 0, gamemode: 1, xp: 1, playsound: 1, achievement: 2 };
// CommandHandler.a with zero matches runs the command zero times and prints nothing; the count is 0. True when this command line is that case.
// Only the @p, @a and @r tokens: ad.c answers null for the dead @f token, which the original does not handle.
export function selectsNobody(name, args, host) {
  const at = USERNAME_INDEX[name], text = at === undefined ? undefined : args[at];
  return text !== undefined && /^@[par](?:\[[\w=,!-]*\])?$/.test(text) && !selectLocalPlayer(text, host);
}

// MathHelper.parseIntWithDefault (qh.a): Integer.parseInt, any NumberFormatException gives the default.
export function parseIntWithDefault(text, fallback) {
  if (typeof text !== 'string' || !/^[+-]?[0-9]+$/.test(text)) return fallback;
  const n = Number(text);
  return n >= -2147483648 && n <= 2147483647 ? n + 0 : fallback; // + 0: Java has no negative zero int
}

// PlayerSelector.h: up to four positional values (x,y,z,r, empty ones skipped), then key=value pairs from where they stopped.
// Later duplicates win (HashMap.put); the first non-matching piece ends the key=value scan silently.
export function parseSelectorArguments(text) {
  const map = new Map();
  if (text == null) return map;
  let index = 0, end = -1;
  for (;;) {
    INT_LIST.lastIndex = end < 0 ? 0 : end;
    const m = INT_LIST.exec(text);
    if (!m) break;
    const key = POSITIONAL[index++];
    if (key && m[1].length > 0) map.set(key, m[1]);
    end = INT_LIST.lastIndex;
    if (m[0].length === 0) break; // an empty match is only possible at the end; Matcher.find cannot advance past it
  }
  if (end < text.length) {
    let at = Math.max(end, 0);
    for (;;) {
      KEY_VALUE.lastIndex = at;
      const m = KEY_VALUE.exec(text);
      if (!m) break;
      map.set(m[1], m[2]);
      at = KEY_VALUE.lastIndex;
    }
  }
  return map;
}

// PlayerSelector.a(Map): score_<objective>[_min] entries as { "<objective>[_min]": parseIntWithDefault(value, 1) }.
export function selectorScoreMap(args) {
  const scores = new Map();
  for (const [key, value] of args) if (key.startsWith('score_') && key.length > 6) scores.set(key.slice(6), parseIntWithDefault(value, 1));
  return scores;
}

export const selectorDefaults = (token) => ({ rm: 0, r: 0, l: 2147483647, lm: 0, c: token === 'a' ? 0 : 1 });

// r.e(int,int,int): float arithmetic over int differences.
const f32 = Math.fround;
function distanceSquared(a, b) {
  const dx = f32((a.x - b.x) | 0), dy = f32((a.y - b.y) | 0), dz = f32((a.z - b.z) | 0);
  return f32(f32(f32(dx * dx) + f32(dy * dy)) + f32(dz * dz));
}
const chunkCoordinates = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y + 0.5), z: Math.floor(p.z) });

// Returns the local player's name when the selector picks them, null when it picks nobody (or is not a selector).
// An @r with a negative count throws like subList(0, c) does natively (CommandHandler reports commands.generic.exception).
export function selectLocalPlayer(text, host) {
  const match = TOKEN.exec(text);
  if (!match) return null;
  const token = match[1];
  if (token === 'f') return null; // ad.c falls through to null for f
  const args = parseSelectorArguments(match[2]);
  const d = selectorDefaults(token);
  const num = (key, fallback) => (args.has(key) ? parseIntWithDefault(args.get(key), fallback) : fallback);
  const scores = selectorScoreMap(args);
  let rm = num('rm', d.rm), r = num('r', d.r);
  const lm = num('lm', d.lm), l = num('l', d.l), mode = num('m', -1), count = num('c', d.c);
  const origin = chunkCoordinates(host.position());
  for (const axis of ['x', 'y', 'z']) if (args.has(axis)) origin[axis] = parseIntWithDefault(args.get(axis), origin[axis]);
  if (token === 'r' && count < 0) throw new RangeError(`toIndex = ${count}`);
  // Away run (away-commands.js): the player is in another dimension. oi.a skips players whose world differs from the sender's, and ad.c passes the
  // sender's world only when rm, r, x, y or z is given: those selectors find nobody, the others still find the player. Scoreboard filters cannot be read there.
  if (host.playerElsewhere) {
    if (['rm', 'r', 'x', 'y', 'z'].some(k => args.has(k))) return null;
    if (args.has('team') || scores.size) host.awaySkip();
  }
  const name = host.playerName ?? host.name ?? 'Player';
  const player = host.playerPosition ?? host.position;
  const board = host.scoreboard;
  // oi.a: name, team, radius, scores, game mode, levels, in that order.
  const nameArg = args.get('name'), teamArg = args.get('team');
  if (nameArg != null) {
    const invert = nameArg.startsWith('!'), want = invert ? nameArg.slice(1) : nameArg;
    if (invert === (want.toLowerCase() === name.toLowerCase())) return null;
  }
  if (teamArg != null) {
    const invert = teamArg.startsWith('!'), want = invert ? teamArg.slice(1) : teamArg;
    const has = board?.teamOf(name)?.name ?? '';
    if (invert === (want.toLowerCase() === has.toLowerCase())) return null;
  }
  if (rm > 0 || r > 0) {
    const distance = distanceSquared(origin, chunkCoordinates(player()));
    if (rm > 0 && distance < f32(Math.imul(rm, rm))) return null;
    if (r > 0 && distance > f32(Math.imul(r, r))) return null;
  }
  // func_96457_a: score_<objective>=max and score_<objective>_min=min; a missing objective fails. Reading the score creates it, as natively.
  for (const [key, want] of scores) {
    const min = key.endsWith('_min') && key.length > 4;
    const o = board?.objective(min ? key.slice(0, -4) : key);
    if (!o) return null;
    const v = board.score(name, o).value;
    if (min ? v < want : v > want) return null;
  }
  const playerMode = host.playerMode?.() ?? 0, level = host.playerLevel?.() ?? 0;
  if (mode !== -1 && mode !== playerMode) return null;
  if (lm > 0 && level < lm) return null;
  if (level > l) return null;
  if (token === 'r' && count === 0) return null; // subList(0, 0)
  return name;
}
