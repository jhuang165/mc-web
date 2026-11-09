import test from 'node:test';
import assert from 'node:assert/strict';
import { UseHold } from './use-hold.js';
import { Survival, ITEMS } from './survival.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { tickPlayerItemUse } from './player-item-use.js';

test('holding use eats successive items through normal right-click dispatch and stops at a full hunger bar or empty stack', () => {
  for (const food of [10, 19]) {
    const survival = new Survival({ food, slots: [{ id: 318, count: 3, damage: 0 }] }, 'survival');
    const state = { screen: 'playing', world: { get: () => 0 }, survival, motion: {}, eating: null };
    const hold = new UseHold();
    let swings = 0, completions = 0, saves = 0;
    const use = () => { state.heldTool = survival.held?.id ?? 0; applyPlayerEdit(state, { place: true }, { swing: () => swings++ }); };
    hold.press(); use();
    for (let i = 0; i < 140; i++) {
      const result = tickPlayerItemUse(state.eating, survival.held?.id ?? 0, survival, { markUnsaved: () => saves++ });
      state.eating = result.use;
      if (result.completed) completions++;
      const id = survival.held?.id ?? 0;
      if (hold.tick(true, !!state.eating, !!ITEMS[id]?.food)) use();
    }
    assert.equal(completions, food === 10 ? 3 : 1);
    assert.equal(saves, completions);
    assert.equal(survival.count(318), food === 10 ? 0 : 2);
    assert.equal(swings, 0);
  }
});

test('held use waits four ticks, never interrupts an active use and stops retrying on release', () => {
  const hold = new UseHold(); hold.press();
  assert.deepEqual(Array.from({ length: 4 }, () => hold.tick(true, false)), [false, false, false, true]);
  assert.ok(Array.from({ length: 40 }, () => hold.tick(true, true)).every((v) => !v));
  assert.equal(hold.tick(true, false), true);
  assert.equal(hold.tick(false, false), false);
  assert.equal(hold.tick(false, false), false);
  assert.equal(hold.tick(true, false, false), false);
});
