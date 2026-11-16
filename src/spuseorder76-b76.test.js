// b76 spuseorder76: Minecraft.rightClickMouse tries the clicked entity first (interactWithEntitySendPacket); only a declined
// click (or a miss) reaches the held item's onItemRightClick. Evidence: bytecode-read of bao (Minecraft) method rightClickMouse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival } from './survival.js';
import { makeStack } from './inventory.js';
import { BOW } from './bow.js';
import { BUCKET, MILK_BUCKET } from './buckets.js';
import { FISHING_ROD } from './fishing-content.js';
import { ITEM_WRITABLE_BOOK } from './books.js';
import { ITEM_POTION } from './potion-use.js';
import { applyPlayerEdit } from './player-edit-simulation.js';
import { capturePlayerAction, dispatchPlayerAction } from './player-actions.js';
import { applyHangingEdit } from './hanging-interaction.js';

const none = () => false;
function mobsStub(claims = {}) {
  return { leashInteract: none, saddleUse: none, spawnEggBaby: none, cure: none, wolfInteract: none, ocelotInteract: none,
    mooshroomInteract: none, horseInteract: none, nameTagUse: none, shear: none, feed: none, dye: none, entities: [], ...claims };
}
function scene(tool, entity, { mode = 'survival', claims = {}, damage = 0 } = {}) {
  const survival = new Survival({ food: 10, slots: [makeStack(tool, 1, damage)] }, mode);
  const state = { screen: 'playing', heldTool: tool, world: new World('spuseorder76'), survival, position: { x: 0, y: 64, z: 0 },
    motion: { sneaking: false }, mobs: mobsStub(claims), eating: null, mining: null, yaw: 0, pitch: 0, grounded: true, fallDistance: 0, wasInWater: false };
  state.mobs.entities.push(entity);
  return { state, request: { place: true, target: null, aimedEntity: { entity } } };
}
const run = (s, hooks = {}) => applyPlayerEdit(s.state, s.request, hooks);
const cow = () => ({ id: 'mob-1', type: 'cow', health: 10 });

test('bow at a cow: an entity that takes the click prevents the draw; a declined click draws', () => {
  const taken = scene(BOW, cow(), { mode: 'creative', claims: { nameTagUse: () => true } });
  assert.equal(run(taken).branch, 'name-entity');
  assert.equal(taken.state.eating, null);
  const declined = scene(BOW, cow(), { mode: 'creative' });
  assert.equal(run(declined).branch, 'begin-bow-use');
  assert.deepEqual(declined.state.eating, { id: BOW, ticks: 0, bow: true });
});

test('empty bucket at a cow milks it before any fluid trace; Creative falls through to the item', () => {
  const s = scene(BUCKET, cow());
  const r = run(s, { renderHotbar() {}, markUnsaved() {} });
  assert.deepEqual(r, { handled: true, branch: 'use-bucket', bucket: 'milk-cow' });
  assert.equal(s.state.survival.held.id, MILK_BUCKET);
  const c = scene(BUCKET, cow(), { mode: 'creative' });
  assert.equal(run(c).bucket, 'invalid-bucket-target'); // the cow gives nothing in Creative; the item's own (trace-less) use follows
  assert.equal(c.state.survival.held.id, BUCKET);
  const dead = scene(BUCKET, { ...cow(), health: 0 });
  assert.equal(run(dead).bucket, 'invalid-bucket-target');
});

test('milk bucket at a cow still starts the drink (cows only take the empty bucket)', () => {
  const s = scene(MILK_BUCKET, cow());
  assert.equal(run(s).bucket, 'begin-drinking');
  assert.equal(s.state.eating.id, MILK_BUCKET);
});

test('fishing rod at a sheep: shearing-style interaction first, the cast only when declined', () => {
  const sheep = { id: 'mob-2', type: 'sheep', health: 8 };
  const taken = scene(FISHING_ROD, sheep, { claims: { nameTagUse: () => true } });
  let cast = 0;
  assert.equal(run(taken, { useFishingRod: () => { cast++; } }).branch, 'name-entity');
  assert.equal(cast, 0);
  const declined = scene(FISHING_ROD, sheep);
  assert.equal(run(declined, { useFishingRod: () => { cast++; return 'cast'; } }).branch, 'use-fishing-rod');
  assert.equal(cast, 1);
});

test('potion at a villager: the trade window opens first, neither drunk nor thrown', () => {
  const villager = { id: 'mob-3', type: 'villager', health: 20 };
  for (const damage of [0, 16384]) {
    const s = scene(ITEM_POTION, villager, { damage });
    let thrown = 0;
    s.state.mobs.potions = { throwFromPlayer: () => { thrown++; } };
    const r = run(s, { openMerchant: () => true });
    assert.equal(r.branch, 'trade-villager');
    assert.equal(s.state.eating, null);
    assert.equal(thrown, 0);
    assert.equal(s.state.survival.held.count, 1);
  }
  // A busy villager (openMerchant false) declines: the potion is drunk.
  const busy = scene(ITEM_POTION, villager);
  assert.equal(run(busy, { openMerchant: () => false }).branch, 'use-potion');
  assert.equal(busy.state.eating.id, ITEM_POTION);
});

test('written book at an item frame goes into the frame; at a painting the book opens', () => {
  const survival = new Survival({ food: 10, slots: [makeStack(ITEM_WRITABLE_BOOK, 1)] }, 'survival');
  const frame = { kind: 'frame', item: null, rotation: 0, dead: false };
  const hanging = { interact: (e, held) => { if (e.kind !== 'frame') return { action: null }; e.item = { ...held, count: 1 }; return { action: 'insert' }; } };
  const calls = [];
  assert.equal(applyHangingEdit({ hanging, survival, heldId: ITEM_WRITABLE_BOOK, place: true, target: null, aimed: { entity: frame } },
    { swing: () => calls.push('swing') }), true);
  assert.equal(frame.item.id, ITEM_WRITABLE_BOOK);
  assert.equal(survival.held, null);
  // EntityPainting has no interactFirst: the click is declined (no swing, nothing consumed) and the held item goes on.
  const survival2 = new Survival({ food: 10, slots: [makeStack(ITEM_WRITABLE_BOOK, 1)] }, 'survival');
  const painting = { kind: 'painting', dead: false };
  const swings = [];
  assert.equal(applyHangingEdit({ hanging, survival: survival2, heldId: ITEM_WRITABLE_BOOK, place: true, target: null, aimed: { entity: painting } },
    { swing: () => swings.push(1) }), false);
  assert.deepEqual(swings, []);
  assert.equal(survival2.held.count, 1);
  const open = scene(ITEM_WRITABLE_BOOK, null);
  open.state.mobs.entities.length = 0;
  open.request.aimedEntity = null;
  let opened = 0;
  assert.equal(run(open, { openBook: () => { opened++; } }).branch, 'open-book');
  assert.equal(opened, 1);
});

test('captured clicks over a live entity use the same order, and left-click attacks are untouched', () => {
  const entity = cow();
  const s = scene(BOW, entity, { mode: 'creative', claims: { nameTagUse: () => true } });
  const action = capturePlayerAction({ place: true, target: null, aimedEntity: { entity }, heldTool: BOW });
  assert.equal(dispatchPlayerAction(s.state, action, {}).branch, 'name-entity');
  assert.equal(s.state.eating, null);
});

test('food and swords at an entity still begin their use after the entity declines', () => {
  const s = scene(200 /* apple */, cow());
  s.state.survival.food = 10;
  assert.equal(run(s).branch, 'interact-entity');
  assert.equal(s.state.eating?.id, 200);
});

test('a sound-less feed claim keeps the stack rule: entity result swings once for non-food', () => {
  const s = scene(BOW, cow(), { mode: 'creative', claims: { feed: () => true } });
  let swings = 0;
  assert.equal(run(s, { swing: () => swings++ }).branch, 'interact-entity');
  assert.equal(swings, 1);
});
