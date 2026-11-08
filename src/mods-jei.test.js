// Recipe viewer mod (not 1.7.10): the item list, search, paging, history and the per-world switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS } from './survival.js';
import { SEARCH_ORDER } from './creative.js';
import { itemList, matches, pageCount, turnPage, ViewerState } from './mods/jei/model.js';
import { jeiWorld, jeiEnabled, setJeiEnabled } from './mods/jei/install.js';
import { worldMods, withWorldMod } from './mods/world-mods.js';
import { createWorldLayout } from './menu-screens.js';

test('the item list holds every registered item once, the creative subtypes included', () => {
  const list = itemList();
  const keys = list.map((s) => `${s.id}:${s.damage | 0}:${s.stored ? JSON.stringify(s.stored) : ''}`);
  assert.equal(new Set(keys).size, keys.length);
  const ids = new Set(list.map((s) => s.id));
  for (const [id, item] of Object.entries(ITEMS)) if (+id && !item.hidden && !item.reserved) assert.ok(ids.has(+id), `item ${id} ${item.name}`);
  for (const e of SEARCH_ORDER) {
    const [id, d = 0] = Array.isArray(e) ? e : [e];
    if (ITEMS[id]) assert.ok(list.some((s) => s.id === id && (s.damage | 0) === d), `search entry ${id}:${d}`);
  }
  assert.ok(list.every((s) => s.count === 1));
});

test('search needs every word in the name, in any order, ignoring case', () => {
  assert.ok(matches('Iron Pickaxe', 'pick IRON'));
  assert.ok(matches('Iron Pickaxe', '  '));
  assert.ok(!matches('Iron Pickaxe', 'gold pick'));
  const v = new ViewerState();
  v.setQuery('pickaxe');
  const found = v.filtered();
  assert.ok(found.length >= 5 && found.every((s) => /pickaxe/i.test(v.name(s))));
  v.setQuery('');
  assert.equal(v.filtered().length, v.all().length);
});

test('paging wraps around at both ends and clamps after a search', () => {
  assert.equal(pageCount(0, 10), 1);
  assert.equal(pageCount(21, 10), 3);
  assert.equal(turnPage(0, -1, 3), 2);
  assert.equal(turnPage(2, 1, 3), 0);
  const list = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, count: 1, damage: 0 }));
  const v = new ViewerState({ list: () => list, name: (s) => 'item ' + s.id, recipes: () => [], uses: () => [] });
  assert.equal(v.pages(10), 3);
  v.turn(-1, 10);
  assert.deepEqual(v.pageItems(10).map((s) => s.id), [21, 22, 23, 24, 25]);
  v.setQuery('item 2');
  assert.equal(v.page, 0);
  assert.deepEqual(v.pageItems(10).map((s) => s.id), [2, 12, 20, 21, 22, 23, 24, 25]);
});

test('recipe views keep a back and forward history and page their entries', () => {
  const entries = (n) => Array.from({ length: n }, (_, i) => ({ category: 'crafting', i }));
  const v = new ViewerState({ list: () => [], name: () => '', recipes: (s) => (s.id === 9 ? [] : entries(s.id)), uses: () => entries(1) });
  assert.equal(v.show('recipes', { id: 9, count: 1, damage: 0 }), false);
  assert.equal(v.view, null);
  assert.ok(v.show('recipes', { id: 5, count: 3, damage: 0 }));
  assert.equal(v.view.stack.count, 1);
  assert.equal(v.viewPages(2), 3);
  v.turnView(-1, 2);
  assert.deepEqual(v.viewEntries(2).map((e) => e.i), [4]);
  assert.ok(v.show('uses', { id: 2, count: 1, damage: 0 }));
  assert.ok(v.goBack());
  assert.equal(v.view.mode, 'recipes');
  assert.equal(v.view.page, 2); // the page it was left on
  assert.ok(!v.goBack());
  assert.ok(v.goForward());
  assert.equal(v.view.mode, 'uses');
  v.goBack();
  v.show('recipes', { id: 3, count: 1, damage: 0 });
  assert.ok(!v.goForward()); // a new view drops the forward history
  v.close();
  assert.equal(v.view, null);
  assert.ok(!v.goBack());
});

test('the world switch: only mods.jei === true turns it on, and vanilla records carry no mods field', () => {
  assert.equal(jeiEnabled(), false);
  assert.equal(jeiWorld({}), false);
  assert.equal(jeiWorld({ mods: { jei: 'yes' } }), false);
  assert.equal(jeiWorld({ mods: { jei: true } }), true);
  assert.equal(setJeiEnabled(true), true);
  assert.equal(setJeiEnabled(true), false);
  assert.equal(jeiEnabled(), true);
  assert.equal(setJeiEnabled(false), true);
  assert.equal(jeiEnabled(), false);
  assert.equal(worldMods(undefined), null);
  assert.equal(worldMods({ jei: false }), null);
  assert.deepEqual(worldMods({ jei: true, guns: 1 }), { jei: true });
  assert.deepEqual(withWorldMod({ name: 'a' }, 'jei', false), { name: 'a' });
  assert.deepEqual(withWorldMod({ name: 'a' }, 'jei', true), { name: 'a', mods: { jei: true } });
  assert.deepEqual(withWorldMod({ name: 'a', mods: { guns: true } }, 'jei', true), { name: 'a', mods: { guns: true, jei: true } });
  assert.deepEqual(withWorldMod({ name: 'a', mods: { jei: true } }, 'jei', false), { name: 'a' });
});

test('main.js keeps the viewer behind the world switch and makeRecord writes mods only when one is on', () => {
  const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.match(main, /setJeiEnabled\(jeiWorld\(record\) && !multiplayer\)/);
  assert.match(main, /if \(jeiEnabled\(\)\) recipeViewer\.attach\(/);
  assert.match(main, /\.\.\.\(worldMods\(p\.mods\) \? \{ mods: worldMods\(p\.mods\) \} : \{\}\)/);
  const menus = readFileSync(new URL('./menus.js', import.meta.url), 'utf8');
  assert.match(menus, /withWorldMod\(\{[\s\S]*?\}, "jei", state\.recipes\)/);
});

test('the Create New World toggle sits on the name page between the game mode lines and More World Options', () => {
  for (const [w, h] of [[320, 240], [427, 240], [854, 480]]) {
    const l = createWorldLayout(w, h), r = l.buttons.recipes;
    assert.equal(r.w, 150);
    assert.ok(r.y >= l.labels.line2[1] + 9, 'below the second game mode line');
    assert.ok(r.y + r.h <= l.buttons.moreOptions.y, 'above More World Options');
    assert.ok(r.x + r.w <= w);
  }
});
