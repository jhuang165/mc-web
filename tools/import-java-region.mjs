// WORLD-03g: convert an area of Java 1.7.10 region files into a new Blockworld export.
import {open, readdir, stat} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {REGION_LIMIT} from '../src/region-inspection.js';
import {importJavaRegionArea} from '../src/region-import.js';
import {wholeSaveRecord} from '../src/whole-save-cli.js';
import {javaPlayerFromNbt, readLevelDat, readPlayerDat} from '../src/level-dat.js';

const USAGE = `Usage: node tools/import-java-region.mjs [options] --out new.blockworld.json r.X.Z.mca [r.X.Z.mca ...]
       node tools/import-java-region.mjs --save SAVE_DIR [--area ...] [--player-file F] [--stats F] --out new.blockworld.json
  --save DIR                           a 1.7.10 save folder: level.dat, the overworld regions covering the area, the
                                       player (Data.Player, else the only playerdata/<uuid>.dat or players/<name>.dat)
                                       and stats/<uuid>.json; the world continues with the save's seed and WorldType
  --whole-save                         with --save: convert the whole save (every region file of the overworld, Nether and End)
                                       and embed the stored full columns under "bases" in the .blockworld.json (the browser
                                       importer writes them back); columns beyond ~96 MiB of JSON are left out and counted in
                                       wholeSave.basesOmitted (they regenerate from the seed). No --area options apply.
  --level level.dat                    read the generator, flags and player from this level.dat (with region paths)
  --player-file PLAYER.dat             a playerdata/<uuid>.dat or players/<name>.dat instead of Data.Player
  --stats stats.json                   a stats/<uuid>.json for the statistics and achievements
  --generation 13|15                   streamed generation version for a level import (default 15; 13 with MapFeatures off)
  --area chunkX,chunkZ[,width,depth]  source chunks (width/depth 1-8, default 8); default: the seed's generator area
  --nether-area chunkX,chunkZ[,width,depth]  use paths under DIM-1/region
  --end-area chunkX,chunkZ[,width,depth]     use paths under DIM1/region
  --seed SEED                          source world seed (level.dat RandomSeed); default 1710
  --landscape java|javaAmplified|javaLargeBiomes
  --destination chunkX,chunkZ          live chunk of the area's north-west corner (0-7)
  --missing generated|air              fill for absent chunks (default generated)
  --survival                           start in Survival instead of Creative
  --name NAME                          world name (40 characters kept)
  --no-sky                             decode chunks without SkyLight arrays
  --report path.json                   also write the conversion report to a new file`;

async function readBounded(path) {
  const source = await open(path, 'r');
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.size > REGION_LIMIT) throw new Error(`${path}: expected a region file up to 64 MiB`);
    const bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const {bytesRead} = await source.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw new Error(`${path}: truncated during read`);
      offset += bytesRead;
    }
    return bytes;
  } finally { await source.close(); }
}
const exists = (path) => stat(path).then(() => true, () => false);
const list = (dir) => readdir(dir).catch(() => []);
async function readSmall(path, limit = 16 << 20) {
  const info = await stat(path);
  if (!info.isFile() || info.size > limit) throw new Error(`${path}: expected a file up to ${limit >> 20} MiB`);
  return readBounded(path);
}
// SaveHandler.readPlayerData: playerdata/<uuid>.dat since 1.7.6, players/<name>.dat before. A folder with several players
// needs --player-file; the stats file follows the chosen uuid (stats/<uuid>.json).
async function savePlayer(dir) {
  for (const sub of ['playerdata', 'players']) {
    const files = (await list(join(dir, sub))).filter((f) => f.endsWith('.dat'));
    if (files.length > 1) throw new Error(`${join(dir, sub)} has ${files.length} players; choose one with --player-file`);
    if (files.length) return join(dir, sub, files[0]);
  }
  return null;
}
async function saveStats(dir, playerPath) {
  const files = (await list(join(dir, 'stats'))).filter((f) => f.endsWith('.json'));
  const uuid = playerPath && basename(playerPath, '.dat');
  if (uuid && files.includes(`${uuid}.json`)) return join(dir, 'stats', `${uuid}.json`);
  return files.length === 1 ? join(dir, 'stats', files[0]) : null;
}

// --whole-save: the save folder as importWholeSave entries ({path, size, modified, read}); only level.dat and the region files.
async function saveEntries(dir) {
  const prefix = basename(dir) || 'save', entries = [];
  const add = async (rel) => {
    const path = join(dir, rel), info = await stat(path).catch(() => null);
    if (!info?.isFile()) return;
    entries.push({ path: `${prefix}/${rel.split('\\').join('/')}`, size: info.size, modified: info.mtimeMs, read: () => readBounded(path) });
  };
  await add('level.dat');
  for (const sub of ['region', 'DIM-1/region', 'DIM1/region'])
    for (const f of (await list(join(dir, sub))).filter((n) => n.endsWith('.mca'))) await add(`${sub}/${f}`);
  return entries;
}
async function writeNew(path, text) {
  const file = await open(path, 'wx');
  try { await file.writeFile(text); } finally { await file.close(); }
}
const integers = (text, counts) => {
  const parts = String(text).split(',');
  if (!counts.includes(parts.length) || !parts.every(p => /^-?\d+$/.test(p))) throw new Error(USAGE);
  return parts.map(Number);
};

try {
  const args = process.argv.slice(2), inputs = [], options = {};
  let wholeSave = false, out = null, reportPath = null, saveDir = null, levelPath = null, playerPath = null, statsPath = null;
  const dimensionAreas = new Map();
  while (args.length) {
    const arg = args.shift();
    const value = () => { if (!args.length) throw new Error(USAGE); return args.shift(); };
    if (['--area', '--nether-area', '--end-area'].includes(arg)) {
      const [chunkX, chunkZ, width = 8, depth = 8] = integers(value(), [2, 4]);
      const area = {chunkX, chunkZ, width, depth};
      if (arg === '--area') options.area = area;
      else dimensionAreas.set(arg === '--nether-area' ? -1 : 1, area);
    } else if (arg === '--destination') {
      const [chunkX, chunkZ] = integers(value(), [2]);
      options.destination = {chunkX, chunkZ};
    } else if (arg === '--seed') options.seed = value();
    else if (arg === '--landscape') options.landscape = value();
    else if (arg === '--missing') options.missing = value();
    else if (arg === '--name') options.name = value();
    else if (arg === '--survival') options.mode = 'survival';
    else if (arg === '--no-sky') options.hasSky = false;
    else if (arg === '--whole-save') wholeSave = true;
    else if (arg === '--save') saveDir = value();
    else if (arg === '--level') levelPath = value();
    else if (arg === '--player-file') playerPath = value();
    else if (arg === '--stats') statsPath = value();
    else if (arg === '--generation') { options.generationVersion = Number(value()); if (![13, 15].includes(options.generationVersion)) throw new Error(USAGE); }
    else if (arg === '--out') out = value();
    else if (arg === '--report') reportPath = value();
    else if (arg.startsWith('--')) throw new Error(USAGE);
    else inputs.push(arg);
  }
  if (wholeSave) {
    if (!saveDir || levelPath || inputs.length || dimensionAreas.size || options.area || options.destination) throw new Error('--whole-save takes only --save DIR (plus --name, --report, --out)');
    if (!out?.endsWith('.blockworld.json')) throw new Error(USAGE);
    for (const path of [out, reportPath].filter(Boolean)) if (await exists(path)) throw new Error(`${path} already exists; choose a new output file`);
    const result = await wholeSaveRecord(await saveEntries(saveDir), {name: options.name});
    await writeNew(out, JSON.stringify(result.record));
    if (reportPath) await writeNew(reportPath, JSON.stringify(result.report, null, 2));
    console.log(JSON.stringify(result.report, null, 2));
    process.exit(0);
  }
  if (saveDir && levelPath) throw new Error('Pass --save or --level, not both');
  if (saveDir) levelPath = join(saveDir, 'level.dat');
  if (levelPath) {
    if (dimensionAreas.size || options.destination || options.landscape) throw new Error('A level import keeps the overworld in its native frame (no --destination, --landscape or other dimensions)');
    options.level = await readLevelDat(await readSmall(levelPath));
    if (!playerPath && !options.level.player && saveDir) playerPath = await savePlayer(saveDir);
    if (playerPath) options.player = await readPlayerDat(await readSmall(playerPath));
    if (!statsPath && saveDir) statsPath = await saveStats(saveDir, playerPath);
    if (statsPath) options.stats = new TextDecoder().decode(await readSmall(statsPath));
    if (saveDir && !inputs.length) {
      // The regions covering the area: the given --area, else the 8x8 chunks around the player (else the spawn).
      const tag = options.player ?? options.level.player, p = tag ? javaPlayerFromNbt(tag, { convertItem: () => null }) : null;
      const centre = p?.position && p.dimension === 0 ? [p.position.x, p.position.z] : [options.level.spawn[0], options.level.spawn[2]];
      const area = options.area ?? { chunkX: Math.floor(centre[0] / 16) - 4, chunkZ: Math.floor(centre[1] / 16) - 4, width: 8, depth: 8 };
      for (let rx = area.chunkX >> 5; rx <= (area.chunkX + area.width - 1) >> 5; rx++)
        for (let rz = area.chunkZ >> 5; rz <= (area.chunkZ + area.depth - 1) >> 5; rz++) {
          const path = join(saveDir, 'region', `r.${rx}.${rz}.mca`);
          if (await exists(path)) inputs.push(path);
        }
      if (!inputs.length) throw new Error(`${join(saveDir, 'region')} has no region file covering the area`);
    }
  } else if (statsPath || playerPath || options.generationVersion) throw new Error('--player-file, --stats and --generation need --save or --level');
  if (!out?.endsWith('.blockworld.json') || !inputs.length) throw new Error(USAGE);
  if (!options.level && !options.area && !dimensionAreas.size && options.seed === undefined) throw new Error('Pass --area, or --seed to convert the generator area of that seed');
  for (const path of [out, reportPath].filter(Boolean)) {
    if (await exists(path)) throw new Error(`${path} already exists; choose a new output file`);
  }
  const regions = new Map([[0, []], [-1, []], [1, []]]);
  for (const path of inputs) {
    const match = path.split(/[\\/]/).find(p => p === 'DIM-1' || p === 'DIM1');
    const dimension = match === 'DIM-1' ? -1 : match === 'DIM1' ? 1 : 0;
    regions.get(dimension).push({ filename: basename(path), bytes: await readBounded(path) });
  }
  let result;
  try {
    for (const [dimension, files] of regions) {
      if (!files.length) continue;
      if (dimension && !dimensionAreas.has(dimension))
        throw new Error(`Pass ${dimension === -1 ? '--nether-area' : '--end-area'} for dimension ${dimension}`);
      const converted = await importJavaRegionArea(files, dimension ? {
        seed: options.seed, name: options.name, mode: options.mode, missing: options.missing,
        area: dimensionAreas.get(dimension), dimension,
      } : options);
      if (!result) result = converted;
      else {
        Object.assign(result.record.dimensions ??= {}, converted.record.dimensions);
        (result.report.dimensions ??= {})[dimension] = converted.report;
      }
    }
  } catch (error) {
    if (error.report) console.log(JSON.stringify(error.report, null, 2));
    throw error;
  }
  await writeNew(out, JSON.stringify(result.record));
  if (reportPath) await writeNew(reportPath, JSON.stringify(result.report, null, 2));
  console.log(JSON.stringify(result.report, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
