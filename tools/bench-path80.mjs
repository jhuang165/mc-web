// Batch 80 mpperf80: server tick time with mobs pathing. node tools/bench-path80.mjs [--players=8] [--layout=spread|cluster] [--mobs=200] [--kinds=zombie,skeleton,...] [--pillar] [--ticks=100] [--warm=20] [--state] [--seed=1] [--cpuprof=file]
// The b77 field (src/mpperf77-scene.js); --pillar stands every player on a 2-block stone pillar so hostile mobs cannot reach them and every search floods the follow-range sphere.
// Timed mode prints ms/tick and the time inside PathFinder.createEntityPathTo, EntityWorld.walk (AI think plus move) and EntityWorld.moveWith (the move alone), plus searches and points per tick.
// Math.random is replaced by a seeded generator in every mode (--rseed), so the timed runs of two modes do the same work. --state prints determinism hashes; compare across MC_MPPERF80=off|on|verify.
// --searches captures the searches of --ticks ticks and replays them on fresh finders in off, on and verify, comparing every result, then times off against on (--rounds).
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import inspector from 'node:inspector';
import fs from 'node:fs';
import { buildPlayersScene, drain, lcg } from '../src/mpperf77-scene.js';
import { PathFinder, setPathSearchObserver } from '../src/pathfinding.js';
import { EntityWorld } from '../src/entities.js';
import { fast80 } from '../src/mpperf80-fast.js';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const PLAYERS = +arg('players', 8), LAYOUT = arg('layout', 'spread'), MOBS = +arg('mobs', 200), TICKS = +arg('ticks', 100), WARM = +arg('warm', 20), SEED = +arg('seed', 1);
const KINDS = arg('kinds', '') ? arg('kinds', '').split(',') : null, PILLAR = process.argv.includes('--pillar'), STATE = process.argv.includes('--state');
{ const rs = lcg(+arg('rseed', 12345)); Math.random = () => rs(); }
const s = buildPlayersScene({ players: PLAYERS, layout: LAYOUT, mobs: KINDS ? 0 : MOBS, seed: SEED });
const host = s.mobs.mobs;
if (KINDS) {
  const rnd = lcg(SEED * 7 + 3), list = [...s.players.values()];
  for (let i = 0; i < MOBS; i++) {
    const c = list[Math.floor(rnd() * list.length)].position;
    const m = host.create(KINDS[i % KINDS.length], c.x + (rnd() - 0.5) * 60, c.y, c.z + (rnd() - 0.5) * 60);
    m.persistent = true; host.entities.push(m);
  }
}
if (PILLAR) for (const p of s.players.values()) {
  const x = Math.floor(p.position.x), z = Math.floor(p.position.z);
  s.world.put(x, 10, z, 1, 0, false); s.world.put(x, 11, z, 1, 0, false);
  p.position.y = 12; p.previous.copy(p.position);
}
const hashOf = (packets) => {
  const h = createHash('sha256');
  for (const e of host.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.health}|${e.yaw}|${e.vx}|${e.vy}|${e.vz}|${e.rotationYaw}|${e.navigator?.currentPath?.index ?? -1};`);
  for (const p of s.players.values()) h.update(`${p.id}|${p.position.x}|${p.position.y}|${p.position.z}|${p.survival?.health};`);
  h.update(JSON.stringify(packets)); return h.digest('hex').slice(0, 16);
};
let searches = 0, points = 0, expanded = 0;
setPathSearchObserver((r) => { searches++; points += r.points; expanded += r.expanded; });
if (process.argv.includes('--searches')) {
  // Capture the searches of TICKS ticks (after the warm-up), then replay them on fresh finders in each MC_MPPERF80 mode and compare every result.
  for (let i = 0; i < WARM; i++) { s.tick(); drain(s); }
  const cap = [], orig = PathFinder.prototype.createEntityPathTo;
  PathFinder.prototype.createEntityPathTo = function (e, tx, ty, tz, range) {
    cap.push({ flags: [this.openDoors, this.breakDoors, this.avoidsWater, this.canSwim, this.maxNodes], e: { x: e.x, y: e.y, z: e.z, width: e.width, height: e.height, inWater: e.inWater, inLava: e.inLava, tries: e.maxSafePointTries() }, t: [tx, ty, tz, range] });
    return orig.call(this, e, tx, ty, tz, range);
  };
  for (let i = 0; i < TICKS; i++) { s.tick(); drain(s); }
  PathFinder.prototype.createEntityPathTo = orig;
  setPathSearchObserver(null);
  const run = (mode) => {
    fast80.mode = mode; const out = [];
    for (const c of cap) {
      const pf = new PathFinder(s.world, ...c.flags.slice(0, 4), { maxNodes: c.flags[4] }), e = { ...c.e, maxSafePointTries: () => c.e.tries };
      const r = pf.createEntityPathTo(e, ...c.t);
      out.push(r ? r.points.map(p => `${p.x},${p.y},${p.z},${p.cost},${p.total}`).join(';') + `|${pf.pointCount}|${pf.expanded}` : `null|${pf.pointCount}|${pf.expanded}`);
    }
    return out;
  };
  const ref = run('off'), got = run('on'), ver = run('verify');
  const same = ref.every((r, k) => r === got[k] && r === ver[k]);
  const time = (mode) => { const t0 = performance.now(); run(mode); return performance.now() - t0; };
  const rounds = +arg('rounds', 5), tOff = [], tOn = [], prof = arg('cpuprof', ''), session = prof ? new inspector.Session() : null;
  if (session) { session.connect(); session.post('Profiler.enable'); }
  for (let k = 0; k < rounds; k++) { tOff.push(time('off')); tOn.push(time('on')); }
  // --cpuprof=file: a profile of `rounds` further replays in the mode given by --profmode (default on)
  if (session) { session.post('Profiler.start'); for (let k = 0; k < rounds; k++) run(arg('profmode', 'on')); session.post('Profiler.stop', (e, r) => fs.writeFileSync(prof, JSON.stringify(r.profile))); }
  const best = a => Math.min(...a).toFixed(1), med = a => [...a].sort((x, y) => x - y)[a.length >> 1].toFixed(1);
  console.log(`searches=${cap.length} identical=${same} off best/median ms=${best(tOff)}/${med(tOff)} on=${best(tOn)}/${med(tOn)}`);
  if (!same) process.exitCode = 1;
} else if (STATE) {
  const hashes = []; let packets = [];
  for (let i = 1; i <= 150; i++) { const t = s.tick(); packets.push(JSON.stringify(t).length); packets.push(drain(s)); if (i % 50 === 0) { hashes.push(hashOf(packets)); packets = []; } }
  console.log(`mode=${fast80.mode} mobs=${host.entities.length} searches=${searches} points=${points}`, JSON.stringify(hashes));
} else {
  for (let i = 0; i < WARM; i++) { s.tick(); drain(s); }
  searches = points = expanded = 0;
  const acc = {}, wrap = (name, o, fn) => { const orig = o[fn]; acc[name] = 0; let depth = 0; o[fn] = function (...a) { if (depth++) { try { return orig.apply(this, a); } finally { depth--; } } const t = performance.now(); try { return orig.apply(this, a); } finally { depth--; acc[name] += performance.now() - t; } }; };
  wrap('path', PathFinder.prototype, 'createEntityPathTo'); wrap('walk', EntityWorld.prototype, 'walk'); wrap('moveWith', EntityWorld.prototype, 'moveWith');
  const prof = arg('cpuprof', ''), session = prof ? new inspector.Session() : null;
  if (session) { session.connect(); session.post('Profiler.enable'); session.post('Profiler.start'); }
  const times = [];
  for (let i = 0; i < TICKS; i++) { const t0 = performance.now(); s.tick(); times.push(performance.now() - t0); drain(s); }
  if (session) session.post('Profiler.stop', (e, r) => fs.writeFileSync(prof, JSON.stringify(r.profile)));
  const mean = times.reduce((a, b) => a + b, 0) / TICKS; times.sort((a, b) => a - b);
  console.log(`mode=${fast80.mode} players=${PLAYERS} layout=${LAYOUT} pillar=${PILLAR} mobs=${host.entities.length} ticks=${TICKS} ms/tick=${mean.toFixed(2)} p95=${times[Math.floor(TICKS * .95)].toFixed(2)} searches/tick=${(searches / TICKS).toFixed(1)} points/tick=${(points / TICKS).toFixed(0)} expanded/tick=${(expanded / TICKS).toFixed(0)}`);
  console.log(Object.entries(acc).map(([k, v]) => `${k}=${(v / TICKS).toFixed(2)}`).join(' '));
}
