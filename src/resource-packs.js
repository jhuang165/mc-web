// Resource packs (ResourcePackRepository, FileResourcePack / FolderResourcePack, PackMetadataSection; public/research/resource-packs.md).
// A pack is a .zip or a folder holding pack.mcmeta, pack.png and assets/minecraft/**. The selected packs are layered over
// the bundled 1.7.10 assets with the top of the "Selected Resource Packs" list winning. The browser cannot swap files on a
// disk, so applying packs resolves every overridden file once, stores it in IndexedDB and a service worker
// (public/resource-pack-sw.js) answers requests for /media/1.7.10/** and /audio/1.7.10** from that table.
import { readZip } from "./zip-reader.js";

export const ASSETS = "assets/minecraft/";
// PackMetadataSection format of 1.7.10.
export const PACK_FORMAT = 1;
export const DEFAULT_DESCRIPTION = "The default look and feel of Minecraft";
export const INVALID_META = "Invalid pack.mcmeta (or missing 'pack' section)";

const MIME = { png: "image/png", ogg: "audio/ogg", json: "application/json", mcmeta: "application/json" };
const mimeOf = (url) => MIME[url.slice(url.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

// The URLs the game requests for a pack file (assets/minecraft/textures/X -> /media/1.7.10/X, sounds/X -> /audio/1.7.10/X and the
// optional music stream directory), or [] when the game has no use for it here.
export function overrideUrls(entryName) {
  if (!entryName.startsWith(ASSETS) || entryName.endsWith("/") || entryName.includes("..")) return [];
  const rest = entryName.slice(ASSETS.length);
  if (rest.startsWith("textures/") && rest.endsWith(".png")) return ["/media/1.7.10/" + rest.slice(9)];
  if (rest.startsWith("sounds/") && rest.endsWith(".ogg")) return ["/audio/1.7.10/" + rest.slice(7), "/audio/1.7.10-streams/" + rest.slice(7)];
  if (rest === "font/glyph_sizes.bin") return ["/media/1.7.10/font/glyph_sizes.bin"];
  return [];
}

// PackMetadataSection via the lenient Gson reader: { "pack": { "pack_format": 1, "description": "..." } }. The description may be
// a plain string or a chat component with "text".
export function parsePackMcmeta(text) {
  try {
    const pack = JSON.parse(String(text).replace(/^﻿/, ""))?.pack;
    if (!pack || typeof pack !== "object") return { valid: false, packFormat: 0, description: INVALID_META };
    const d = pack.description;
    const description = typeof d === "string" ? d : typeof d?.text === "string" ? d.text : INVALID_META;
    const packFormat = Number.isInteger(pack.pack_format) ? pack.pack_format : 0;
    return { valid: typeof d === "string" || typeof d?.text === "string", packFormat, description };
  } catch {
    return { valid: false, packFormat: 0, description: INVALID_META };
  }
}

// StringTranslate / LanguageMap: key=value lines, '#' comments.
export function parseLang(text) {
  const out = {};
  for (const raw of String(text).replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

// options.txt "resourcePacks": a Gson list of pack names, lowest priority first (ResourcePackRepository.func_148527_a).
export const formatResourcePacksOption = (names) => JSON.stringify(names.filter((n) => typeof n === "string"));
export function parseResourcePacksOption(text) {
  const v = JSON.parse(text);
  if (!Array.isArray(v) || v.some((n) => typeof n !== "string")) throw new Error("JsonSyntaxException");
  return v;
}

// ---- Packs ----
// A pack: { name, kind, entries: Map(name -> { read(): Promise<Uint8Array> }) }.
export function zipPack(name, bytes) {
  return { name, kind: "zip", entries: readZip(bytes) };
}
export function folderPack(name, files) {
  const entries = new Map();
  for (const [path, blob] of Object.entries(files)) entries.set(path, { name: path, directory: false, read: async () => new Uint8Array(await blob.arrayBuffer()) });
  return { name, kind: "folder", entries };
}
const text = async (pack, name) => (pack.entries.has(name) ? new TextDecoder().decode(await pack.entries.get(name).read()) : null);

// The list entry of a pack: name, description (the mcmeta text, or the error line) and the pack.png bytes.
export async function packInfo(pack) {
  const meta = await text(pack, "pack.mcmeta");
  const parsed = meta == null ? { valid: false, packFormat: 0, description: INVALID_META } : parsePackMcmeta(meta);
  const icon = pack.entries.has("pack.png") ? await pack.entries.get("pack.png").read() : null;
  return { name: pack.name, kind: pack.kind, ...parsed, icon };
}

// Override resolution: `packs` run from the lowest priority to the highest, so a later pack wins a URL. Returns Map(url -> { pack, entry }).
export function resolveOverrides(packs) {
  const table = new Map();
  for (const pack of packs) for (const [name, entry] of pack.entries) for (const url of overrideUrls(name)) table.set(url, { pack: pack.name, entry });
  return table;
}
// The merged lang/en_US.lang of the packs in priority order (later packs win keys).
export async function resolveLang(packs) {
  const out = {};
  for (const pack of packs) { const t = await text(pack, ASSETS + "lang/en_US.lang"); if (t != null) Object.assign(out, parseLang(t)); }
  return out;
}

// ---- Storage ----
// Stores: packs (name -> { name, kind, blob | files, added }), overrides (url -> { blob, type }), meta (key -> value).
export function memoryStore() {
  const packs = new Map(), overrides = new Map(), meta = new Map();
  return {
    async listPacks() { return [...packs.keys()].sort(); },
    async getPack(name) { return packs.get(name) ?? null; },
    async putPack(rec) { packs.set(rec.name, rec); },
    async deletePack(name) { packs.delete(name); },
    async replaceOverrides(map) { overrides.clear(); for (const [k, v] of map) overrides.set(k, v); },
    async getOverrides() { return new Map(overrides); },
    async setMeta(k, v) { meta.set(k, v); },
    async getMeta(k) { return meta.get(k) ?? null; },
  };
}
export function indexedDbStore(idb = globalThis.indexedDB) {
  const open = new Promise((resolve, reject) => {
    const r = idb.open("mc-web-resource-packs", 1);
    r.onupgradeneeded = () => { for (const s of ["packs", "overrides", "meta"]) r.result.createObjectStore(s); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const run = async (store, mode, fn) => {
    const db = await open, tx = db.transaction(store, mode), s = tx.objectStore(store);
    const result = fn(s);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  };
  return {
    listPacks: async () => (await run("packs", "readonly", (s) => s.getAllKeys())).sort(),
    getPack: async (name) => (await run("packs", "readonly", (s) => s.get(name))) ?? null,
    putPack: (rec) => run("packs", "readwrite", (s) => s.put(rec, rec.name)),
    deletePack: (name) => run("packs", "readwrite", (s) => s.delete(name)),
    replaceOverrides: (map) => run("overrides", "readwrite", (s) => { s.clear(); for (const [k, v] of map) s.put(v, k); }),
    getOverrides: async () => {
      const db = await open, tx = db.transaction("overrides", "readonly"), s = tx.objectStore("overrides");
      const keys = s.getAllKeys(), values = s.getAll();
      return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(new Map(keys.result.map((k, i) => [k, values.result[i]]))); tx.onerror = () => reject(tx.error); });
    },
    setMeta: (k, v) => run("meta", "readwrite", (s) => s.put(v, k)),
    getMeta: async (k) => (await run("meta", "readonly", (s) => s.get(k))) ?? null,
  };
}

// Adds a dropped/picked file or a folder (a File list with webkitRelativePath) to the store; returns the pack name.
export async function addPackFromFile(store, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  readZip(bytes); // throws on a file that is not a zip
  await store.putPack({ name: file.name, kind: "zip", blob: new Blob([bytes]), added: Date.now() });
  return file.name;
}
export async function addPackFromFolder(store, files) {
  const list = [...files];
  const root = list[0]?.webkitRelativePath.split("/")[0];
  if (!root) throw new Error("Empty folder");
  const entries = {};
  for (const f of list) entries[f.webkitRelativePath.slice(root.length + 1)] = f;
  await store.putPack({ name: root, kind: "folder", files: entries, added: Date.now() });
  return root;
}
export async function openStoredPack(rec) {
  return rec.kind === "zip" ? zipPack(rec.name, new Uint8Array(await rec.blob.arrayBuffer())) : folderPack(rec.name, rec.files);
}

// ResourcePackRepository.setRepositories + refreshResources: resolves the selected packs (lowest priority first) into the
// override table the worker serves and the merged lang the menus read. Returns a summary.
export async function applyPacks(names, store) {
  const packs = [];
  for (const name of names) { const rec = await store.getPack(name); if (rec) packs.push(await openStoredPack(rec)); }
  const table = resolveOverrides(packs), overrides = new Map();
  for (const [url, { entry }] of table) overrides.set(url, { blob: new Blob([await entry.read()], { type: mimeOf(url) }), type: mimeOf(url) });
  const lang = await resolveLang(packs);
  await store.replaceOverrides(overrides);
  await store.setMeta("lang", lang);
  return { packs: packs.map((p) => p.name), overrides: overrides.size, lang: Object.keys(lang).length };
}

// ---- Browser glue ----
let sharedStore = null;
export const packStore = () => (sharedStore ??= indexedDbStore());
export async function registerPackWorker() {
  if (!("serviceWorker" in navigator)) return null;
  await navigator.serviceWorker.register("/resource-pack-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}
export async function refreshWorker() {
  const reg = await registerPackWorker();
  reg?.active?.postMessage({ type: "refresh" });
}
// Page start: pack lang entries replace the strings of `lang` (the menu table).
export async function initResourcePacks(options, lang) {
  if (!options?.resourcePacks?.length || typeof indexedDB === "undefined") return;
  try { Object.assign(lang, (await packStore().getMeta("lang")) ?? {}); } catch {}
}

// ---- GuiScreenResourcePacks lists ----
// `available` and `selected` hold pack names. `selected` is shown top to bottom, the top winning, and the "Default" entry
// (the bundled assets) is always below it; options.txt stores the selected names bottom to top.
export class PackLists {
  constructor(all, chosen = []) {
    const known = new Set(all);
    this.selected = [...chosen].filter((n, i, a) => known.has(n) && a.indexOf(n) === i).reverse();
    this.available = all.filter((n) => !this.selected.includes(n));
  }
  // bgg.a(...) clicks: the right arrow of an available entry puts it at the top of the selected list...
  select(name) {
    if (!this.available.includes(name)) return false;
    this.available = this.available.filter((n) => n !== name);
    this.selected.unshift(name);
    return true;
  }
  // ...the left arrow of a selected entry puts it at the top of the available list...
  deselect(name) {
    if (!this.selected.includes(name)) return false;
    this.selected = this.selected.filter((n) => n !== name);
    this.available.unshift(name);
    return true;
  }
  // ...and the up / down arrows swap it with its neighbour in the selected list.
  canMoveUp(name) { return this.selected.indexOf(name) > 0; }
  canMoveDown(name) { const i = this.selected.indexOf(name); return i >= 0 && i < this.selected.length - 1; }
  moveUp(name) { return this.#move(name, -1); }
  moveDown(name) { return this.#move(name, 1); }
  #move(name, d) {
    const i = this.selected.indexOf(name), j = i + d;
    if (i < 0 || j < 0 || j >= this.selected.length) return false;
    this.selected.splice(i, 1);
    this.selected.splice(j, 0, name);
    return true;
  }
  // The options.txt order (lowest priority first).
  get names() { return [...this.selected].reverse(); }
}
// ResourcePackRepository.setRepositories only refreshes resources when the selection changed.
export const sameSelection = (a = [], b = []) => a.length === b.length && a.every((n, i) => n === b[i]);
