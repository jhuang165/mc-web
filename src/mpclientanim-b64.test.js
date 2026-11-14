// Batch 64 mpclientanim: a connected client's own eat / drink / block prediction, and the PvP victim and overkill paths on the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { makeStack } from './inventory.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { predictUse } from './multiplayer/client-use-predict.js';
import { tickPlayerItemUse } from './player-item-use.js';
import { applyHurtMessage } from './multiplayer/client-health.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ITEMS } from './survival.js';
import { BOW } from './bow.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const food = Object.keys(ITEMS).map(Number).find(id => ITEMS[id].food && !ITEMS[id].alwaysEdible);
const fake = (over = {}) => ({ creative: false, food: 10, usable: () => true, count: () => 1, eat: () => { throw new Error('predicted eat applied'); }, ...over });

test('predictUse: food needs hunger and is not Creative, sword blocks, potion drinks, splash and an empty bow start nothing', () => {
  assert.deepEqual(predictUse({ id: food }, fake()), { id: food, ticks: 32 });
  assert.equal(predictUse({ id: food }, fake({ food: 20 })), null);
  assert.equal(predictUse({ id: food }, fake({ creative: true })), null);
  assert.equal(predictUse({ id: 343 }, fake({ food: 20 })).drink, true);
  const sword = Object.keys(ITEMS).map(Number).find(id => ITEMS[id].kind === 'sword');
  assert.deepEqual(predictUse({ id: sword }, fake()), { id: sword, ticks: 72000, block: true });
  assert.equal(predictUse(null, fake()), null);
});

test('a predicted eat shows the crumbs at 24..0 and never eats or burps; a predicted drink sounds but applies nothing (b65: it no longer ends at count 0, see mpuse2-b65.test.js)', () => {
  let use = { id: food, ticks: 32 };
  const crumbs = [], sounds = [], s = fake();
  for (let i = 0; i < 33 && use; i++) use = tickPlayerItemUse(use, food, s, { predicted: true, foodEffects: (id, n) => crumbs.push(n), sound: n => sounds.push(n) }).use;
  assert.ok(use, 'the client never finishes the use itself (EntityPlayer.onUpdate: !world.isRemote)');
  assert.deepEqual(crumbs, [5, 5, 5, 5, 5, 5, 5]);
  assert.deepEqual(sounds, [], 'the burp comes from the server');
  let drink = { id: 343, ticks: 32, drink: true }, finished = 0; const dsounds = [];
  for (let i = 0; i < 33 && drink; i++) drink = tickPlayerItemUse(drink, 343, s, { predicted: true, finishDrinking: () => { finished++; return true; }, sound: n => dsounds.push(n) }).use;
  assert.ok(drink);
  assert.equal(finished, 0);
  assert.equal(dsounds.at(-1), 'random.drink');
  assert.equal(dsounds.length, 7, '24, 20, 16, 12, 8, 4 and 0');
});

function joined() {
  const world = new World('mp-clientanim-b64');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' }), ps = [];
  for (let i = 0; i < 2; i++) { const p = s.addPlayer('p' + i, i ? 'Victim' : 'Attacker', key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); s.input('p' + i, input()); ps.push(p); }
  for (let i = 0; i < 3; i++) s.tick();
  for (const p of ps) p.survival.protection = 0;
  return { s, ps };
}

test('a PvP hit reaches the victim client: S19 status 2 (hurtTime 10 for the camera tilt, hurt sound), the knockback, and the hurt flag in the other players\' presence', () => {
  const { s, ps: [a, v] } = joined();
  a.survival.inventory.main[0] = makeStack(115, 1, 0); a.survival.inventory.current = 0;
  assert.equal(s.queuePvpAttack('p0', 'p1'), true);
  s.tick();
  assert.equal(v.vitals?.hurt, true, 'queued for this tick\'s presence');
  s.tick(); // the knockback queue drains in the victim's next step
  const out = s.serverSurvival.outgoing(v), hurt = out.find(m => m.type === 'healthHurt');
  assert.ok(hurt?.hurt);
  const client = { hurtTime: 0, clientResist: 0, inventory: {} };
  assert.deepEqual(applyHurtMessage(client, null, hurt), ['game.player.hurt']);
  assert.equal(client.hurtTime, 10);
  assert.ok(v.velocity.x > 0 || v.position.x > 65.5, 'knocked away from the attacker');
});

test('overkill: a PvP hit of 18 or more awards it to the attacker; a plain sword hit does not', () => {
  const blow = amplifier => {
    const { s, ps: [a, v] } = joined();
    v.survival.health = 100;
    a.survival.inventory.main[0] = makeStack(115, 1, 0); a.survival.inventory.current = 0;
    if (amplifier >= 0) a.survival.effects.add({ id: 5, amplifier, duration: 600 });
    s.events = [];
    assert.equal(s.pvpRules.attack(a, 'p1'), true);
    return { damage: s.events.find(e => e.type === 'pvpHit').damage / 10, awards: s.events.filter(e => e.type === 'award' && e.achievement === 'overkill' && e.id === 'p0').length };
  };
  const small = blow(-1), big = blow(9);
  assert.ok(small.damage < 18 && big.damage >= 18, small.damage + ' / ' + big.damage);
  assert.equal(small.awards, 0);
  assert.equal(big.awards, 1);
});
