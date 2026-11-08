// npm run mods:fetch-tacz — installs the TaCZ default gun pack (every gun's and attachment's model, textures, animations,
// display, data, recipes, names and sounds, and the attachment tags) from the official TaCZ release into public/mods/tacz/,
// which Git ignores. Nothing from TaCZ is committed to this repository; the game reads these files as they are at run time
// (src/mods/guns/pack.js).
//
// Source: [TaCZ] Timeless and Classics Zero by MCModderAnchor (https://github.com/MCModderAnchor/TACZ), the Modrinth file
// tacz-forge-1.20.1-1.2.0.jar, checked against its SHA-512. TaCZ's assets are licensed CC BY-NC-ND 4.0
// (https://creativecommons.org/licenses/by-nc-nd/4.0/): non-commercial use with attribution, files kept unmodified. They are
// copied byte for byte; the only file written here is this project's own listing, public/mods/tacz/index.json.
// $TACZ_JAR may point at a local copy of the same jar instead of downloading it.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { zipEntries as entries } from "./zip-entries.mjs";

const URL = "https://cdn.modrinth.com/data/SzzJttH8/versions/QGCbNkTy/tacz-forge-1.20.1-1.2.0.jar";
const SHA512 = "7784dd103fbaa5d26a6130ae6a716a1909f93c126fd226193b21dec38f8c345b0044e9e392a1aa6737e468a346b7e95dc38a3e76f22ecaf37cef438ae57874c1";
const PACK = "assets/tacz/custom/tacz_default_gun/";
// The pack files the game reads, relative to the pack root (normal and specular maps, blocks, Lua scripts and player
// animator files are left out: nothing here uses them).
const WANTED = [
  /^assets\/tacz\/geo_models\/(gun|attachment)\/(lod\/)?[^/]+\.json$/,
  /^assets\/tacz\/animations\/[^/]+\.animation\.json$/,
  /^assets\/tacz\/display\/(guns|ammo|attachments)\/[^/]+\.json$/,
  /^assets\/tacz\/textures\/(gun|attachment)\/(uv|lod|slot)\/[^/_]+(_[a-z0-9]+)*\.png$/,
  /^assets\/tacz\/textures\/ammo\/slot\/[^/]+\.png$/,
  /^assets\/tacz\/textures\/flash\/[^/]+\.png$/,
  /^assets\/tacz\/lang\/en_us\.json$/,
  /^assets\/tacz\/tacz_sounds\/.+\.ogg$/,
  /^data\/tacz\/index\/(guns|ammo|attachments)\/[^/]+\.json$/,
  /^data\/tacz\/data\/(guns|attachments)\/[^/]+\.json$/,
  /^data\/tacz\/recipes\/(gun|ammo|attachments)\/[^/]+\.json$/,
  // Which attachments each gun takes: allow_attachments/<gun>.json, listing attachment ids and #tags (the other files).
  /^data\/tacz\/tacz_tags\/attachments\/.+\.json$/,
];
// Normal (_n) and specular (_s) maps share the textures' folders; the game draws only the colour map.
const SKIP = /\/textures\/(gun|attachment)\/uv\/[^/]+_[ns]\.png$/;
// The mod's own fallback animations (use_default_animation: rifle / pistol), outside the pack.
const BASE = /^assets\/tacz\/animations\/[^/]+_default\.animation\.json$/;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = path.join(root, "public/mods/tacz");

async function jar() {
  const b = process.env.TACZ_JAR ? await readFile(process.env.TACZ_JAR)
    : Buffer.from(await (await fetch(URL, { signal: AbortSignal.timeout(300000) })).arrayBuffer());
  const hash = createHash("sha512").update(b).digest("hex");
  if (hash !== SHA512) throw new Error(`TaCZ jar SHA-512 mismatch (${hash.slice(0, 16)}...)`);
  return b;
}
const zip = await jar();
await rm(out, { recursive: true, force: true });
await rm(path.join(root, "public/audio/mods/tacz"), { recursive: true, force: true }); // the sounds-only install this replaces
const files = [];
for (const e of entries(zip)) {
  let rel = null;
  if (e.name.startsWith(PACK)) {
    const r = e.name.slice(PACK.length);
    if (WANTED.some((w) => w.test(r)) && !SKIP.test(r)) rel = "pack/" + r;
  } else if (BASE.test(e.name)) rel = "base/" + e.name;
  if (!rel) continue;
  const data = e.read();
  if (!data) continue;
  await mkdir(path.join(out, path.dirname(rel)), { recursive: true });
  await writeFile(path.join(out, rel), data);
  files.push(rel);
}
files.sort();
const list = (re) => files.map((f) => f.match(re)?.[1]).filter(Boolean);
const index = {
  source: URL, sha512: SHA512, license: "CC BY-NC-ND 4.0",
  credits: "[TaCZ] Timeless and Classics Zero by MCModderAnchor and contributors, https://github.com/MCModderAnchor/TACZ",
  guns: list(/^pack\/data\/tacz\/index\/guns\/(.+)\.json$/),
  ammo: list(/^pack\/data\/tacz\/index\/ammo\/(.+)\.json$/),
  attachments: list(/^pack\/data\/tacz\/index\/attachments\/(.+)\.json$/),
  attachmentTags: list(/^pack\/data\/tacz\/tacz_tags\/attachments\/(.+)\.json$/),
  recipes: list(/^pack\/data\/tacz\/recipes\/(.+)\.json$/),
  animations: list(/^pack\/assets\/tacz\/animations\/(.+)\.animation\.json$/),
  defaults: list(/^base\/assets\/tacz\/animations\/(.+)\.animation\.json$/),
  sounds: list(/^pack\/assets\/tacz\/tacz_sounds\/(.+)\.ogg$/),
};
await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 1));
await writeFile(path.join(out, "CREDITS.txt"), [
  "Models, textures, animations, data, names and sounds from [TaCZ] Timeless and Classics Zero",
  "by MCModderAnchor and contributors: https://github.com/MCModderAnchor/TACZ",
  "(tacz-forge-1.20.1-1.2.0.jar, default gun pack)",
  "Licensed CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/",
  "Installed locally by tools/fetch-tacz.mjs; unmodified; not redistributed by this repository.", "",
].join("\n"));
console.log(`installed ${files.length} TaCZ files (${index.guns.length} guns, ${index.ammo.length} ammo, ${index.attachments.length} attachments, ${index.sounds.length} sounds) into ${path.relative(root, out)}`);
