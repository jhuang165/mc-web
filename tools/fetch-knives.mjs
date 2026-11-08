// npm run mods:fetch-knives [pack.zip ...] — installs LR Tactical melee packs (TaCZ-style "gun packs" holding melee
// weapons, such as the CS2 Knifes Pack) from local zips into public/mods/lrtactical/, which Git ignores. Nothing from a pack
// is committed to this repository; the game reads the files as they are at run time (src/mods/guns/melee.js).
//
// Without arguments it reads the CS2 Knifes Pack v1.0.1 (namespace cs2_wt) from the CurseForge instance it was installed
// into, ~/Documents/curseforge/minecraft/Instances/cs2 knife/tacz/; $KNIFE_PACKS may list zips instead (":"-separated).
// Each pack keeps its own credits and terms: the files are copied byte for byte, and the only files written here are this
// project's own listing, public/mods/lrtactical/index.json, and a CREDITS.txt naming the source zips.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { zipEntries } from "./zip-entries.mjs";

const DEFAULT = path.join(os.homedir(), "Documents/curseforge/minecraft/Instances/cs2 knife/tacz/CS2 Knifes Pack v1.0.1.zip");
// The pack files the game reads, relative to the pack root, for namespace NS (specular and normal maps, Lua state machines
// and player animator files are left out: nothing here uses them).
const wanted = (ns) => [
  new RegExp(`^data/${ns}/index/melee/[^/]+\\.json$`),
  new RegExp(`^assets/${ns}/display/melee/[^/]+\\.json$`),
  new RegExp(`^assets/${ns}/geo_models/.+\\.json$`),
  new RegExp(`^assets/${ns}/animations/.+\\.animation\\.json$`),
  new RegExp(`^assets/${ns}/textures/.+\\.png$`),
  new RegExp(`^assets/${ns}/lang/[a-z_]+\\.json$`),
  new RegExp(`^assets/${ns}/tacz_sounds/.+\\.ogg$`),
];
const SKIP = /_[ns]\.png$/;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = path.join(root, "public/mods/lrtactical");
const zips = process.argv.slice(2).length ? process.argv.slice(2) : process.env.KNIFE_PACKS ? process.env.KNIFE_PACKS.split(":") : [DEFAULT];

await rm(out, { recursive: true, force: true });
const index = { packs: [] }, credits = [];
for (const file of zips) {
  const zip = await readFile(file);
  const entries = [...zipEntries(zip)];
  // The pack root holds gunpack.meta.json (a zip may wrap it in one folder).
  const meta = entries.find((e) => /(^|\/)gunpack\.meta\.json$/.test(e.name));
  if (!meta) throw new Error(`${file}: no gunpack.meta.json`);
  const prefix = meta.name.slice(0, -"gunpack.meta.json".length);
  const ns = JSON.parse(meta.read().toString("utf8")).namespace;
  if (!/^[a-z0-9_.-]+$/.test(ns ?? "")) throw new Error(`${file}: bad namespace ${ns}`);
  const want = wanted(ns), files = [];
  for (const e of entries) {
    if (!e.name.startsWith(prefix)) continue;
    const rel = e.name.slice(prefix.length);
    if (!want.some((w) => w.test(rel)) || SKIP.test(rel)) continue;
    const data = e.read();
    if (!data) continue;
    const dest = path.join(out, ns, rel);
    if (!dest.startsWith(path.join(out, ns) + path.sep)) continue; // no path escapes
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
    files.push(rel);
  }
  files.sort();
  const list = (re) => files.map((f) => f.match(re)?.[1]).filter(Boolean);
  const pack = {
    namespace: ns, file: path.basename(file), sha256: createHash("sha256").update(zip).digest("hex"),
    melee: list(new RegExp(`^data/${ns}/index/melee/(.+)\\.json$`)),
    lang: list(new RegExp(`^assets/${ns}/lang/(.+)\\.json$`)),
    sounds: list(new RegExp(`^assets/${ns}/tacz_sounds/(.+)\\.ogg$`)),
  };
  index.packs.push(pack);
  credits.push(`${pack.file} (namespace ${ns}, sha256 ${pack.sha256.slice(0, 16)}...)`);
  console.log(`installed ${files.length} files from ${pack.file}: ${pack.melee.length} melee weapons, ${pack.sounds.length} sounds`);
}
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 1));
await writeFile(path.join(out, "CREDITS.txt"), [
  "LR Tactical melee packs installed locally by tools/fetch-knives.mjs from:", ...credits.map((c) => "  " + c),
  "The files are the packs' own, unmodified, under their authors' terms; this repository does not redistribute them.", "",
].join("\n"));
