// The gun server reads the same private pack JSON the browser downloads, from a directory laid out like public/mods/
// (tacz/, cs2/, lrtactical/). Only gameplay metadata is read; models, textures and sounds are never loaded or served.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { installGunPacks } from '../src/mods/guns/load-packs.js';
import { setGunsEnabled } from '../src/mods/guns/install.js';
import { ITEMS, setExtraCrafting } from '../src/survival.js';
import { packFingerprint } from '../src/multiplayer/fingerprint.js';

// '/mods/<file>' -> text under `dir`, or null for anything missing, outside it or not JSON.
export function diskFetcher(dir) {
  const root = path.resolve(dir);
  return async url => {
    const m = /^\/mods\/([^?#]+)$/.exec(String(url));
    if (!m) return null;
    let rel;
    try { rel = decodeURIComponent(m[1]); } catch { return null; }
    if (!/\.(json|mcmeta|lang)$/i.test(rel)) return null;
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) return null;
    try { return await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') return null; throw error; }
  };
}

// Registers the guns, ammo, attachments, knives and their recipes, then returns the weapon-rules fingerprint clients must match.
export async function installGunRules({ packDir = null, fetchText = packDir ? diskFetcher(packDir) : null } = {}) {
  const raw = fetchText ? await installGunPacks(fetchText) : null;
  setGunsEnabled(true, { items: ITEMS, combatTab: [], search: [], setCrafting: setExtraCrafting });
  return { pack: await packFingerprint(), installed: !!raw };
}
