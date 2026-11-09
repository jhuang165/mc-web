// The guns mod's inventory actions on a gun server (gun-simulation.js gun): attachments, the gun smith and ammo boxes run on
// the server's copy, and the tab's prediction (remote-inventory.js gun) is replayed until the server acknowledges it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { RemoteInventory } from './multiplayer/remote-inventory.js';
import { PlayerInventory, makeStack } from './inventory.js';
import { ITEMS } from './survival.js';
import { AKM, GUNS, ATTACHMENTS, GUN_SMITH } from './mods/guns/catalog.js';
import { taczAttachment } from './mods/guns/fit.js';
import { fitFromInventory } from './mods/guns/attachment-screen.js';
import { gunSmithRecipes } from './mods/guns/install.js';
import { AMMO_BOX_IRON, boxContents } from './mods/guns/ammo-box.js';
import { TACZ_ATTACHMENT_IDS } from './mods/guns/ids.js';
import { installGunRules } from '../server/pack-loader.js';

await installGunRules(); // the built-in guns, no pack directory
const SCOPE = taczAttachment(Object.keys(TACZ_ATTACHMENT_IDS).find(n => n.startsWith('scope_')), {
  index: { type: 'scope', name: 'n.scope' }, data: {}, display: { sounds: { install: 'tacz:attach_scope' } } }, { 'n.scope': 'Test Scope' });

function withScope(fn) {
  const ak = GUNS[AKM], saved = ak.attachments;
  ATTACHMENTS[SCOPE.id] = SCOPE; ak.attachments = new Set([SCOPE.key]);
  const item = ITEMS[SCOPE.id];
  ITEMS[SCOPE.id] ??= { name: 'Test Scope', stack: 1 }; // install.js registers a pack's parts as items
  try { return fn(); } finally { delete ATTACHMENTS[SCOPE.id]; ak.attachments = saved; if (!item) delete ITEMS[SCOPE.id]; }
}
function arena() {
  const world = new World('guns-actions');
  for (let x = 50; x <= 80; x++) for (let z = 55; z <= 75; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new GunSimulation({}, { world, config: { spawnProtection: 0 } });
  const p = sim.addPlayer('a', 'Alice', '00000000-0000-4000-8000-000000000001');
  p.survival.mode = 'survival'; p.survival.inventory.creative = false;
  p.survival.inventory.main.fill(null);
  return { sim, p, inv: p.survival.inventory };
}

test('a gun server fits and removes attachments on the slot the tab names, and acknowledges the action', () => withScope(() => {
  const { sim, p, inv } = arena();
  inv.main[2] = makeStack(AKM, 1, 0); inv.main[10] = makeStack(SCOPE.id, 1);
  assert.equal(sim.gun('a', { op: 'fit', slot: 2, part: 'scope', attachment: SCOPE.id, seq: 4 }), true);
  assert.equal(inv.main[2].modTag.attachments.scope, SCOPE.id);
  assert.equal(inv.main[10], null, 'the part came out of the inventory');
  assert.equal(sim.you(p).ack, 4);
  // Nothing left to fit: refused quietly, still acknowledged.
  assert.equal(sim.gun('a', { op: 'fit', slot: 2, part: 'scope', attachment: SCOPE.id, seq: 5 }), true);
  assert.equal(p.clickAck, 5);
  sim.gun('a', { op: 'fit', slot: 2, part: 'scope', attachment: null, seq: 6 });
  assert.equal(inv.main[2].modTag?.attachments?.scope, undefined);
  assert.equal(inv.main.filter(s => s?.id === SCOPE.id).length, 1, 'the part went back');
  // A full inventory: the part taken off is thrown.
  sim.gun('a', { op: 'fit', slot: 2, part: 'scope', attachment: SCOPE.id, seq: 7 });
  for (let i = 0; i < 36; i++) inv.main[i] ??= makeStack(3, 64);
  const before = sim.play.items.items.length;
  sim.gun('a', { op: 'fit', slot: 2, part: 'scope', attachment: null, seq: 8 });
  assert.equal(sim.play.items.items.length, before + 1);
  // Malformed messages.
  for (const bad of [{ op: 'fit', slot: 9, part: 'scope', attachment: null, seq: 9 }, { op: 'fit', slot: 2, part: 'bayonet', attachment: null, seq: 9 },
    { op: 'fit', slot: 2, part: 'muzzle', attachment: SCOPE.id, seq: 9 }, { op: 'nope', slot: 0, seq: 9 }, { op: 'fit', slot: 2, part: 'scope', attachment: null }])
    assert.equal(sim.gun('a', bad), false, JSON.stringify(bad));
}));

test('the gun smith crafts on the server only while the named slot holds a gun smith table; ammo boxes fill and empty', () => {
  const { sim, inv } = arena();
  const recipes = gunSmithRecipes(), index = recipes.findIndex(r => r.materials.every(m => typeof m.item === 'number'));
  assert.ok(index >= 0, 'a recipe with plain item materials');
  const recipe = recipes[index];
  let at = 9;
  for (const m of recipe.materials) inv.main[at++] = makeStack(m.item, m.count, m.damage ?? 0);
  sim.gun('a', { op: 'smith', slot: 0, recipe: index, seq: 1 });
  assert.equal(inv.main.filter(s => s?.id === recipe.output).length, 0, 'no table in slot 0');
  inv.main[0] = makeStack(GUN_SMITH, 1);
  sim.gun('a', { op: 'smith', slot: 0, recipe: index, seq: 2 });
  assert.ok(inv.main.some(s => s?.id === recipe.output));
  assert.equal(sim.gun('a', { op: 'smith', slot: 0, recipe: recipes.length, seq: 3 }), false);

  const ammo = GUNS[AKM].ammo;
  inv.main.fill(null);
  inv.main[1] = makeStack(AMMO_BOX_IRON, 1); inv.main[20] = makeStack(ammo, 30);
  sim.gun('a', { op: 'box', slot: 1, empty: false, seq: 4 });
  assert.deepEqual(boxContents(inv.main[1]), { ammo, count: 30 });
  assert.equal(inv.main[20], null);
  sim.gun('a', { op: 'box', slot: 1, empty: true, seq: 5 });
  assert.equal(boxContents(inv.main[1]), null);
  assert.equal(inv.main.reduce((n, s) => n + (s?.id === ammo ? s.count : 0), 0), 30);
});

test('the tab predicts a gun action and replays it over server inventories until acknowledged', () => withScope(() => {
  const sent = [], remote = new RemoteInventory(m => sent.push(m));
  const inv = new PlayerInventory(ITEMS);
  inv.main[0] = makeStack(AKM, 1, 0); inv.main[5] = makeStack(SCOPE.id, 1);
  const apply = copy => fitFromInventory(copy.main, 0, 'scope', SCOPE).ok;
  assert.equal(remote.gun({ op: 'fit', slot: 0, part: 'scope', attachment: SCOPE.id }, apply, inv), true);
  assert.deepEqual(sent, [{ op: 'fit', slot: 0, part: 'scope', attachment: SCOPE.id, type: 'gun', seq: 1 }]);
  assert.equal(inv.main[0].modTag.attachments.scope, SCOPE.id);
  // A server inventory from before the action arrives: rebuilt, then the action replayed.
  inv.main[0] = makeStack(AKM, 1, 0); inv.main[5] = makeStack(SCOPE.id, 1);
  remote.restore(inv, null);
  assert.equal(inv.main[0].modTag.attachments.scope, SCOPE.id);
  assert.equal(inv.main[5], null);
  assert.equal(remote.acked(1), true);
  assert.equal(remote.pending.length, 0);
}));
