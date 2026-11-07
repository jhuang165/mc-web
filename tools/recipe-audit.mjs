import {itemFromOriginal} from '../src/region-import.js';
// Conservative native stack conversion for offline recipe audits/replays.
// Undefined means unsupported; null is an actual empty slot/result.
import { MC_IDS } from './inventory-replay.mjs';
import { ITEMS, craftingResult, smeltingResult } from '../src/survival.js';
import { smeltExperience } from '../src/experience.js';
import { makeStack } from '../src/inventory.js';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { DYE } from '../src/world.js';
import { leatherDyeResult } from '../src/leather-dye.js';
import { bookCloneResult, ITEM_WRITABLE_BOOK, ITEM_WRITTEN_BOOK } from '../src/books.js';
import { MapStore, createMapData, mapCloneResult, mapExtendResult, ITEM_FILLED_MAP, ITEM_EMPTY_MAP, ITEM_PAPER } from '../src/maps.js';
import { FIREWORK_ITEMS, registerSkullItem, fireworksResult, normalizeExplosion } from '../src/fireworks.js';
import { ORIGINAL_ITEMS } from '../src/original-items.js';

const AUDIT_BLOCK_ITEMS = { 126: [1165, 5], 139: [1169, 1] }; // wooden slab (6 woods), cobblestone wall (normal, mossy)

export function browserStack(s) {
  if (s == null) return null;
  if (s.tag != null) return undefined;
  // itemFromOriginal has no damage mapping for these two block items; the browser items keep the native damage (shaped-blocks.js).
  const mapped=itemFromOriginal(s.id,s.damage)??(AUDIT_BLOCK_ITEMS[s.id]&&s.damage<=AUDIT_BLOCK_ITEMS[s.id][1]?{id:AUDIT_BLOCK_ITEMS[s.id][0],damage:s.damage}:null);
  return mapped&&!mapped.clamped?makeStack(mapped.id,s.count,mapped.damage):undefined;
}

export function auditRecipes(reference) {
  const crafting = reference.crafting.map(() => ({ checked: 0, mismatches: [] }));
  for (const sample of reference.samples) {
    const cells = sample.cells.map(browserStack), expected = browserStack(sample.result);
    if (cells.includes(undefined) || expected === undefined) continue;
    const row = crafting[sample.recipe];
    row.checked++;
    const actual = craftingResult(cells, sample.size);
    if (!isDeepStrictEqual(actual, expected)) row.mismatches.push({ sample, expected, actual });
  }
  const smelting = reference.smelting.map(recipe => {
    const input = browserStack(recipe.sample.input);
    const expected = browserStack(recipe.sample.output);
    if (!input || !expected) return { checked: false };
    const actual = smeltingResult(input);
    return { checked: true, expected, actual,
      resultMatches: isDeepStrictEqual(actual, expected),
      xpMatches: actual != null && Math.fround(smeltExperience(actual)) === Math.fround(recipe.sample.experience) };
  });
  return { crafting, smelting };
}

// The five dynamic handlers have no samples in recipe-registry-reference.json (the manager extractor only samples fixed
// recipes). Their native fixtures live in dedicated probe references, replayed here and in each family's own test.
const research = new URL('../public/research/', import.meta.url);
const readRef = name => JSON.parse(readFileSync(new URL(name, research)));
export const SPECIAL_RECIPES = Object.freeze({
  0: { name: 'RecipesArmorDyes', reference: 'leather-dye-reference.json', probe: 'tools/verify-leather-dye.mjs', test: 'src/leather-dye.test.js', doc: 'leather-dye.md' },
  1: { name: 'RecipeFireworks', reference: 'fireworks-reference.json', probe: 'tools/verify-fireworks.mjs', test: 'src/fireworks.test.js', doc: 'fireworks.md' },
  65: { name: 'RecipeBookCloning', reference: 'book-reference.json', probe: 'tools/verify-book.mjs', test: 'src/books.test.js', doc: 'books.md' },
  66: { name: 'RecipesMapCloning', reference: 'maps-clock-reference.json', probe: 'tools/verify-maps-clock.mjs', test: 'src/maps-clock.test.js', doc: 'maps-clock.md' },
  67: { name: 'RecipesMapExtending', reference: 'maps-clock-reference.json', probe: 'tools/verify-maps-clock.mjs', test: 'src/maps-clock.test.js', doc: 'maps-clock.md' },
});
export function auditSpecials() {
  const out = Object.fromEntries(Object.keys(SPECIAL_RECIPES).map(i => [i, { checked: 0, mismatches: [] }]));
  const record = (index, ok, detail) => { out[index].checked++; if (!ok) out[index].mismatches.push(detail); };
  const leather = readRef('leather-dye-reference.json');
  for (const f of leather.records) {
    const cells = f.input.map(i => i.kind === 'armor' ? makeStack(i.id, 1, 0, undefined, i.color === undefined ? undefined : { color: i.color })
      : i.kind === 'dye' ? makeStack(DYE, 1, i.damage) : makeStack(i.id));
    const r = leatherDyeResult(cells);
    record(0, !!r === f.output && (!r || (r.count === 1 && r.color === f.color)), f.name);
  }
  registerSkullItem(9999);
  const explosionOf = x => normalizeExplosion({ type: x.Type ?? 0, colors: x.Colors ?? [], fade: x.FadeColors ?? [], flicker: !!x.Flicker, trail: !!x.Trail });
  const fwStack = i => {
    if (!i) return null;
    const st = { id: i.id === 397 ? 9999 : FIREWORK_ITEMS[i.id] ?? ORIGINAL_ITEMS[i.id] ?? ORIGINAL_ITEMS[`${i.id}:0`], count: i.count, damage: i.damage };
    if (i.tag?.Explosion) st.explosion = explosionOf(i.tag.Explosion);
    if (i.tag?.Fireworks) st.fireworks = { ...(i.tag.Fireworks.Flight !== undefined ? { flight: i.tag.Fireworks.Flight } : {}), explosions: (i.tag.Fireworks.Explosions ?? []).map(explosionOf) };
    return st;
  };
  for (const r of readRef('fireworks-reference.json').records.filter(x => x.case === 'recipe')) {
    const cells = Array(r.size * r.size).fill(null);
    for (const { slot, item } of r.input) cells[slot] = fwStack(item);
    const got = fireworksResult(cells);
    const want = r.matched ? fwStack(r.result) : null;
    record(1, r.matched ? !!got && got.id === want.id && got.count === want.count
      && isDeepStrictEqual(got.explosion ?? null, want.explosion ?? null) && isDeepStrictEqual(got.fireworks ?? null, want.fireworks ?? null) : got === null, r.name);
  }
  const live = id => id === 340 ? 314 : id === 288 ? 317 : id === 386 ? ITEM_WRITABLE_BOOK : id === 387 ? ITEM_WRITTEN_BOOK : id;
  const bookStack = c => c ? { id: live(c.id), count: c.count, damage: c.damage, ...(c.tag ? { pages: c.tag.pages, author: c.tag.author, title: c.tag.title, ...(c.tag.name !== undefined ? { displayName: c.tag.name } : {}) } : {}) } : null;
  for (const r of readRef('book-reference.json').recipe.filter(x => !x.name.startsWith('book quill'))) {
    const cells = r.cells.map(bookStack), clone = bookCloneResult(cells);
    if (r.cloningResult?.error) record(65, clone === null, r.name); // the original throws a NullPointerException
    else if (r.cloningMatches) record(65, !!clone && clone.id === ITEM_WRITTEN_BOOK && clone.count === r.cloningResult.count
      && isDeepStrictEqual([clone.pages, clone.author, clone.title, clone.displayName], [r.cloningResult.tag.pages, r.cloningResult.tag.author, r.cloningResult.tag.title, r.cloningResult.tag.name]), r.name);
    else record(65, clone === null, r.name);
  }
  const cell = { P: { id: ITEM_PAPER, count: 1, damage: 0 }, E: { id: ITEM_EMPTY_MAP, count: 1, damage: 0 } };
  const store = new MapStore();
  for (const r of readRef('maps-clock-reference.json').records.filter(x => x.case === 'recipe')) {
    const named = r.map.includes('name'), damage = r.map.startsWith('M=1:0') ? 0 : 7;
    store.maps.clear();
    store.set(createMapData(7, { scale: r.map.includes('scale4') ? 4 : 0 })); store.set(createMapData(0, { scale: 0 }));
    const cells = r.grid.split(' ').map(c => c === '.' ? null : c === 'M' ? { id: ITEM_FILLED_MAP, count: 1, damage, ...(named ? { displayName: 'Atlas' } : {}) } : { ...cell[c] });
    const clone = mapCloneResult(cells), extend = mapExtendResult(cells, r.size, store);
    record(66, !!clone === r.clone.matches && (!clone || isDeepStrictEqual([clone.count, clone.damage, clone.displayName ?? null], [r.clone.result.count, r.clone.result.damage, r.clone.result.name])), `${r.grid} ${r.map}`);
    record(67, !!extend === r.extend.matches && (!extend || isDeepStrictEqual([extend.count, extend.damage, !!extend.mapScaling], [r.extend.result.count, r.extend.result.damage, r.extend.result.scaling])), `${r.grid} ${r.map}`);
  }
  return out;
}
