// Batch 74 mpperf74: tick time of the dedicated simulation with many mobs. Run: node tools/bench-server-mobs.mjs [--ticks=200] [--counts=0,100,300,600] [--state] [--seed-check]
// Reports ms per tick split by phase (wrapped method timers) for chunkStream on and off. Natural spawning is off so every run holds exactly N mobs.
// --state prints a hash of a seeded run's end state (mob positions, health, packets), used as the determinism check before and after a performance change.
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { World } from '../src/world.js';
import { DedicatedSimulation } from '../src/multiplayer/simulation.js';
import { IDLE_INPUT } from '../src/multiplayer/protocol.js';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const TICKS = +arg('ticks', 200), COUNTS = arg('counts', '0,100,300,600').split(',').map(Number), WARM = +arg('warm', 20);
const KINDS = ['zombie', 'skeleton', 'pig', 'cow', 'sheep', 'chicken', 'creeper', 'spider', 'villager', 'zombie'];
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SIZE = 120;

function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

function build(count, chunkStream, seed = 1) {
  const world = new World('mpperf74');
  for (let x = 4; x < SIZE; x++) for (let z = 4; z < SIZE; z++) { world.put(x, 9, z, 1, 0, false); for (let y = 10; y <= 20; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true, rules: { chunkStream } });
  s.gameRules.doMobSpawning = 'false'; s.gameRules.doDaylightCycle = 'false';
  s.difficulty = 2; s.mobs.mobs.difficulty = 2; s.time = 18000;
  const players = [];
  for (let i = 0; i < 2; i++) {
    const p = s.addPlayer('p' + i, 'p' + i, key(i + 1));
    p.position.copy({ x: 50.5 + i * 25, y: 10, z: 64.5 }); p.previous.copy(p.position);
    s.input('p' + i, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
    players.push(p);
  }
  s.mobs.mobs.entities.length = 0;
  const rnd = lcg(seed);
  for (let i = 0; i < count; i++) {
    const m = s.mobs.mobs.create(KINDS[i % KINDS.length], 6 + rnd() * (SIZE - 12), 10, 6 + rnd() * (SIZE - 12));
    m.persistent = true; s.mobs.mobs.entities.push(m);
  }
  // let the join snapshot and first chunk bulks settle
  for (let i = 0; i < 3; i++) { s.tick(); for (const p of s.players.values()) p.chunkOut = null; }
  return s;
}

const PHASES = [['containers', s => s.containers, 'tick'], ['chunkViews', s => s.chunkViews, 'tick'], ['items', s => s.items, 'tick'], ['dispense', s => s.dispense, 'tick'],
  ['mobs.spawnPass', s => s.mobs, 'spawnPass'], ['mobs.entities.tick', s => s.mobs.mobs, 'tick'], ['mobs.track', s => s.mobs, 'track'], ['vehicles', s => s.vehicles, 'tick'],
  ['weather', s => s.weather, 'tick'], ['falling', s => s.falling, 'tick'], ['pistons', s => s.pistons, 'flush']];
function instrument(s, acc) {
  for (const [name, get, fn] of PHASES) {
    const o = get(s); const orig = o[fn].bind(o); acc[name] = 0;
    o[fn] = (...a) => { const t = performance.now(); try { return orig(...a); } finally { acc[name] += performance.now() - t; } };
  }
  const mt = s.mobs.tick.bind(s.mobs); acc['mobs.tick(total)'] = 0;
  s.mobs.tick = (...a) => { const t = performance.now(); try { return mt(...a); } finally { acc['mobs.tick(total)'] += performance.now() - t; } };
}

function stateHash(s, packets) {
  const h = createHash('sha256');
  for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.health}|${e.yaw}|${e.motionX ?? e.velocity?.x ?? 0}|${e.motionZ ?? e.velocity?.z ?? 0};`);
  h.update(JSON.stringify(packets));
  return h.digest('hex').slice(0, 16);
}

function run(count, chunkStream) {
  const s = build(count, chunkStream), acc = {};
  for (let i = 0; i < WARM; i++) { s.tick(); for (const p of s.players.values()) { p.chunkOut = null; p.mobPackets = null; } }
  instrument(s, acc);
  let total = 0, wire = 0, bytes = 0; const times = [];
  for (let i = 0; i < TICKS; i++) {
    const t0 = performance.now();
    const tick = s.tick();
    const t1 = performance.now();
    let b = JSON.stringify(tick).length; // the broadcast serialises the tick once per recipient group
    for (const p of s.players.values()) { if (p.mobPackets) { b += JSON.stringify(p.mobPackets).length; wire += p.mobPackets.length; } p.mobPackets = null; p.chunkOut = null; }
    const t2 = performance.now();
    total += t1 - t0; bytes += b; times.push(t1 - t0); acc.serialise = (acc.serialise ?? 0) + t2 - t1;
  }
  times.sort((a, b) => a - b);
  return { count, chunkStream, mobs: s.mobs.mobs.entities.length, ms: total / TICKS, p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1], phases: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v / TICKS])), packetsPerTick: wire / TICKS, bytesPerTick: bytes / TICKS };
}

if (process.argv.includes('--state')) {
  // determinism: a seeded run (Math.random replaced) of 300 mobs for 150 ticks, hashed every 50 ticks
  let rs = lcg(12345); Math.random = () => rs();
  const s = build(300, true, 7), hashes = [];
  let packets = [];
  for (let i = 1; i <= 150; i++) { const t = s.tick(); for (const p of s.players.values()) { if (p.mobPackets) packets.push(p.mobPackets); p.mobPackets = null; p.chunkOut = null; } if (i % 50 === 0) { hashes.push(stateHash(s, packets)); packets = []; } }
  console.log(JSON.stringify(hashes));
} else {
  const rows = [];
  for (const chunkStream of [true, false]) for (const c of COUNTS) rows.push(run(c, chunkStream));
  const names = Object.keys(rows[0].phases);
  console.log(`ticks=${TICKS} warm=${WARM} players=2 (node ${process.version})`);
  console.log(['mobs', 'stream', 'ms/tick', 'p95', 'max', 'pkts/t', 'KB/t', ...names].join('\t'));
  for (const r of rows) console.log([r.mobs, r.chunkStream ? 'on' : 'off', r.ms.toFixed(2), r.p95.toFixed(2), r.max.toFixed(1), r.packetsPerTick.toFixed(0), (r.bytesPerTick / 1024).toFixed(1), ...names.map(n => r.phases[n].toFixed(2))].join('\t'));
}
