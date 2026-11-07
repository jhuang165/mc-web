import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lang, mergeLocale, parseLang } from './lang.js';
import { EN_US } from './lang-en-us.js';
import { BED_TEXT } from './bed.js';
import { nowPlaying, DISC_FIRST } from './note-jukebox-content.js';
import { potionTooltip } from './potions.js';


const withLang = (text, fn) => {
  const saved = lang.table;
  lang.table = mergeLocale([EN_US, parseLang(text)]).table;
  try { return fn(); } finally { lang.table = saved; }
};
test('bed messages, now playing and potion tooltips follow the selected language', () => {
  assert.equal(BED_TEXT.leave, 'Leave Bed');
  assert.equal(nowPlaying(DISC_FIRST), 'Now playing: C418 - 13');
  const before = potionTooltip(8193).map((l) => l.text);
  withLang('tile.bed.occupied=Besetzt\nmultiplayer.stopSleeping=Bett verlassen\nrecord.nowPlaying=Spielt: %s\npotion.regeneration=Regeneration X\npotion.effects.whenDrank=Beim Trinken:\npotion.empty=Keine\nattribute.name.generic.movementSpeed=Tempo\n', () => {
    assert.equal(BED_TEXT.occupied, 'Besetzt');
    assert.equal(BED_TEXT.leave, 'Bett verlassen');
    assert.equal(BED_TEXT.noSleep, 'You can only sleep at night', 'untranslated key reads en_US');
    assert.equal(nowPlaying(DISC_FIRST), 'Spielt: C418 - 13');
    assert.equal(potionTooltip(8193)[0].text, 'Regeneration X (0:45)');
    assert.equal(potionTooltip(8194).at(-1).text.endsWith('Tempo'), true);
    assert.ok(potionTooltip(8194).some((l) => l.text === 'Beim Trinken:'));
  });
  assert.deepEqual(potionTooltip(8193).map((l) => l.text), before);
});
