// Guns mod (not 1.7.10): reads the locally installed TaCZ default gun pack (npm run mods:fetch-tacz, Git-ignored, unmodified
// CC BY-NC-ND 4.0 files under public/mods/tacz/) and turns its index, data, display, recipe and language files into this
// project's gun, ammo and smithing tables. Nothing here copies TaCZ data into the repository: without the install, the pack
// is null and only the three hand-made guns of catalog.js exist.
//
// The conversion follows the pack's own fields (data/guns/<gun>_data.json, display/guns/<gun>_display.json); what this game
// cannot do yet (attachments, projectile flight, heat, crawling, melee) is ignored.
import { parseLenient } from "./json5.js";
import { TACZ_GUN_IDS, TACZ_AMMO_IDS } from "./ids.js";

export const PACK_ROOT = "/mods/tacz/";
const ASSETS = PACK_ROOT + "pack/assets/tacz/", DATA = PACK_ROOT + "pack/data/tacz/";
const path = (loc) => String(loc ?? "").replace(/^tacz:/, "");
export const packUrl = {
  geo: (loc) => `${ASSETS}geo_models/${path(loc)}.json`,
  texture: (loc) => `${ASSETS}textures/${path(loc)}.png`,
  animation: (loc) => `${ASSETS}animations/${path(loc)}.animation.json`,
  defaultAnimation: (kind) => `${PACK_ROOT}base/assets/tacz/animations/${kind}_default.animation.json`,
  sound: (file) => `${ASSETS}tacz_sounds/${file}.ogg`,
};
// "tacz:ak47/ak47_shoot" -> "ak47/ak47_shoot", the file under tacz_sounds/ (and the sound event's name, sounds.js).
export const soundPath = (loc) => (loc ? path(loc) : null);

const defaultFetch = (url) => fetch(url).then((r) => (r.ok ? r.text() : null)).catch(() => null);
const strip = (s) => String(s ?? "").replace(/§./g, "").trim();

// The raw pack: { index, lang, guns: { name: { index, data, display } }, ammo: { name: { index, display } }, recipes: [...] },
// or null when public/mods/tacz/index.json is missing (the pack is not installed).
export async function loadTaczPack(fetchText = defaultFetch) {
  const json = async (url) => { const t = await fetchText(url); return t == null ? null : parseLenient(t); };
  const index = await json(PACK_ROOT + "index.json").catch(() => null);
  if (!index?.guns) return null;
  const pack = { index, lang: (await json(ASSETS + "lang/en_us.json")) ?? {}, guns: {}, ammo: {}, recipes: [] };
  await Promise.all([
    ...index.guns.map(async (name) => {
      const gi = await json(`${DATA}index/guns/${name}.json`);
      if (!gi) return;
      const [data, display] = await Promise.all([json(`${DATA}data/guns/${path(gi.data)}.json`), json(`${ASSETS}display/guns/${path(gi.display)}.json`)]);
      if (data && display) pack.guns[name] = { index: gi, data, display };
    }),
    ...index.ammo.map(async (name) => {
      const ai = await json(`${DATA}index/ammo/${name}.json`);
      if (!ai) return;
      pack.ammo[name] = { index: ai, display: await json(`${ASSETS}display/ammo/${path(ai.display)}.json`) };
    }),
    ...(index.recipes ?? []).map(async (name) => { const r = await json(`${DATA}recipes/${name}.json`); if (r) pack.recipes.push({ name, ...r }); }),
  ]);
  pack.recipes.sort((a, b) => (a.name < b.name ? -1 : 1));
  return pack;
}

// TaCZ damage_adjust bands as [[distance, damage], ...], "infinite" as Infinity; without bands, the flat damage everywhere.
function damageBands(bullet, pellets) {
  const per = (v) => (+v || 0) / pellets;
  const bands = bullet?.extra_damage?.damage_adjust;
  if (!Array.isArray(bands) || !bands.length) return [[Infinity, per(bullet?.damage)]];
  const out = bands.map((b) => [b.distance === "infinite" ? Infinity : +b.distance, per(b.damage)]);
  if (out[out.length - 1][0] !== Infinity) out.push([Infinity, out[out.length - 1][1]]);
  return out;
}
// TaCZ recoil keyframes { time, value: [min, max] } as feel.js's [time, [min, max]].
const recoilKeys = (list) => (Array.isArray(list) ? list.map((k) => [+k.time || 0, [+k.value?.[0] || 0, +k.value?.[1] || 0]]) : []);

// One pack gun in catalog.js's shape, plus `pack` (what the renderer and sounds read). `id` comes from ids.js.
export function taczGun(name, entry, lang = {}) {
  const { index: gi, data: d, display: v } = entry;
  const id = TACZ_GUN_IDS[name];
  if (id == null) return null;
  const ammoName = path(d.ammo), pellets = Math.max(1, d.bullet?.bullet_amount | 0 || 1);
  const sp = d.script_param ?? {}, cd = d.reload?.cooldown ?? {};
  // Guns whose script loads one round at a time (intro, loop per round, ending), the way TaCZ's shotgun and rifle logic does.
  const shell = sp.loop > 0 && sp.intro > 0;
  const modes = (Array.isArray(d.fire_mode) && d.fire_mode.length ? d.fire_mode : ["semi"]).filter((m) => ["auto", "semi", "burst"].includes(m));
  const ex = d.bullet?.explosion;
  const sounds = v.sounds ?? {};
  return {
    id, key: name, pack: name,
    name: strip(lang[gi.name]) || name,
    description: strip(lang[gi.tooltip]),
    type: gi.type ?? "rifle", sort: gi.sort ?? 0,
    ammo: TACZ_AMMO_IDS[ammoName] ?? null,
    magazine: Math.max(0, d.ammo_amount | 0),
    feed: d.reload?.type === "inventory" ? "inventory" : "magazine", // the minigun fires straight from the inventory
    rpm: +d.rpm > 0 ? +d.rpm : 300,
    modes: modes.length ? modes : ["semi"],
    burst: d.burst_data ? { count: Math.max(1, d.burst_data.count | 0), bpm: +d.burst_data.bpm || 600, minInterval: +d.burst_data.min_interval || 0, continuous: !!d.burst_data.continuous_shoot } : null,
    pellets,
    damage: damageBands(d.bullet, pellets),
    headshot: +d.bullet?.extra_damage?.head_shot_multiplier || 1,
    knockback: +d.bullet?.knockback || 0,
    explosion: ex?.explode ? { damage: +ex.damage || 0, radius: +ex.radius || 1, destroy: !!ex.destroy_block } : null,
    inaccuracy: { stand: 0, move: 0, sneak: 0, aim: 0, ...d.inaccuracy },
    reload: shell ? { kind: "shell", start: +sp.intro, perShell: +sp.loop, end: +sp.ending || 0 }
      : { kind: "magazine", tactical: +cd.tactical || 2, empty: +cd.empty || +cd.tactical || 2.5 },
    draw: +d.draw_time || 0.5, aim: +d.aim_time || 0.2,
    bolt: d.bolt ?? "closed_bolt",
    recoil: { pitch: recoilKeys(d.recoil?.pitch), yaw: recoilKeys(d.recoil?.yaw) },
    zoom: +v.iron_zoom || 1,
    sounds: {
      shoot: soundPath(sounds.shoot), draw: soundPath(sounds.draw), putAway: soundPath(sounds.put_away),
      // Reload keyframes come from the animation file's sound_effects once it is loaded (assets.js).
      tactical: [], empty: [], start: [], shell: [], end: [], pump: null,
    },
    pack: {
      model: v.model, texture: v.texture, bolt: d.bolt ?? "closed_bolt", lod: v.lod ?? null, slot: v.slot, animation: v.animation ?? null,
      defaultAnimation: v.use_default_animation ?? null,
      modelFov: +v.model_fov || null, zoomModelFov: +v.zoom_model_fov || null,
      flash: v.muzzle_flash ? { texture: v.muzzle_flash.texture, scale: +v.muzzle_flash.scale || 1 } : null,
      thirdPersonScale: v.transform?.scale?.thirdperson ?? [1, 1, 1],
      // The factory parts fitted with no attachments (builtin_attachments' default_attached), as bone names.
      adapters: Object.values(d.builtin_attachments ?? {}).map((b) => path(b?.default_attached)).filter(Boolean),
    },
  };
}

export function taczAmmo(name, entry, lang = {}) {
  const id = TACZ_AMMO_IDS[name];
  if (id == null) return null;
  return { id, key: name, pack: name, name: strip(lang[entry.index.name]) || name, stack: Math.max(1, entry.index.stack_size | 0 || 64), slot: entry.display?.slot ?? null };
}

// TaCZ material tags -> this game's items ([id], [id, damage] or "log"/"planks" for any variant), with a count divisor for
// materials 1.7.10 only has in a bigger form. Copper (no 1.7.10 ore) becomes gold nuggets; amethyst emeralds; netherite diamonds.
export const SMITH_MATERIALS = {
  "forge:ingots/iron": { item: 302 }, "forge:ingots/gold": { item: 304 }, "forge:gems/diamond": { item: 303 },
  "forge:rods/blaze": { item: 387 }, "forge:gems/quartz": { item: 382 }, "forge:gems/lapis": { item: 351, damage: 4 },
  "minecraft:logs": { item: "log" }, "minecraft:planks": { item: "planks" }, "forge:rods/wooden": { item: 300 },
  "forge:gunpowder": { item: 330 }, "forge:ingots/copper": { item: 394 }, "forge:gems/amethyst": { item: 367 },
  "forge:ingots/netherite": { item: 303 }, "forge:nuggets/iron": { item: 302, per: 9 },
};
// The gun smith table's recipes: { key, output, count, group, materials: [{ item, damage?, count }] }, only those whose output
// and every material this game has.
export function taczRecipes(pack) {
  const out = [];
  for (const r of pack?.recipes ?? []) {
    const res = r.result ?? {}, name = path(res.id);
    const output = res.type === "gun" ? TACZ_GUN_IDS[name] : res.type === "ammo" ? TACZ_AMMO_IDS[name] : undefined;
    if (output == null) continue;
    const materials = [];
    for (const m of r.materials ?? []) {
      const tag = m.item?.tag ?? m.item?.item, map = SMITH_MATERIALS[tag];
      if (!map) { materials.length = 0; materials.push(null); break; }
      const count = Math.ceil((m.count | 0 || 1) / (map.per ?? 1));
      const same = materials.find((x) => x.item === map.item && x.damage === map.damage);
      if (same) same.count += count; else materials.push({ item: map.item, ...(map.damage != null ? { damage: map.damage } : {}), count });
    }
    if (materials[0] === null || !materials.length) continue;
    out.push({ key: r.name, output, count: Math.max(1, res.count | 0 || 1), kind: res.type, group: res.group ?? null, materials });
  }
  return out;
}
