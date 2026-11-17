// Batch 79 mpperf79: three exact speed-ups found by profiling the 16/32-player, dense-pen and Nether server benches (tools/bench-server-players.mjs), the old code kept beside each.
// MC_MPPERF79=on (default) | off (reference paths) | verify (both on every call, throws on the first difference); tests set `fast79.mode`.
//   1. blockBoxes: World.getCollidingBoundingBoxes' block scan (entities.js collisionBoxes) skips air cells without asking the cell function (solid(0) is false, so it returned []).
//   2. nearestView / mobStateJson: the server's per-mob nearest-player pick (server-mobs.js target) over a cached array, and the tracker's state string built from the flag bits for
//      types whose watched state is only dead/hurt/baby/burn (the same key order as mobState, so the same JSON text).
//   3. sweepBox: Fireballs.sweep's per-mob box without building the pushBox array for mobs that miss the swept query box (same float arithmetic as pushBox).
export const fast79 = { mode: (typeof process !== 'undefined' && process.env?.MC_MPPERF79) || 'on' };
const f = Math.fround, SCRATCH = [0, 0];
const fail = (what) => { throw new Error(`mpperf79 ${what} mismatch`); };

// ---- 1. block boxes ----
// Appends to `out` the cell boxes ([minX, minY, minZ, maxX, maxY, maxZ], world coordinates) that overlap `b`; cellFn(world, x, y, z) -> block-local boxes (world.js collisionBoxes).
export function blockBoxesReference(world, b, out, cellFn) {
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        for (const [a, c, d, g, h, i] of cellFn(world, bx, by, bz))
          if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
  return out;
}
export function blockBoxes(world, b, out, cellFn) {
  const mode = fast79.mode;
  if (mode === 'off' || typeof world.get !== 'function') return blockBoxesReference(world, b, out, cellFn);
  const x1 = Math.floor(b[3] + 1), y1 = Math.floor(b[4] + 1), z1 = Math.floor(b[5] + 1), start = out.length;
  for (let bx = Math.floor(b[0]); bx < x1; bx++)
    for (let by = Math.floor(b[1]) - 1; by < y1; by++)
      for (let bz = Math.floor(b[2]); bz < z1; bz++) {
        if (world.get(bx, by, bz) === 0) continue;
        for (const [a, c, d, g, h, i] of cellFn(world, bx, by, bz))
          if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
      }
  if (mode === 'verify') {
    const ref = blockBoxesReference(world, b, [], cellFn), got = out.slice(start);
    if (ref.length !== got.length || ref.some((r, k) => r.some((v, j) => v !== got[k][j]))) fail('blockBoxes');
  }
  return out;
}

// ---- 2. nearest player view, tracker state text ----
export function nearestReference(views, e) {
  let best = null, bd = Infinity;
  for (const v of views.values()) {
    const p = v.player.position, d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
const lists = new WeakMap();
export const dropViewList = (views) => lists.delete(views);
export function nearestView(views, e) {
  const mode = fast79.mode;
  if (mode === 'off') return nearestReference(views, e);
  let list = lists.get(views);
  if (!list || list.length !== views.size) { list = [...views.values()]; lists.set(views, list); }
  let best = null, bd = Infinity;
  for (let k = 0; k < list.length; k++) {
    const v = list[k], p = v.player.position, d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  if (mode === 'verify' && best !== nearestReference(views, e)) fail('nearestView');
  return best;
}
// Types with watched state beyond dead / hurt / baby / burn (server-mobs.js mobState); everything else is one of 16 texts.
const SPECIAL = new Set(['zombie', 'villager', 'enderman', 'slime', 'magma_cube', 'witch', 'wolf', 'ocelot', 'horse', 'bat', 'sheep', 'pig', 'wither', 'creeper']);
const FLAG_TEXT = [];
for (let m = 0; m < 16; m++) {
  const s = {};
  if (m & 1) s.dead = 1; if (m & 2) s.hurt = 1; if (m & 4) s.baby = 1; if (m & 8) s.burn = 1;
  FLAG_TEXT.push(JSON.stringify(s));
}
export function mobStateJson(e, mobState) {
  const mode = fast79.mode;
  if (mode === 'off' || SPECIAL.has(e.type)) return JSON.stringify(mobState(e));
  const s = FLAG_TEXT[(e.health <= 0 ? 1 : 0) | (e.hurt > 0 ? 2 : 0) | (e.growingAge < 0 ? 4 : 0) | (e.burn > 0 || e.fire > 0 ? 8 : 0)];
  if (mode === 'verify' && s !== JSON.stringify(mobState(e))) fail('mobStateJson');
  return s;
}

// ---- 3. fireball sweep candidates ----
// pushBox(e, ...mobs.size(e)) when it meets the query box q ([minX, minY, minZ, maxX, maxY, maxZ] test of Fireballs.sweep `near`), else null.
export function sweepBoxReference(mobs, e, q, pushBox) {
  const c = pushBox(e, ...mobs.size(e));
  return c[3] > q[0] && c[0] < q[3] && c[4] > q[1] && c[1] < q[4] && c[5] > q[2] && c[2] < q[5] ? c : null;
}
export function sweepBox(mobs, e, q, pushBox) {
  const mode = fast79.mode;
  if (mode === 'off' || typeof mobs.sizeInto !== 'function') return sweepBoxReference(mobs, e, q, pushBox);
  const s = mobs.sizeInto(e, SCRATCH), w = f(f(s[0]) / 2), h = f(s[1]);
  const hit = e.x + w > q[0] && e.x - w < q[3] && e.y + h > q[1] && e.y < q[4] && e.z + w > q[2] && e.z - w < q[5];
  const r = hit ? pushBox(e, s[0], s[1]) : null;
  if (mode === 'verify') {
    const ref = sweepBoxReference(mobs, e, q, pushBox);
    if (!!ref !== !!r || (ref && ref.some((v, k) => v !== r[k]))) fail('sweepBox');
  }
  return r;
}
