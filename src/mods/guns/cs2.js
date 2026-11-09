import { fetchPackText } from "./pack-fetch.js";
// Read CS2 Unified's installed files; keep its payload separate from the default TaCZ pack.
import { parseLenient } from './json5.js';
import { loadTaczPack } from './pack.js';
import { CS2_ROOT } from './resources.js';

const defaultFetch = fetchPackText;
export async function loadCS2Pack(fetchText = defaultFetch) {
  const raw = await loadTaczPack(fetchText, { root: CS2_ROOT, namespace: 'cs2' });
  if (!raw) return null;
  const json = async file => {
    const text = await fetchText(CS2_ROOT + 'pack/' + file);
    if (text == null) return null;
    try { return parseLenient(text); } catch { return null; }
  };
  const melee = {};
  await Promise.all((raw.index.melee ?? []).map(async name => {
    const [index, display] = await Promise.all([json(`data/cs2/index/melee/${name}.json`), json(`assets/cs2/display/melee/${name}.json`)]);
    if (index && display) melee[name] = { index, display };
  }));
  // The CT/T default knives use TaCZ's gun-melee format. Adapt their own melee data to the existing
  // delayed cone strikes instead of treating a knife as a ranged gun that consumes ammunition.
  for (const name of ['ct_knife', 't_knife']) {
    const entry = raw.guns['cs2:' + name]; if (!entry) continue;
    const { data: d, display: v, index: i } = entry, hit = d.melee?.default ?? {};
    const attack = { factor: 1, knockback: hit.knockback ?? 0, cooldown: (d.melee?.cooldown ?? 1) * 20,
      delay: (hit.prep ?? 0) * 20, hitbox: { type: 'cone', max_range: d.melee?.distance ?? 1.4, max_angle: hit.range_angle ?? 40 } };
    melee[name] = { index: { name: i.name, base_item: 'lrtactical:melee', data: {
      draw_time: (d.draw_time ?? 0.5) * 20, put_away_time: (d.put_away_time ?? 0) * 20,
      attributes: { 'generic.attack_damage': (hit.damage ?? d.bullet?.damage ?? 1) - 1 }, attack: { attack_left: attack, attack_right: attack },
    } }, display: { model: v.model, texture: v.texture, animation: v.animation, slot_texture: v.slot,
      transforms: { thirdperson_righthand: { scale: v.transform?.scale?.thirdperson ?? [1, 1, 1] } } } };
    delete raw.guns['cs2:' + name];
  }
  // Unified ships this internal token for gun-style knives; melee adaptation does not need it.
  delete raw.ammo['cs2:melee_weapon'];
  // Both LR and TaCZ category copies of the knife recipes exist in the pack. Show one recipe per cost/output.
  const seen = new Set();
  raw.recipes = raw.recipes.filter(r => {
    const result = r.result ?? {}, id = result.id ?? result.item?.nbt?.MeleeWeaponId;
    const signature = JSON.stringify([id, r.materials]);
    if (seen.has(signature)) return false; seen.add(signature); return true;
  });
  // Two indexed entries have no source recipe. Use their equivalent AK and AUG-scope costs so every
  // offered weapon/attachment remains craftable; this changes runtime tables, never the installed pack files.
  for (const [id, equivalent] of [['cs2:cs_test_ak', 'cs2:cs_ak'], ['cs2:sg553_scope', 'cs2:aug_scope']]) {
    if (!raw.recipes.some(r => r.result?.id === id)) {
      const source = raw.recipes.find(r => r.result?.id === equivalent);
      if (source) raw.recipes.push({ ...source, name: 'fallback:' + id, result: { ...source.result, id } });
    }
  }
  return { raw, melee: { namespace: 'cs2', lang: raw.lang, melee, sounds: raw.index.sounds ?? [] } };
}

export function mergeGunPacks(...packs) {
  const available = packs.filter(Boolean); if (!available.length) return null;
  return { index: available[0].index,
    ...Object.fromEntries(['lang', 'guns', 'ammo', 'attachments', 'tags'].map(key => [key, Object.assign({}, ...available.map(p => p[key]))])),
    recipes: available.flatMap(p => p.recipes ?? []) };
}
