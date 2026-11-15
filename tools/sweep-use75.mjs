// Batch 75 mpusesweep75: right-click sweep. Every item id (damages 0-5, 8, 15) on every supported mob kind, the dedicated server's
// ServerMobs.interact against the single-player applyPlayerEdit entity branch on identical fixtures. Prints the differing rows.
import { World } from '../src/world.js';
import { DedicatedSimulation } from '../src/multiplayer/simulation.js';
import { IDLE_INPUT } from '../src/multiplayer/protocol.js';
import { ITEMS } from '../src/survival.js';
import { makeStack } from '../src/inventory.js';
import { applyPlayerEdit } from '../src/player-edit-simulation.js';
import { setEntityRandom } from '../src/entities.js';
import { JavaRandom } from '../src/java-random.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
export const DAMAGES = [0, 1, 2, 3, 4, 5, 8, 15];
export const KINDS = ['cow', 'mooshroom', 'sheep', 'pig', 'chicken', 'wolf', 'ocelot', 'horse', 'donkey', 'mule', 'villager', 'iron_golem', 'snow_golem', 'creeper', 'zombie', 'skeleton'];
export function makeSide(mode = 'survival') {
  const world = new World('use-sweep75');
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: true });
  s.rules.chunkStream = false;
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer('a', 'Alice', key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input('a', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  return { s, p, calls: [] };
}
export function spawn(side, kind) {
  const m = side.s.mobs.mobs, type = kind === 'donkey' || kind === 'mule' ? 'horse' : kind;
  const e = m.create(type, 66.5, 10, 64.5);
  if (kind === 'donkey') e.horse = { ...e.horse, type: 1 }; if (kind === 'mule') e.horse = { ...e.horse, type: 2 };
  setEntityRandom(e, new JavaRandom(7));
  m.entities.length = 0; m.entities.push(e);
  return e;
}
export function stock(side, id, damage, count = 3) { const extra = id === 375 ? { displayName: 'Rex' } : undefined; const inv = side.p.survival.inventory; inv.main.fill?.(null); for (let i = 0; i < inv.main.length; i++) inv.main[i] = null; inv.main[0] = makeStack(id, count, damage, undefined, extra); inv.current = 0; }
const skip = new Set(['rand', 'id', 'uuid', 'knockbackResistance', 'reinforcement', 'breeder', 'ownerHere', 'eggTimer']);
export function sig(side, e) {
  const seen = new WeakSet();
  const ent = JSON.stringify(e, (k, v) => { if (k === 'holderId') return undefined; if (skip.has(k)) return undefined; if (typeof v === 'function') return undefined; if (v && typeof v === 'object') { if (seen.has(v)) return '[cyc]'; seen.add(v); } if (typeof v === 'number') return Math.round(v * 1e6) / 1e6; return v; });
  const inv = side.p.survival.inventory;
  return { ent, inv: JSON.stringify([inv.main, inv.armor]), mobs: side.s.mobs.mobs.entities.length, items: side.s.items?.items?.size ?? side.s.items?.list?.length ?? 0 };
}
export function serverClick(side, e) { const done = side.s.mobs.interact(side.p, Number(String(e.id).slice(4)), false); if (!done) side.s.edit(side.p, true); } // the client sends C02 and then its own use packet
export function spClick(side, e, calls) {
  const p = side.p, mobs = side.s.mobs.mobs;
  const state = { screen: 'playing', heldTool: p.survival.held?.id ?? 0, world: side.s.world, survival: p.survival, position: { x: 64.5, y: 10, z: 64.5 }, velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false }, mobs, farming: side.s.farming, trees: side.s.trees, fire: {}, grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, rider: null };
  const rec = n => (...a) => { calls.push(n); return n === 'openMerchant' ? e.type === 'villager' && e.health > 0 && (e.growingAge ?? 0) >= 0 : undefined; };
  const hooks = new Proxy({}, { get: (_, n) => ['openMerchant', 'openHorse'].includes(n) ? rec(n) : () => undefined });
  return applyPlayerEdit(state, { place: true, aimedEntity: { entity: e } }, hooks);
}
const diffKeys = (a, b) => { const x = JSON.parse(a.ent), y = JSON.parse(b.ent), out = []; for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(k); if (a.inv !== b.inv) out.push('inv'); if (a.mobs !== b.mobs) out.push('mobs'); return out.join('+'); };
export function sweep({ ids = Object.keys(ITEMS).map(Number), kinds = KINDS, damages = DAMAGES } = {}) {
  const A = makeSide(), B = makeSide(), rows = [];
  for (const kind of kinds) for (const id of [0, ...ids]) for (const d of (id === 0 ? [0] : id === 1950 ? [...damages, 90, 91, 92, 93, 95, 98, 100, 120, 50] : damages)) {
    if (id && !ITEMS[id]) continue;
    if ([379, 1951, 1960, 312, 316, 378].includes(id)) continue; // air-use items (map, bottle o' enchanting, eye of ender, throwables): the air sweep
    const ea = spawn(A, kind), eb = spawn(B, kind); { const c = JSON.parse(JSON.stringify(ea, (k, v) => k === 'rand' ? undefined : v)); delete c.id; delete c.uuid; Object.assign(eb, c); }
    B.s.mobs.villagerUse = (q, e) => (A.calls.push('openMerchant'), false); // overwritten below
    const ca = [], cb = [];
    A.s.mobs.villagerUse = (q, e) => (ca.push('openMerchant'), e.type === 'villager' && e.health > 0 && (e.growingAge ?? 0) >= 0);
    stock(A, id, d); stock(B, id, d);
    try { serverClick(A, ea); } catch (x) { ca.push('THROW ' + x.message); }
    try { spClick(B, eb, cb); } catch (x) { cb.push('THROW ' + x.message); }
    const a = sig(A, ea), b = sig(B, eb);
    if ([...ca, ...cb].some(c => String(c).startsWith('THROW'))) continue; // thrown items are the air-use sweep
    if (a.ent !== b.ent || a.inv !== b.inv || a.mobs !== b.mobs || ca.join() !== cb.join()) rows.push({ kind, id, d, name: ITEMS[id]?.name, a, b, ca, cb, keys: diffKeys(a, b) });
  }
  return rows;
}
if (process.argv[1].endsWith('sweep-use75.mjs')) {
  const rows = sweep(), groups = new Map();
  for (const r of rows) { const k = `${r.kind} | ${r.keys} | srv:${r.ca.join()} sp:${r.cb.join()}`; (groups.get(k) ?? groups.set(k, new Map()).get(k)).set(r.id, (groups.get(k).get(r.id) ?? 0) + 1); }
  for (const [k, ids] of groups) console.log(k, '::', (ids.size > 15 ? `${ids.size} ids` : [...ids].map(([id, n]) => `${id}${ITEMS[id] ? '(' + ITEMS[id].name + ')' : ''}x${n}`).join(' ')));
  console.log('rows', rows.length);
}
