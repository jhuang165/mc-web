// The installed gun, CS2 and LR Tactical packs, merged the way the browser and the gun server both install them: the CS2
// pack's guns join TaCZ's, and its knives replace the separately installed cs2 melee pack. fetchText(url) -> text | null.
import { loadTaczPack } from './pack.js';
import { loadMeleePacks } from './melee.js';
import { loadCS2Pack, mergeGunPacks } from './cs2.js';
import { setGunPack, setMeleePacks } from './install.js';

export async function loadGunPacks(fetchText) {
  const args = fetchText ? [fetchText] : [];
  const [base, melee, cs2] = await Promise.all([loadTaczPack(...args).catch(() => null), loadMeleePacks(...args).catch(() => null), loadCS2Pack(...args).catch(() => null)]);
  const raw = mergeGunPacks(base, cs2?.raw);
  const meleePacks = cs2 ? [...(melee ?? []).filter(p => p.namespace !== 'cs2_wt' && p.namespace !== 'cs2'), cs2.melee] : melee;
  return { raw, melee: meleePacks };
}
// Loads and registers the packs (before setGunsEnabled); returns the merged gun pack (null without one).
export async function installGunPacks(fetchText) {
  const { raw, melee } = await loadGunPacks(fetchText);
  setGunPack(raw); setMeleePacks(melee);
  return raw;
}
