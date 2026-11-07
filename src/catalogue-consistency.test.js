import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

// Guards the generated parity catalogues against going stale: a row may not say Missing for a class the code clearly has a
// counterpart for, and every remaining Missing row must be listed here on purpose (batch 19 audit).
const research = new URL('../public/research/', import.meta.url);
const read = name => readFile(new URL(name, research), 'utf8');
const catalogues = (await readdir(research)).filter(n => /-(parity-)?catalogue\.md$/.test(n)).sort();
const text = Object.fromEntries(await Promise.all(catalogues.map(async n => [n, await read(n)])));
const exists = url => access(url).then(() => true, () => false);

// [catalogue, row key, [module, export]...]: the row's browser counterpart. The module must exist and export the names.
const COUNTERPARTS = [
  ['gui-parity-catalogue.md', 'GuiScreenResourcePacks', ['resource-packs-ui.js', 'resourcePacksScreen']],
  ['gui-parity-catalogue.md', 'GuiResourcePackList', ['resource-packs-ui.js', 'resourcePacksScreen']],
  ['gui-parity-catalogue.md', 'GuiResourcePackAvailable', ['resource-packs-ui.js', 'resourcePacksScreen']],
  ['gui-parity-catalogue.md', 'GuiResourcePackSelected', ['resource-packs-ui.js', 'resourcePacksScreen']],
  ['gui-parity-catalogue.md', 'GuiLanguage', ['lang.js', 'setForceUnicodeFont']],
  ['gui-parity-catalogue.md', 'GuiSnooper', null, 'Out of scope'],
  ['gui-parity-catalogue.md', 'GuiMemoryErrorScreen', null, 'Out of scope'],
  ['structure-parity-catalogue.md', 'WorldGeneratorBonusChest', ['bonus-chest.js', 'createBonusChest']],
  ['settings-parity-catalogue.md', 'FORCE_UNICODE_FONT', ['lang.js', 'setForceUnicodeFont']],
  ['settings-parity-catalogue.md', 'ANAGLYPH', ['post-shaders.js', 'SHADER_LIST']],
  ['settings-parity-catalogue.md', 'STREAM_FPS', null, 'Out of scope'],
  ['settings-parity-catalogue.md', 'SNOOPER_ENABLED', null, 'Out of scope'],
  ['settings-parity-catalogue.md', 'key.streamStartStop', null, 'Out of scope'],
  ['recipe-parity-catalogue.md', 'C0', ['leather-dye.js', 'leatherDyeResult']],
  ['recipe-parity-catalogue.md', 'C1', ['fireworks.js', 'fireworksResult']],
  ['recipe-parity-catalogue.md', 'C65', ['books.js', 'bookCloneResult']],
  ['recipe-parity-catalogue.md', 'C66', ['maps.js', 'mapCloneResult']],
  ['recipe-parity-catalogue.md', 'C67', ['maps.js', 'mapExtendResult']],
];
// Keyed by the first cell of the row that may stay Missing/Unmapped/Not replayed, with the reason it is not a counterpart bug.
const KNOWN_ABSENT = {
  'settings-parity-catalogue.md': { SATURATION: 'no 1.7.10 screen or renderer reads it', TOUCHSCREEN: 'native touch mode not ported; mobile controls differ' },
  'gui-parity-catalogue.md': { GuiErrorScreen: 'browser errors use the notice modal', GuiScreenWorking: 'world loading uses the browser overlay' },
  'recipe-parity-catalogue.md': { C25: 'fire block ingredient', C26: 'fire block ingredient', C125: 'fire block ingredient', C126: 'fire block ingredient' },
};

const rowFor = (catalogue, key) => text[catalogue].split('\n').find(line => line.startsWith('|')
  && line.split('|').slice(1, 4).some(cell => { const c = cell.trim(); return c === key || c.endsWith(`/${key}`); }));
const absent = /\|\s*(Missing|Unmapped|Not replayed)\b/;

test('catalogues the generated files exist for every parity subsystem', () => {
  for (const n of ['biome', 'block', 'command', 'entity', 'gamerule', 'gui', 'item', 'recipe', 'settings', 'structure'])
    assert(text[`${n}-parity-catalogue.md`], n);
  assert(text['block-metadata-catalogue.md']);
});

test('no catalogue row says Missing for a class with a clear browser counterpart', async () => {
  for (const [catalogue, key, counterpart, status] of COUNTERPARTS) {
    const row = rowFor(catalogue, key);
    assert(row, `${catalogue} has no row for ${key}`);
    if (counterpart) {
      const [file, name] = counterpart;
      assert(await exists(new URL(`./${file}`, import.meta.url)), `${file} for ${key}`);
      assert.match(await readFile(new URL(`./${file}`, import.meta.url), 'utf8'), new RegExp(`export (const|function|class) ${name}\\b`), `${file} exports ${name}`);
      assert(!absent.test(row), `${catalogue} ${key} still says Missing although ${file} implements it: ${row.slice(0, 160)}`);
    }
    if (status) assert(row.includes(status), `${catalogue} ${key} should say ${status}: ${row.slice(0, 160)}`);
  }
});

test('every Missing row is a known absence and no Missing row is stale', () => {
  for (const [catalogue, body] of Object.entries(text)) {
    const known = KNOWN_ABSENT[catalogue] ?? {};
    const seen = new Set();
    for (const line of body.split('\n').filter(l => l.startsWith('|') && absent.test(l))) {
      const cells = line.split('|').map(c => c.trim());
      const named = Object.keys(known).find(k => cells.slice(1, 4).some(c => c === k || c.endsWith(`/${k}`)));
      assert(named, `${catalogue}: unexpected absent row ${cells.slice(1, 4).join(' | ')} (add a counterpart or list it in KNOWN_ABSENT)`);
      seen.add(named);
    }
    for (const k of Object.keys(known)) assert(seen.has(k), `${catalogue}: ${k} is no longer Missing, drop it from KNOWN_ABSENT`);
  }
});

test('catalogue evidence links point at existing research files', async () => {
  for (const [catalogue, body] of Object.entries(text)) {
    for (const [, target] of body.matchAll(/\]\(([\w.-]+\.(?:md|json))\)/g))
      assert(await exists(new URL(target, research)), `${catalogue} links to missing ${target}`);
  }
});

test('catalogue headers state the batch-19 audit and its status words', () => {
  for (const n of ['biome', 'command', 'entity', 'gamerule', 'gui', 'item', 'recipe', 'settings', 'structure'])
    assert.match(text[`${n}-parity-catalogue.md`], /batch 19 audit/, n);
  assert.match(text['block-parity-catalogue.md'], /batch 19/);
});
