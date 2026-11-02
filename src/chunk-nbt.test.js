import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Chunk, NibbleArray} from './chunk-store.js';
import {NBT, encodeNbt, decodeNbt} from './nbt.js';
import {encodeCompressedNbt, decodeCompressedNbt} from './nbt-compression.js';
import {chunkToNbt, chunkFromNbt} from './chunk-nbt.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/chunk-nbt-reference.json', import.meta.url)));
const TIMES = [0n,1n,-1n,(1n<<63n)-1n,-(1n<<63n),9007199254740993n,-9007199254740993n];
const DELAYS = [0n,1n,-1n,2147483648n,4294967301n,-2147483649n];
const POOL = [0,1,2,3,8,10,18,54,175,255];
const t = (type, value) => ({type, value});
const native = base64 => decodeNbt(gunzipSync(Buffer.from(base64, 'base64')));
const levelOf = document => document.tag.value.get('Level').value;
function indices(n) {
  return [[],[0],[0,15],Array.from({length:16}, (_,i)=>i),[3,7],[15]][n%6];
}
function fixture(n) {
  const chunk = new Chunk(n%2 ? -1875000 : -3+n, 1874999-n, n%2===0);
  chunk.isTerrainPopulated = n%2===0; chunk.isLightPopulated = n%3===0;
  chunk.inhabitedTime = TIMES[(n+2)%TIMES.length]; chunk.hasEntities = true;
  for (let i=0;i<256;i++) { chunk.heightMap[i]=(i*37+n)%257; chunk.biomes[i]=(i+n*3)&255; }
  for (const y of indices(n)) {
    const storage = chunk.section(y, true);
    for (let i=0;i<4096;i++) storage.lsb[i]=n%6===1 ? 0 : POOL[(i*7+y*3+n)%POOL.length];
    for (let i=0;i<2048;i++) {
      storage.metadata.data[i]=i*5+y+n; storage.blocklight.data[i]=i*7+n*11;
      if(chunk.hasSky) storage.skylight.data[i]=i*13+y*17+n;
    }
    if ((n+y)%3===0) {
      storage.msb = new NibbleArray();
      for (let i=0;i<2048;i++) storage.msb.data[i]=i%17===0 ? 0x10 : 0;
    }
  }
  const tileTicks = n%3===0 ? null : [];
  if (n%3===2) for (let j=0;j<3;j++) tileTicks.push(new Map([
    ['i',t(NBT.INT,[8,10,12][j])],['x',t(NBT.INT,-48+j)],['y',t(NBT.INT,j*127)],['z',t(NBT.INT,31-j)],
    ['t',t(NBT.INT,Number(BigInt.asIntN(32,DELAYS[(n+j)%DELAYS.length])))],['p',t(NBT.INT,j-1)],
  ]));
  return {chunk, lastUpdate: TIMES[n%TIMES.length], tileTicks};
}

test('chunk storage encoder matches 14 original AnvilChunkLoader writes', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(reference.cases.length,14);
  for (const c of reference.cases) {
    const f=fixture(c.index), encoded=chunkToNbt(f.chunk,f), expected=native(c.saveGzip);
    assert.deepEqual(decodeNbt(encodeNbt(encoded)).tag,expected.tag,`write ${c.index}`);
    // Serialization is pure; lifecycle hasEntities is owned by its eventual caller.
    assert.equal(f.chunk.hasEntities,true);
  }
});

test('chunk loader matches native recount, default fields, duplicate sections and rewrite', () => {
  for (const c of reference.cases) {
    const loaded=chunkFromNbt(native(c.inputGzip),{hasSky:c.hasSky}), chunk=loaded.chunk;
    assert.deepEqual({x:chunk.x,z:chunk.z,inhabitedTime:String(chunk.inhabitedTime),
      terrain:chunk.isTerrainPopulated,light:chunk.isLightPopulated,
      sections:chunk.sections.flatMap((s,y)=>s?[[y,s.blockRefCount,s.tickRefCount]]:[]),
    },c.summary,`load ${c.index}`);
    assert.deepEqual([...chunk.precipitationHeightMap],Array(256).fill(-999));
    assert.equal(chunk.modified,false); assert.equal(chunk.isChunkLoaded,false);
    assert.equal(chunk.hasEntities,false); assert.equal(chunk.lastSaveTime,0);
    const scheduled=(loaded.tileTicks??[]).map(tick=>['i','x','y','z','t','p'].map(key=>tick.get(key).value));
    assert.deepEqual(scheduled,c.scheduled,`relative ticks ${c.index}`);
    const rewritten=chunkToNbt(chunk,{...loaded,lastUpdate:BigInt(c.time)});
    assert.deepEqual(decodeNbt(encodeNbt(rewritten)).tag,native(c.loadedGzip).tag,`rewrite ${c.index}`);
  }
});

test('chunk payloads compose with bounded gzip/zlib NBT without losing coordinates or longs', async () => {
  for (const n of [2,3,5]) {
    const f=fixture(n), document=chunkToNbt(f.chunk,f);
    for (const format of ['gzip','zlib']) {
      const encoded=await encodeCompressedNbt(document,{format});
      const decoded=chunkFromNbt(await decodeCompressedNbt(encoded,{format}),{hasSky:f.chunk.hasSky});
      assert.deepEqual(chunkToNbt(decoded.chunk,decoded),document);
      assert.equal(BigInt(decoded.chunk.inhabitedTime),f.chunk.inhabitedTime);
    }
  }
});

test('opaque entity/tile/tick tags and unknown extension fields survive without execution', () => {
  const document=native(reference.cases[2].saveGzip),level=levelOf(document);
  const unknown=t(NBT.COMPOUND,new Map([['opaque',t(NBT.LONG,9007199254740993n)]]));
  document.name='retained';document.tag.value.set('__proto__',structuredClone(unknown));
  level.set('CustomLevel',structuredClone(unknown));
  const section=level.get('Sections').value.items[0];section.set('CustomSection',structuredClone(unknown));
  const payload=(id)=>new Map([['id',t(NBT.STRING,id)],['x',t(NBT.INT,-49)],['data',structuredClone(unknown)]]);
  level.set('Entities',t(NBT.LIST,{elementType:NBT.COMPOUND,items:[payload('UnknownEntity')]}));
  level.set('TileEntities',t(NBT.LIST,{elementType:NBT.COMPOUND,items:[payload('UnknownTile')]}));
  const loaded=chunkFromNbt(document),restored=chunkToNbt(loaded.chunk,loaded);
  assert.equal(loaded.chunk.hasEntities,true);
  assert.equal(restored.name,document.name);
  assert.deepEqual(restored.tag,document.tag);
  level.get('Entities').value.items[0].get('id').value='changed';
  section.get('Blocks').value.fill(0);
  document.tag.value.get('__proto__').value.get('opaque').value=0n;
  assert.equal(loaded.entities[0].get('id').value,'UnknownEntity');
  assert.equal(loaded.extensions.root.get('__proto__').value.get('opaque').value,9007199254740993n);
  assert.ok(loaded.chunk.sections[0].lsb.some(x=>x!==0));
  restored.tag.value.get('Level').value.get('HeightMap').value.fill(0);
  assert.ok(loaded.chunk.heightMap.some(x=>x!==0));
});

test('empty existing sections and raw invalid IDs/Add nibbles persist without inventing blocks', () => {
  const chunk=new Chunk(-1,0,true), section=chunk.section(15,true);
  section.lsb[0]=255;section.msb=new NibbleArray();section.msb.data[1]=0xff;section.recount();
  const loaded=chunkFromNbt(chunkToNbt(chunk));
  assert.ok(loaded.chunk.sections[15]);
  assert.deepEqual(loaded.chunk.sections[15].lsb,section.lsb);
  assert.deepEqual(loaded.chunk.sections[15].msb.data,section.msb.data);
  assert.equal(loaded.chunk.getBlock(0,240,0),0);
  assert.equal(loaded.chunk.sections[15].blockRefCount,0);
  assert.equal(levelOf(chunkToNbt(loaded.chunk)).get('Sections').value.items.length,1);
});

test('no-sky chunks ignore input SkyLight and always save a zero array', () => {
  const document=native(reference.cases[2].saveGzip);
  const loaded=chunkFromNbt(document,{hasSky:false});
  assert.equal(loaded.chunk.sections[0].skylight,null);
  const saved=chunkToNbt(loaded.chunk);
  for (const s of levelOf(saved).get('Sections').value.items) assert.ok(s.get('SkyLight').value.every(v=>v===0));
  for (const s of levelOf(document).get('Sections').value.items) s.delete('SkyLight');
  assert.doesNotThrow(()=>chunkFromNbt(document,{hasSky:false}));
  assert.throws(()=>chunkFromNbt(document),/SkyLight/);
});

test('chunk storage validation rejects damaged shapes rather than loading partial cells', () => {
  const base=native(reference.cases[2].saveGzip);
  const mutations=[
    doc=>doc.tag.value.delete('Level'), doc=>levelOf(doc).delete('xPos'),
    doc=>levelOf(doc).set('xPos',t(NBT.LONG,0n)), doc=>levelOf(doc).set('HeightMap',t(NBT.INT_ARRAY,new Int32Array(255))),
    doc=>levelOf(doc).set('Biomes',t(NBT.BYTE_ARRAY,new Int8Array(255))),
    doc=>levelOf(doc).delete('Sections'), doc=>levelOf(doc).get('Sections').value.elementType=NBT.INT,
    doc=>levelOf(doc).get('Sections').value.items[0].set('Y',t(NBT.BYTE,16)),
    doc=>levelOf(doc).get('Sections').value.items[0].set('Y',t(NBT.BYTE,-1)),
    doc=>levelOf(doc).get('Sections').value.items[0].set('Blocks',t(NBT.BYTE_ARRAY,new Int8Array(4095))),
    doc=>levelOf(doc).get('Sections').value.items[0].set('Add',t(NBT.BYTE_ARRAY,new Int8Array(2047))),
    doc=>levelOf(doc).set('TileTicks',t(NBT.INT,0)),
  ];
  for (const mutation of mutations) {const doc=structuredClone(base);mutation(doc);assert.throws(()=>chunkFromNbt(doc));}
  assert.throws(()=>chunkFromNbt(base,{hasSky:1}));
  for(const mutation of [
    c=>c.x=1.5,c=>c.inhabitedTime=Number.MAX_SAFE_INTEGER+1,c=>c.inhabitedTime=1n<<63n,
    c=>c.heightMap=new Int32Array(0),c=>c.section(0,true).yBase=16,c=>c.sections=[],
  ]) {const chunk=new Chunk(0,0);mutation(chunk);assert.throws(()=>chunkToNbt(chunk));}
  assert.throws(()=>chunkToNbt({}));
});
