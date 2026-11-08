import test from 'node:test';import assert from 'node:assert/strict';
import {World} from './world.js';import {exportJavaSave} from './region-export.js';import {readRegion,decodeRegionChunk,regionAddress,regionSlot} from './region-file.js';import {chunkFromNbt} from './chunk-nbt.js';import {Survival} from './survival.js';
import {tickBlockIds,importTileTicks,tickRecordFields,mergeTickState,spreadTicks,tileTickRows,treeOrder,intOf} from './tile-ticks.js';
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
 mergeTickState(acc,seen,'redstone',{comparators:[['1,2,3',5],['2,2,3',6]]});mergeTickState(acc,seen,'redstone',{comparators:[['1,2,3',5]]});assert.deepEqual(acc.redstone.comparators,[['1,2,3',5],['2,2,3',6]]);
});
test('spreadTicks copies a tick in the last 2 columns into the owned higher neighbour only',()=>{
 const rt=new Map([['0,0',{fluidTicks:[{order:0,value:{x:15,y:1,z:5}},{order:1,value:{x:8,y:1,z:8}},{order:2,value:{x:1,y:1,z:1}}]}]]);
 spreadTicks(rt,new Set(['-1,0','0,-1','0,0','1,0','0,1']),['fluidTicks']);
 assert.equal(rt.get('1,0').fluidTicks.length,1);assert.equal(rt.get('0,1'),undefined);assert.equal(rt.get('-1,0'),undefined);assert.equal(rt.get('0,-1'),undefined);assert.equal(rt.get('0,0').fluidTicks.length,3);
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

// ---- native replay: public/research/tile-ticks-reference.json (tools/probes/TileTicksProbe.java, tools/verify-tile-ticks.mjs)
import {readFileSync} from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../public/research/tile-ticks-reference.json',import.meta.url)));
const KEYS=['i','x','y','z','t','p'];
const nativeMap=(a,absentZero)=>new Map(KEYS.flatMap((k,q)=>absentZero&&a[q]===0?[]:[[k,num(a[q])]]));
const supported=()=>{const k=tickBlockIds();return new Set([...k.fluid,...k.fire,...k.falling,...k.redstone]);};
test('replay of the unchanged WorldServer load path: pending list, order, times and priorities match',()=>{
 const ids=supported();let checked=0,kept=0;
 for(const c of reference.cases.filter(c=>c.kind==='read')){
  const seen=new Set(),rows=[];
  for(const load of c.loads){
   const got=importTileTicks(load.ticks.map(a=>nativeMap(a,load.absentWhenZero)),{seen});
   for(const k of ['fluid','fire','falling'])for(const e of got[k])rows.push({row:[e.orig,e.x,e.y,e.z,e.delay,e.p],t:e.delay,p:e.p});
   for(const e of got.redstone)rows.push({row:[e[3],e[0],e[1],e[2],e[4],e[5]],t:e[4],p:e[5]});
  }
  // Native: every entry is kept (also air, unknown ids and y out of range); the port keeps the ones it schedules, in the same tree order.
  // Native: every entry is kept (also air, unknown ids and y out of range); the port keeps the ones it schedules. The port's kinds are separate
  // lists, so tree order (time, priority, load order) is compared inside each kind.
  const kinds={fluid:[8,9,10,11],fire:[51],falling:[12,13,122,145],redstone:tickBlockIds().redstone};
  const kindOfId=(i)=>Object.keys(kinds).find(k=>kinds[k].includes(i));
  const byKind=(list,key)=>Object.fromEntries(Object.keys(kinds).map(k=>[k,list.filter(r=>kindOfId(key(r))===k)]));
  const actual=byKind(treeOrder(rows,r=>r.t,r=>r.p).map(r=>r.row),r=>r[0]);
  const expected=byKind(c.pending.filter(([i,,y])=>ids.has(i)&&y>=0&&y<=255),r=>r[0]);
  kept+=Object.values(actual).flat().length;
  assert.deepEqual(actual,expected,`read scenario ${c.index}`);checked++;
 }
 assert.equal(checked,14);assert.ok(kept>40);
});
test('replay of getPendingBlockUpdates and the writer: border box, order and priorities match',()=>{
 const ids=supported();let checked=0,rowsSeen=0;
 const kindOf=(id)=>tickBlockIds().fluid.includes(id)?'fluidTicks':id===51?'fireTicks':tickBlockIds().falling.includes(id)?'fallingTicks':'redstoneTicks';
 for(const c of reference.cases.filter(c=>c.kind==='write')){
  const runtime=new Map(),owned=new Set();
  c.pending.forEach(([i,x,y,z,t,p],order)=>{
   if(!ids.has(i))return;
   const k=`${Math.floor(x/16)},${Math.floor(z/16)}`,name=kindOf(i);owned.add(k);
   if(!runtime.has(k))runtime.set(k,{});
   (runtime.get(k)[name]??=[]).push({order,value:name==='redstoneTicks'?{x,y,z,id:i,delay:t,priority:p}:{x,y,z,orig:i,block:1,delay:t}});
  });
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)owned.add(`${c.cx+dx},${c.cz+dz}`);
  spreadTicks(runtime,owned,['fluidTicks','fireTicks','fallingTicks','redstoneTicks']);
  const rows=tileTickRows(runtime.get(`${c.cx},${c.cz}`)??{},()=>null).map(r=>[r.i,r.x,r.y,r.z,r.t,r.p]);
  // The native writer lists the tree entries first and the ThisTick entries after them (only filled while a tick runs); both use the box [c*16-2, c*16+16).
  const inBox=([,x,,z])=>x>=c.cx*16-2&&x<c.cx*16+16&&z>=c.cz*16-2&&z<c.cz*16+16;
  const tail=c.pendingThisTick.filter(inBox).length;
  const treeSaved=c.saved.slice(0,c.saved.length-tail).filter(([i])=>ids.has(i));
  assert.deepEqual(rows,treeSaved,`write scenario ${c.index}`);
  assert.deepEqual(c.saved.slice(c.saved.length-tail),c.pendingThisTick.filter(inBox),`native ThisTick tail ${c.index}`);
  checked++;rowsSeen+=rows.length;
 }
 assert.equal(checked,10);assert.ok(rowsSeen>10);
});
test('intOf reads numeric tags like NBTTagCompound.getInteger and other types as 0',()=>{
 assert.equal(intOf(undefined),0);assert.equal(intOf({type:8,value:'5'}),0);assert.equal(intOf({type:3,value:-7}),-7);
 assert.equal(intOf({type:4,value:4294967301n}),5);assert.equal(intOf({type:4,value:-2147483649n}),2147483647);
 assert.equal(intOf({type:6,value:-1.5}),-2);assert.equal(intOf({type:5,value:3.9}),3);assert.equal(intOf({type:6,value:1e20}),2147483647);assert.equal(intOf({type:6,value:NaN}),0);
});

// ---- comparator OutputSignal (TileEntityComparator, bytecode-read: readFromNBT getInteger "OutputSignal", writeToNBT setInteger)
test('a Comparator tile entity imports its OutputSignal into the live redstone state and exports it again',async()=>{
 const {Chunk}=await import('./chunk-store.js'),{chunkToNbt}=await import('./chunk-nbt.js'),{encodeRegionChunk,writeRegion}=await import('./region-file.js'),{importJavaRegionArea}=await import('./region-import.js'),{NBT}=await import('./nbt.js'),{LiveRedstone}=await import('./redstone-live.js');
 const t=(type,value)=>({type,value}),compound=(o)=>new Map(Object.entries(o));
 const chunk=new Chunk(-2,3);chunk.setBlockState(3,70,5,149,0);chunk.setBlockState(4,70,5,150,8);chunk.setBlockState(6,70,5,1,0);
 const x0=-32,z0=48,tile=(id,x,z,extra)=>compound({id:t(NBT.STRING,id),x:t(NBT.INT,x0+x),y:t(NBT.INT,70),z:t(NBT.INT,z0+z),...extra});
 const tileEntities=[tile('Comparator',3,5,{OutputSignal:t(NBT.INT,7)}),tile('Comparator',4,5,{OutputSignal:t(NBT.LONG,4294967299n)}),tile('Comparator',6,5,{OutputSignal:t(NBT.INT,3)}),tile('Comparator',9,5,{})];
 const {regionX,regionZ,x,z}=regionAddress(chunk.x,chunk.z);
 const files=[{filename:`r.${regionX}.${regionZ}.mca`,bytes:writeRegion([await encodeRegionChunk(chunkToNbt(chunk,{tileEntities}),{x,z})])}];
 const {record,report}=await importJavaRegionArea(files,{area:{chunkX:-2,chunkZ:3,width:1,depth:1}});
 assert.deepEqual(record.redstone.comparators,[['51,70,53',7],['52,70,53',3]]);
 assert.equal(report.tileEntities.converted.Comparator,2);assert.equal(report.ticks.comparators,2);
 assert.ok(report.tileEntities.lost.some(e=>e.id==='Comparator'),'a Comparator tile on a stone cell is lost');
 // The live engine restores the signal as its comparator tile and saves it again.
 const live=new LiveRedstone(new World('17','javaStreamed',12));live.restore({...record.redstone});
 assert.deepEqual(live.save().comparators,[['51,70,53',7],['52,70,53',3]]);
 // Export: a comparator tile is written only where the chunk holds a comparator.
 const w=new World('17','javaStreamed',12);w.restore([['-1,100,-1',127],['-3,100,-1',128|(8<<8)],['-5,100,-1',1]]);
 const r={id:'cmp',name:'Cmp',seed:'17',biome:'javaStreamed',generationVersion:12,mode:'survival',edits:[...w.edits],player:new Survival({},'survival').serialize(),position:{x:-.5,y:102,z:-.5,yaw:0,pitch:0},minecarts:{version:1,carts:[]},updated:1700000000000,
  redstone:{version:1,clock:0,time:0,pending:[],lit:[],comparators:[['-1,100,-1',9],['-3,100,-1',2],['-5,100,-1',4],['-7,100,-1',1]]}};
 const out=await exportJavaSave(r,{world:w});
 const cx=-1+w.originX/16,cz=-1+w.originZ/16,a=regionAddress(cx,cz),c=chunkFromNbt(await decodeRegionChunk(readRegion(out.files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x,a.z))));
 const signals=c.tileEntities.filter(e=>e.get('id').value==='Comparator').map(e=>[e.get('x').value-w.originX,e.get('z').value-w.originZ,e.get('OutputSignal').value]).sort((p,q)=>p[0]-q[0]);
 assert.deepEqual(signals,[[-3,-1,2],[-1,-1,9]]);
});
