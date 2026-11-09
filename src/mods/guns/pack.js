// Guns mod (not 1.7.10): reads the locally installed TaCZ default gun pack (npm run mods:fetch-tacz, Git-ignored, unmodified
// CC BY-NC-ND 4.0 files under public/mods/tacz/) and turns its index, data, display, recipe and language files into this
// project's gun, ammo and smithing tables. Nothing here copies TaCZ data into the repository: without the install, the pack
// is null and only the three hand-made guns of catalog.js exist.
//
// The conversion follows the pack's own fields (data/guns/<gun>_data.json, display/guns/<gun>_display.json); what this game
// cannot do yet (projectile flight, heat, crawling, melee, an attachment's scripted functions) is ignored.
import { parseLenient } from "./json5.js";
import { TACZ_GUN_IDS, TACZ_AMMO_IDS, TACZ_ATTACHMENT_IDS, LRT_MELEE_IDS } from "./ids.js";

import { resourceKey, packResource } from "./resources.js";

export const PACK_ROOT = "/mods/tacz/";
const ASSETS = PACK_ROOT + "pack/assets/tacz/", DATA = PACK_ROOT + "pack/data/tacz/";
const path = resourceKey;
export const packUrl = {
  geo: (loc) => packResource("geo_models", ".json", loc),
  texture: (loc) => packResource("textures", ".png", loc),
  animation: (loc) => packResource("animations", ".animation.json", loc),
  defaultAnimation: (kind) => `${PACK_ROOT}base/assets/tacz/animations/${kind}_default.animation.json`,
  sound: (file) => packResource("tacz_sounds", ".ogg", file),
};
// "tacz:ak47/ak47_shoot" -> "ak47/ak47_shoot", the file under tacz_sounds/ (and the sound event's name, sounds.js).
export const soundPath = (loc) => (loc ? path(loc) : null);

const defaultFetch = (url) => fetch(url).then((r) => (r.ok ? r.text() : null)).catch(() => null);
const strip = (s) => String(s ?? "").replace(/§./g, "").trim();

// The raw pack: { index, lang, guns: { name: { index, data, display } }, ammo: { name: { index, display } },
// attachments: { name: { index, data, display } }, tags: { "allow_attachments/ak47": [...], ... }, recipes: [...] }, or null
// when public/mods/tacz/index.json is missing (the pack is not installed).
export async function loadTaczPack(fetchText = defaultFetch, { root = PACK_ROOT, namespace = "tacz" } = {}) {
  const ASSETS = `${root}pack/assets/${namespace}/`, DATA = `${root}pack/data/${namespace}/`;
  const filePath = loc => String(loc ?? "").replace(/^[^:]+:/, "");
  const key = name => resourceKey(`${namespace}:${name}`);
  const referenced = (kind, folder, loc) => {
    const value = String(loc ?? ""), ns = value.includes(":") ? value.split(":")[0] : namespace;
    const base = ns === namespace ? root : ns === "tacz" ? PACK_ROOT : `/mods/${ns}/`;
    return `${base}pack/${kind}/${ns}/${folder}/${filePath(loc)}.json`;
  };
  // A file that does not parse counts as missing, so one bad file costs only its own entry.
  const json = async (url) => { const t = await fetchText(url); if (t == null) return null; try { return parseLenient(t); } catch { return null; } };
  const index = await json(root + "index.json").catch(() => null);
  if (!index?.guns) return null;
  const pack = { index, lang: (await json(ASSETS + "lang/en_us.json")) ?? {}, guns: {}, ammo: {}, attachments: {}, tags: {}, recipes: [] };
  await Promise.all([
    ...index.guns.map(async (name) => {
      const gi = await json(`${DATA}index/guns/${name}.json`);
      if (!gi) return;
      const [data, display] = await Promise.all([json(referenced("data", "data/guns", gi.data)), json(referenced("assets", "display/guns", gi.display))]);
      if (data && display) pack.guns[key(name)] = { index: gi, data, display };
    }),
    ...index.ammo.map(async (name) => {
      const ai = await json(`${DATA}index/ammo/${name}.json`);
      if (!ai) return;
      pack.ammo[key(name)] = { index: ai, display: await json(referenced("assets", "display/ammo", ai.display)) };
    }),
    ...(index.attachments ?? []).map(async (name) => {
      const ai = await json(`${DATA}index/attachments/${name}.json`);
      if (!ai) return;
      const [data, display] = await Promise.all([json(referenced("data", "data/attachments", ai.data)), json(referenced("assets", "display/attachments", ai.display))]);
      pack.attachments[key(name)] = { index: ai, data: data ?? {}, display: display ?? {} };
    }),
    ...(index.attachmentTags ?? []).map(async (name) => { const t = await json(`${DATA}tacz_tags/attachments/${name}.json`); if (Array.isArray(t)) pack.tags[key(name)] = t; }),
    ...(index.recipes ?? []).map(async (name) => { const r = await json(`${DATA}recipes/${name}.json`); if (r) pack.recipes.push({ name: key(name), ...r }); }),
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
    // A manual action (bolt, pump, lever) is worked after every shot before the next: bolt_action_time, or the gun script's
    // bolt_time for the scripted shotguns and lever guns.
    boltTime: d.bolt === "manual_action" ? +d.bolt_action_time || +sp.bolt_time || 0 : 0,
    recoil: { pitch: recoilKeys(d.recoil?.pitch), yaw: recoilKeys(d.recoil?.yaw) },
    zoom: +v.iron_zoom || 1,
    // Attachments (fit.js): the extended magazine sizes by level, and the slots the gun has at all; install.js sets
    // `attachments`, the allow list (tacz_tags/attachments/allow_attachments/<gun>.json) as a set of names.
    extendedMag: Array.isArray(d.extended_mag_ammo_amount) ? d.extended_mag_ammo_amount.map((n) => n | 0) : null,
    attachmentTypes: Array.isArray(d.allow_attachment_types) ? d.allow_attachment_types : [],
    // builtin_attachments: per slot, the factory parts the gun takes besides its allow list, and the one fitted while the
    // slot is empty ({ type: { attachments: [names], default: name | null } }; the P90's is a bare name).
    builtin: Object.fromEntries(Object.entries(d.builtin_attachments ?? {}).map(([type, b]) => typeof b === "string"
      ? [type, { attachments: [path(b)], default: path(b) }]
      : [type, { attachments: (Array.isArray(b?.attachments) ? b.attachments : []).map(path), default: b?.default_attached ? path(b.default_attached) : null }])),
    sounds: {
      shoot: soundPath(sounds.shoot), silenced: soundPath(sounds.silence), draw: soundPath(sounds.draw), putAway: soundPath(sounds.put_away),
      inspect: soundPath(sounds.inspect), inspectEmpty: soundPath(sounds.inspect_empty),
      reloadTactical: soundPath(sounds.reload_tactical), reloadEmpty: soundPath(sounds.reload_empty),
      // Reload keyframes come from the animation file's sound_effects once it is loaded (assets.js).
      tactical: [], empty: [], start: [], shell: [], end: [], pump: null,
    },
    pack: {
      model: v.model, texture: v.texture, bolt: d.bolt ?? "closed_bolt", lod: v.lod ?? null, slot: v.slot, animation: v.animation ?? null,
      defaultAnimation: v.use_default_animation ?? null,
      modelFov: +v.model_fov || null, zoomModelFov: +v.zoom_model_fov || null,
      flash: v.muzzle_flash ? { texture: v.muzzle_flash.texture, scale: +v.muzzle_flash.scale || 1 } : null,
      // Tracer rounds (tracers.js): bullet speed in blocks a second and life in seconds, tracer_count_interval (0 every
      // round, -1 none), and the gun display's ammo.tracer_color; install.js falls back to the ammo display's colour.
      tracer: { speed: +d.bullet?.speed > 0 ? +d.bullet.speed : 250, life: +d.bullet?.life > 0 ? +d.bullet.life : 10,
        interval: Number.isFinite(+d.bullet?.tracer_count_interval) ? +d.bullet.tracer_count_interval : -1, color: v.ammo?.tracer_color ?? null },
      thirdPersonScale: v.transform?.scale?.thirdperson ?? [1, 1, 1],
      // The factory parts fitted with no attachments (builtin_attachments' default_attached), as bone names.
      adapters: Object.values(d.builtin_attachments ?? {}).map((b) => path(typeof b === "string" ? b : b?.default_attached)).filter(Boolean),
    },
  };
}

export function taczAmmo(name, entry, lang = {}) {
  const id = TACZ_AMMO_IDS[name];
  if (id == null) return null;
  return { id, key: name, pack: name, name: strip(lang[entry.index.name]) || name, stack: Math.max(1, entry.index.stack_size | 0 || 64), slot: entry.display?.slot ?? null, tracerColor: entry.display?.tracer_color ?? null };
}

// TaCZ material tags -> this game's items ([id], [id, damage] or "log"/"planks" for any variant), with a count divisor for
// materials 1.7.10 only has in a bigger form. Copper (no 1.7.10 ore) becomes coal or charcoal; amethyst emeralds; netherite diamonds;
// the later blocks their nearest 1.7.10 kin (crying obsidian obsidian, shroomlight glowstone, observer a comparator, an end
// crystal an eye of ender, a copper block a block of coal).
export const SMITH_MATERIALS = {
  "forge:dusts/redstone": { item: 360 }, "forge:dusts/glowstone": { item: 383 }, "forge:glass": { item: 9 },
  "forge:leather": { item: 315 }, "minecraft:wool": { item: "wool" }, "minecraft:gunpowder": { item: 330 },
  "minecraft:blaze_powder": { item: 388 }, "minecraft:fire_charge": { item: 1952 }, "minecraft:ender_eye": { item: 1960 },
  "minecraft:end_crystal": { item: 1960 }, "minecraft:crying_obsidian": { item: 22 }, "minecraft:shroomlight": { item: 1131 },
  "minecraft:quartz": { item: 382 }, "minecraft:oak_log": { item: 4, damage: 0 }, "forge:nuggets/gold": { item: 394 },
  "minecraft:observer": { item: 381 }, "minecraft:copper_block": { item: 1144 },
  "forge:ingots/iron": { item: 302 }, "forge:ingots/gold": { item: 304 }, "forge:gems/diamond": { item: 303 },
  "forge:rods/blaze": { item: 387 }, "forge:gems/quartz": { item: 382 }, "forge:gems/lapis": { item: 351, damage: 4 },
  "minecraft:logs": { item: "log" }, "minecraft:planks": { item: "planks" }, "forge:rods/wooden": { item: 300 },
  "forge:gunpowder": { item: 330 }, "forge:ingots/copper": { item: 301 }, "forge:gems/amethyst": { item: 367 },
  "forge:ingots/netherite": { item: 303 }, "forge:nuggets/iron": { item: 302, per: 9 },
};
// The gun smith table's recipes: { key, output, count, group, materials: [{ item, damage?, count }] }, only those whose output
// and every material this game has.
export function taczRecipes(pack) {
  const out = [];
  for (const r of pack?.recipes ?? []) {
    const res = r.result ?? {}, name = path(res.id);
    const melee = res.type === "custom" && res.item?.item === "lrtactical:melee" ? LRT_MELEE_IDS[res.item?.nbt?.MeleeWeaponId] : LRT_MELEE_IDS[name];
    const output = melee ?? (res.type === "gun" ? TACZ_GUN_IDS[name] : res.type === "ammo" ? TACZ_AMMO_IDS[name]
      : res.type === "attachment" ? TACZ_ATTACHMENT_IDS[name] : undefined);
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
    const attachments = Object.fromEntries(Object.entries(res.attachments ?? {}).map(([type, key]) => [type, TACZ_ATTACHMENT_IDS[path(key)]]).filter(([, id]) => id != null));
    out.push({ key: r.name, output, count: Math.max(1, res.count | 0 || 1), kind: melee != null ? "melee" : res.type, group: res.group ?? null, materials, ...(Object.keys(attachments).length ? { modTag: { attachments } } : {}) });
  }
  return out;
}
