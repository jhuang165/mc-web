import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {WorldChunkManager} from './biome-layers.js';import {BIOME_LIST} from './java-biomes.js';import {VILLAGE_BIOMES,TEMPLE_BIOMES,villageCandidate,templeCandidate,strongholdPositions} from './structure-placement.js';
const reference=JSON.parse(readFileSync(new URL('../public/research/structure-placement-reference.json',import.meta.url)));
test('native village/temple candidates across negative, custom-spacing and border grids',()=>{
 const config=reference.records.find(r=>r.kind==='config');assert.deepEqual(VILLAGE_BIOMES,config.villageBiomes);assert.deepEqual(TEMPLE_BIOMES,config.templeBiomes);
 assert.deepEqual(BIOME_LIST.filter(b=>b&&b.rootHeight>0).map(b=>b.id),config.strongholdBiomes);
 for(const r of reference.records.filter(r=>r.kind==='village'||r.kind==='temple')) {
  const manager=new WorldChunkManager(BigInt(r.seed),r.type),hash=createHash('sha1'),accepted=[],predicate=r.kind==='village'?villageCandidate:templeCandidate;
  for(let x=r.x;x<r.x+r.size;x++)for(let z=r.z;z<r.z+r.size;z++){const yes=predicate(BigInt(r.seed),manager,x,z,{distance:r.distance});hash.update(Uint8Array.of(yes?1:0));if(yes)accepted.push([x,z]);}
  assert.deepEqual(accepted,r.accepted,JSON.stringify(r));assert.equal(hash.digest('hex'),r.sha1);
 }
});
test('native stronghold rings and biome relocation, including post-first-ring off-by-one behavior',()=>{
 for(const r of reference.records.filter(r=>r.kind==='stronghold'))assert.deepEqual(strongholdPositions(BigInt(r.seed),new WorldChunkManager(BigInt(r.seed),r.type),{count:r.count}),r.positions,JSON.stringify(r));
});
