import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, RED_FLOWER, WOOL, YELLOW_FLOWER } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { Farming } from './farming.js';
import { makeStack } from './inventory.js';
import { BOW, canDraw } from './bow.js';
import { CHEST } from './chest.js';
import { EntityWorld } from './entities.js';
import { capturePlayerAction, dispatchPlayerAction } from './player-actions.js';

const reference = JSON.parse(readFileSync(new URL('./player-edit-port-reference.json', import.meta.url), 'utf8'));
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };

test('captured player edit is JSON-safe, detached from ray results, and resolves stable mob IDs live', () => {
  const entity = { id: 'mob-7', health: 10 }, wrapper = { entity, distance: 2 };
  const target = { block: [12, 19, 12], adjacent: [12, 20, 12], distance: 1.25 };
  const action = capturePlayerAction({ place: true, target, aimedEntity: wrapper, heldTool: WOOL });
  target.block[0] = 99;
  target.adjacent[1] = 99;
  entity.id = 'mob-99';
  assert.deepEqual(JSON.parse(JSON.stringify(action)), {
    version: 1, type: 'player-edit', place: true, heldTool: WOOL,
    target: { block: [12, 19, 12], adjacent: [12, 20, 12], distance: 1.25 },
    aimedEntity: { id: 'mob-7' },
  });
  assert.equal(Object.hasOwn(action.aimedEntity, 'entity'), false);

  const live = { id: 'mob-7', health: 8 }, calls = [];
  const state = { heldTool: WOOL, mobs: { entities: [live] } };
  const result = dispatchPlayerAction(state, JSON.parse(JSON.stringify(action)), {
    apply: (passedState, request) => {
      calls.push(['apply', passedState === state, request.aimedEntity.entity === live, request.target.block[0]]);
      return { handled: true, branch: 'observed' };
    },
  });
  assert.deepEqual(result, { handled: true, branch: 'observed' });
  assert.deepEqual(calls, [['apply', true, true, 12]]);

  const zeroId = { id: 'mob-0', health: 3 }, zeroAction = capturePlayerAction({ place: false, heldTool: WOOL, aimedEntity: { entity: zeroId } });
  const zeroResult = dispatchPlayerAction({ heldTool: WOOL, mobs: { entities: [zeroId] } }, zeroAction, {
    apply: (_state, request) => ({ handled: true, branch: request.aimedEntity.entity.id }),
  });
  assert.deepEqual(zeroResult, { handled: true, branch: 'mob-0' });
});

test('selected entity with absent, malformed, or stale ID is consumed without block fallback', () => {
  const state = { heldTool: WOOL, mobs: { entities: [] } };
  const invoke = aimedEntity => {
    const calls = [];
    const result = dispatchPlayerAction(state, {
      version: 1, type: 'player-edit', place: false, heldTool: WOOL,
      target: { block: [4, 7, 4], adjacent: [4, 8, 4] }, aimedEntity,
    }, { apply: () => { calls.push('called'); return { handled: true, branch: 'block-fallback' }; } });
    return { result, calls };
  };
  for (const id of [null, undefined, 'mob-404', 'not-an-entity-id']) {
    const { result, calls } = invoke(id === undefined ? {} : { id });
    assert.deepEqual(result, { handled: true, branch: 'missing-entity-target', skipped: true });
    assert.deepEqual(calls, []);
  }
  assert.deepEqual(dispatchPlayerAction(state, {
    version: 1, type: 'player-edit', place: true, heldTool: WOOL, target: null,
    aimedEntity: null,
  }, { apply: () => ({ handled: true, branch: 'none' }) }), { handled: true, branch: 'none' });
});

test('malformed non-null block targets fail closed during capture and dispatch', () => {
  assert.throws(() => capturePlayerAction({ place: true, heldTool: WOOL, target: { adjacent: [1, 2, 3] } }), TypeError);
  for (const target of [{ block: null }, { block: [1, 2] }, { block: [1, NaN, 3] }]) {
    const calls = [];
    const result = dispatchPlayerAction({ heldTool: WOOL }, {
      version: 1, type: 'player-edit', place: true, heldTool: WOOL, target, aimedEntity: null,
    }, { apply: () => calls.push('called') });
    assert.deepEqual(result, { handled: true, branch: 'invalid-player-action', skipped: true });
    assert.deepEqual(calls, []);
  }
});

test('repeated JSON-captured ItemBlock actions place immediately with real World and Survival state', () => {
  const run = () => {
    const world = new World('player-actions-placement', 'meadow', 1), survival = new Survival();
    const block = [10, 19, 10], adjacent = [10, 20, 10];
    world.set(...block, 1);
    survival.inventory.setStack(0, makeStack(WOOL, 3, 14));
    const state = {
      screen: 'playing', heldTool: WOOL, motion: { sneaking: false, sprinting: false },
      world, survival, position: { x: 30.5, y: 20, z: 30.5 }, velocity: { x: 0, y: 0, z: 0 },
      mobs: { entities: [] }, farming: new Farming(world), flowers: FLOWERS, yaw: 0,
      grounded: true, fallDistance: 0, wasInWater: false, eating: null, mining: null,
      mineCooldown: 0, mineHeld: false,
    };
    const action = JSON.parse(JSON.stringify(capturePlayerAction({
      place: true, target: { block, adjacent, distance: 1 }, heldTool: WOOL,
    })));
    const events = [];
    const result = dispatchPlayerAction(state, action, {
      collides: () => false,
      updateBlock: (...p) => events.push(['update', ...p]),
      renderHotbar: () => events.push(['hotbar']),
      sound: (...args) => events.push(['sound', ...args]),
      markUnsaved: () => events.push(['dirty']),
    });
    // The mutation has happened synchronously when dispatch returns.
    assert.equal(world.get(...adjacent), WOOL);
    return { result, world: world.get(...adjacent), meta: world.getMeta(...adjacent), count: survival.count(WOOL), events };
  };
  const first = run(), second = run();
  assert.deepEqual(first, second);
  assert.equal(first.result.branch, 'place-block');
  assert.equal(first.result.placement.placed, true);
  assert.equal(first.world, WOOL);
  assert.equal(first.meta, 14);
  assert.equal(first.count, 2);
  assert.deepEqual(first.events.map(e => e[0]), ['update', 'hotbar', 'sound', 'dirty']);

  const rollbackWorld = new World('player-actions-rollback', 'meadow', 1), rollbackPlayer = new Survival();
  const here = [14, 19, 14], occupied = [14, 20, 14];
  rollbackWorld.set(...here, 1);
  rollbackWorld.set(...occupied, WOOL, true, 6);
  rollbackPlayer.inventory.setStack(0, makeStack(WOOL, 3, 14));
  const rollbackState = {
    screen: 'playing', heldTool: WOOL, motion: { sneaking: false }, world: rollbackWorld,
    survival: rollbackPlayer, position: { x: 40.5, y: 20, z: 40.5 }, velocity: { x: 0, y: 0, z: 0 },
    mobs: { entities: [] }, farming: new Farming(rollbackWorld), flowers: FLOWERS, yaw: 0,
    grounded: true, fallDistance: 0, wasInWater: false, eating: null, mining: null,
    mineCooldown: 0, mineHeld: false,
  };
  const rollback = dispatchPlayerAction(rollbackState, capturePlayerAction({
    place: true, heldTool: WOOL, target: { block: here, adjacent: occupied },
  }), { collides: () => true });
  assert.equal(rollback.branch, 'placement-player-collision');
  assert.equal(rollbackWorld.get(...occupied), WOOL);
  assert.equal(rollbackWorld.getMeta(...occupied), 6);
  assert.equal(rollbackPlayer.count(WOOL), 3);
});

test('JSON-selected mob interaction resolves a real live creeper and applies immediately', () => {
  const world = new World('player-actions-creeper', 'meadow', 1), survival = new Survival();
  const toolId = Object.values(ITEMS).find(item => item.kind === 'flint_and_steel').id;
  survival.inventory.setStack(0, makeStack(toolId, 1, 0));
  const mobs = new EntityWorld(world, [], () => 0.5), creeper = mobs.create('creeper', 40, 20, 40);
  mobs.entities.push(creeper);
  const state = {
    screen: 'playing', heldTool: toolId, motion: { sneaking: false, sprinting: false }, world, survival,
    position: { x: 39, y: 20, z: 40 }, velocity: { x: 0, y: 0, z: 0 }, mobs,
    farming: new Farming(world), positionYaw: 0, grounded: true, fallDistance: 0, wasInWater: false,
    yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: false,
  };
  const action = JSON.parse(JSON.stringify(capturePlayerAction({ place: true, heldTool: toolId,
    aimedEntity: { entity: creeper } })));
  const calls = [];
  const result = dispatchPlayerAction(state, action, {
    random: () => 0.5,
    playSound: (name, options) => calls.push([name, options.position]),
    renderHotbar: () => calls.push(['hotbar']),
    markUnsaved: () => calls.push(['dirty']),
  });
  assert.equal(result.branch, 'ignite-creeper');
  assert.equal(creeper.ignited, true);
  assert.equal(survival.held.damage, 1);
  assert.deepEqual(calls.map(call => call[0]), ['fire.ignite', 'hotbar', 'dirty']);
});

test('captured action cannot replace authoritative held inventory; mismatched tool is consumed', () => {
  const state = { heldTool: BOW, survival: { inventory: { held: { id: BOW } } }, mobs: { entities: [] } };
  const action = capturePlayerAction({ place: true, heldTool: WOOL });
  let called = false;
  assert.deepEqual(dispatchPlayerAction(state, action, { apply: () => { called = true; } }),
    { handled: true, branch: 'held-item-mismatch', skipped: true });
  assert.equal(called, false);
  assert.equal(state.heldTool, BOW);

  // A stale snapshot cannot pass validation then make the real helper use a
  // different item than the live held inventory.
  const survival = new Survival();
  survival.inventory.setStack(0, makeStack(BOW));
  survival.inventory.setStack(1, makeStack(320, 2));
  const authoritative = {
    screen: 'playing', heldTool: WOOL, motion: { sneaking: false, sprinting: false },
    world: {}, survival, mobs: { entities: [] }, position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }, farming: {}, grounded: true,
    fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null,
    mineCooldown: 0, mineHeld: false,
  };
  const accepted = dispatchPlayerAction(authoritative, capturePlayerAction({ place: true, heldTool: BOW }));
  assert.deepEqual(accepted, { handled: true, branch: 'begin-bow-use' });
  assert.equal(authoritative.heldTool, BOW);
  assert.deepEqual(authoritative.eating, { id: BOW, ticks: 0, bow: true });
  assert.equal(survival.count(BOW), 1);
  assert.equal(survival.count(320), 2);
});

test('pinned main.js bow fast path keeps precedence and matches the extracted dispatcher', () => {
  assert.equal(reference.commit, '91fcbd4');
  assert.match(reference.blobSha256, /^[a-f0-9]{64}$/);
  const trace = [], oldSurvival = new Survival();
  oldSurvival.inventory.setStack(0, makeStack(BOW));
  oldSurvival.inventory.setStack(1, makeStack(320, 2));
  const bindings = {
    screen: 'playing', sounds: { unlock: () => trace.push('unlock') }, heldId: () => BOW,
    ITEMS, motion: { sneaking: false }, aimedEntity: null, target: null, world: {}, CHEST,
    survival: oldSurvival, BOW, canDraw,
  };
  const oldEdit = new Function(...Object.keys(bindings),
    `let eating = null; const edit = (${reference.functions.edit}); return { edit, getEating: () => eating };`)
    (...Object.values(bindings));
  oldEdit.edit(true);
  const nextSurvival = new Survival();
  nextSurvival.inventory.setStack(0, makeStack(BOW));
  nextSurvival.inventory.setStack(1, makeStack(320, 2));
  const state = {
    screen: 'playing', heldTool: BOW, motion: { sneaking: false, sprinting: false },
    world: {}, survival: nextSurvival, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    mobs: { entities: [] }, farming: {}, grounded: true, fallDistance: 0, wasInWater: false,
    eating: null, mining: null, mineCooldown: 0, mineHeld: false,
  };
  const newResult = dispatchPlayerAction(state, capturePlayerAction({ place: true, heldTool: BOW }));
  assert.deepEqual(trace, ['unlock']);
  assert.deepEqual(oldEdit.getEating(), { id: BOW, ticks: 0, bow: true });
  assert.deepEqual(newResult, { handled: true, branch: 'begin-bow-use' });
  assert.deepEqual(state.eating, oldEdit.getEating());
  assert.equal(oldSurvival.count(320), 2);
  assert.equal(nextSurvival.count(320), 2);
});
