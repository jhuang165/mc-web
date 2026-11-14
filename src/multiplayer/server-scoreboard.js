// Batch 64 mpscoreboard: the dedicated server's one shared scoreboard (ServerScoreboard, lp in the 1.7.10 jar) and its network packets.
//
// `sim.scoreboard` is a Scoreboard (src/scoreboard.js: objectives, scores, teams, slots, the ScoreboardSaveData JSON) that records the packets
// lp sends and drains them with `take()`. ServerSocial delivers them to every player after a command or a tick. Saved in the world file as `scoreboard`
// (scoreboardToJSON, the browser form of data/scoreboard.dat). The /scoreboard command runs on it through the command host's `scoreboard`.
//
// Wire message `{ type: 'sb', packets: [...] }` carries, in order, the 1.7.10 packets as plain objects:
//   { k: 'obj', name, display, mode }                     S3BPacketScoreboardObjective (ic): mode 0 create, 1 remove, 2 update the display name
//   { k: 'score', player, obj, value, action }            S3CPacketUpdateScore (ie): action 0 set, 1 remove the player's scores (obj '')
//   { k: 'display', slot, name }                          S3DPacketDisplayScoreboard (hv): slot 0 list, 1 sidebar, 2 belowName; '' clears it
//   { k: 'team', name, mode, display, prefix, suffix, flags, players }   S3EPacketTeams (id): mode 0 create, 1 remove, 2 update, 3 add players, 4 remove players
// Bytecode-read (javap lp, ic, ie, hv, id, azz, bjb, yz, mw): lp sends an objective's S3B / S3D / S3C only while the objective is in a display slot
// (the `b` set, `tracked` here), team changes always; a score's S3C only when its value changed; EntityPlayerMP.canAttackPlayer (mw.a) is false when
// pvp is off, else EntityPlayer.canAttackPlayer (yz.a): true without a team, true across teams, else the team's friendlyFire.
import { Scoreboard, scoreboardToJSON, scoreboardFromJSON } from '../scoreboard.js';
import { STAT } from '../stats.js';

const int32 = n => n | 0, f = Math.fround;
export const teamFlags = t => (t.friendlyFire ? 1 : 0) | (t.seeFriendlyInvisibles ? 2 : 0); // azy.i()

export class ServerScoreboard extends Scoreboard {
  constructor(saved) {
    super();
    this.loading = false;
    if (saved) this.load(saved);
  }
  reset() { super.reset(); this.tracked = new Set(); this.outbox = []; }
  load(json) {
    this.loading = true;
    try { scoreboardFromJSON(this, json); } finally { this.loading = false; }
    this.tracked = new Set(this.slots.filter(Boolean));
    this.outbox.length = 0;
  }
  save() { return scoreboardToJSON(this); }
  /** The packets queued since the last call. */
  take() { return this.outbox.length ? this.outbox.splice(0) : []; }
  emit(packet) { if (!this.loading) this.outbox.push(packet); }

  // ---- packets ----
  objectivePacket(obj, mode) { return { k: 'obj', name: obj.name, display: obj.displayName, mode }; }
  scorePacket(s) { return { k: 'score', player: s.player, obj: s.objective.name, value: s.value, action: 0 }; }
  displayPacket(slot, obj) { return { k: 'display', slot, name: obj ? obj.name : '' }; }
  teamPacket(team, mode, players) {
    const p = { k: 'team', name: team.name, mode };
    if (mode === 0 || mode === 2) Object.assign(p, { display: team.displayName, prefix: team.prefix, suffix: team.suffix, flags: teamFlags(team) });
    if (mode === 0) p.players = [...team.members];
    else if (mode === 3 || mode === 4) p.players = players;
    return p;
  }
  slotCount(obj) { return this.slots.filter(o => o === obj).length; } // lp.h
  /** lp.d: what a client needs to show one objective: create, the slots that show it, every score in the sort order. */
  showPackets(obj) {
    const out = [this.objectivePacket(obj, 0)];
    this.slots.forEach((o, i) => { if (o === obj) out.push(this.displayPacket(i, obj)); });
    for (const s of this.sortedScores(obj)) out.push(this.scorePacket(s));
    return out;
  }
  hide(obj) { // lp.g: remove, and untrack
    this.emit(this.objectivePacket(obj, 1));
    this.slots.forEach((o, i) => { if (o === obj) this.emit(this.displayPacket(i, obj)); });
    this.tracked.delete(obj);
  }
  show(obj) { for (const p of this.showPackets(obj)) this.emit(p); this.tracked.add(obj); } // lp.e
  /** ServerConfigurationManager.func_96456_a: the whole scoreboard for a player who joins (teams, then each displayed objective once). */
  joinPackets() {
    const out = [], sent = new Set();
    for (const t of this.teamList()) out.push(this.teamPacket(t, 0));
    for (let i = 0; i < 3; i++) {
      const obj = this.slot(i);
      if (obj && !sent.has(obj)) { sent.add(obj); out.push(...this.showPackets(obj)); }
    }
    return out;
  }

  // ---- lp's overrides ----
  setSlot(i, obj) { // lp.a(int, azx)
    const old = this.slot(i);
    super.setSlot(i, obj);
    if (old !== (obj ?? null) && old) {
      if (this.slotCount(old) > 0) this.emit(this.displayPacket(i, obj));
      else this.hide(old);
    }
    if (obj) { if (this.tracked.has(obj)) this.emit(this.displayPacket(i, obj)); else this.show(obj); }
  }
  setDisplayName(obj, name) { super.setDisplayName(obj, name); if (this.tracked.has(obj)) this.emit(this.objectivePacket(obj, 2)); } // lp.b(azx)
  removeObjective(obj) { // bac.k clears the slots through the overridable setter, then lp.c(azx) hides a still tracked one
    for (let i = 0; i < 3; i++) if (this.slot(i) === obj) this.setSlot(i, null);
    if (this.tracked.has(obj)) this.hide(obj);
    super.removeObjective(obj);
  }
  scoreChanged(s) { if (this.tracked.has(s.objective)) this.emit(this.scorePacket(s)); } // lp.a(azz)
  setScore(player, obj, value) {
    const s = this.score(player, obj), old = s.value;
    super.setScore(player, obj, value);
    if (s.value !== old) this.scoreChanged(s);
    return s;
  }
  increment(player, criteria) {
    for (const obj of this.objectivesFor(criteria)) { const s = this.score(player, obj); s.value = int32(s.value + 1); this.changed(); this.scoreChanged(s); }
  }
  setCriteria(player, criteria, value) {
    for (const obj of this.objectivesFor(criteria)) { const s = this.score(player, obj), old = s.value; s.value = int32(value); this.changed(); if (s.value !== old) this.scoreChanged(s); }
  }
  resetPlayer(player) { // lp.a(String): the S3C that removes every score of the name
    const had = this.scores.has(player);
    super.resetPlayer(player);
    if (had) this.emit({ k: 'score', player, obj: '', value: 0, action: 1 });
  }
  createTeam(name) { const t = super.createTeam(name); this.emit(this.teamPacket(t, 0)); return t; }
  removeTeam(team) { super.removeTeam(team); this.emit(this.teamPacket(team, 1)); }
  // Each ScorePlayerTeam setter notifies on its own (func_96624_a): one S3E update per field.
  setTeam(team, fields) { for (const [k, v] of Object.entries(fields)) { super.setTeam(team, { [k]: v }); this.emit(this.teamPacket(team, 2)); } }
  joinTeam(player, teamName) {
    const ok = super.joinTeam(player, teamName);
    if (ok) this.emit(this.teamPacket(this.team(teamName), 3, [player]));
    return ok;
  }
  leaveTeam(player) {
    const team = this.teamOf(player), ok = super.leaveTeam(player);
    if (ok) this.emit(this.teamPacket(team, 4, [player]));
    return ok;
  }

  // ---- criteria for a server player (name `p.name`) ----
  /** EntityPlayerMP.addStat: +1 on every objective of the stat's criteria (any amount), plus deathCount / totalKillCount / playerKillCount. */
  statIncrement(name, id) {
    if (id === STAT.deaths) this.increment(name, 'deathCount');
    if (id === STAT.mobKills || id === STAT.playerKills) this.increment(name, 'totalKillCount');
    if (id === STAT.playerKills) this.increment(name, 'playerKillCount');
    this.increment(name, id);
  }
  achievement(name, id) { this.increment(name, 'achievement.' + id); }
  /** EntityPlayerMP.onUpdate: health criteria = ceil(health + absorption) when that sum changed; a new entity after a respawn starts again. */
  tickHealth(p) {
    const s = p.survival;
    if (!s) return;
    if (p.dead) p.sbWasDead = true;
    else if (p.sbWasDead) { p.sbWasDead = false; p.sbHealth = undefined; }
    const sum = f(f(s.health) + f(s.absorption || 0));
    if (p.sbHealth === sum) return;
    p.sbHealth = sum;
    this.setCriteria(p.name, 'health', Math.ceil(sum));
  }

  // ---- teams ----
  /** EntityPlayerMP.canAttackPlayer's team part: attacker and victim by name. */
  teamAllowsAttack(attackerName, victimName) {
    const a = this.teamOf(victimName), b = this.teamOf(attackerName);
    if (!a) return true;
    if (a !== b) return true;
    return a.friendlyFire;
  }
}
