import {open} from 'node:fs/promises';
import {basename} from 'node:path';
import {REGION_LIMIT} from '../src/region-inspection.js';
import {previewJavaChunk} from '../src/chunk-preview.js';

try {
  const [input,x,z,output,...extra] = process.argv.slice(2);
  if (extra.length || !output?.endsWith('.blockworld.json') || !/^-?\d+$/.test(x) || !/^-?\d+$/.test(z))
    throw new Error('Usage: node tools/preview-java-chunk.mjs r.X.Z.mca chunkX chunkZ new.blockworld.json');
  const source = await open(input,'r');
  let bytes;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.size > REGION_LIMIT) throw new Error('Expected a region file up to 64 MiB');
    bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const {bytesRead} = await source.read(bytes,offset,bytes.length-offset,offset);
      if (!bytesRead) throw new Error('Region file truncated during read');
      offset += bytesRead;
    }
  } finally { await source.close(); }
  const {record,report} = await previewJavaChunk(basename(input),bytes,Number(x),Number(z));
  const file = await open(output,'wx');
  try { await file.writeFile(JSON.stringify(record)); } finally { await file.close(); }
  console.log(JSON.stringify(report,null,2));
} catch (error) { console.error(error.message); process.exitCode=1; }
