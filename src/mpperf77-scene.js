// Batch 77 mpperf77: seeded multi-player / Nether / End server scenes for tools/bench-server-players.mjs and mpperf77-b77.test.js.
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

export const lcg = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const KINDS = ['zombie', 'skeleton', 'pig', 'cow', 'sheep', 'chicken', 'creeper', 'spider', 'villager', 'zombie'];
const NETHER_KINDS = ['pigman', 'ghast', 'magma_cube', 'ghast', 'pigman', 'blaze', 'wither_skeleton'];
const END_KINDS = ['enderman'];

// layout 'spread': a square grid over the field; 'cluster': everyone within an 8 x 8 area. Returns the simulation with `players` joined and their first chunk bulks settled.
export function buildPlayersScene({ players = 8, layout = 'spread', mobs = 200, dim = 0, seed = 1, size = 200, spawning = false } = {}) {
  const world = new World('mpperf77');
  if (dim === 0) for (let x = 4; x < size; x++) for (let z = 4; z < size; z++) { world.put(x, 9, z, 1, 0, false); for (let y = 10; y <= 20; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: size / 2 + 0.5, y: 10, z: size / 2 + 0.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true, rules: { chunkStream: true } });
  if (!spawning) s.gameRules.doMobSpawning = 'false';
  s.gameRules.doDaylightCycle = 'false'; s.difficulty = 2; s.mobs.mobs.difficulty = 2; s.time = 18000;
  const rnd = lcg(seed), list = [], per = Math.ceil(Math.sqrt(players));
  for (let i = 0; i < players; i++) {
    const p = s.addPlayer('p' + i, 'p' + i, key(i + 1));
    const x = layout === 'cluster' ? size / 2 + (i % 8) + 0.5 : 14 + ((i % per) + 0.5) * ((size - 28) / per), z = layout === 'cluster' ? size / 2 + Math.floor(i / 8) + 0.5 : 14 + (Math.floor(i / per) + 0.5) * ((size - 28) / per);
    p.position.copy({ x, y: 10, z }); p.previous.copy(p.position);
    s.input('p' + i, { type: 'input', controls: { ...IDLE_INPUT }, yaw: rnd() * 6, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
    list.push(p);
  }
  let host = s.mobs.mobs, kinds = KINDS;
  if (dim) {
    const d = s.dimensions, p0 = list[0];
    d.arrive(list[0], dim);
    for (const p of list.slice(1)) d.arrive(p, dim, { at: { x: p0.position.x + (layout === 'cluster' ? (p.id.slice(1) % 8) : (p.id.slice(1) * 7)), y: p0.position.y, z: p0.position.z } });
    host = (dim === 1 ? d.end.n : d.nether).mobs.mobs; kinds = dim === 1 ? END_KINDS : NETHER_KINDS;
  }
  if (dim !== 1) host.entities.length = 0; // the End keeps its dragon and crystals
  // mobs near players (within 30) so that trackers and AI have work: pick a random player as the centre
  for (let i = 0; i < mobs; i++) {
    const c = list[Math.floor(rnd() * list.length)].position;
    const m = host.create(kinds[i % kinds.length], c.x + (rnd() - 0.5) * 60, c.y + (dim === -1 && kinds[i % kinds.length] === 'ghast' ? 12 : 0), c.z + (rnd() - 0.5) * 60);
    m.persistent = true; host.entities.push(m);
  }
  for (let i = 0; i < 3; i++) { s.tick(); for (const p of s.players.values()) p.chunkOut = null; }
  return s;
}
export const drain = s => { const out = []; for (const p of s.players.values()) { if (p.mobPackets) out.push(p.mobPackets); p.mobPackets = null; p.chunkOut = null; p.dimOut = null; } return out; };
