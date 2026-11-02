import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PopulationArea,populationBlockMapperReady} from './population-world.js';
import {ChunkProviderGenerate,BiomeTerrainState} from './terrain-generator.js';
import {MapGenCaves,MapGenRavine,randomLong} from './mapgen.js';
import {recordedWorld} from './gen-world-recording.js';
import {World} from './world.js';
import {fromOriginal} from './block-registry.js';
const ref=JSON.parse(readFileSync(new URL('../public/research/population-world-reference.json',import.meta.url)));
const hash=c=>{const b=Buffer.alloc(65536*4);for(let x=0;x<16;x++)for(let z=0;z<16;z++)for(let y=0;y<256;y++) b.writeInt32LE(c.getBlock(x,y,z)|c.getMeta(x,y,z)<<12,((x*16+z)*256+y)*4);return createHash('sha1').update(b).digest('hex');};
const bits=n=>{const b=Buffer.alloc(4);b.writeFloatLE(n);return b.readInt32LE();};
const stack=s=>s?[s[0],s[1],s[2],s[3]??[]]:null;
const landscapes={default:'java',amplified:'javaAmplified',largeBiomes:'javaLargeBiomes'};
for(const rec of ref.records) test(`v11 native full population and live mapping: ${rec.label}`,async()=>{
  await populationBlockMapperReady;
  const seed=BigInt(rec.seed),state=new BiomeTerrainState(),gen=new ChunkProviderGenerate(seed,rec.type,state);
  const top=(x,z)=>state.topBlock(gen.manager.biomeAt(x,z)),caves=new MapGenCaves(seed,gen.manager,top),ravines=new MapGenRavine(seed,gen.manager,top);
  const terrain=(x,z)=>{const c=gen.provideChunk(x,z);caves.generate(x,z,c.blocks);ravines.generate(x,z,c.blocks);return c;};
  const pass=new PopulationArea({seed,chunkX:rec.origin[0],chunkZ:rec.origin[1],terrain,biomeAt:(x,z)=>gen.manager.biomeAt(x,z)}),w=pass.world,steps=[],drops=[];
  // Native initial inputs, before population and before any halo generation.
  for(const [x,z,sha] of rec.inputs){pass.mineshafts.generate(x,z);assert.equal(hash(w.chunk(x,z)),sha,`input ${x},${z}`);}
  let recording;
  pass.run({beforePopulate(){recording=recordedWorld(w);},afterPopulate(x,z,r){drops.push(...recording.drops);steps.push({chunk:[x,z],calls:recording.callCount,callSha1:recording.calls.digest('hex'),writes:recording.writeCount,writeSha1:recording.writes.digest('hex'),nextLong:randomLong(r).toString()});}});
  for(let i=0;i<64;i++) assert.deepEqual(steps[i],rec.steps[i],`step ${i}`);
  const area=[];
  for(let x=rec.origin[0];x<rec.origin[0]+8;x++)for(let z=rec.origin[1];z<rec.origin[1]+8;z++)area.push(hash(w.chunk(x,z)));
  assert.deepEqual(area,rec.areaSha1,'original cells');
  w.onCall=null; w.onWrite=null;
  const tiles=[...w.chunks.values()].flatMap(c=>[...c.tiles.values()]).sort((a,b)=>a.x-b.x||a.z-b.z||a.y-b.y).map(t=>t.kind==='chest'?[t.x,t.y,t.z,t.kind,w.getBlockMetadata(t.x,t.y,t.z),t.slots.map(stack)]:[t.x,t.y,t.z,t.kind,t.name]);
  assert.deepEqual(tiles,rec.tiles,'all tiles/loot');
  assert.deepEqual(w.animals.map(e=>[e.name,e.x,e.y,e.z,bits(e.yaw),e.fleece]),rec.entities,'animals');
  assert.deepEqual(w.carts.map(e=>[e.x,e.y,e.z,e.slots.map(stack)]),rec.carts,'carts');
  assert.deepEqual(w.pending,rec.pending,'pending ticks');
  assert.deepEqual(drops,rec.drops,'population item drops');
  assert.equal(randomLong(w.rand).toString(),rec.worldNextLong,'world random');
  const live=new World(rec.seed,landscapes[rec.type],11);
  for(let a=0;a<8;a++)for(let b=0;b<8;b++){
    const c=w.chunk(rec.origin[0]+a,rec.origin[1]+b),l=live.chunkAt(a,b);
    const expectedBlocks=new Uint8Array(65536),expectedMeta=new Uint8Array(65536),mapped=new Map();
    for(let x=0;x<16;x++)for(let z=0;z<16;z++)for(let y=0;y<256;y++){
      const id=c.getBlock(x,y,z),meta=c.getMeta(x,y,z),key=id*16+meta;
      let m=mapped.get(key);if(!m){m=fromOriginal(id,meta);assert.ok(m?.exact);mapped.set(key,m);}
      const i=(x*16+z)*256+y;expectedBlocks[i]=m.id;expectedMeta[i]=m.meta;
    }
    assert.deepEqual(l.blocks,expectedBlocks);assert.deepEqual(l.meta,expectedMeta);
  }
  assert.equal(live.edits.size,0,'population is seed generation, never edits');
});
