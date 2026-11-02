import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync, inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readRegion, writeRegion, regionSlot, regionAddress, encodeRegionChunk, decodeRegionChunk} from './region-file.js';
import {Chunk} from './chunk-store.js';
import {chunkFromNbt, chunkToNbt} from './chunk-nbt.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/region-file-reference.json', import.meta.url)));
const native = c => new Uint8Array(gunzipSync(Buffer.from(c.regionGzip,'base64')));
function summary(entries) {
  return [...entries].map(([slot,entry]) => {
    const raw=(entry.format==='gzip'?gunzipSync:inflateSync)(entry.compressed);
    return {slot,length:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
  });
}

test('reads native empty, sparse, fragmented and full 1024-slot files and compacts them', () => {
  assert.equal(reference.clientSha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
  for(const c of reference.cases) {
    const bytes=native(c),loaded=readRegion(bytes);
    assert.deepEqual(summary(loaded),c.entries);
    const rewritten=writeRegion(loaded.values());
    assert.deepEqual(summary(readRegion(rewritten)),c.entries);
    assert.deepEqual(writeRegion(readRegion(rewritten).values()),rewritten);
    assert.ok(rewritten.length<=bytes.length);
  }
  assert.equal(readRegion(native(reference.cases[3])).size,1024);
  assert.equal(readRegion(native(reference.cases[2])).get(77).format,'gzip');
});

test('sector allocation matches native exact-boundary and 255-sector probes', () => {
  for(const c of reference.allocations) {
    const entry={x:0,z:0,format:'zlib',compressed:new Uint8Array(c.allocation)};
    if(c.location===0){assert.throws(()=>writeRegion([entry]),/255 sectors/);continue;}
    const bytes=writeRegion([entry]);
    assert.equal(new DataView(bytes.buffer).getUint32(0),c.location);
    assert.equal(bytes.length,c.fileBytes);
    assert.equal(readRegion(bytes).get(0).compressed.length,c.allocation);
  }
});

test('local slots and negative chunk region addresses follow Java shifts and masks', () => {
  for(const x of [-1875000,-65,-33,-32,-31,-1,0,31,32,33,1874999]) {
    for(const z of [-33,-1,0,32]) {
      const a=regionAddress(x,z);
      assert.equal(a.regionX,Math.floor(x/32));assert.equal(a.regionZ,Math.floor(z/32));
      assert.equal(a.regionX*32+a.x,x);assert.equal(a.regionZ*32+a.z,z);
      assert.equal(regionSlot(a.x,a.z),a.x+a.z*32);
    }
  }
  for(const [x,z] of [[-1,0],[32,0],[0,32],[1.5,0]])assert.throws(()=>regionSlot(x,z));
  assert.throws(()=>regionAddress(2**31,0));
});

test('timestamps, entry order, view offsets and owned payload bytes are preserved', () => {
  const entries=[...readRegion(native(reference.cases[1])).values()];
  entries[0].timestamp=0xffffffff;entries[1].timestamp=123456789;
  const wire=writeRegion(entries),padded=new Uint8Array(wire.length+7);padded.set(wire,3);
  const loaded=readRegion(padded.subarray(3,3+wire.length));
  assert.equal(loaded.get(0).timestamp,0xffffffff);assert.equal(loaded.get(31).timestamp,123456789);
  assert.deepEqual(writeRegion([...entries].reverse()),wire);
  padded.fill(0);assert.deepEqual(summary(loaded),reference.cases[1].entries);
  assert.deepEqual(wire,writeRegion(loaded.values()));
});

test('NBT/chunk payloads round trip through region sectors for both compression IDs', async () => {
  const chunk=new Chunk(-33,63),s=chunk.section(15,true);s.setBlock(15,15,15,175);s.setMeta(15,15,15,8);
  chunk.inhabitedTime=9007199254740993n;
  const doc=chunkToNbt(chunk,{lastUpdate:123n}),entries=[];
  for(const [x,format] of [[0,'gzip'],[31,'zlib']])entries.push(await encodeRegionChunk(doc,{x,z:31,format,timestamp:11}));
  const region=readRegion(writeRegion(entries));
  for(const entry of region.values()) {
    const loaded=chunkFromNbt(await decodeRegionChunk(entry));
    assert.deepEqual(chunkToNbt(loaded.chunk,loaded),doc);
    assert.equal(loaded.chunk.getBlock(15,255,15),175);
    await assert.rejects(decodeRegionChunk(entry,{maxBytes:64}),/byte limit/);
  }
  assert.equal((await encodeRegionChunk(doc,{x:0,z:0})).format,'zlib');
});

test('rejects damaged headers, overlaps, unsupported compression and record lengths', () => {
  const base=writeRegion([{x:0,z:0,format:'zlib',compressed:Uint8Array.of(1,2,3)}]);
  for(const n of [0,4096,8191,base.length-1])assert.throws(()=>readRegion(base.subarray(0,n)),/Truncated/);
  const mutations=[
    v=>v.setUint32(0,1),v=>v.setUint32(0,256|1),v=>v.setUint32(0,512),
    v=>v.setUint32(0,(99<<8)|1),v=>v.setUint32(4,v.getUint32(0)),
    v=>v.setInt32(8192,-1),v=>v.setInt32(8192,0),v=>v.setInt32(8192,4093),
    v=>v.setUint8(8196,0),v=>v.setUint8(8196,3),v=>v.setUint8(8196,0x82),
  ];
  for(const mutation of mutations){const wire=base.slice();mutation(new DataView(wire.buffer));assert.throws(()=>readRegion(wire));}
});

test('validates input/output limits and refuses duplicates or invalid entries', () => {
  const entry={x:0,z:0,format:'zlib',compressed:new Uint8Array(4091)};
  const wire=writeRegion([entry]);
  assert.throws(()=>writeRegion([entry],{maxBytes:wire.length-1}),/limit/);
  assert.throws(()=>readRegion(wire,{maxBytes:wire.length-1}),/limit/);
  assert.equal(writeRegion([]).length,8192);
  assert.throws(()=>writeRegion([entry,entry]),/Duplicate/);
  for(const value of [0,1.5,Infinity,8191])assert.throws(()=>readRegion(wire,{maxBytes:value}));
  for(const patch of [{x:32},{format:'raw'},{timestamp:-1},{timestamp:2**32},{compressed:new ArrayBuffer(4)}])assert.throws(()=>writeRegion([{...entry,...patch}]));
  assert.throws(()=>readRegion(new ArrayBuffer(8192)),/Uint8Array/);
});
