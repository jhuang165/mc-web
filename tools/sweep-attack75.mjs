// Batch 75 mpusesweep75: left-click sweep. Every item id (plain and with each weapon enchantment) hitting every mob kind: ServerMobs.attack against the single-player
// applyPlayerEdit entity attack branch on identical fixtures. Prints the differing rows.
import { ITEMS } from '../src/survival.js';
import { makeStack } from '../src/inventory.js';
import { applyPlayerEdit } from '../src/player-edit-simulation.js';
import { makeSide, spawn } from './sweep-use75.mjs';

const KINDS = ['cow', 'sheep', 'pig', 'chicken', 'wolf', 'ocelot', 'horse', 'villager', 'iron_golem', 'snow_golem', 'creeper', 'zombie', 'skeleton', 'spider', 'cave_spider', 'slime', 'squid', 'bat', 'witch', 'mooshroom'];
const ENCH = [[], [[16, 3]], [[17, 3]], [[18, 3]], [[19, 2]], [[20, 2]], [[21, 3]], [[34, 3]]];
const skip = new Set(['rand', 'id', 'uuid', 'knockbackResistance', 'reinforcement', 'breeder', 'ownerHere', 'eggTimer', 'holderId']);
const sigOf = (side, e, events) => {
  const seen = new WeakSet();
  const r = (k, v) => { if (skip.has(k) || typeof v === 'function') return undefined; if (v && typeof v === 'object') { if (seen.has(v)) return '[cyc]'; seen.add(v); } if (typeof v === 'number') return Math.round(v * 1e5) / 1e5; return v; };
  const inv = side.p.survival.inventory;
  return { ent: JSON.stringify(e, r), inv: JSON.stringify([inv.main, inv.armor]), ev: JSON.stringify(events.map(x => ({ ...x, id: undefined })), r), mobs: side.s.mobs.mobs.entities.length };
};
export function attackSweep({ ids = [0, ...Object.keys(ITEMS).map(Number)], kinds = KINDS, ench = ENCH } = {}) {
  const A = makeSide(), B = makeSide(), rows = [];
  for (const kind of kinds) for (const id of ids) for (const en of (ITEMS[id]?.kind === 'sword' || id === 0 || (ITEMS[id]?.tool) ? ench : [[]])) {
    if (id && !ITEMS[id]) continue;
    const ea = spawn(A, kind), eb = spawn(B, kind);
    { const c = JSON.parse(JSON.stringify(ea, (k, v) => k === 'rand' ? undefined : v)); delete c.id; delete c.uuid; Object.assign(eb, c); }
    for (const side of [A, B]) { const inv = side.p.survival.inventory; for (let i = 0; i < inv.main.length; i++) inv.main[i] = null; if (id) inv.main[0] = makeStack(id, 1, 0, undefined, en.length ? { enchantments: en.map(([i, level]) => ({ id: i, level })) } : undefined); inv.current = 0; side.p.survival.exhaustion = 0; side.s.mobs.mobs.events.length = 0; }
    A.s.mobs.mobs.events.length = 0; B.s.mobs.mobs.events.length = 0;
    let ra = '', rb = '';
    try { A.s.mobs.attack(A.p, Number(String(ea.id).slice(4))); } catch (x) { ra = 'THROW ' + x.message; }
    const state = { screen: 'playing', heldTool: B.p.survival.held?.id ?? 0, world: B.s.world, survival: B.p.survival, position: { x: 64.5, y: 10, z: 64.5 }, velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false }, mobs: B.s.mobs.mobs, farming: B.s.farming, trees: B.s.trees, fire: {}, grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null };
    try { applyPlayerEdit(state, { place: false, aimedEntity: { entity: eb } }, new Proxy({}, { get: () => () => undefined })); } catch (x) { rb = 'THROW ' + x.message; }
    const a = sigOf(A, ea, [...A.s.mobs.mobs.events]), b = sigOf(B, eb, [...B.s.mobs.mobs.events]);
    const keys = Object.keys(a).filter(k => a[k] !== b[k]);
    if (keys.length || ra || rb) rows.push({ kind, id, en: JSON.stringify(en), keys: keys.join('+') + ra + '|' + rb, a, b });
  }
  return rows;
}
if (process.argv[1].endsWith('sweep-attack75.mjs')) {
  const rows = attackSweep(), groups = new Map();
  for (const r of rows) { const k = `${r.kind} | ${r.keys}`; (groups.get(k) ?? groups.set(k, new Set()).get(k)).add(r.id + (r.en !== '[]' ? r.en : '')); }
  for (const [k, ids] of groups) console.log(k, '::', ids.size > 12 ? ids.size + ' rows' : [...ids].join(' '));
  console.log('rows', rows.length);
}
