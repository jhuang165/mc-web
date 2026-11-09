// Guns mod (not 1.7.10): adds the locally installed TaCZ sounds (npm run mods:fetch-tacz, Git-ignored) to a SoundBank as
// "guns.<path>" events in the player category, where <path> is the file under the pack's tacz_sounds/ folder without
// ".ogg" ("ak47/ak47_shoot", "dry_fire"). Without the install, the index fetch fails and guns stay silent.
// The LR Tactical melee packs' sounds (melee.js) join as "guns.<namespace>:<path>", the name their animation keyframes give.
import { PACK_ROOT, packUrl } from "./pack.js";
import { CS2_ROOT } from "./resources.js";
import { MELEE_ROOT, meleeUrl } from "./melee.js";

const installed = new WeakMap(); // SoundBank -> Promise<boolean>

export const gunSoundEvent = (path) => `guns.${path}`;
const fileName = (path) => path.startsWith('cs2:') ? `mods/cs2/${path.slice(4)}` : `mods/tacz/${path}`;

// Adds the files and events to both the bank's vanilla base table (resource-pack refreshes rebuild the manifest from it)
// and its current manifest. Once per bank.
export function installGunSounds(bank, load = (url) => fetch(url).then((r) => (r.ok ? r.json() : null))) {
  if (!bank) return Promise.resolve(false);
  if (!installed.has(bank)) {
    installed.set(bank, (async () => {
      const [index, meleeIndex, cs2Index, cs2Events] = await Promise.all([load(`${PACK_ROOT}index.json`).catch(() => null), load(`${MELEE_ROOT}index.json`).catch(() => null),
        load(`${CS2_ROOT}index.json`).catch(() => null), load(`${CS2_ROOT}pack/assets/cs2/sounds.json`).catch(() => null), bank.ready]);
      const packs = Array.isArray(meleeIndex?.packs) ? meleeIndex.packs : [];
      if ((!Array.isArray(index?.sounds) && !packs.length && !cs2Index) || !bank.base) return false;
      const files = {}, events = {};
      for (const path of index?.sounds ?? []) {
        files[fileName(path)] = { url: packUrl.sound(path) };
        events[gunSoundEvent(path)] = { category: "player", sounds: [fileName(path)] };
      }
      for (const p of packs) for (const path of p.sounds ?? []) {
        const name = `mods/lrtactical/${p.namespace}/${path}`;
        files[name] = { url: meleeUrl.sound(path, p.namespace) };
        events[gunSoundEvent(`${p.namespace}:${path}`)] = { category: "player", sounds: [name] };
      }
      for (const path of cs2Index?.sounds ?? []) {
        const name = `mods/cs2/${path}`;
        files[name] = { url: packUrl.sound(`cs2:${path}`) };
        events[gunSoundEvent(`cs2:${path}`)] = { category: "player", sounds: [name] };
      }
      // Sound-event aliases may refer to several weighted files rather than a same-named .ogg.
      for (const [event, definition] of Object.entries(cs2Events ?? {})) {
        const sounds = (definition.sounds ?? []).map(sound => {
          const value = typeof sound === "string" ? { name: sound } : sound;
          const name = String(value.name ?? "").replace(/^cs2:/, "").replace(/^tacz_sounds\//, "");
          const file = `mods/cs2/${name}`;
          return files[file] ? { ...value, name: file } : null;
        }).filter(Boolean);
        if (sounds.length) events[gunSoundEvent(`cs2:${event}`)] = { category: "player", sounds };
      }
      for (const table of [bank.base, bank.manifest]) {
        if (!table) continue;
        Object.assign(table.files, files);
        Object.assign(table.events, events);
      }
      return true;
    })());
  }
  return installed.get(bank);
}

// Plays a gun sound at the player (no position: TaCZ's first-person sounds follow the shooter).
export async function playGunSound(bank, event, options = {}) {
  if (!bank || !(await installGunSounds(bank))) return false;
  return bank.play(event, options);
}
// Decodes a gun's sounds ahead of its first shot (only once the bank has an audio context, after a user gesture).
// `folder` is the gun's sound folder (the first part of its sound paths).
export async function preloadGunSounds(bank, folder) {
  if (!bank?.context || !folder || !(await installGunSounds(bank))) return;
  const prefix = fileName(folder + "/");
  for (const name of Object.keys(bank.manifest?.files ?? {}))
    if (name.startsWith(prefix) && !/_inspect|_silence|_3p$/.test(name)) bank.buffer(name); // the clips a gun can play here
}
