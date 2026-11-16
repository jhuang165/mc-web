// Batch 77 mpperf77: server tick time with many players, in the Overworld, the Nether and the End.
// node tools/bench-server-players.mjs [--scene=over|nether|end] [--players=8] [--layout=spread|cluster] [--mobs=200] [--ticks=100] [--warm=20] [--state] [--seed=1]
// Timed mode prints ms/tick plus wrapped phase timers; --state prints seeded determinism hashes (Math.random replaced). Use `node --cpu-prof` for self-time shares.
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import inspector from 'node:inspector';
import fs from 'node:fs';
import { buildPlayersScene, drain, lcg } from '../src/mpperf77-scene.js';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const SCENE = arg('scene', 'over'), DIM = { over: 0, nether: -1, end: 1 }[SCENE], PLAYERS = +arg('players', 8), LAYOUT = arg('layout', 'spread'), MOBS = +arg('mobs', 200), TICKS = +arg('ticks', 100), WARM = +arg('warm', 20), SEED = +arg('seed', 1);
const SPAWN = process.argv.includes('--spawning');
if (process.argv.includes('--state')) { let rs = lcg(+arg('rseed', 12345)); Math.random = () => rs(); }
const s = buildPlayersScene({ players: PLAYERS, layout: LAYOUT, mobs: MOBS, dim: DIM, seed: SEED, spawning: SPAWN });
const host = DIM === 0 ? s.mobs : DIM === 1 ? s.dimensions.end.n.mobs : s.dimensions.nether.mobs;
const hashOf = (packets) => {
  const h = createHash('sha256');
  for (const e of host.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.health}|${e.yaw}|${e.motionX ?? e.velocity?.x ?? 0}|${e.motionZ ?? e.velocity?.z ?? 0};`);
  for (const p of s.players.values()) h.update(`${p.id}|${p.position.x}|${p.position.y}|${p.position.z}|${p.survival?.health};`);
  h.update(JSON.stringify(packets)); return h.digest('hex').slice(0, 16);
};
if (process.argv.includes('--state')) {
  const hashes = []; let packets = [];
  for (let i = 1; i <= 150; i++) { const t = s.tick(); packets.push(JSON.stringify(t).length); packets.push(drain(s)); if (i % 50 === 0) { hashes.push(hashOf(packets)); packets = []; } }
  console.log(JSON.stringify(hashes));
} else {
  const acc = {}, phases = [['chunkViews', s.chunkViews, 'tick'], ['mobs.entities.tick', host.mobs, 'tick'], ['mobs.track', host, 'track'], ['mobs.spawnPass', host, 'spawnPass'], ['mobs.tick(total)', host, 'tick']];
  for (let i = 0; i < WARM; i++) { s.tick(); drain(s); }
  for (const [name, o, fn] of phases) { const orig = o[fn].bind(o); acc[name] = 0; o[fn] = (...a) => { const t = performance.now(); try { return orig(...a); } finally { acc[name] += performance.now() - t; } }; }
  // --cpuprof=file.cpuprofile profiles only the timed ticks (setup and warm-up excluded)
  const prof = arg('cpuprof', ''), session = prof ? new inspector.Session() : null;
  if (session) { session.connect(); session.post('Profiler.enable'); session.post('Profiler.start'); }
  const times = []; let bytes = 0;
  for (let i = 0; i < TICKS; i++) { const t0 = performance.now(); const t = s.tick(); times.push(performance.now() - t0); bytes += JSON.stringify(t).length; for (const p of s.players.values()) if (p.mobPackets) bytes += JSON.stringify(p.mobPackets).length; drain(s); }
  if (session) session.post('Profiler.stop', (e, r) => fs.writeFileSync(prof, JSON.stringify(r.profile)));
  const mean = times.reduce((a, b) => a + b, 0) / TICKS; times.sort((a, b) => a - b);
  console.log(`scene=${SCENE} players=${PLAYERS} layout=${LAYOUT} mobs=${host.mobs.entities.length} ticks=${TICKS} ms/tick=${mean.toFixed(2)} p95=${times[Math.floor(TICKS * .95)].toFixed(2)} max=${times[TICKS - 1].toFixed(1)} KB/tick=${(bytes / TICKS / 1024).toFixed(1)}`);
  console.log(Object.entries(acc).map(([k, v]) => `${k}=${(v / TICKS).toFixed(2)}`).join(' '));
}
