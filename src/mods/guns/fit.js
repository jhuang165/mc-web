// Guns mod (not 1.7.10): TaCZ attachments. Each is an item (ids.js, 4400 and up) fitted into one of a gun's slots; a gun
// stack keeps what it carries in `modTag.attachments` ({ type: item id }, saved with the stack, inventory.js). fitGun
// gives the gun with its attachments' data applied the way TaCZ's attachment modifiers read (data/attachments/*.json):
// extended magazines, aim time, spread, recoil, headshot, damage, range, fire rate and the silencer. Pure: no DOM, no three.
import { TACZ_ATTACHMENT_IDS } from "./ids.js";
import { hasChamber, loadedRounds, setLoadedRounds } from "./ammo.js";

// The slots, in the order the attachment screen lists them.
export const ATTACHMENT_TYPES = ["scope", "muzzle", "stock", "grip", "laser", "extended_mag"];
export const TYPE_NAMES = { scope: "Scope", muzzle: "Muzzle", stock: "Stock", grip: "Grip", laser: "Laser", extended_mag: "Magazine" };

const path = (loc) => String(loc ?? "").replace(/^tacz:/, "");
const strip = (s) => String(s ?? "").replace(/§./g, "").trim();
const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== "" ? +v : d);
// A TaCZ modifier { addend, multiplier } (either may be missing) as [addend, multiplier].
const mod = (m) => [num(m?.addend), num(m?.multiplier, 1)];

// One pack attachment: entry is { index, data, display } (index/attachments, data/attachments, display/attachments).
export function taczAttachment(name, entry, lang = {}) {
  const id = TACZ_ATTACHMENT_IDS[name], { index: ai, data: d = {}, display: v = {} } = entry;
  if (id == null || !ATTACHMENT_TYPES.includes(ai?.type)) return null;
  const [adsAdd, adsMul] = mod(d.ads);
  return {
    id, key: name, type: ai.type, sort: ai.sort | 0,
    name: strip(lang[ai.name]) || name,
    stats: {
      ads: [adsAdd + num(d.ads_addend), adsMul],
      inaccuracy: num(d.inaccuracy?.multiplier, 1), aimInaccuracy: num(d.aim_inaccuracy?.multiplier, 1),
      sneakInaccuracy: num(d.sneak_inaccuracy?.multiplier, 1),
      recoil: [num(d.recoil?.pitch?.multiplier, 1), num(d.recoil?.yaw?.multiplier, 1)],
      headshot: mod(d.head_shot), damage: num(d.damage?.multiplier, 1), range: mod(d.effective_range), rpm: mod(d.rpm),
      knockback: num(d.knockback?.multiplier, 1),
      silence: !!d.silence?.use_silence_sound,
      extendedMag: Math.max(0, Math.min(3, d.extended_mag_level | 0)),
    },
    // What the renderer reads (pack-view.js).
    model: v.model ?? null, texture: v.texture ?? null, lod: v.lod ?? null, slot: v.slot ?? null,
    zoom: Array.isArray(v.zoom) && v.zoom.length ? v.zoom.map((z) => num(z, 1)) : null, scope: !!v.scope, sight: !!v.sight,
    fov: num(v.fov, 0) || null, adapter: v.adapter ?? null, showMount: v.show_mount !== false, showMuzzle: !!v.show_muzzle,
    flashOffset: num(v.muzzle_flash_offset, 0),
    sounds: { install: path(v.sounds?.install) || null, uninstall: path(v.sounds?.uninstall) || null },
  };
}

// allow_attachments/<gun>.json and the tag files it names: "#tacz:pistol_sight" is the tag file pistol_sight.json, any
// other entry one attachment. Returns the set of attachment names the gun takes (tags nest; a loop ends at a repeat).
export function resolveAllowed(list, tags) {
  const out = new Set(), seen = new Set();
  const walk = (entries) => {
    for (const e of Array.isArray(entries) ? entries : []) {
      const s = String(e);
      if (s.startsWith("#")) { const t = path(s.slice(1)); if (!seen.has(t)) { seen.add(t); walk(tags[t]); } }
      else out.add(path(s));
    }
  };
  walk(list);
  return out;
}

// The parts a stack carries: { type: attachment } for those this game knows (ATTACHMENTS: id -> attachment).
export function stackParts(stack, ATTACHMENTS) {
  const tag = stack?.modTag?.attachments, out = {};
  if (!tag || typeof tag !== "object") return out;
  for (const type of ATTACHMENT_TYPES) { const a = ATTACHMENTS[tag[type]]; if (a && a.type === type) out[type] = a; }
  return out;
}

// The gun with its parts applied, or the gun itself without any. The result keeps `base` (the catalog gun), `parts`
// ({ type: attachment }) and `fitKey` (the same parts give the same key, for caches).
export function fitGun(gun, parts) {
  const list = ATTACHMENT_TYPES.map((t) => parts[t]).filter(Boolean);
  if (!list.length) return gun;
  let adsAdd = 0, adsMul = 1, hip = 1, aimInacc = 1, sneak = 1, pitch = 1, yaw = 1, hsAdd = 0, hsMul = 1, dmg = 1, rangeAdd = 0, rangeMul = 1,
    rpmAdd = 0, rpmMul = 1, kb = 1, silenced = false, level = 0;
  for (const { stats: s } of list) {
    adsAdd += s.ads[0]; adsMul *= s.ads[1]; hip *= s.inaccuracy; aimInacc *= s.aimInaccuracy; sneak *= s.sneakInaccuracy;
    pitch *= s.recoil[0]; yaw *= s.recoil[1]; hsAdd += s.headshot[0]; hsMul *= s.headshot[1]; dmg *= s.damage;
    rangeAdd += s.range[0]; rangeMul *= s.range[1]; rpmAdd += s.rpm[0]; rpmMul *= s.rpm[1]; kb *= s.knockback;
    silenced ||= s.silence; level = Math.max(level, s.extendedMag);
  }
  const i = gun.inaccuracy, scope = parts.scope;
  const magazine = level > 0 && gun.feed !== "inventory" ? Math.max(gun.magazine, gun.extendedMag?.[level - 1] | 0) : gun.magazine;
  return {
    ...gun,
    base: gun, parts: { ...parts }, fitKey: `${gun.id}:${list.map((a) => a.id).join(",")}`,
    magazine, extendedLevel: level,
    aim: Math.max(0.05, (gun.aim + adsAdd) * adsMul),
    inaccuracy: { ...i, stand: i.stand * hip, move: i.move * hip, sneak: i.sneak * hip * sneak, aim: i.aim * aimInacc },
    recoilScale: [pitch, yaw],
    headshot: (gun.headshot + hsAdd) * hsMul,
    damage: gun.damage.map(([reach, d]) => [reach === Infinity ? Infinity : Math.max(0, (reach + rangeAdd) * rangeMul), d * dmg]),
    rpm: Math.max(1, (gun.rpm + rpmAdd) * rpmMul),
    knockback: (gun.knockback || 0) * kb,
    silenced,
    // A scope or sight: its first magnification and the hand model's field of view while aimed through it.
    scopeZoom: scope?.zoom?.[0] ?? null, scopeFov: scope?.fov ?? null,
  };
}

// Which of a gun's slots an attachment goes in, or null when the gun does not take it. gun.attachments is the pack's
// allow list as a Set of names; a gun without one (the hand-made guns without the pack) takes nothing.
export const fitsGun = (gun, attachment) => (gun && attachment && gun.attachments?.has(attachment.key) ? attachment.type : null);

// Fit `attachment` (or nothing, to take the slot's part off) into the gun stack. Returns { stack, removed } where
// `removed` is the attachment taken out (or null) and `unloaded` the rounds a smaller magazine no longer holds; the stack
// keeps its rounds otherwise (stack.damage counts rounds fired from a full magazine, so it moves with the magazine size).
export function refit(stack, type, attachment, { gunOf, ATTACHMENTS }) {
  const before = gunOf(stack), rounds = loadedRounds(before, stack);
  const tag = { ...(stack.modTag?.attachments ?? {}) }, removed = ATTACHMENTS[tag[type]] ?? null;
  if (attachment) tag[type] = attachment.id; else delete tag[type];
  const next = { ...stack, modTag: { ...stack.modTag } };
  if (Object.keys(tag).length) next.modTag.attachments = tag;
  else delete next.modTag.attachments;
  const after = gunOf(next), kept = Math.min(rounds, after.magazine + (hasChamber(after) ? 1 : 0));
  setLoadedRounds(after, next, kept);
  return { stack: next, removed, unloaded: before.feed === "inventory" ? 0 : rounds - kept };
}

// A saved gun's attachments and the round above magazine capacity (item readTag, install.js).
export function readGunTag(tag) {
  const a = tag?.attachments;
  const out = {}, attachments = {};
  if (a && typeof a === "object") for (const type of ATTACHMENT_TYPES)
    if (Number.isInteger(a[type]) && a[type] > 0) attachments[type] = a[type];
  if (Object.keys(attachments).length) out.attachments = attachments;
  if (tag?.extraRound === true) out.extraRound = true;
  return Object.keys(out).length ? out : null;
}
