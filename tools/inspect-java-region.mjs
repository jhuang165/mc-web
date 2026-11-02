import {open} from 'node:fs/promises';
import {basename} from 'node:path';
import {inspectRegion, REGION_LIMIT} from '../src/region-inspection.js';

try {
  const args = process.argv.slice(2);
  const noSky = args[0] === '--no-sky';
  if (noSky) args.shift();
  if (args.length !== 1) throw new Error('Usage: node tools/inspect-java-region.mjs [--no-sky] path/to/r.X.Z.mca');
  const file = await open(args[0], 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > REGION_LIMIT) throw new Error('Expected a regular region file at most 64 MiB');
    const bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const {bytesRead} = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw new Error('Region file truncated during read');
      offset += bytesRead;
    }
    const report = await inspectRegion(basename(args[0]), bytes, {hasSky: !noSky});
    console.log(JSON.stringify(report, null, 2));
  } finally { await file.close(); }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
