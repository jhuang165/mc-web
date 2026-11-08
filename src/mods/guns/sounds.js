// Guns mod (not 1.7.10): adds the locally installed TaCZ sounds (npm run mods:fetch-tacz, Git-ignored) to a SoundBank as
// "guns.<path>" events in the player category, where <path> is the file under the pack's tacz_sounds/ folder without
// ".ogg" ("ak47/ak47_shoot", "dry_fire"). Without the install, the index fetch fails and guns stay silent.
import { PACK_ROOT, packUrl } from "./pack.js";

const installed = new WeakMap(); // SoundBank -> Promise<boolean>

export const gunSoundEvent = (path) => `guns.${path}`;
const fileName = (path) => `mods/tacz/${path}`;

// Adds the files and events to both the bank's vanilla base table (resource-pack refreshes rebuild the manifest from it)
// and its current manifest. Once per bank.
export function installGunSounds(bank, load = (url) => fetch(url).then((r) => (r.ok ? r.json() : null))) {
  if (!bank) return Promise.resolve(false);
  if (!installed.has(bank)) {
    installed.set(bank, (async () => {
      const [index] = await Promise.all([load(`${PACK_ROOT}index.json`).catch(() => null), bank.ready]);
      if (!Array.isArray(index?.sounds) || !bank.base) return false;
      const files = {}, events = {};
      for (const path of index.sounds) {
        files[fileName(path)] = { url: packUrl.sound(path) };
        events[gunSoundEvent(path)] = { category: "player", sounds: [fileName(path)] };
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
