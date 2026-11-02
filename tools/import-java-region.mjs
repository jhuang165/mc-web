// WORLD-03g: convert an area of Java 1.7.10 region files into a new Blockworld export.
import {open, stat} from 'node:fs/promises';
import {basename} from 'node:path';
import {REGION_LIMIT} from '../src/region-inspection.js';
import {importJavaRegionArea} from '../src/region-import.js';

const USAGE = `Usage: node tools/import-java-region.mjs [options] --out new.blockworld.json r.X.Z.mca [r.X.Z.mca ...]
  --area chunkX,chunkZ[,width,depth]  source chunks (width/depth 1-8, default 8); default: the seed's generator area
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
  let out = null, reportPath = null;
  while (args.length) {
    const arg = args.shift();
    const value = () => { if (!args.length) throw new Error(USAGE); return args.shift(); };
    if (arg === '--area') {
      const [chunkX, chunkZ, width = 8, depth = 8] = integers(value(), [2, 4]);
      options.area = {chunkX, chunkZ, width, depth};
    } else if (arg === '--destination') {
      const [chunkX, chunkZ] = integers(value(), [2]);
      options.destination = {chunkX, chunkZ};
    } else if (arg === '--seed') options.seed = value();
    else if (arg === '--landscape') options.landscape = value();
    else if (arg === '--missing') options.missing = value();
    else if (arg === '--name') options.name = value();
    else if (arg === '--survival') options.mode = 'survival';
    else if (arg === '--no-sky') options.hasSky = false;
    else if (arg === '--out') out = value();
    else if (arg === '--report') reportPath = value();
    else if (arg.startsWith('--')) throw new Error(USAGE);
    else inputs.push(arg);
  }
  if (!out?.endsWith('.blockworld.json') || !inputs.length) throw new Error(USAGE);
  if (!options.area && options.seed === undefined) throw new Error('Pass --area, or --seed to convert the generator area of that seed');
  for (const path of [out, reportPath].filter(Boolean)) {
    if (await stat(path).then(() => true, () => false)) throw new Error(`${path} already exists; choose a new output file`);
  }
  const regions = [];
  for (const path of inputs) regions.push({filename: basename(path), bytes: await readBounded(path)});
  let result;
  try { result = await importJavaRegionArea(regions, options); }
  catch (error) {
    if (error.report) console.log(JSON.stringify(error.report, null, 2));
    throw error;
  }
  await writeNew(out, JSON.stringify(result.record));
  if (reportPath) await writeNew(reportPath, JSON.stringify(result.report, null, 2));
  console.log(JSON.stringify(result.report, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
