import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerTitle, CONTAINER_KEYS } from './container-names.js';
import { lang, mergeLocale, parseLang } from './lang.js';
import { EN_US } from './lang-en-us.js';
import { BREWING_TITLE } from './brewing-container.js';
import { DISPENSER_TITLE, DROPPER_TITLE } from './dispenser-container.js';
import { HOPPER_TITLE } from './hopper.js';
import { MERCHANT_TITLE } from './merchant-ui.js';

test('every default English container title is its en_US value', () => {
  for (const [title, key] of Object.entries(CONTAINER_KEYS)) assert.equal(EN_US[key], title === 'Item Selection' ? 'Item Selection' : title, key);
  for (const t of [BREWING_TITLE, DISPENSER_TITLE, DROPPER_TITLE, HOPPER_TITLE, MERCHANT_TITLE]) assert.ok(CONTAINER_KEYS[t], t);
});
test('container titles follow the selected language; custom names stay', () => {
  assert.equal(containerTitle('Furnace'), 'Furnace');
  const saved = lang.table;
  lang.table = mergeLocale([EN_US, parseLang('container.furnace=Ofen\ncontainer.chestDouble=Grosse Truhe\n')]).table;
  try {
    assert.equal(containerTitle('Furnace'), 'Ofen');
    assert.equal(containerTitle('Large Chest'), 'Grosse Truhe');
    assert.equal(containerTitle('Chest'), 'Chest', 'missing key reads en_US');
    assert.equal(containerTitle('My Stash'), 'My Stash');
  } finally { lang.table = saved; }
});
