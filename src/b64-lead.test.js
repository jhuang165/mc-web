// Batch 64 lead: joins between the batch's tracks. The dragon's killing blow (mpdragon) runs the server's onDeath chain, so the attacker gets mobKills (mpstats2's credit),
// killEnemy and the scoreboard's totalKillCount (mpscoreboard). EntityDragon.func_82195_e is super.attackEntityFrom (recalled from the 1.7.10 source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { STAT } from './stats.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const wire = e => Number(String(e.id).replace(/^mob-/, ''));

test('the blow that kills the dragon credits mobKills, killEnemy and totalKillCount to the attacker; damage before it does not', { timeout: 120000 }, () => {
  const world = new World('b64-lead-dragon');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, 1);
  const end = s.dimensions.end.n, mobs = end.mobs.mobs;
  const board = s.scoreboard, tk = board.addObjective('tk', 'totalKillCount');
  for (let i = 0; i < 2; i++) { s.input('a', input()); s.tick(); }
  const d = mobs.entities.find(e => e.type === 'ender_dragon'), head = d.dragon.parts[0].box;
  const aim = () => { a.position.copy({ x: (head[0] + head[3]) / 2 + 2, y: head[1] - 1.6, z: (head[2] + head[5]) / 2 }); a.previous.copy(a.position); };
  s.events = [];
  aim();
  assert.equal(end.mobs.attack(a, wire(d)), true);
  assert.ok(d.health > 0);
  assert.equal(a.stats.get(STAT.mobKills), 0, 'a hit that leaves health is no kill');
  d.health = 0.5; d.hurtResist = 0; d.lastDamage = 0;
  aim();
  assert.equal(end.mobs.attack(a, wire(d)), true);
  assert.ok(d.health <= 0);
  assert.equal(a.stats.get(STAT.mobKills), 1);
  assert.equal(board.peek('Alice', tk)?.value, 1);
  assert.ok(s.events.some(ev => ev.type === 'award' && ev.id === a.id && ev.achievement === 'killEnemy'), 'killEnemy');
  // a dead dragon takes no more blows (adapter: health <= 0 refuses), so the kill is counted once
  aim();
  end.mobs.attack(a, wire(d));
  assert.equal(a.stats.get(STAT.mobKills), 1);
});
