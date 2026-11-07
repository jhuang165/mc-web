// In-browser Java save-folder import (Priority 5): the same steps as tools/import-java-region.mjs --save, on files the user picked
// with <input webkitdirectory> or showDirectoryPicker. It reads level.dat, the player (Data.Player, else playerdata/<uuid>.dat,
// else players/<name>.dat), stats/<uuid>.json and the overworld region files that cover ONE 8x8 chunk area around the player (else
// the world spawn), and hands them to importJavaRegionArea. The result is a Blockworld export object for the Import pipeline.
// Not imported: the other 8x8-chunk areas, DIM-1 and DIM1 regions (a level import keeps the overworld frame), data/*.dat other
// than what the exporter writes. Limit stated honestly in public/research/hardcore.md and level-dat.md.
import { REGION_LIMIT } from "./region-inspection.js";
import { importJavaRegionArea } from "./region-import.js";
import { javaPlayerFromNbt, readLevelDat, readPlayerDat } from "./level-dat.js";

const SMALL_LIMIT = 16 << 20;

// entries: [{path, size, modified?, read(): Promise<Uint8Array|ArrayBuffer>}]; path is "Folder/level.dat" (webkitRelativePath) or
// "level.dat" (a directory handle walk). Returns {prefix, files: Map(relative path -> entry)} for the shallowest level.dat.
export function indexSave(entries) {
  const clean = entries.map((e) => ({ ...e, path: String(e.path).replace(/\\/g, "/").replace(/^\/+/, "") }));
  const levels = clean.filter((e) => /(^|\/)level\.dat$/.test(e.path)).sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  if (!levels.length) throw new Error("This folder has no level.dat. Choose the Java save folder itself (the one that holds level.dat and region/).");
  if (levels[0].path.split("/").length > 2) throw new Error("level.dat is nested too deeply; choose the Java save folder itself.");
  const prefix = levels[0].path.slice(0, -"level.dat".length);
  const files = new Map(clean.filter((e) => e.path.startsWith(prefix)).map((e) => [e.path.slice(prefix.length), e]));
  return { prefix, folder: prefix.replace(/\/$/, "").split("/").pop() || "", files };
}

export async function bytesOf(entry, limit) {
  if (entry.size > limit) throw new Error(`${entry.path}: larger than ${limit >> 20} MiB`);
  const data = await entry.read();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length > limit) throw new Error(`${entry.path}: larger than ${limit >> 20} MiB`);
  return bytes;
}
export const inDir = (files, dir, ext) => [...files].filter(([p]) => p.startsWith(dir + "/") && p.slice(dir.length + 1).indexOf("/") < 0 && p.endsWith(ext));

// SaveHandler.readPlayerData: playerdata/<uuid>.dat since 1.7.6, players/<name>.dat before. With several players the most recently
// written file is taken (the CLI asks for --player-file instead); the choice is reported.
export function pickPlayer(files) {
  for (const dir of ["playerdata", "players"]) {
    const list = inDir(files, dir, ".dat").map(([, e]) => e);
    if (!list.length) continue;
    list.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
    return { entry: list[0], count: list.length };
  }
  return null;
}
export function pickStats(files, player) {
  const list = inDir(files, "stats", ".json").map(([p, e]) => [p.slice(6), e]);
  const uuid = player && player.path.split("/").pop().replace(/\.dat$/, "");
  const named = uuid && list.find(([n]) => n === `${uuid}.json`);
  return named ? named[1] : list.length === 1 ? list[0][1] : null;
}

/** The 8x8 chunk area the import covers: the saved overworld position of the player, else the world spawn. */
export function areaAround(level, playerTag) {
  const p = playerTag ? javaPlayerFromNbt(playerTag, { convertItem: () => null }) : null;
  const centre = p?.position && p.dimension === 0 ? [p.position.x, p.position.z] : [level.spawn[0], level.spawn[2]];
  return { chunkX: Math.floor(centre[0] / 16) - 4, chunkZ: Math.floor(centre[1] / 16) - 4, width: 8, depth: 8, around: p?.position && p.dimension === 0 ? "player" : "spawn" };
}

/** Convert a picked save folder. Returns {record, report}; record is a Blockworld export (format "blockworld"). */
export async function importSaveFolder(entries, options = {}) {
  const { files, folder } = indexSave(entries);
  const level = await readLevelDat(await bytesOf(files.get("level.dat"), SMALL_LIMIT));
  const chosen = pickPlayer(files);
  const opts = { level, ...(options.name ? { name: options.name } : {}) };
  if (!level.player && chosen) opts.player = await readPlayerDat(await bytesOf(chosen.entry, SMALL_LIMIT));
  const stats = pickStats(files, chosen?.entry);
  if (stats) opts.stats = new TextDecoder().decode(await bytesOf(stats, SMALL_LIMIT));
  const { around, ...area } = areaAround(level, opts.player ?? level.player);
  opts.area = area;
  const regions = [];
  for (let rx = area.chunkX >> 5; rx <= (area.chunkX + area.width - 1) >> 5; rx++)
    for (let rz = area.chunkZ >> 5; rz <= (area.chunkZ + area.depth - 1) >> 5; rz++) {
      const entry = files.get(`region/r.${rx}.${rz}.mca`);
      if (entry) regions.push({ filename: `r.${rx}.${rz}.mca`, bytes: await bytesOf(entry, REGION_LIMIT) });
    }
  const result = await importJavaRegionArea(regions, opts);
  const regionCount = inDir(files, "region", ".mca").length;
  result.report.save = {
    folder, area: { ...area, around }, regionFilesRead: regions.map((r) => r.filename), regionFilesInSave: regionCount,
    playerFile: !level.player && chosen ? { name: chosen.entry.path.split("/").pop(), of: chosen.count } : null,
    statsFile: stats ? stats.path.split("/").pop() : null,
    notImported: [
      ...(regionCount > regions.length ? [`${regionCount - regions.length} other region file(s): the rest of the world regenerates from the seed`] : []),
      ...(files.size && [...files.keys()].some((p) => /^DIM-?1\/region\//.test(p)) ? ["DIM-1 and DIM1 regions (Nether and End)"] : []),
    ],
  };
  return result;
}

// <input type=file webkitdirectory>: File objects carry webkitRelativePath.
export const entriesFromFileList = (list) => [...list].map((f) => ({ path: f.webkitRelativePath || f.name, size: f.size, modified: f.lastModified, read: () => f.arrayBuffer() }));

// showDirectoryPicker: walk only what the importer reads (level.dat, playerdata, players, stats, data, region and the
// region folders of DIM-1 and DIM1).
export async function entriesFromDirectoryHandle(root) {
  const out = [];
  const walk = async (dir, prefix, allowed) => {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await handle.getFile();
        out.push({ path: prefix + name, size: file.size, modified: file.lastModified, read: () => handle.getFile().then((f) => f.arrayBuffer()) });
      } else if (allowed?.[name]) await walk(handle, `${prefix}${name}/`, allowed[name] === true ? null : allowed[name]);
    }
  };
  await walk(root, "", { playerdata: true, players: true, stats: true, region: true, data: true, "DIM-1": { region: true }, DIM1: { region: true } });
  return out;
}
