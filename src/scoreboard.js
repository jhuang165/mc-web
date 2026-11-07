// The 1.7.10 Scoreboard (bac) with its objectives (azx), scores (azz), teams (azy, ScorePlayerTeam) and criteria (bah), the
// GuiIngame sidebar layout (bbv) and ScoreboardSaveData (bad, data/scoreboard.dat). Collections are java.util.HashMaps in the
// native class, so iteration order (command lists, the sort's tie order, the .dat file) follows java-hash.js. Verified against
// the client JAR by tools/verify-scoreboard.mjs (public/research/scoreboard-reference.json).
import { JavaHashMap, JavaHashSet } from "./java-hash.js";
import { NBT } from "./nbt.js";
import { compoundTag } from "./structure-nbt.js";
import { allStatIds } from "./commands-extra.js";

// bac.b(int) / bac.j(String): display slot names; the lookup is equalsIgnoreCase, anything else is -1.
export const SLOT_NAMES = Object.freeze(["list", "sidebar", "belowName"]);
export const slotIndex = (name) => SLOT_NAMES.findIndex((s) => s.toLowerCase() === String(name).toLowerCase());

// IScoreObjectiveCriteria: dummy, deathCount, playerKillCount, totalKillCount (ScoreDummyCriteria) and health (ScoreHealthCriteria,
// read-only); every StatBase (ObjectiveStat, achievements included) registers one more criteria under its stat id.
export const BASE_CRITERIA = Object.freeze(["dummy", "deathCount", "playerKillCount", "totalKillCount", "health"]);
export const READ_ONLY_CRITERIA = Object.freeze(new Set(["health"]));
// StatList.replaceAllSimilarBlocks swaps these block stats for their base block's after the StatBase (and so its criteria) was
// constructed: the criteria stay registered, but nothing increments them (stat.mineBlock.2 counts as stat.mineBlock.3 and so on).
export const REPLACED_STAT_CRITERIA = Object.freeze([2, 40, 43, 60, 62, 91, 125].flatMap((id) => [`stat.mineBlock.${id}`, `stat.useItem.${id}`]).concat(["stat.useItem.9", "stat.useItem.11"]));
// The criteria registration order: IScoreObjectiveCriteria.<clinit> puts the four dummies and health first, then every StatBase
// constructor (ObjectiveStat) registers its stat id in construction order, which is StatList.allStats order except that the 16 stats
// StatList.replaceAllSimilarBlocks later dropped from allStats were constructed in their id slot of the mineBlock/useItem runs.
export function criteriaInsertionOrder(statOrder = allStatIds()) {
  const out = statOrder.slice(), slot = /^stat\.(mineBlock|useItem)\.(\d+)$/;
  for (const id of REPLACED_STAT_CRITERIA) {
    const [, kind, n] = slot.exec(id);
    const at = out.findIndex((x) => { const q = slot.exec(x); return q && q[1] === kind && Number(q[2]) > Number(n); });
    out.splice(at, 0, id);
  }
  return [...BASE_CRITERIA, ...out];
}
// bah.a (a HashMap<String, criteria>): the keys in HashMap iteration order (table size and bin order follow from the insertion order).
export function criteriaOrder(statOrder) { return [...new JavaHashMap(criteriaInsertionOrder(statOrder).map((k) => [k, true])).keys()]; }
let criteriaMap = null;
export function criteriaNames() {
  if (!criteriaMap) criteriaMap = new JavaHashMap(criteriaInsertionOrder().map((k) => [k, true]));
  return [...criteriaMap.keys()];
}
export const isCriteria = (name) => (criteriaNames(), criteriaMap.has(name));
export const isReadOnly = (criteria) => READ_ONLY_CRITERIA.has(criteria);

const int32 = (n) => n | 0;

export class Scoreboard {
  constructor() { this.onChange = null; this.reset(); }
  reset() {
    this.objectives = new JavaHashMap();   // a: name -> objective
    this.byCriteria = new Map();           // b: criteria -> [objective] (an ArrayList per criteria; only looked up)
    this.scores = new JavaHashMap();       // c: player -> Map<objective, score> (identity HashMap natively; insertion order here)
    this.slots = [null, null, null];       // d
    this.teams = new JavaHashMap();        // e: name -> team
    this.playerTeams = new JavaHashMap();  // f: player -> team
    this.revision = (this.revision ?? 0) + 1;
  }
  changed() { this.revision++; this.onChange?.(); }

  // ---- objectives ----
  objective(name) { return this.objectives.get(name) ?? null; }  // bac.b(String)
  objectiveList() { return [...this.objectives.values()]; }      // bac.c()
  addObjective(name, criteria) {                                 // bac.a(String, bah)
    if (this.objectives.has(name)) throw new Error(`An objective with the name '${name}' already exists!`);
    const obj = { name, criteria, displayName: name };
    this.objectives.set(name, obj);
    if (!this.byCriteria.has(criteria)) this.byCriteria.set(criteria, []);
    this.byCriteria.get(criteria).push(obj);
    this.changed();
    return obj;
  }
  objectivesFor(criteria) { return [...(this.byCriteria.get(criteria) ?? [])]; } // bac.a(bah)
  setDisplayName(obj, displayName) { obj.displayName = displayName; this.changed(); }
  // bac.k: drops the objective, clears the slots that show it, its criteria entry and its score in every player's map (players
  // whose map becomes empty stay listed).
  removeObjective(obj) {
    this.objectives.delete(obj.name);
    for (let i = 0; i < 3; i++) if (this.slots[i] === obj) this.slots[i] = null;
    const list = this.byCriteria.get(obj.criteria);
    if (list) { const i = list.indexOf(obj); if (i >= 0) list.splice(i, 1); }
    for (const m of this.scores.values()) m.delete(obj);
    this.changed();
  }
  setSlot(i, obj) { this.slots[i] = obj ?? null; this.changed(); }
  slot(i) { return this.slots[i] ?? null; }

  // ---- scores ----
  // bac.a(String, azx) getValueFromObjective: creates the player's map and a 0 score when missing.
  score(player, obj) {
    let m = this.scores.get(player);
    if (!m) { m = new Map(); this.scores.set(player, m); }
    let s = m.get(obj);
    if (!s) { s = { player, objective: obj, value: 0 }; m.set(obj, s); this.changed(); }
    return s;
  }
  peek(player, obj) { return this.scores.get(player)?.get(obj) ?? null; }
  setScore(player, obj, value) { const s = this.score(player, obj); s.value = int32(value); this.changed(); return s; }
  // Score.increase / decrease (add / remove): int overflow wraps like Java's.
  addScore(player, obj, n) {
    if (isReadOnly(obj.criteria)) throw new Error("Cannot modify read-only score");
    return this.setScore(player, obj, this.score(player, obj).value + n);
  }
  playerNames() { return [...this.scores.keys()]; }                     // bac.d()
  playerScores(player) { return [...(this.scores.get(player)?.values() ?? [])]; } // bac.d(String).values()
  resetPlayer(player) { if (this.scores.delete(player)) this.changed(); } // bac.c(String)
  allScores() { return [...this.scores.values()].flatMap((m) => [...m.values()]); } // bac.e()
  // bac.i(azx): the objective's scores in player-map order, stably sorted ascending by value (azz.a).
  sortedScores(obj) {
    const out = [];
    for (const m of this.scores.values()) { const s = m.get(obj); if (s) out.push(s); }
    return out.sort((a, b) => a.value - b.value);
  }
  // A criteria event for one player (EntityPlayerMP.addStat, onDeath, onKillEntity): +1 on every objective of the criteria.
  increment(player, criteria) {
    for (const obj of this.byCriteria.get(criteria) ?? []) { const s = this.score(player, obj); s.value = int32(s.value + 1); }
    if (this.byCriteria.get(criteria)?.length) this.changed();
  }
  // EntityPlayerMP.onUpdate: ScoreHealthCriteria (ceil of health + absorption) set on every health objective.
  setCriteria(player, criteria, value) {
    const list = this.byCriteria.get(criteria) ?? [];
    for (const obj of list) this.score(player, obj).value = int32(value);
    if (list.length) this.changed();
  }

  // ---- teams ----
  team(name) { return this.teams.get(name) ?? null; }  // bac.e(String)
  teamNames() { return [...this.teams.keys()]; }       // bac.f()
  teamList() { return [...this.teams.values()]; }      // bac.g()
  teamOf(player) { return this.playerTeams.get(player) ?? null; } // bac.i(String)
  createTeam(name) {                                   // bac.f(String)
    if (this.teams.has(name)) throw new Error(`A team with the name '${name}' already exists!`);
    const team = { name, displayName: name, prefix: "", suffix: "", friendlyFire: true, seeFriendlyInvisibles: true, members: new JavaHashSet() };
    this.teams.set(name, team);
    this.changed();
    return team;
  }
  removeTeam(team) {                                   // bac.d(azy)
    this.teams.delete(team.name);
    for (const p of [...team.members]) this.playerTeams.delete(p);
    this.changed();
  }
  // bac.a(String, String): false when the team does not exist; otherwise leaves any current team first.
  joinTeam(player, teamName) {
    const team = this.teams.get(teamName);
    if (!team) return false;
    if (this.teamOf(player)) this.leaveTeam(player);
    this.playerTeams.set(player, team);
    team.members.add(player);
    this.changed();
    return true;
  }
  // bac.g(String): false when the player has no team.
  leaveTeam(player) {
    const team = this.teamOf(player);
    if (!team) return false;
    this.playerTeams.delete(player);
    team.members.delete(player);
    this.changed();
    return true;
  }
  setTeam(team, fields) { Object.assign(team, fields); this.changed(); }
  // ScorePlayerTeam.formatPlayerName (azy.a(bae, String)): prefix + name + suffix, or the name without a team.
  formatName(player) { const t = this.teamOf(player); return t ? t.prefix + player + t.suffix : player; }
}

// ---- GuiIngame sidebar (bbv private a(azx, int, int, bbu)) ----
// More than 15 scores draw nothing at all (1.7.10 neither truncates nor hides '#' names); an empty objective draws nothing either
// (the title is drawn with the last row). Rows run upward from the lowest score: y = height/2 + size*9/3 - k*9 for k = 1..size.
// The name is drawn at the left edge, the "§c" + score right-aligned, both without shadow in colour 0x20FFFFFF (white: GL blending
// is off for text there, so the 0x20 alpha only passes the alpha test). Row backdrops are 0x50000000; the title row above the
// highest score gets 0x60000000 plus a 1-pixel 0x50000000 line under it.
export function sidebarLayout(board, obj, width, height, fontWidth) {
  const scores = board.sortedScores(obj);
  if (scores.length > 15 || scores.length === 0) return null;
  let maxW = fontWidth(obj.displayName);
  const rows = scores.map((s) => ({ name: board.formatName(s.player), score: "§c" + s.value }));
  for (const r of rows) maxW = Math.max(maxW, fontWidth(r.name + ": " + r.score));
  const top = Math.trunc(height / 2) + Math.trunc((scores.length * 9) / 3), left = width - maxW - 3, right = width - 3 + 2;
  const out = { left: left - 2, right, maxW, rows: [], rects: [] };
  rows.forEach((r, i) => {
    const y = top - (i + 1) * 9;
    out.rects.push({ x0: left - 2, y0: y, x1: right, y1: y + 9, color: 0x50000000 });
    out.rows.push({ y, name: r.name, nameX: left, score: r.score, scoreX: right - fontWidth(r.score) });
    if (i + 1 === rows.length) {
      out.rects.push({ x0: left - 2, y0: y - 9 - 1, x1: right, y1: y - 1, color: 0x60000000 });
      out.rects.push({ x0: left - 2, y0: y - 1, x1: right, y1: y, color: 0x50000000 });
      out.title = { text: obj.displayName, x: left + Math.trunc(maxW / 2) - Math.trunc(fontWidth(obj.displayName) / 2), y: y - 9 };
    }
  });
  return out;
}

// ---- persistence ----
// Browser record shape (record.scoreboard): ScoreboardSaveData's fields as JSON, written in the native iteration order.
export function scoreboardToJSON(board) {
  if (!board.objectives.size && !board.teams.size && !board.scores.size) return undefined;
  return {
    objectives: board.objectiveList().map((o) => ({ name: o.name, criteria: o.criteria, displayName: o.displayName })),
    scores: board.allScores().map((s) => ({ name: s.player, objective: s.objective.name, score: s.value })),
    teams: board.teamList().map((t) => ({ name: t.name, displayName: t.displayName, prefix: t.prefix, suffix: t.suffix, friendlyFire: t.friendlyFire, seeFriendlyInvisibles: t.seeFriendlyInvisibles, players: [...t.members] })),
    slots: board.slots.map((o) => o?.name ?? null),
  };
}
// ScoreboardSaveData.readFromNBT order: objectives, scores, teams, display slots. Objectives with an unknown criteria are kept
// (bah.a.get gives null natively); scores of a missing objective are skipped.
export function scoreboardFromJSON(board, json) {
  const onChange = board.onChange;
  board.onChange = null; // loading is not a change to save
  try { return readJSON(board, json); } finally { board.onChange = onChange; }
}
function readJSON(board, json) {
  board.reset();
  if (!json || typeof json !== "object") return board;
  const str = (v, d = "") => (typeof v === "string" ? v : d);
  for (const o of Array.isArray(json.objectives) ? json.objectives : []) {
    const name = str(o?.name);
    if (!name || board.objective(name)) continue;
    const obj = board.addObjective(name, str(o.criteria, "dummy"));
    obj.displayName = str(o.displayName, name);
  }
  for (const s of Array.isArray(json.scores) ? json.scores : []) {
    const obj = board.objective(str(s?.objective));
    if (!obj || typeof s.name !== "string") continue;
    board.score(s.name, obj).value = int32(Number(s.score) || 0);
  }
  for (const t of Array.isArray(json.teams) ? json.teams : []) {
    const name = str(t?.name);
    if (!name || board.team(name)) continue;
    const team = board.createTeam(name);
    Object.assign(team, { displayName: str(t.displayName, name), prefix: str(t.prefix), suffix: str(t.suffix) });
    if (typeof t.friendlyFire === "boolean") team.friendlyFire = t.friendlyFire;
    if (typeof t.seeFriendlyInvisibles === "boolean") team.seeFriendlyInvisibles = t.seeFriendlyInvisibles;
    for (const p of Array.isArray(t.players) ? t.players : []) if (typeof p === "string") board.joinTeam(p, name);
  }
  (Array.isArray(json.slots) ? json.slots : []).slice(0, 3).forEach((n, i) => { board.slots[i] = typeof n === "string" ? board.objective(n) : null; });
  board.revision++;
  return board;
}

// ScoreboardSaveData.writeToNBT (bad.b(dh)) under the MapStorage root {data: {...}}: Objectives {Name, CriteriaName, DisplayName},
// PlayerScores {Name, Objective, Score}, Teams {Name, DisplayName, Prefix, Suffix, AllowFriendlyFire, SeeFriendlyInvisibles,
// Players}, and DisplaySlots {slot_N} only when a slot is set. NBTTagCompound keys are stored in HashMap order (compoundTag).
const tag = (type, value) => ({ type, value });
const str = (v) => tag(NBT.STRING, v), list = (type, items) => tag(NBT.LIST, { elementType: items.length ? type : NBT.END, items });
export function scoreboardDocument(board) {
  const data = [
    ["Objectives", list(NBT.COMPOUND, board.objectiveList().map((o) => compoundTag([["Name", str(o.name)], ["CriteriaName", str(o.criteria)], ["DisplayName", str(o.displayName)]]).value))],
    ["PlayerScores", list(NBT.COMPOUND, board.allScores().map((s) => compoundTag([["Name", str(s.player)], ["Objective", str(s.objective.name)], ["Score", tag(NBT.INT, s.value)]]).value))],
    ["Teams", list(NBT.COMPOUND, board.teamList().map((t) => compoundTag([
      ["Name", str(t.name)], ["DisplayName", str(t.displayName)], ["Prefix", str(t.prefix)], ["Suffix", str(t.suffix)],
      ["AllowFriendlyFire", tag(NBT.BYTE, t.friendlyFire ? 1 : 0)], ["SeeFriendlyInvisibles", tag(NBT.BYTE, t.seeFriendlyInvisibles ? 1 : 0)],
      ["Players", list(NBT.STRING, [...t.members])]]).value))],
  ];
  const slots = board.slots.map((o, i) => o && [`slot_${i}`, str(o.name)]).filter(Boolean);
  if (slots.length) data.push(["DisplaySlots", compoundTag(slots)]);
  return { name: "", tag: compoundTag([["data", compoundTag(data)]]) };
}
// ScoreboardSaveData.readFromNBT (bad.a(dh)) from a decoded document (root or its "data" compound) to the browser JSON shape.
export function scoreboardJSONFromNbt(root) {
  const data = root?.value?.get?.("data") ?? root, get = (c, k) => c?.value?.get?.(k);
  const items = (c, k) => { const t = get(c, k); return t?.type === NBT.LIST ? t.value.items : []; };
  const s = (m, k) => { const v = m.get(k)?.value; return typeof v === "string" ? v : undefined; };
  const json = {
    objectives: items(data, "Objectives").map((m) => ({ name: s(m, "Name"), criteria: s(m, "CriteriaName"), displayName: s(m, "DisplayName") })),
    scores: items(data, "PlayerScores").map((m) => ({ name: s(m, "Name"), objective: s(m, "Objective"), score: m.get("Score")?.value ?? 0 })),
    teams: items(data, "Teams").map((m) => ({
      name: s(m, "Name"), displayName: s(m, "DisplayName"), prefix: s(m, "Prefix"), suffix: s(m, "Suffix"),
      ...(m.has("AllowFriendlyFire") ? { friendlyFire: m.get("AllowFriendlyFire").value !== 0 } : {}),
      ...(m.has("SeeFriendlyInvisibles") ? { seeFriendlyInvisibles: m.get("SeeFriendlyInvisibles").value !== 0 } : {}),
      players: (m.get("Players")?.value?.items ?? []).filter((p) => typeof p === "string"),
    })),
    slots: [null, null, null],
  };
  const slots = get(data, "DisplaySlots");
  if (slots?.type === NBT.COMPOUND) for (let i = 0; i < 3; i++) { const v = slots.value.get(`slot_${i}`)?.value; if (typeof v === "string") json.slots[i] = v; }
  return json;
}
