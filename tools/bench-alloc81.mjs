// Batch 81 mpperf81: server tick time, GC and heap in the pen, travel (spread field), pillar, nether and terrain (mixed blocks) scenes.
// node [--expose-gc] tools/bench-alloc81.mjs [--scene=pen|travel|pillar|nether|terrain] [--mobs=200] [--players=16] [--ticks=150] [--warm=30] [--runs=5] [--state]
//   [--cpuprof=file | --heapprof=file] [--seed=1]
// Math.random is seeded in every mode, so two modes do the same work. Timed mode: each run builds a fresh scene, warms, then times --ticks ticks and records
// ms/tick, cpu ms/tick, GC pauses (PerformanceObserver 'gc': count and ms per tick) and heap growth per tick (process.memoryUsage().heapUsed increases between
// ticks, summed: a lower bound on bytes allocated, since a GC inside a tick hides that tick's allocations). Prints the median of the runs.
// --state prints seeded determinism hashes after 50/100/150 ticks; compare across MC_MPPERF81=off|on|verify, MC_MPPERF82=off|on|verify, MC_MPPERF83=off|on|verify (and the earlier and later flags, up to MC_MPPERF86).
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import inspector from 'node:inspector';
import fs from 'node:fs';
import { buildPlayersScene, drain, lcg } from '../src/mpperf77-scene.js';
import { buildPenScene } from '../src/mpperf78-scene.js';
import { buildTerrainPen } from '../src/mpperf81-scene.js';
import { fast81 } from '../src/mpperf81-fast.js';
import { fast82 } from '../src/mpperf82-fast.js'; // b82 mpperf82: MC_MPPERF82 shows as mode82
import { fast83 } from '../src/mpperf83-fast.js'; // b83 mpperf83: MC_MPPERF83 shows as mode83
import { fast84 } from '../src/mpperf84-fast.js'; // b84 mpperf84: MC_MPPERF84 shows as mode84
import { fast85 } from '../src/mpperf85-fast.js'; // b85 mpperf85: MC_MPPERF85 shows as mode85
import { fast86 } from '../src/mpperf86-fast.js'; // b86 mpperf86: MC_MPPERF86 shows as mode86

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const SCENE = arg('scene', 'travel'), TICKS = +arg('ticks', 150), WARM = +arg('warm', 30), RUNS = +arg('runs', 5), SEED = +arg('seed', 1);
const build = () => {
  if (SCENE === 'terrain') return buildTerrainPen({ mobs: +arg('mobs', 120), pen: +arg('pen', 14), seed: SEED });
  if (SCENE === 'pen') return buildPenScene({ mobs: +arg('mobs', 200), pen: +arg('pen', 14), kind: arg('kind', 'cow').split(','), seed: SEED });
  if (SCENE === 'nether') return buildPlayersScene({ players: +arg('players', 8), mobs: +arg('mobs', 200), dim: -1, seed: SEED });
  const s = buildPlayersScene({ players: +arg('players', 16), layout: arg('layout', 'spread'), mobs: +arg('mobs', 300), seed: SEED });
  if (SCENE === 'pillar') for (const p of s.players.values()) {
    const x = Math.floor(p.position.x), z = Math.floor(p.position.z);
    s.world.put(x, 10, z, 1, 0, false); s.world.put(x, 11, z, 1, 0, false);
    p.position.y = 12; p.previous.copy(p.position);
  }
  return s;
};
const hostOf = (s) => SCENE === 'nether' ? s.dimensions.nether.mobs.mobs : s.mobs.mobs;
const seed = () => { const rs = lcg(+arg('rseed', 12345)); Math.random = () => rs(); };
if (process.argv.includes('--state')) {
  seed();
  const s = build(), host = hostOf(s), hashes = []; let h = createHash('sha256');
  for (let i = 1; i <= TICKS; i++) {
    const t = s.tick(); h.update(JSON.stringify(t)); h.update(JSON.stringify(drain(s)));
    if (i % 50 === 0) {
      for (const e of host.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vy}|${e.vz}|${e.health}|${e.onGround}|${e.collidedH}|${e.fallDistance};`);
      for (const p of s.players.values()) h.update(`${p.id}|${p.position.x}|${p.position.y}|${p.position.z}|${p.survival?.health};`);
      hashes.push(h.digest('hex').slice(0, 16)); h = createHash('sha256');
    }
  }
  console.log(`scene=${SCENE} mode=${fast81.mode} mode82=${fast82.mode} mode83=${fast83.mode} mode84=${fast84.mode} mode85=${fast85.mode} mode86=${fast86.mode} mobs=${host.entities.length}`, JSON.stringify(hashes));
} else {
  let gcCount = 0, gcMs = 0, on = false;
  new PerformanceObserver((l) => { if (on) for (const e of l.getEntries()) { gcCount++; gcMs += e.duration; } }).observe({ entryTypes: ['gc'] });
  const HEAP = arg('heapprof', ''), prof = HEAP || arg('cpuprof', ''), session = prof ? new inspector.Session() : null;
  if (session) { session.connect(); session.post('Profiler.enable'); }
  const res = [];
  for (let r = 0; r < RUNS; r++) {
    seed();
    const s = build();
    for (let i = 0; i < WARM; i++) { s.tick(); drain(s); }
    globalThis.gc?.();
    await new Promise(r => setTimeout(r, 0));
    gcCount = 0; gcMs = 0; on = true;
    if (session && r === RUNS - 1) session.post(HEAP ? 'HeapProfiler.startSampling' : 'Profiler.start', HEAP ? { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true } : {});
    let grown = 0, last = process.memoryUsage().heapUsed;
    const t0 = performance.now(), c0 = process.cpuUsage();
    for (let i = 0; i < TICKS; i++) {
      s.tick(); drain(s);
      const u = process.memoryUsage().heapUsed; if (u > last) grown += u - last; last = u;
    }
    const ms = (performance.now() - t0) / TICKS, cu = process.cpuUsage(c0), cpu = (cu.user + cu.system) / 1000 / TICKS;
    if (session && r === RUNS - 1) session.post(HEAP ? 'HeapProfiler.stopSampling' : 'Profiler.stop', (e, p) => fs.writeFileSync(prof, JSON.stringify(p.profile)));
    await new Promise(r => setTimeout(r, 0)); // flush gc entries
    on = false;
    res.push({ ms, cpu, gc: gcCount / TICKS, gcMs: gcMs / TICKS, kb: grown / TICKS / 1024 });
  }
  const med = (k) => { const a = res.map(x => x[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
  console.log(`scene=${SCENE} mode=${fast81.mode} mode82=${fast82.mode} mode83=${fast83.mode} mode84=${fast84.mode} mode85=${fast85.mode} mode86=${fast86.mode} runs=${RUNS} ticks=${TICKS} median ms/tick=${med('ms').toFixed(2)} (runs ${res.map(x => x.ms.toFixed(2)).join(' ')}) cpu ms/tick=${med('cpu').toFixed(2)} gc/tick=${med('gc').toFixed(2)} gc ms/tick=${med('gcMs').toFixed(2)} heap growth KB/tick=${med('kb').toFixed(0)}`);
}
