import test from 'node:test';import assert from 'node:assert/strict';
import {World} from './world.js';import {exportJavaSave} from './region-export.js';import {readRegion,decodeRegionChunk,regionAddress,regionSlot} from './region-file.js';import {chunkFromNbt} from './chunk-nbt.js';import {Survival} from './survival.js';
import {tickBlockIds,importTileTicks,tickRecordFields,mergeTickState,spreadTicks} from './tile-ticks.js';
const num=(v)=>({value:v});
const tick=(i,x,y,z,t,p=0)=>new Map([['i',num(i)],['x',num(x)],['y',num(y)],['z',num(z)],['t',num(t)],['p',num(p)]]);
test('tick kinds cover fluids, fire, falling blocks and the redstone behaviours',()=>{
 const k=tickBlockIds();assert.deepEqual(k.fluid,[8,9,10,11]);assert.deepEqual(k.fire,[51]);assert.deepEqual(k.falling,[12,13,122,145]);
 for(const id of [93,94,75,76,23,149])assert.ok(k.redstone.includes(id),`redstone ${id}`);
});
test('importTileTicks routes by block id, dedupes border ticks and tallies unknown ids',()=>{
 const seen=new Set();
 const r=importTileTicks([tick(8,1,60,2,5),tick(51,3,60,3,20),tick(12,4,70,4,2),tick(93,5,60,5,3,-1),tick(93,5,60,5,3,-1),tick(999,6,60,6,1),tick(8,500,60,2,5)],{shiftX:100,shiftZ:-100,seen,inside:(x)=>x<200});
 assert.equal(r.fluid.length,1);assert.deepEqual([r.fluid[0].x,r.fluid[0].z,r.fluid[0].delay,r.fluid[0].orig],[101,-98,5,8]);
 assert.equal(r.fire.length,1);assert.equal(r.falling.length,1);
 assert.deepEqual(r.redstone,[[105,60,-95,93,3,-1]]);assert.equal(r.duplicates,1);assert.equal(r.outside,1);assert.equal(r.dropped.get(999),1);
 assert.equal(importTileTicks([tick(93,5,60,5,3,-1)],{shiftX:100,shiftZ:-100,seen}).duplicates,1);
 const f=tickRecordFields(r,['105,60,-95']);assert.equal(f.fluidTicks.entries.length,1);assert.deepEqual(f.redstone.lit,['105,60,-95']);assert.equal(f.redstone.pending[0][6],0);
 assert.deepEqual(tickRecordFields({fluid:[],fire:[],falling:[],redstone:[]}),{});
});
test('mergeTickState keeps a tick saved in two chunks once',()=>{
 const acc={},seen=new Set(),e={x:1,y:2,z:3,block:9,delay:1,orig:8};
 assert.ok(mergeTickState(acc,seen,'fluidTicks',{entries:[e]}));mergeTickState(acc,seen,'fluidTicks',{entries:[e]});assert.equal(acc.fluidTicks.entries.length,1);
 mergeTickState(acc,seen,'redstone',{pending:[[1,2,3,93,4,0,0]],lit:['1,2,3']});mergeTickState(acc,seen,'redstone',{pending:[[1,2,3,93,4,0,0],[2,2,3,93,4,0,0]],lit:['1,2,3']});
 assert.deepEqual(acc.redstone.pending.map(p=>p[6]),[0,1]);assert.deepEqual(acc.redstone.lit,['1,2,3']);assert.equal(mergeTickState(acc,seen,'drops',{}),false);
});
test('spreadTicks copies a tick within 2 blocks of a border into the owned neighbour only',()=>{
 const rt=new Map([['0,0',{fluidTicks:[{order:0,value:{x:15,y:1,z:5}},{order:1,value:{x:8,y:1,z:8}}]}]]);
 spreadTicks(rt,new Set(['0,0','1,0','0,1']),['fluidTicks']);
 assert.equal(rt.get('1,0').fluidTicks.length,1);assert.equal(rt.get('0,1'),undefined);assert.equal(rt.get('0,0').fluidTicks.length,2);
});
test('export writes pending redstone ticks with original ids, delay and priority',async()=>{
 const w=new World('17','javaStreamed',12);w.restore([['-1,100,-1',1]]);
 const player=new Survival({},'survival').serialize();
 const r={id:'export',name:'Export',seed:'17',biome:'javaStreamed',generationVersion:12,mode:'survival',edits:[...w.edits],player,position:{x:-.5,y:102,z:-.5,yaw:0,pitch:0},minecarts:{version:1,carts:[]},updated:1700000000000,
  redstone:{version:1,clock:0,time:100,pending:[[-1,100,-1,93,103,-1,0]],lit:[]}};
 const {files}=await exportJavaSave(r,{world:w});
 const cx=-1+w.originX/16,cz=-1+w.originZ/16,a=regionAddress(cx,cz),c=chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x,a.z))));
 const t=c.tileTicks.find(e=>e.get('i').value===93);assert.ok(t);assert.equal(t.get('t').value,3);assert.equal(t.get('p').value,-1);assert.equal(t.get('x').value,w.originX-1);
});
