// Batch 64 (mpstats2): fishing on the dedicated server (server-fishing.js, client-fishing.js), the damageDealt rule, the later-death attacker credit and the use stat of seeds,
// spawn eggs and flint and steel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { RemoteFishing } from './multiplayer/client-fishing.js';
import { makeStack } from './inventory.js';
import { STAT } from './stats.js';
import { FISHING_ROD } from './fishing-content.js';
import { ITEMS } from './survival.js';
import { liveFishStack } from './fishing-loot.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...extra });
function fixture(mobs = false, gameMode = 'survival') {
  const world = new World('mp-stats2-b64');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs });
  if (mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  return s;
}
const join = (s, id = 'a', n = 1) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };
const hold = (p, stack) => { p.survival.inventory.main[0] = stack; p.survival.inventory.current = 0; };
const messages = (p, type) => (p.dispOut ?? []).filter(m => m.type === type);

test('casting with the rod makes a hook that the players of the dimension are told about, a second use reels it in', () => {
  const s = fixture(), p = join(s), q = join(s, 'b', 2);
  hold(p, makeStack(FISHING_ROD, 1));
  p.pitch = 0.3; // looking up: no block is in reach
  assert.equal(s.fishing.use(p), true);
  assert.ok(s.fishing.hookOf(p));
  s.tick();
  const seen = messages(q, 'fishHooks').at(-1);
  assert.equal(seen.hooks.length, 1); assert.equal(seen.hooks[0].o, p.id);
  assert.equal(s.fishing.use(p), true); // reel in: nothing bit, nothing caught, no wear
  assert.equal(s.fishing.hookOf(p), null);
  assert.equal(p.survival.held.damage ?? 0, 0);
  q.dispOut.length = 0; s.tick();
  assert.deepEqual(messages(q, 'fishHooks').at(-1)?.hooks, []); // cleared once
});

test('a bite is landed as loot with the live item ids, an orb, one wear and the catch statistic', () => {
  const s = fixture(), p = join(s);
  hold(p, makeStack(FISHING_ROD, 1)); p.pitch = 0.3;
  s.fishing.use(p);
  const fishing = s.fishing.byPlayer.get(p.id); fishing.hook.ticksCatchable = 5; fishing.hook.inGround = false;
  const before = s.items.items.length, orbs = s.serverItems.xp.orbs.length;
  s.fishing.use(p);
  assert.equal(s.items.items.length, before + 1);
  const stack = s.items.items.at(-1).stack;
  assert.ok(stack.id !== 349 && stack.id > 0, 'a live id, not the native 349');
  assert.ok(s.serverItems.xp.orbs.length > orbs);
  assert.equal(p.survival.held.damage, 1);
  const caught = p.stats.get(STAT.fishCaught) + p.stats.get(STAT.junkFished) + p.stats.get(STAT.treasureFished);
  assert.equal(caught, 1);
});

test('Creative anglers lose no durability and the hook dies with the rod put away', () => {
  const s = fixture(false, 'creative'), p = join(s);
  hold(p, makeStack(FISHING_ROD, 1)); p.pitch = 0.3;
  s.fishing.use(p);
  const fishing = s.fishing.byPlayer.get(p.id); fishing.hook.ticksCatchable = 5; fishing.hook.inGround = false;
  s.fishing.use(p);
  assert.equal(p.survival.held.damage ?? 0, 0);
  s.fishing.use(p);
  p.survival.inventory.main[0] = null;
  s.tick();
  assert.equal(s.fishing.hookOf(p), null);
});

test('a hook leaves with its angler', () => {
  const s = fixture(), p = join(s);
  hold(p, makeStack(FISHING_ROD, 1)); p.pitch = 0.3;
  s.fishing.use(p);
  s.removePlayer('a');
  assert.equal(s.fishing.byPlayer.size, 0);
});

test('RemoteFishing keeps stable rows, interpolates from the last place and spawns the particles', () => {
  const seen = [], r = new RemoteFishing({ particle: (...a) => seen.push(a) });
  r.apply({ type: 'fishHooks', hooks: [{ o: 'a', i: 7, x: 1, y: 2, z: 3 }] });
  r.apply({ type: 'fishHooks', hooks: [{ o: 'a', i: 7, x: 2, y: 2, z: 3 }, { o: 'b', i: 8, x: 5, y: 5, z: 5 }] });
  assert.equal(r.rows.length, 2);
  assert.equal(r.own('a').px, 1); assert.equal(r.own('a').x, 2);
  assert.equal(r.others('a').length, 1);
  r.apply({ type: 'fishFx', events: [{ n: 'splash', x: 1, y: 2, z: 3, vx: 0.1, vy: 0.2, vz: 0 }, { n: 5, x: 1, y: 1, z: 1 }] });
  assert.equal(seen.length, 1);
  r.apply({ type: 'fishHooks', hooks: [] });
  assert.equal(r.rows.length, 0);
});

test('fishing loot maps native ids to this build and keeps enchantments and wear', () => {
  assert.notEqual(liveFishStack({ id: 349, count: 1, damage: 1 }).id, 349);
  const rod = liveFishStack({ id: 346, count: 1, damage: 20, enchantments: [{ id: 61, lvl: 2 }] });
  assert.equal(rod.id, FISHING_ROD); assert.equal(rod.damage, 20); assert.equal(rod.enchantments.length, 1);
});

test('damageDealt is round(f * 10) of the pre-armour damage of a landed hit, not the health lost', () => {
  const s = fixture(true), p = join(s);
  const z = s.mobs.mobs.create('zombie', 65.5, 10, 64.5); z.health = 0.5; s.mobs.mobs.entities.push(z); s.tick();
  s.queueAttack(p.id, Number(z.id.slice(4))); s.tick();
  assert.equal(p.stats.get(STAT.damageDealt), 10, 'a bare hand is 1 point: 10, though only 0.5 health was left');
});

test('a mob that dies later from something else credits the player who hit it in the last 100 ticks', () => {
  const s = fixture(true), p = join(s);
  const mk = x => { const z = s.mobs.mobs.create('cow', x, 10, 64.5); s.mobs.mobs.entities.push(z); return z; };
  const a = mk(65.5), b = mk(66.5); s.tick();
  s.queueAttack(p.id, Number(a.id.slice(4))); s.tick();
  s.queueAttack(p.id, Number(b.id.slice(4))); s.tick();
  assert.ok(a.recentlyHit > 0);
  s.mobs.mobs.kill(a);
  assert.equal(p.stats.get(STAT.mobKills), 1);
  assert.equal(p.stats.get('stat.killEntity.Cow'), 1);
  b.recentlyHit = 0; s.mobs.mobs.kill(b); // the window ran out
  assert.equal(p.stats.get(STAT.mobKills), 1);
});

const useCount = (p, needle) => [...p.stats.values.entries()].filter(([k]) => k.startsWith('stat.useItem') && k.includes(needle)).reduce((n, [, v]) => n + v, 0);

test('seeds planted on farmland, a spawn egg and flint and steel count the use stat', () => {
  const s = fixture(true), p = join(s);
  s.world.put(64, 9, 64, 30, 7, false); // farmland (this build's id)
  p.pitch = -1.5; s.input(p.id, input({ pitch: -1.5 }));
  hold(p, makeStack(309, 3));
  assert.equal(s.edit(p, true), true);
  assert.equal(s.world.get(64, 10, 64), 31); // the seeds' crop block
  assert.equal(p.survival.held.count, 2);
  assert.equal(p.stats.get('stat.useItem.295'), 1);
  hold(p, makeStack(1950, 2, 90)); // pig egg
  const mobs = s.mobs.mobs.entities.length;
  assert.equal(s.edit(p, true), true);
  assert.equal(s.mobs.mobs.entities.length, mobs + 1);
  assert.equal(p.survival.held.count, 1);
  assert.equal(p.stats.get('stat.useItem.383'), 1);
});

test('flint and steel counts the use stat', () => {
  const s = fixture(), p = join(s), flint = Object.keys(ITEMS).map(Number).find(id => ITEMS[id].kind === 'flint_and_steel');
  p.pitch = -1.5; hold(p, makeStack(flint, 1));
  assert.equal(s.edit(p, true), true);
  assert.equal(p.stats.get('stat.useItem.259'), 1);
  assert.equal(p.survival.held.damage, 1);
});
