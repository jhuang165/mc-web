import {World} from './world.js';
import {placeHeldBlock} from './block-placement-simulation.js';
import {makeStack} from './inventory.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {fromOriginal,toOriginal} from './block-registry.js';import {BLOCKS,solidBlock,blockBounds} from './world.js';
import {ITEMS,MATERIALS,Survival,craftingResult} from './survival.js';import {miningState} from './mining.js';
import {populationDrops,populationXp} from './population-content.js';import {TILES,blockTile} from './block-textures.js';
import {Trees} from './trees.js';import {JavaRandom} from './java-random.js';import {treeRegistryReady} from './tree-growth.js';
import {PopulationBlocks} from './population-blocks.js';
const audit=JSON.parse(readFileSync(new URL('../public/research/population-blocks.json',import.meta.url)));
test('every audited population state maps exactly to playable textured content',()=>{
 assert.equal(audit.audit.length,183);assert.equal(new Set(audit.audit.map(r=>r.slot)).size,61);
 for(const s of audit.states){const m=fromOriginal(s.id,s.meta);assert.ok(m?.exact,`${s.id}:${s.meta}`);assert.ok(BLOCKS[m.id]);if(m.id)assert.ok(MATERIALS[m.id]||m.id===45||m.id===10||m.id===42);}
 for(const tile of TILES)assert.ok(tile.startsWith('chest_')||existsSync(new URL(`../public/media/1.7.10/blocks/${tile}.png`,import.meta.url)),tile);
 for(const id of [63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84])assert.ok(TILES[blockTile(id,0,false,0)]);
});
test('population ore tiers, variable loot and metadata survive inventory save validation',()=>{
 for(const [id,tier]of[[63,1],[64,2],[65,2],[66,2]]){
  assert.equal(miningState(id,MATERIALS[id],{kind:'pickaxe',tier:tier-1,speed:2}).harvest,false);
  assert.equal(miningState(id,MATERIALS[id],{kind:'pickaxe',tier,speed:6}).harvest,true);
  const drops=populationDrops(id,0,{random:()=>0});assert.ok(drops.length);assert.ok(populationXp(id,()=>0)>0);
  const p=new Survival({slots:drops},'survival');assert.equal(p.inventory.main[0].damage,drops[0].damage??0);
 }
 assert.deepEqual(populationDrops(73,8),[{id:351,count:3,damage:3}]);
 assert.equal(solidBlock(69),false);assert.equal(solidBlock(72),false);assert.equal(solidBlock(73),true);
});
class Cells{
 constructor(){this.cells=new Map();this.height=256;this.generationVersion=11;}
 get(x,y,z){return this.cells.get(`${x},${y},${z}`)?.[0]??(y===9?1:y<9?2:0);}
 getMeta(x,y,z){return this.cells.get(`${x},${y},${z}`)?.[1]??0;}
 put(x,y,z,id,meta=0){this.cells.set(`${x},${y},${z}`,[id,meta]);return true;}
 set(x,y,z,id,tracked=true,meta=0){const old=this.get(x,y,z);this.put(x,y,z,id,meta);if(tracked)this.onChange?.(x,y,z,old,id);return true;}
}
test('all six sapling types grow through the ported tree generators, including dark oak square requirement',async()=>{
 await treeRegistryReady;
 for(let type=0;type<6;type++){
  const w=new Cells(),t=new Trees(w,{random:new JavaRandom(37n)});
  w.put(30,10,30,48,type|8);if(type===5)for(const [x,z]of[[31,30],[30,31],[31,31]])w.put(x,10,z,48,type);
  assert.equal(t.growTree(30,10,30),'grew',`sapling ${type}`);
  const trunk=type>=4?70:4;assert.ok([...w.cells.values()].some(([id])=>id===trunk));
 }
 const w=new Cells();w.put(30,10,30,48,13);assert.equal(new Trees(w,{random:new JavaRandom(1n)}).growTree(30,10,30),'failed');assert.equal(w.get(30,10,30),48);
});
test('double plants remove both halves once, and activated redstone saves as a real lit block',()=>{
 const w=new Cells(),drops=[],p=new PopulationBlocks(w,{drop:s=>drops.push(...s)}).watch();
 w.put(2,10,2,69,4);w.put(2,11,2,69,8);w.set(2,9,2,0);
 assert.equal(w.get(2,10,2),0);assert.equal(w.get(2,11,2),0);assert.deepEqual(drops,[{id:69,count:1,damage:4}]);
 w.put(3,9,3,64);assert.equal(p.touch(3,9,3),true);assert.deepEqual(toOriginal(w.get(3,9,3)),[74,0]);p.randomTick(3,9,3,65);assert.equal(w.get(3,9,3),64);
});

test('placing a double plant tracks both halves and subtype through a saved-edit reload',()=>{
 const w=new World('paired-plant-save','meadow',8),p=new Survival({},'creative');
 w.put(20,39,20,2);w.put(20,40,20,0);w.put(20,41,20,0);
 new PopulationBlocks(w).watch();p.inventory.main[0]=makeStack(69,1,4);
 const r=placeHeldBlock({world:w,survival:p,position:{x:25,y:40,z:25}}, {id:69,item:ITEMS[69],target:{block:[20,39,20],adjacent:[20,40,20]}},{updateBlock:()=>{}});
 assert.equal(r.placed,true);const edits=JSON.parse(JSON.stringify([...w.edits]));
 const resumed=new World(w.seed,w.biome,8);resumed.restore(edits);
 assert.deepEqual([resumed.get(20,40,20),resumed.getMeta(20,40,20),resumed.get(20,41,20),resumed.getMeta(20,41,20)],[69,4,69,8]);
});
