import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { makeStack } from './inventory.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { tickClientHealth } from './multiplayer/client-health.js';
import { stepRemoteHurt } from './multiplayer/remote-hurt.js';
import { Survival } from './survival.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function joined(count = 1) {
  const world = new World('mp-health2-b61');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' }), ps = [];
  for (let i = 0; i < count; i++) {
    const p = s.addPlayer('p' + i, 'Player' + i, key(i + 1));
    p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 });
    s.input('p' + i, input()); ps.push(p);
  }
  for (let i = 0; i < 3; i++) s.tick();
  for (const p of ps) p.survival.protection = 0;
  return { s, ps };
}

test('a blow that lands after the players tick (a mob) kills in its own tick', () => {
  const { s, ps: [a] } = joined();
  const real = s.mobs.tick.bind(s.mobs);
  s.mobs.tick = () => { s.damagePlayer(a, 50, undefined); real(); };
  s.tick();
  assert.equal(a.dead, true);
  assert.equal(s.events.filter(e => e.type === 'death').length, 1);
  assert.equal(s.serverSurvival.outgoing(a).some(m => m.type === 'healthHurt' && m.die), true);
});

test('another player hears the hurt sound (S29 except the victim); death plays the death sound instead', () => {
  const { s, ps: [a, b] } = joined(2);
  s.damagePlayer(a, 3, undefined); s.tick();
  assert.deepEqual((b.soundsOut ?? []).map(x => x.name), ['game.player.hurt']);
  assert.equal(a.soundsOut?.length ?? 0, 0);
  const sound = b.soundsOut[0];
  assert.equal(sound.volume, 1);
  assert.ok(sound.pitch >= 0.8 && sound.pitch <= 1.2);
  b.soundsOut = null;
  a.survival.hurtTicks = 0; s.damagePlayer(a, 50, undefined); s.tick();
  assert.deepEqual((b.soundsOut ?? []).map(x => x.name), ['game.player.die']);
});

test('presence carries hurt for the tick of a fresh hit only', () => {
  const { s, ps: [a] } = joined(2);
  s.damagePlayer(a, 3, undefined);
  const first = s.tick().players.find(p => p.id === 'p0');
  assert.equal(first.hurt, true);
  s.serverSurvival.outgoing(a);
  assert.equal(s.tick().players.find(p => p.id === 'p0').hurt, undefined);
});

test('remote copy: status 2 sets limbSwingAmount 1.5 and a tint for 9 ticks', () => {
  const entry = {}, body = { limbSwingAmount: 0 };
  assert.equal(stepRemoteHurt(entry, true, body), true);
  assert.equal(body.limbSwingAmount, 1.5);
  let tinted = 1;
  while (stepRemoteHurt(entry, false, body)) tinted++;
  assert.equal(tinted, 9);
  assert.equal(stepRemoteHurt(entry, false, body), false);
});

test('saved players carry ActiveEffects (HashMap order) and the absorption amount', () => {
  const { s, ps: [a] } = joined();
  const e = a.survival.effects;
  e.player = a.survival;
  e.add({ id: 19, duration: 300, amplifier: 1 }); e.add({ id: 1, duration: 900, amplifier: 0, ambient: true }); e.add({ id: 22, duration: 600, amplifier: 0 });
  const saved = JSON.parse(JSON.stringify(s.savePlayer(a)));
  assert.deepEqual(saved.player.effects.map(x => x.id), [1, 19, 22]);
  assert.equal(saved.player.absorption, 4);
  const back = new Survival(saved.player, 'survival');
  assert.deepEqual(back.effects.serialize(), saved.player.effects);
  assert.equal(back.absorption, 4);
  s.removePlayer('p0');
  const again = s.addPlayer('p0', 'Player0', key(1));
  assert.deepEqual(again.survival.effects.serialize().map(x => [x.id, x.duration, x.amplifier]), [[1, 900, 0], [19, 300, 1], [22, 600, 0]]);
});

test('the S1D burst walks the effects in HashMap order on the first call and again after resendEffects', () => {
  const { s, ps: [a] } = joined();
  const sv = s.serverSurvival;
  a.vitals.effects = undefined;
  a.survival.effects.add({ id: 19, duration: 300, amplifier: 0 }); a.survival.effects.add({ id: 1, duration: 300, amplifier: 0 }); a.survival.effects.add({ id: 8, duration: 300, amplifier: 0 });
  assert.deepEqual(sv.outgoing(a).filter(m => m.type === 'healthEffect').map(m => m.id), [1, 19, 8]);
  assert.deepEqual(sv.outgoing(a), []);
  sv.resendEffects(a);
  assert.deepEqual(sv.outgoing(a).map(m => m.id), [1, 19, 8]);
});

test('death keeps the cursor and the 2x2 grid; the respawn discards them without a drop', () => {
  const { s, ps: [a] } = joined();
  const win = s.serverItems.inv.win(a), inv = a.survival.inventory;
  inv.cursor = makeStack(4, 12); win.container.grid.stacks[0] = makeStack(5, 3);
  const before = s.items.items.length;
  s.damagePlayer(a, 50, undefined); s.tick();
  assert.equal(a.dead, true);
  assert.equal(inv.cursor.count, 12);
  assert.ok(win.container.grid.stacks[0]);
  assert.equal(s.items.items.filter(e => e.stack?.id === 4 || e.stack?.id === 5).length, 0);
  assert.ok(s.serverSurvival.respawn(a));
  assert.equal(inv.cursor, null);
  assert.ok(win.container.grid.stacks.every(x => !x));
  assert.equal(s.items.items.filter(e => e.stack?.id === 4 || e.stack?.id === 5).length, 0);
  assert.ok(before >= 0);
});

test('client: performEffect is a no-op for health (EntityPlayerSP.heal is empty, attackEntityFrom returns false on a remote world)', () => {
  const sv = new Survival({ health: 10, effects: [{ id: 10, duration: 200, amplifier: 4 }, { id: 19, duration: 200, amplifier: 4 }, { id: 20, duration: 200, amplifier: 4 }] }, 'survival');
  for (let i = 0; i < 100; i++) tickClientHealth(sv);
  assert.equal(sv.health, 10);
  assert.equal(sv.effects.get(10).duration, 100);
});
