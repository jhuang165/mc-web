// Batch 76 mplos76: line-of-sight walk, reference versus fast. Run: node tools/bench-raytrace.mjs [--rays=20000] [--reps=7] [--scene=flat|mixed|air]
// Verifies bit-identical results first (hit block, side, vec, or null), then times both interleaved (best of reps) so machine load hits both alike.
import { performance } from 'node:perf_hooks';
import { World } from '../src/world.js';
import { rayTraceBlocks, rayTraceBlocksReference, rayTraceConfig } from '../src/projectiles.js';
import { buildScene, randomRays } from '../src/mplos76-scene.js';
const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const N = +arg('rays', 20000), REPS = +arg('reps', 7), SCENE = arg('scene', 'flat');
const world = buildScene(World, SCENE === 'air' ? 'flat' : SCENE), rays = randomRays(N, 5, SCENE === 'mixed' ? 30 : 40, 5, 110, SCENE === 'air');
rayTraceConfig.mode = 'on';
let hits = 0;
for (const [a, b, h] of rays) { const g = rayTraceBlocks(world, a, b, h), w = rayTraceBlocksReference(world, a, b, h); if (JSON.stringify(g) !== JSON.stringify(w)) throw new Error('mismatch'); if (g) hits++; }
console.log(`scene=${SCENE} rays=${N} hits=${hits} identical`);
const time = fn => { const t = performance.now(); let k = 0; for (const [a, b, h] of rays) if (fn(world, a, b, h)) k++; return performance.now() - t; };
let bo = Infinity, bn = Infinity;
for (let i = 0; i < REPS; i++) { bo = Math.min(bo, time(rayTraceBlocksReference)); bn = Math.min(bn, time(rayTraceBlocks)); }
console.log(`reference ${(bo / N * 1000).toFixed(2)} us/ray, fast ${(bn / N * 1000).toFixed(2)} us/ray, ${(bo / bn).toFixed(2)}x`);
