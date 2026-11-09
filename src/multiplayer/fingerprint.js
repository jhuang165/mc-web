// Gun-server weapon-rules fingerprint (protocol v3): SHA-256 over the gameplay inputs both sides load from the pack files —
// item ids, gun/ammo/attachment/melee stats, smithing and crafting recipes and the ammo boxes. Models, textures, sounds, icons and
// other presentation fields are left out, so the server (which installs only the pack's JSON) and a browser agree.
import { GUNS, AMMO, ATTACHMENTS } from '../mods/guns/catalog.js';
import { MELEE, GUN_RECIPES, gunSmithRecipes } from '../mods/guns/install.js';
import { AMMO_BOXES } from '../mods/guns/ammo-box.js';

const PRESENTATION = new Set(['pack', 'iconUrl', 'tooltip', 'inspectSounds', 'sounds', 'model', 'texture', 'lod', 'slot', 'zoom', 'fov',
  'adapter', 'adapters', 'showMount', 'showMuzzle', 'flashOffset', 'scope', 'sight', 'scopeZoom', 'scopeFov', 'thirdPersonScale', 'base']);

// Deterministic JSON: sorted object keys, Sets and Maps as sorted arrays, non-finite numbers as strings, functions dropped.
export function canonical(value, seen = new Set()) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value !== 'object') return 'null';
  if (seen.has(value)) throw new Error('Cyclic weapon rules');
  seen.add(value);
  let out;
  if (value instanceof Set) out = '[' + [...value].map(v => canonical(v, seen)).sort().join(',') + ']';
  else if (value instanceof Map) out = '[' + [...value].map(([k, v]) => canonical([k, v], seen)).sort().join(',') + ']';
  else if (Array.isArray(value)) out = '[' + value.map(v => canonical(v, seen)).join(',') + ']';
  else out = '{' + Object.keys(value).filter(k => !PRESENTATION.has(k) && typeof value[k] !== 'function' && value[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k], seen)).join(',') + '}';
  seen.delete(value);
  return out;
}
export const weaponRules = () => ({ guns: GUNS, ammo: AMMO, attachments: ATTACHMENTS, melee: MELEE, smithing: gunSmithRecipes(), crafting: GUN_RECIPES, boxes: AMMO_BOXES });
export async function packFingerprint(rules = weaponRules()) {
  const bytes = new TextEncoder().encode(canonical(rules));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
