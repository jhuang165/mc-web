// The name tag of another player on a server with a scoreboard (batch 64 mpscoreboard): the team-formatted name (prefix + name + suffix, ScorePlayerTeam.formatPlayerName) with its
// colour codes, and under it the belowName objective's "<score> <display name>" (RenderPlayer.func_96449_a: Scoreboard display slot 2). Recalled (not executed): native draws the
// score line only within 10 blocks of the viewer and in the same pass as the name; this canvas label always shows both.
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

function paintRow(c, text, y) {
  const runs = colorRuns(text), width = runs.reduce((w, r) => w + c.measureText(r.text).width, 0);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, y, 256, 40);
  let x = 128 - width / 2;
  c.textAlign = 'left';
  for (const r of runs) { c.fillStyle = r.color; c.fillText(r.text, x, y + 28); x += c.measureText(r.text).width; }
}

/** Draw `entry`'s sprite label: a 256x80 canvas (name over the score row) kept at a fixed size so the texture is never re-specified. */
export function drawScoreLabel(entry, board) {
  const { top, below } = labelRows(board, entry.name), canvas = entry.canvas, c = canvas.getContext('2d');
  if (canvas.height !== 80) { canvas.height = 80; entry.label.scale.set(2.8, .875, 1); entry.label.position.y = 2.2 - .21875; } // the name row stays where it was; the score row hangs below it
  c.clearRect(0, 0, 256, 80); c.font = '24px monospace';
  paintRow(c, top, 0);
  if (below != null) paintRow(c, below, 40);
  entry.texture.needsUpdate = true;
}
