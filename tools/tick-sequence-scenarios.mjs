// Executed tick sequences (batch 35 ticktree3): scenarios shared by tools/verify-tick-sequence.mjs (which runs the unchanged BlockDynamicLiquid /
// BlockStaticLiquid / BlockFalling classes in tools/probes/TickSequenceProbe.java) and src/tick-sequence.test.js (which replays the recorded reference
// through the port's tick tree). A scenario is a dx x dy x dz box inside a stone shell: '#' stone, '.' air, '~' settled water, 'L' settled lava,
// 'S' sand, 'G' gravel (nothing scheduled for the settled cells), plus [tick, op, x, y, z] events applied before that tick
// (op: remove, stone, water, lava, sand, gravel). More than 1000 entries come due in one tick in every scenario.
import {World, SAND, GRAVEL, WATER, LAVA} from '../src/world.js';
import {Fluids} from '../src/fluids.js';
import {FallingBlocks} from '../src/falling.js';
import {attachTickTree} from '../src/tile-ticks.js';
import {JavaRandom} from '../src/java-random.js';

const STONE = 3, COBBLESTONE = 12, OBSIDIAN = 22, ORIGIN = [30, 10, 30];
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; };
export const hashString = hash;

function box(name, dims, rseed, ticks, build) {
  const [dx, dy, dz] = dims, cells = new Array(dx * dy * dz), events = [];
  const at = (x, y, z) => (x * dy + y) * dz + z;
  for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) cells[at(x, y, z)] = x === 0 || y === 0 || z === 0 || x === dx - 1 || y === dy - 1 || z === dz - 1 ? '#' : '.';
  const fill = (x0, y0, z0, x1, y1, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells[at(x, y, z)] = c; };
  const event = (t, op, x0, y0, z0, x1 = x0, y1 = y0, z1 = z0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) events.push([t, op, x, y, z]); };
  build({ fill, event });
  return { name, dims, ticks, rseed, grid: cells.join(''), events };
}

export const SEQUENCES = [
  // 36 x 36 sand slab on a stone slab; the support goes in tick 1: 1296 falling updates come due together (1000 + 296 + the cascade).
  box('slab-collapse', [40, 14, 40], 11, 16, ({ fill, event }) => {
    fill(2, 5, 2, 37, 5, 37, '#'); fill(2, 6, 2, 37, 6, 37, 'S');
    event(1, 'remove', 2, 5, 2, 37, 5, 37);
  }),
  // 900 water sources placed in the air at tick 1 over a stone floor; the spread keeps well over 1000 entries due per tick for a while.
  box('flood', [36, 12, 36], 12, 30, ({ fill, event }) => { fill(1, 1, 1, 34, 1, 34, '#'); event(1, 'water', 3, 8, 3, 32, 8, 32); }),
  // Sand and gravel slabs over a water pool and a lava pool; the supports go in tick 1. Liquid updates and falling updates share the cap,
  // lava meeting water uses the world Random (fizz), and the sand displaces liquid on landing.
  box('lake-collapse', [40, 14, 40], 13, 40, ({ fill, event }) => {
    fill(2, 2, 2, 37, 4, 18, '~'); fill(2, 2, 19, 37, 4, 37, 'L');
    fill(2, 7, 2, 37, 7, 37, '#'); fill(2, 8, 2, 37, 8, 37, 'S'); fill(2, 9, 2, 20, 9, 20, 'G');
    event(1, 'remove', 2, 7, 2, 37, 7, 37);
  }),
];

const kind = (b) => b === WATER ? 'w' : b === LAVA ? 'l' : b === SAND ? 's' : b === GRAVEL ? 'g' : '?';
const OPS = {remove: 0, stone: STONE, water: WATER, lava: LAVA, sand: SAND, gravel: GRAVEL};
export const nativeIds = { '#': 1, '~': 9, L: 11, S: 12, G: 13 }; // for the probe's input only: stone, still water, still lava, sand, gravel

/**
 * Replays one scenario through the port's shared tick tree (attachTickTree over Fluids and FallingBlocks, `fallInstantly` as the probe's
 * BlockFalling.fallInstantly world). Returns per tick: [taken, ran, hash of the taken sequence, hash of the grid], the final grid hash,
 * the pending entry count and hash, and the world Random's next int.
 */
export function replaySequence(s, { onTake } = {}) {
  const [dx, dy, dz] = s.dims, [ox, oy, oz] = ORIGIN, w = new World('tick-sequence');
  const pos = (x, y, z) => [ox + x, oy + y, oz + z];
  for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) {
    const c = s.grid[(x * dy + y) * dz + z];
    w.put(...pos(x, y, z), c === '#' ? STONE : c === '~' ? WATER : c === 'L' ? LAVA : c === 'S' ? SAND : c === 'G' ? GRAVEL : 0, 0, false);
  }
  const fluids = new Fluids(w, { seed: s.rseed, fizz: () => {} }), falling = new FallingBlocks(w, { drop() {} }, []);
  falling.watch();
  falling.fallInstantly = true;
  const tree = attachTickTree({ fluids, falling });
  const takenLog = [];
  for (const src of tree.sources) {
    const take = src.take, run = src.run;
    src.take = () => { const e = take(); takenLog.push(`${kind(e.block)}@${e.x - ox},${e.y - oy},${e.z - oz}`); onTake?.(src.name, e); return e; };
    src.run = (e) => { if (w.get(e.x, e.y, e.z) === e.block) ran++; return run(e); };
  }
  let ran = 0;
  const cell = (b, p) => b === 0 ? '.' : b === WATER ? String.fromCharCode(97 + w.getMeta(...p)) : b === LAVA ? String.fromCharCode(65 + w.getMeta(...p)) : b === OBSIDIAN ? '@' : b === COBBLESTONE ? '%' : b === SAND ? 'S' : b === GRAVEL ? 'G' : '#';
  const grid = () => { let out = ''; for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) { const p = pos(x, y, z); out += cell(w.get(...p), p); } return out; };
  const ticks = [];
  for (let t = 1; t <= s.ticks; t++) {
    for (const [at, op, x, y, z] of s.events) if (at === t) { const p = pos(x, y, z), id = OPS[op]; if (!((op === 'water' || op === 'lava') && w.get(...p) === id && w.getMeta(...p) === 0)) w.set(...p, id, true, 0); }
    takenLog.length = 0; ran = 0;
    tree.tick({ x: 0, z: 0 });
    if (process.env.DUMP === `${s.name}:${t}`) console.error(takenLog.join(' '));
    ticks.push([takenLog.length, ran, hash(takenLog.join(' ')), hash(grid())]);
  }
  const pending = [...fluids.pending.values(), ...falling.pending.values()].map((e) => `${kind(e.block)}@${e.x - ox},${e.y - oy},${e.z - oz}:${e.time - (e.block === SAND || e.block === GRAVEL ? falling.time : fluids.time)}`).sort();
  return { ticks, final: hash(grid()), pending: pending.length, pendingHash: hash(pending.join(' ')), rng: fluids.random.nextInt() };
}
