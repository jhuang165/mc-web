// Guns mod (not 1.7.10): an opt-in world option inspired by the TaCZ mod (Timeless and Classics Zero, MCModderAnchor/TACZ).
// Nothing here is part of the parity target; a world without `mods.guns` never registers these items.
//
// Gun stats follow the TaCZ default gun pack data (tacz_default_gun data/guns/<gun>_data.json, version 1.2.0) as gameplay
// numbers: magazine size, rounds per minute, damage with distance falloff, headshot multiplier, inaccuracy (degrees) and
// reload/draw times (seconds). Code, icons and models here are this project's own. TaCZ's sounds are not in this repository;
// `npm run mods:fetch-tacz` installs them locally (tools/fetch-tacz-sounds.mjs).

// Internal item ids: above every internal (max 2130) and original 1.7.10 (max 2267) item id.
export const GUN_ITEM_BASE = 4000;
export const P320 = 4000, AKM = 4001, M870 = 4002;
export const AMMO_45ACP = 4010, AMMO_762X39 = 4011, AMMO_12G = 4012;

const ICON = (name) => `/media/mods/guns/${name}.png`;

export const AMMO = {
  [AMMO_45ACP]: { id: AMMO_45ACP, key: "45acp", name: ".45 ACP Rounds", stack: 60 },
  [AMMO_762X39]: { id: AMMO_762X39, key: "762x39", name: "7.62x39mm Rounds", stack: 60 },
  [AMMO_12G]: { id: AMMO_12G, key: "12g", name: "12 Gauge Shells", stack: 36 },
};

// damage: [[distance in blocks, damage], ...]; the last entry applies beyond every distance (TaCZ damage_adjust).
// reload: magazine guns have tactical (rounds left) and empty times; the M870 loads one shell per `perShell` after `start`.
export const GUNS = {
  [P320]: {
    id: P320, key: "p320", name: "P320", type: "pistol", ammo: AMMO_45ACP, magazine: 12, rpm: 450, modes: ["semi"],
    pellets: 1, damage: [[20, 10], [50, 7], [Infinity, 5]], headshot: 1.75,
    inaccuracy: { stand: 1.8, move: 2, sneak: 1.25, aim: 0.175 },
    reload: { kind: "magazine", tactical: 1.98, empty: 2.48 }, draw: 0.63, aim: 0.16,
  },
  [AKM]: {
    id: AKM, key: "akm", taczKey: "ak47", name: "AKM", type: "rifle", ammo: AMMO_762X39, magazine: 30, rpm: 600, modes: ["auto", "semi"],
    pellets: 1, damage: [[30, 9], [60, 7.5], [Infinity, 6]], headshot: 1.5,
    inaccuracy: { stand: 4.5, move: 5, sneak: 2.5, aim: 0.15 },
    reload: { kind: "magazine", tactical: 2.0, empty: 2.6 }, draw: 0.35, aim: 0.22,
  },
  [M870]: {
    id: M870, key: "m870", name: "M870", type: "shotgun", ammo: AMMO_12G, magazine: 5, rpm: 180, modes: ["semi"],
    // TaCZ's 36 is the whole shot; each of the nine pellets carries a ninth.
    pellets: 9, damage: [[18, 36 / 9], [32, 27 / 9], [Infinity, 18 / 9]], headshot: 1.33,
    inaccuracy: { stand: 3.65, move: 3.7, sneak: 3.65, aim: 3.5 },
    reload: { kind: "shell", start: 0.67, perShell: 0.5 }, draw: 0.25, aim: 0.18,
  },
};

// The `damage` field of a gun stack counts rounds fired from a full magazine, so it saves with the stack like durability does
// without the item being damageable (no `durability`: no wear, repair or Unbreaking). `damageRange` lets PlayerInventory.read keep it.
export const roundsLeft = (stack) => Math.max(0, (GUNS[stack?.id]?.magazine ?? 0) - (stack?.damage | 0));
export const isGun = (id) => GUNS[id] !== undefined;
export const isAmmo = (id) => AMMO[id] !== undefined;

export const GUN_ITEMS = [
  ...Object.values(GUNS).map((g) => ({ id: g.id, name: g.name, stack: 1, damageRange: g.magazine, iconUrl: ICON(g.key), gun: g })),
  ...Object.values(AMMO).map((a) => ({ id: a.id, name: a.name, stack: a.stack, iconUrl: ICON("ammo_" + a.key), ammo: a })),
];
// Creative inventory: appended to the Combat tab (1.7.10 has no tab pages for a 13th tab).
export const CREATIVE_ORDER = [P320, AKM, M870, AMMO_45ACP, AMMO_762X39, AMMO_12G];
