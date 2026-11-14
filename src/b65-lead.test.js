// Batch 65 lead: S19 status 9. EntityPlayerMP.onItemUseFinish (mw.p, bytecode-read) sends `new S19PacketEntityStatus(this, 9)` to the eater's own connection before
// EntityPlayer.onItemUseFinish runs; the client's handleHealthUpdate(9) runs its own onItemUseFinish: updateItemUse(16) and clearItemInUse. mpuse2 made a predicted
// use run on until the S2F; this ends it at the server's finish, with the 16-crumb burst the client never plays by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { makeStack } from './inventory.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { DedicatedClient } from './multiplayer/client.js';
import { finishPredictedUse, predictUse } from './multiplayer/client-use-predict.js';
import { tickPlayerItemUse } from './player-item-use.js';
import { ITEMS } from './survival.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const food = Object.keys(ITEMS).map(Number).find(id => ITEMS[id].food && !ITEMS[id].alwaysEdible);

test('a finished eat sends useDone to the eater alone, ahead of the S2F of the eaten stack', { timeout: 60000 }, () => {
  const world = new World('b65-lead-usedone');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'Eater', key(1)), b = s.addPlayer('b', 'Watcher', key(2));
  for (const id of ['a', 'b']) s.input(id, input());
  for (let i = 0; i < 3; i++) s.tick();
  a.itemsOut = null; b.itemsOut = null;
  a.survival.inventory.main[0] = makeStack(food, 2, 0); a.survival.inventory.current = 0; a.survival.food = 10;
  assert.equal(s.handleUse(a, true), true);
  const got = [];
  for (let i = 0; i < 40 && !got.some(m => m.type === 'useDone'); i++) {
    s.input('a', input()); s.input('b', input()); s.tick();
    got.push(...(a.itemsOut ?? []).map(m => ({ ...m, tick: i })));
    assert.ok(!(b.itemsOut ?? []).some(m => m.type === 'useDone'), 'S19 status 9 goes to the eater only');
    a.itemsOut = null; b.itemsOut = null;
  }
  const done = got.findIndex(m => m.type === 'useDone');
  assert.ok(done >= 0, 'useDone sent');
  assert.equal(got[done].id, food);
  assert.equal(a.itemInUse, null);
  // in the finishing tick no S2F of the held slot comes ahead of it (the earlier ones are the sync of the stack this test put there)
  assert.ok(!got.slice(0, done).some(m => m.tick === got[done].tick && m.type === 'slot' && m.slots.some(c => c.slot === 0)), 'the S2F of the eaten stack follows');
  assert.equal(a.survival.inventory.main[0]?.count, 1, 'one eaten');
});

test('the client routes useDone in order, and finishing a predicted use plays the onItemUseFinish burst then clears it', () => {
  const seen = [];
  const c = new DedicatedClient({ onSlot: () => seen.push('slot') });
  c.onUseDone = () => seen.push('useDone');
  c.buffer({ type: 'useDone', id: food }); c.buffer({ type: 'slot', slots: [] });
  c.start();
  assert.deepEqual(seen, ['useDone', 'slot']);
  // food: updateItemUse(16), the crumbs and random.eat (eatEffects)
  const fake = { creative: false, food: 10, usable: () => true };
  let use = predictUse({ id: food }, fake);
  for (let i = 0; i < 31; i++) use = tickPlayerItemUse(use, food, fake, { predicted: true }).use;
  const fx = [];
  assert.equal(finishPredictedUse(use, { foodEffects: (id, n) => fx.push([id, n]), sound: n => fx.push(n) }), null);
  assert.deepEqual(fx, [[food, 16]]);
  // drink: one random.drink
  const snd = [];
  assert.equal(finishPredictedUse({ id: 335, ticks: 1, drink: true }, { sound: (n, o) => snd.push([n, o.volume]), random: () => 0.5 }), null);
  assert.deepEqual(snd, [['random.drink', 0.5]]);
  // a bow draw or a sword block is never finished by status 9 (it has no count to run out)
  const bow = { id: 261, ticks: 7, bow: true };
  assert.equal(finishPredictedUse(bow), bow);
  assert.equal(finishPredictedUse(null), null);
});
