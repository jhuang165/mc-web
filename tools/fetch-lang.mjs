// npm run lang:fetch — installs the original Minecraft 1.7.10 language files (assets/minecraft/lang/*.lang, about 70 languages)
// and the language table of pack.mcmeta (names, regions, bidirectional) into public/lang/1.7.10/, which Git ignores. The game
// reads public/lang/1.7.10/manifest.json; without it the Language screen offers English (US) only (en_US.lang is built in).
// Every file comes from the 1.7.10 asset index (SHA-1 1863782e33ce7b584fc45b037325a1964e095d3e) and is SHA-1 checked against it,
// like tools/fetch-music-streams.mjs (same sources: $MC_ASSET_INDEX, tools/research/assets-1.7.10.json, the launcher folders,
// then Mojang's hosts; objects from $MC_ASSETS, the launcher's assets/objects or resources.download.minecraft.net).
// Original Minecraft language files © Mojang / Microsoft; they are not redistributed in this repository.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const INDEX_SHA1 = "1863782e33ce7b584fc45b037325a1964e095d3e";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), out = path.join(root, "public/lang/1.7.10");
const sha1 = (b) => createHash("sha1").update(b).digest("hex");
const launcher = [path.join(os.homedir(), "Library/Application Support/minecraft"), path.join(os.homedir(), ".minecraft"), process.env.APPDATA && path.join(process.env.APPDATA, ".minecraft")].filter(Boolean);
async function local(p, hash) { try { const b = await readFile(p); return sha1(b) === hash ? b : null; } catch { return null; } }
async function remote(url, hash) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(60000) }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return sha1(b) === hash ? b : null; } catch { return null; }
}
async function first(sources, hash) { for (const s of sources) { const b = s.startsWith("http") ? await remote(s, hash) : await local(s, hash); if (b) return b; } return null; }
const parents = []; for (let d = root, i = 0; i < 6; i++, d = path.dirname(d)) parents.push(path.join(d, "tools/research/assets-1.7.10.json"));
const indexBytes = await first([process.env.MC_ASSET_INDEX, ...parents, ...launcher.map((d) => path.join(d, "assets/indexes/1.7.10.json")),
  `https://launchermeta.mojang.com/v1/packages/${INDEX_SHA1}/1.7.10.json`].filter(Boolean), INDEX_SHA1);
if (!indexBytes) throw new Error("The 1.7.10 asset index was not found (set MC_ASSET_INDEX to a copy of 1.7.10.json).");
const objects = JSON.parse(indexBytes).objects;
const sources = (hash) => [process.env.MC_ASSETS && path.join(process.env.MC_ASSETS, "objects", hash.slice(0, 2), hash),
  ...launcher.map((d) => path.join(d, "assets/objects", hash.slice(0, 2), hash)), `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`].filter(Boolean);
const meta = objects["pack.mcmeta"];
const metaBytes = await first(sources(meta.hash), meta.hash);
if (!metaBytes) throw new Error("pack.mcmeta from the 1.7.10 index was not found (set MC_ASSETS to a launcher assets folder).");
const table = JSON.parse(metaBytes.toString("utf8")).language;
await mkdir(out, { recursive: true });
const languages = { en_US: { ...table.en_US, builtin: true } }, missing = [];
let total = 0;
for (const code of Object.keys(table).sort()) {
  if (code === "en_US") continue;
  const entry = objects[`minecraft/lang/${code}.lang`];
  if (!entry) { missing.push(code); continue; }
  const file = path.join(out, code + ".lang");
  let bytes = await local(file, entry.hash);
  if (!bytes) { bytes = await first(sources(entry.hash), entry.hash); if (!bytes) { missing.push(code); continue; } await writeFile(file, bytes); }
  languages[code] = { ...table[code], file: `${code}.lang`, sha1: entry.hash, bytes: entry.size };
  total += entry.size;
}
if (missing.length) throw new Error(`Missing ${missing.length} language(s): ${missing.join(", ")} (set MC_ASSETS to a launcher assets folder).`);
await writeFile(path.join(out, "manifest.json"), JSON.stringify({ target: "Minecraft Java 1.7.10", assetIndexSha1: INDEX_SHA1, packMcmetaSha1: meta.hash,
  credit: "Original Minecraft language files © Mojang / Microsoft. Installed locally by npm run lang:fetch; not redistributed in Git.", languages }, null, 2) + "\n");
console.log(`${Object.keys(languages).length - 1} language files (${(total / 1e6).toFixed(1)} MB) and the pack.mcmeta table in public/lang/1.7.10/`);
