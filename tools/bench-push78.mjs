// Batch 78 mpperf78: cost of the mob push in dense pens. node tools/bench-push78.mjs [--mobs=200] [--pen=14] [--kind=cow] [--ticks=60] [--warm=10] [--mode=on|off|verify] [--state]
// Wraps EntityMobs.push for its own time. --state prints a seeded determinism hash (positions, motion) after 120 ticks; compare across MC_MPPERF78 modes.
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { buildPenScene } from '../src/mpperf78-scene.js';
import { drain, lcg } from '../src/mpperf77-scene.js';
import { fineConfig } from '../src/push-grid.js';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const MOBS = +arg('mobs', 200), PEN = +arg('pen', 14), KIND = arg('kind', 'cow').split(','), TICKS = +arg('ticks', 60), WARM = +arg('warm', 10);
fineConfig.mode = arg('mode', fineConfig.mode);
if (process.argv.includes('--state')) { const rs = lcg(12345); Math.random = () => rs(); }
const s = buildPenScene({ mobs: MOBS, pen: PEN, kind: KIND });
const em = s.mobs.mobs;
if (process.argv.includes('--state')) {
  const h = createHash('sha256');
  for (let i = 0; i < 120; i++) { s.tick(); drain(s); }
  for (const e of em.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vz}|${e.health};`);
  console.log(h.digest('hex').slice(0, 16), 'mobs', em.entities.length);
} else {
  for (let i = 0; i < WARM; i++) { s.tick(); drain(s); }
  let pushMs = 0, pushes = 0; const orig = em.push.bind(em);
  em.push = (...a) => { const t = performance.now(); try { return orig(...a); } finally { pushMs += performance.now() - t; pushes++; } };
  const times = [];
  for (let i = 0; i < TICKS; i++) { const t0 = performance.now(); s.tick(); times.push(performance.now() - t0); drain(s); }
  const mean = times.reduce((a, b) => a + b, 0) / TICKS;
  console.log(`mode=${fineConfig.mode} kind=${KIND} mobs=${em.entities.length} pen=${PEN} ms/tick=${mean.toFixed(2)} push ms/tick=${(pushMs / TICKS).toFixed(2)} pushes/tick=${(pushes / TICKS).toFixed(0)}`);
}
