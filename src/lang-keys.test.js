// Translations round 2 (batch 17): creative tab labels, firework tooltip lines, horse/beacon/trade GUI labels and boss bar names through
// the selected language. public/research/lang-keys-reference.json comes from tools/probes/KeyTraceProbe.java (unchanged 1.7.10 classes with a
// key-echoing StatCollector) plus bytecode-read keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lang, mergeLocale, parseLang } from './lang.js';
import { EN_US } from './lang-en-us.js';
import { CREATIVE_TABS } from './creative.js';
import { fireworkLines, makeStar, makeRocket, DYE_COLORS } from './fireworks.js';
import { horseChestTitle } from './horse-gear.js';
import { beaconDecorationsHtml, beaconUiHtml } from './pyramid-gui.js';
import { merchantDecorationsHtml } from './merchant-ui.js';
import { dragonBossStatus } from './dragon.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/lang-keys-reference.json', import.meta.url), 'utf8'));
const withTable = (table, fn) => { const saved = lang.table; lang.table = table; try { return fn(); } finally { lang.table = saved; } };
const echo = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? `<${k}>` : undefined) });
const german = (text) => mergeLocale([EN_US, parseLang(text)]).table;

const red = [0xB3312C], blue = [3949738], three = [0xB3312C, 0x3B511A, 0x253192], custom = [0x123456];
const ex = (type, colors, fade = [], flicker = false, trail = false) => ({ type, colors, fade, flicker, trail });
const FIXTURES = {
  'star-small': makeStar(ex(0, red)), 'star-large-fade': makeStar(ex(1, blue, [0xB3312C, 0x123456], true, true)),
  'star-star-multi': makeStar(ex(2, three, [], true)), 'star-creeper-trail': makeStar(ex(3, custom, [], false, true)),
  'star-burst': makeStar(ex(4, red)), 'star-unknown-type': makeStar(ex(9, red)), 'star-no-colors': makeStar(ex(1, [])),
  'star-bare': { id: makeStar(ex(0, [])).id, count: 1, damage: 0 }, 'rocket-bare': makeRocket(null),
  'rocket-flight-2': makeRocket({ flight: 2, explosions: [] }), 'rocket-one': makeRocket({ flight: 1, explosions: [ex(1, red)] }),
  'rocket-two': makeRocket({ flight: 3, explosions: [ex(0, red, [3949738], false, true), ex(4, three, [], true)] }),
};
for (let d = 0; d < 16; d++) FIXTURES[`dye-${d}`] = makeStar(ex(0, [DYE_COLORS[d]]));

test('probe fixtures are all covered', () => assert.deepEqual(ref.tooltips.map((t) => t.name).sort(), Object.keys(FIXTURES).sort()));
test('firework tooltips use the probed keys and formatting', () => {
  for (const t of ref.tooltips) assert.deepEqual(withTable(echo, () => fireworkLines(FIXTURES[t.name])), t.lines, t.name);
});
test('firework tooltips: English output is unchanged with en_US, with no table, and follows a language', () => {
  for (const t of ref.tooltips) {
    const english = t.lines.map((l) => l.replace(/<([^>]+)>/g, (_, k) => ref.values[k]));
    assert.deepEqual(withTable(null, () => fireworkLines(FIXTURES[t.name])), english, t.name);
    assert.deepEqual(withTable(EN_US, () => fireworkLines(FIXTURES[t.name])), english, t.name);
  }
  const lines = withTable(german('item.fireworks.flight=Flugdauer:\nitem.fireworksCharge.red=Rot\nitem.fireworksCharge.type.1=Grosse Kugel\nitem.fireworksCharge.trail=Spur\n'), () =>
    fireworkLines(FIXTURES['rocket-one']));
  assert.deepEqual(lines, ['Flugdauer: 1', 'Grosse Kugel', '  Rot']);
});

test('creative tabs: keys, order and English', () => {
  assert.deepEqual(CREATIVE_TABS.map((t) => [t.index, t.label]), ref.tabs.map((t) => [t.index, t.label]));
  for (const r of ref.tabs) {
    const t = CREATIVE_TABS[r.index];
    assert.equal(r.key, `itemGroup.${t.label}`);
    assert.equal(withTable(null, () => t.name), ref.values[r.key], r.key);
    assert.equal(withTable(EN_US, () => t.name), ref.values[r.key], r.key);
  }
  assert.equal(withTable(german('itemGroup.tools=Werkzeuge\n'), () => CREATIVE_TABS[7].name), 'Werkzeuge');
  assert.equal(withTable(german('itemGroup.tools=Werkzeuge\n'), () => CREATIVE_TABS[8].name), 'Combat');
});

test('bytecode-read keys exist in en_US with the English the port shows', () => {
  for (const k of Object.keys(ref.values)) assert.equal(ref.values[k], EN_US[k], k);
  assert.equal(EN_US['tile.beacon.primary'], 'Primary Power');
  assert.equal(EN_US['entity.zombiehorse.name'], 'Zombie Horse');
});

test('horse inventory title follows the language (native key per type, custom names untouched)', () => {
  const de = german('entity.horse.name=Pferd\nentity.donkey.name=Esel\nentity.mule.name=Maultier\nentity.zombiehorse.name=Zombiepferd\nentity.skeletonhorse.name=Skelettpferd\n');
  assert.deepEqual([0, 1, 2, 3, 4].map((type) => horseChestTitle({ chested: true, type })), ['Horse', 'Donkey', 'Mule', 'Zombie Horse', 'Skeleton Horse']);
  withTable(de, () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((type) => horseChestTitle({ chested: true, type })), ['Pferd', 'Esel', 'Maultier', 'Zombiepferd', 'Skelettpferd']);
    assert.equal(horseChestTitle({ chested: false, type: 2 }), 'Pferd');
    assert.equal(horseChestTitle({ chested: true, type: 1 }, 'Bob'), 'Bob');
  });
});

test('beacon and trade GUI labels follow the language', () => {
  assert.match(beaconDecorationsHtml(), />Primary Power<.*>Secondary Power</);
  const html = beaconUiHtml({ levels: 4, primary: 1, secondary: 0, payment: true, icon: () => '' });
  assert.match(html, /title="Done"/);
  assert.match(html, /title="Cancel"/);
  assert.match(html, /title="Speed II"/);
  const de = german('tile.beacon.primary=Hauptkraft\ntile.beacon.secondary=Nebenkraft\ngui.done=Fertig\ngui.cancel=Abbrechen\npotion.moveSpeed=Tempo\ncontainer.inventory=Inventar\n');
  withTable(de, () => {
    assert.match(beaconDecorationsHtml(), />Hauptkraft<.*>Nebenkraft</);
    const h = beaconUiHtml({ levels: 4, primary: 1, secondary: 0, payment: true, icon: () => '' });
    assert.match(h, /title="Fertig"/);
    assert.match(h, /title="Abbrechen"/);
    assert.match(h, /title="Tempo II"/);
    assert.match(merchantDecorationsHtml(), />Inventar</);
  });
  assert.match(merchantDecorationsHtml(), />Inventory</);
});

test('boss bar names', () => {
  assert.equal(dragonBossStatus({ health: 200 }).name, 'Ender Dragon');
  assert.equal(withTable(german('entity.EnderDragon.name=Enderdrache\n'), () => dragonBossStatus({ health: 200 }).name), 'Enderdrache');
});
