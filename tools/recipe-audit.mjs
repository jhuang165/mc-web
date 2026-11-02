import {itemFromOriginal} from '../src/region-import.js';
// Conservative native stack conversion for offline recipe audits/replays.
// Undefined means unsupported; null is an actual empty slot/result.
import { MC_IDS } from './inventory-replay.mjs';
import { ITEMS, craftingResult, smeltingResult } from '../src/survival.js';
import { smeltExperience } from '../src/experience.js';
import { makeStack } from '../src/inventory.js';
import { isDeepStrictEqual } from 'node:util';

export function browserStack(s) {
  if (s == null) return null;
  if (s.tag != null) return undefined;
  const mapped=itemFromOriginal(s.id,s.damage);
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
