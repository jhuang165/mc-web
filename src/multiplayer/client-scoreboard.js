// Client half of S3B / S3C / S3D / S3E (batch 64 mpscoreboard): NetHandlerPlayClient's scoreboard handlers (bjb.a(ic / ie / hv / id), bytecode-read) applied to a
// replica Scoreboard. The client never learns an objective's criteria (S3B carries none): every objective is a dummy one, so nothing here counts by itself.
import { Scoreboard } from '../scoreboard.js';

const str = (v, d = '') => (typeof v === 'string' ? v : d);

export const createClientScoreboard = () => new Scoreboard();

/** Apply one `{ type: 'sb', packets }` message; returns how many packets changed something. */
export function applyScoreboardMessage(board, m) {
  if (!m || !Array.isArray(m.packets)) return 0;
  let n = 0;
  for (const p of m.packets) if (p && typeof p === 'object' && apply(board, p)) n++;
  return n;
}

function apply(board, p) {
  if (p.k === 'obj') { // S3B
    const name = str(p.name);
    if (!name) return false;
    if (p.mode === 0) { const o = board.objective(name) ?? board.addObjective(name, 'dummy'); board.setDisplayName(o, str(p.display, name)); return true; }
    const o = board.objective(name);
    if (!o) return false;
    if (p.mode === 1) board.removeObjective(o);
    else if (p.mode === 2) board.setDisplayName(o, str(p.display, name));
    else return false;
    return true;
  }
  if (p.k === 'score') { // S3C
    if (p.action === 1) { board.resetPlayer(str(p.player)); return true; }
    const o = board.objective(str(p.obj));
    if (p.action !== 0 || !o || typeof p.player !== 'string') return false;
    board.setScore(p.player, o, Number(p.value) | 0);
    return true;
  }
  if (p.k === 'display') { // S3D: an empty or unknown name clears the slot
    if (!Number.isInteger(p.slot) || p.slot < 0 || p.slot > 2) return false;
    board.setSlot(p.slot, str(p.name) ? board.objective(p.name) : null);
    return true;
  }
  if (p.k === 'team') { // S3E
    const name = str(p.name);
    if (!name) return false;
    const mode = p.mode;
    let team = board.team(name);
    if (mode === 0) team = team ?? board.createTeam(name);
    if (!team) return false;
    if (mode === 1) { board.removeTeam(team); return true; }
    if (mode === 0 || mode === 2) {
      const flags = Number(p.flags) | 0;
      board.setTeam(team, { displayName: str(p.display, name), prefix: str(p.prefix), suffix: str(p.suffix), friendlyFire: (flags & 1) !== 0, seeFriendlyInvisibles: (flags & 2) !== 0 });
    }
    if (mode === 0 || mode === 3) for (const q of Array.isArray(p.players) ? p.players : []) if (typeof q === 'string') board.joinTeam(q, name);
    if (mode === 4) for (const q of Array.isArray(p.players) ? p.players : []) if (typeof q === 'string' && board.teamOf(q) === team) board.leaveTeam(q);
    return mode >= 0 && mode <= 4;
  }
  return false;
}
