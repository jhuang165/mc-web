// The name tag of another player on a server with a scoreboard (batch 64 mpscoreboard): the team-formatted name (prefix + name + suffix, ScorePlayerTeam.formatPlayerName) with its
// colour codes, and under it the belowName objective's "<score> <display name>" (RenderPlayer.func_96449_a: Scoreboard display slot 2).
// Batch 65 mpinvis (bytecode-read, boh.b/a, bop.a, bno.a, yz.d): the tag rules below (tagPlan) and the two passes of the native tag (dim through walls, bright when not occluded).
const COLORS = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#ffaa00', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];

/** Split a legacy string into runs { text, color } (colour codes 0-f set the colour, r and the style codes reset or are dropped). */
export function colorRuns(text) {
  const runs = []; let color = '#ffffff', cur = '';
  const flush = () => { if (cur) runs.push({ text: cur, color }); cur = ''; };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '§' && i + 1 < text.length) {
      const code = text[++i].toLowerCase(), n = parseInt(code, 16);
      flush();
      if (code.length === 1 && n >= 0 && n < 16) color = COLORS[n]; else if (code === 'r') color = '#ffffff';
      continue;
    }
    cur += text[i];
  }
  flush();
  return runs;
}
export const plainLength = text => colorRuns(text).reduce((n, r) => n + r.text.length, 0);

/** The two rows of the tag: the formatted name and, with a belowName objective, "<score> <objective display name>" (null without). */
export function labelRows(board, name) {
  const obj = board.slot(2);
  return { top: board.formatName(name), below: obj ? `${board.peek(name, obj)?.value ?? 0} ${obj.displayName}` : null };
}

/** Entity.isInvisibleToPlayer for another player (yz.d): not invisible -> false; same team as the viewer with seeFriendlyInvisibles -> false; otherwise true. */
export function invisibleToViewer(invisible, name, viewerName, board) {
  if (!invisible) return false;
  const team = board?.teamOf(name) ?? null;
  return !(team && viewerName != null && board.teamOf(viewerName) === team && team.seeFriendlyInvisibles);
}

/**
 * What RendererLivingEntity.passSpecialRender / RenderPlayer.func_96449_a draw for another player's tag at squared distance `distSq`:
 *  - nothing for a player invisible to the viewer (func_110813_b: guiEnabled, not the viewer, !isInvisibleToPlayer, no rider);
 *  - nothing beyond 64 blocks, 32 when sneaking (the d > maxDist^2 return);
 *  - the belowName row only under 10 blocks (distSq < 100) with an objective in slot 2, drawn by Render.func_147906_a at the usual spot while the name is lifted one row (fontHeight * 1.15 * 0.016666668 * 1.6);
 *  - a sneaking name is depth-tested (no pass through walls), 0.25 lower, with the dim colour only; a standing name has a through-walls dim pass and a bright depth-tested pass.
 */
export function tagPlan({ invisible = false, sneak = false, distSq = 0, name = '', viewerName = null, board = null, riddenBy = false }) {
  const hidden = invisibleToViewer(invisible, name, viewerName, board) || riddenBy || distSq > (sneak ? 32 * 32 : 64 * 64);
  if (hidden) return { show: false, below: false, sneakStyle: false };
  return { show: true, below: distSq < 100 && !!board?.slot(2), sneakStyle: !!sneak };
}

/** Where the rows sit above the player's feet (blocks), from RenderPlayer (-0.125 for a sneaking model) and boh.b: the score row takes the usual spot, the name goes up one row, sneaking name 0.25 down. */
export const TAG_ROW = 0.4375 * 1.15; // one canvas sprite row (2.8 x 0.4375) times the native 1.15 line spacing
export function tagHeights({ sneak, below }) {
  const base = 2.2 - (sneak ? 0.125 : 0);
  return { score: base, name: base + (below ? TAG_ROW : 0) - (sneak ? 0.25 : 0) };
}

const NATIVE_DIM = 0x20 / 255; // the 553648127 colour of the through-walls pass: alpha 0x20, white

/**
 * One row of a tag into a 256x40 canvas. mode 'dim': Render.func_147906_a's first pass (black 0.25 background of the text width + 2 native pixels, text alpha 0x20, no depth test);
 * mode 'bright': the second pass (full alpha text, depth-tested, no background). The native FontRenderer.drawString here is unshadowed (func_78276_b = func_85187_a(.., false)).
 */
export function paintTagRow(canvas, text, mode) {
  const c = canvas.getContext('2d'); c.clearRect(0, 0, 256, 40); c.font = '24px monospace'; c.textAlign = 'left';
  const runs = colorRuns(text), width = runs.reduce((w, r) => w + c.measureText(r.text).width, 0);
  if (mode === 'dim') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(128 - width / 2 - 3, 0, width + 6, 40); }
  c.globalAlpha = mode === 'dim' ? NATIVE_DIM : 1;
  let x = 128 - width / 2;
  for (const r of runs) { c.fillStyle = r.color; c.fillText(r.text, x, 28); x += c.measureText(r.text).width; }
  c.globalAlpha = 1;
}
