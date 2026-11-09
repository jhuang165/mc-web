import test from 'node:test';import assert from 'node:assert/strict';
import {World,SAND} from './world.js';import {exportJavaSave} from './region-export.js';import {readRegion,decodeRegionChunk,regionAddress,regionSlot} from './region-file.js';import {chunkFromNbt} from './chunk-nbt.js';import {Survival} from './survival.js';
import {fromOriginal} from './block-registry.js';import {ForeignTicks,tickUpdatesTake,TICK_UPDATES_CAP,ageForeignTicks,placeForeignTicks,tickBlockIds,importTileTicks,tickRecordFields,mergeTickState,spreadTicks,tileTickRows,treeOrder,intOf} from './tile-ticks.js';
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
 assert.deepEqual(r.redstone,[[105,60,-95,93,3,-1]]);assert.equal(r.duplicates,1);assert.equal(r.outside,1);assert.equal(r.dropped.get(999),undefined);assert.deepEqual(r.foreign,[{i:0,x:106,y:60,z:-94,p:0,air:true}]);
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
 // floor_double / floor_float below -2^31: (int) saturates to MIN_VALUE, v < i then gives MIN_VALUE - 1, which wraps to MAX_VALUE (bytecode-read qh.c, qh.d).
 assert.equal(intOf({type:6,value:-1e20}),2147483647);assert.equal(intOf({type:5,value:-1e20}),2147483647);assert.equal(intOf({type:6,value:-2147483648}),-2147483648);assert.equal(intOf({type:6,value:-2147483648.5}),2147483647);assert.equal(intOf({type:5,value:-0.25}),-1);assert.equal(intOf({type:5,value:2147483648}),2147483647);
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

// ---- foreign ticks (batch 31): what the port cannot run is kept raw and written back until its due time
test('every native pending entry is kept: port lists plus foreign ticks hold exactly the unchanged load result (air, unknown ids, y out of range included)',()=>{
 let checked=0,foreignSeen=0;
 for(const c of reference.cases.filter(c=>c.kind==='read')){
  const seen=new Set(),rows=[],foreign=[];
  for(const load of c.loads){
   const got=importTileTicks(load.ticks.map(a=>nativeMap(a,load.absentWhenZero)),{seen});
   for(const k of ['fluid','fire','falling'])for(const e of got[k])rows.push([e.orig,e.x,e.y,e.z,e.delay,e.p]);
   for(const e of got.redstone)rows.push([e[3],e[0],e[1],e[2],e[4],e[5]]);
   foreign.push(...got.foreign);
  }
  foreignSeen+=foreign.length;
  for(const e of ageForeignTicks({time:c.time,entries:foreign},c.time))rows.push([e.i,e.x,e.y,e.z,e.delay,e.p]);
  const key=(r)=>r.join(',');
  assert.deepEqual(rows.map(key).sort(),c.pending.map(key).sort(),`read scenario ${c.index}`);checked++;
 }
 assert.equal(checked,14);assert.ok(foreignSeen>30);
});
test('ageForeignTicks: nothing is due at elapsed 0 (t <= 0 stays: a ThisTick entry reads back as a due entry), then t <= elapsed is gone, air is written as -now',()=>{
 const env={time:100,entries:[{i:1,x:0,y:5,z:0,t:-3,p:0},{i:1,x:1,y:5,z:0,t:4,p:1},{i:54,x:2,y:300,z:0,t:9,p:0},{i:0,x:3,y:5,z:0,p:0,air:true}]};
 assert.deepEqual(ageForeignTicks(env,100).map(e=>[e.x,e.delay]),[[0,-3],[1,4],[2,9],[3,-100]]);
 assert.deepEqual(ageForeignTicks(env,101).map(e=>[e.x,e.delay]),[[1,3],[2,8]]);
 assert.deepEqual(ageForeignTicks(env,104).map(e=>[e.x,e.delay]),[[2,5]]);assert.deepEqual(ageForeignTicks(env,109),[]);
 assert.deepEqual(ageForeignTicks(env,50).map(e=>e.x),[0,1,2,3]);assert.deepEqual(ageForeignTicks(undefined,5),[]);
});
test('placeForeignTicks writes a tick into every owned chunk whose box holds it and nothing outside',()=>{
 const rt=new Map(),owned=new Set(['0,0','1,0']),env={time:0,entries:[{i:1,x:15,y:1,z:5,t:5,p:0},{i:1,x:-1,y:1,z:5,t:5,p:0},{i:1,x:-3,y:1,z:5,t:5,p:0},{i:1,x:40,y:1,z:5,t:5,p:0}]};
 assert.equal(placeForeignTicks(rt,owned,env,0),2);
 assert.deepEqual(rt.get('0,0').foreignTicks.map(e=>e.value.x),[15,-1]);assert.deepEqual(rt.get('1,0').foreignTicks.map(e=>e.value.x),[15]);
 assert.equal(tileTickRows(rt.get('0,0'),()=>null).length,2);
});
test('an area import keeps air, unknown ids, y out of range and a low-edge border outside the area as foreignTicks; export ages them',async()=>{
 const {Chunk}=await import('./chunk-store.js'),{chunkToNbt}=await import('./chunk-nbt.js'),{encodeRegionChunk,writeRegion}=await import('./region-file.js'),{importJavaRegionArea}=await import('./region-import.js'),{NBT}=await import('./nbt.js');
 const t=(type,value)=>({type,value}),I=(v)=>t(NBT.INT,v),cmp=(o)=>new Map(Object.entries(o));
 const chunk=new Chunk(2,3);chunk.setBlockState(3,70,5,1,0);
 const x0=32,z0=48,row=(i,x,y,z,tt,p=0)=>cmp({i:I(i),x:I(x0+x),y:I(y),z:I(z0+z),t:I(tt),p:I(p)});
 const tileTicks=[row(0,3,70,5,7),row(999,4,70,5,3),row(1,6,300,5,9),row(1,7,-2,5,2),row(1,8,70,5,6,2),row(11,-1,70,5,4),row(8,-5,70,5,4),row(8,9,70,5,4)];
 const {regionX,regionZ,x,z}=regionAddress(chunk.x,chunk.z);
 const files=[{filename:`r.${regionX}.${regionZ}.mca`,bytes:writeRegion([await encodeRegionChunk(chunkToNbt(chunk,{tileTicks}),{x,z})])}];
 const {record,report}=await importJavaRegionArea(files,{area:{chunkX:2,chunkZ:3,width:1,depth:1}});
 assert.equal(record.fluidTicks.entries.length,1);assert.equal(report.ticks.foreign,6);assert.equal(report.ticks.outsideArea,1);
 const f=record.foreignTicks;assert.deepEqual(f.entries.map(e=>[e.i,e.air?'air':e.t]).sort(),[[0,'air'],[0,'air'],[1,2],[1,6],[1,9],[11,4]].sort());
 // Export: all of them are written back (the one at x=-1 relative sits in the 2-column low border of the area chunk), with the native air time -worldTime.
 const w=new World('17','javaStreamed',12);
 const out=await (await import('./region-export.js')).exportJavaSave({...record,totalTime:500,foreignTicks:{...f,time:500}},{world:w});
 const rowsOf=async(files)=>{const rows=[];for(const [name,bytes] of files)if(name.startsWith('region/')&&name.endsWith('.mca'))for(const [,entry] of readRegion(bytes)){const c=chunkFromNbt(await decodeRegionChunk(entry));for(const e of c.tileTicks??[])rows.push(['i','x','y','z','t','p'].map(k=>e.get(k).value));}return rows;};
 const rows=await rowsOf(out.files);
 const mine=rows.map(r=>[r[0],r[4],r[5]].join()).sort();
 assert.deepEqual(mine,['0,-500,0','0,-500,0','1,2,0','1,6,2','1,9,0','11,4,0','11,4,0','8,4,0'].sort()); // the 11 is written by the area chunk and by its owned lower neighbour (both boxes hold it), as natively
 // Played 3 ticks later: t <= 3 is gone (air, the t 2 tick), the rest is 3 lower (the port's own fluid list is not aged by the export).
 const later=await rowsOf((await (await import('./region-export.js')).exportJavaSave({...record,totalTime:503,foreignTicks:{...f,time:500}},{world:w})).files);
 assert.deepEqual(later.map(r=>[r[0],r[4]].join()).sort(),['1,3','1,6','11,1','11,1','8,4'].sort());
});
test('a save taken mid tick: the native writer appends the ThisTick entries (t <= 0) after the tree; reading that list back keeps all of them as due entries',()=>{
 let withThis=0;
 for(const c of reference.cases.filter(c=>c.kind==='write')){
  if(c.pendingThisTick.length)withThis++;
  const got=importTileTicks(c.saved.map(a=>nativeMap(a,false)),{});
  const rows=[];
  for(const k of ['fluid','fire','falling'])for(const e of got[k])rows.push([e.orig,e.x,e.y,e.z,e.delay,e.p]);
  for(const e of got.redstone)rows.push([e[3],e[0],e[1],e[2],e[4],e[5]]);
  for(const e of ageForeignTicks({time:c.time,entries:got.foreign},c.time))rows.push([e.i,e.x,e.y,e.z,e.delay,e.p]);
  const key=(r)=>r.join(','),dupes=new Set(),expected=c.saved.filter((r)=>{const k=[r[1],r[2],r[3],r[0]].join();if(dupes.has(k))return false;dupes.add(k);return true;});
  assert.deepEqual(rows.map(key).sort(),expected.map(key).sort(),`write scenario ${c.index}`);
 }
 assert.ok(withThis>=2);
});

test('replay of the unchanged WorldServer.tickUpdates: at most 1000 entries leave the tree per call, in time, priority, creation order, and what is left matches',()=>{
 const cases=reference.cases.filter(c=>c.kind==='tick');assert.equal(cases.length,6);
 let capped=0;
 for(const c of cases){
  const entries=c.before.map(a=>({a,t:a[4],p:a[5]})),{taken,left}=tickUpdatesTake(entries,c.all);
  assert.deepEqual(left.map(e=>e.a),c.remaining,`case ${c.index}`);assert.equal(c.remaining.length,c.hashSize);
  assert.equal(taken.length+left.length,c.before.length);assert.ok(taken.length<=TICK_UPDATES_CAP);
  if(taken.length===TICK_UPDATES_CAP)capped++;
 }
 assert.ok(capped>=4);assert.equal(cases[1].remaining.length,0);assert.equal(cases[2].remaining.length,1);
});
test('fluid, fire and falling tick priority is kept: import stores a non-zero p, the live lists order and save it, the export writes it back',async()=>{
 const r=importTileTicks([tick(8,1,60,2,5,0),tick(9,2,60,2,5,-3),tick(51,3,60,3,20,2),tick(12,4,70,4,2,5)],{});
 const f=tickRecordFields(r);
 assert.deepEqual(f.fluidTicks.entries.map(e=>e.p),[-3,undefined]);assert.equal(f.fireTicks.entries[0].p,2);assert.equal(f.fallingTicks.entries[0].p,5);
 const rows=tileTickRows({fluidTicks:f.fluidTicks.entries.map((value,order)=>({order,value})),fireTicks:[{order:0,value:f.fireTicks.entries[0]}],fallingTicks:[{order:0,value:f.fallingTicks.entries[0]}]});
 assert.deepEqual(rows.map(x=>[x.i,x.t,x.p]),[[12,2,5],[9,5,-3],[8,5,0],[51,20,2]]);
 // the live lists: the lower priority at the same time runs first and a saved envelope carries p only when it is not 0
 const {Fluids}=await import('./fluids.js'),{Fire}=await import('./fire.js'),{FallingBlocks}=await import('./falling.js');
 const w=new World('prio');for(const x of [1,2,3])w.set(x,60,2,0,false);w.set(1,60,2,10,false);w.set(2,60,2,10,false);
 const fl=new Fluids(w);fl.schedule(1,60,2,5,0);fl.schedule(2,60,2,5,-3);
 assert.deepEqual(fl.save().entries.map(e=>[e.x,e.p]),[[2,-3],[1,undefined]]);
 const back=new Fluids(w);back.load(fl.save());assert.deepEqual(back.save().entries,fl.save().entries);assert.equal(back.pop().x,2);
 const fire=new Fire(w,{weather:()=>({})});w.set(3,60,2,0,false);fire.schedule(3,60,2,20,2);fire.schedule(4,60,2,20,-1);
 assert.deepEqual(fire.save().entries.map(e=>[e.x,e.p]),[[4,-1],[3,2]]);
 const fb=new FallingBlocks(w);fb.enqueue(5,60,2,SAND,2,3);fb.enqueue(6,60,2,SAND,2,-1);
 assert.deepEqual(fb.save().entries.map(e=>[e.x,e.p]),[[6,-1],[5,3]]);
 const fb2=new FallingBlocks(w);fb2.load(fb.save());assert.deepEqual([...fb2.pending.values()].map(e=>e.p),[-1,3]);
});
test('foreign ticks are taken at their due time: air and unrunnable blocks are removed, a cell still holding a block the port ticks is scheduled',()=>{
 const id=(o)=>fromOriginal(o,0).id;
 const env={version:1,time:100,entries:[{i:0,x:1,y:5,z:1,p:0,air:true},{i:54,x:2,y:5,z:2,t:3,p:0},{i:8,x:3,y:5,z:3,t:2,p:1},{i:12,x:4,y:5,z:4,t:2,p:0},{i:12,x:5,y:300,z:5,t:2,p:0},{i:12,x:6,y:5,z:6,t:50,p:0},{i:93,x:7,y:5,z:7,t:2,p:-1}]};
 const cells={'3,5,3':id(8),'4,5,4':0,'7,5,7':id(1),'6,5,6':id(12),'5,300,5':id(12)};const ran=[];
 const ft=new ForeignTicks(env,(x,y,z)=>cells[`${x},${y},${z}`]??-1,{fluid:(x,y,z,e)=>ran.push(['fluid',x,e.p]),falling:(x)=>ran.push(['falling',x]),redstone:(x,y,z,e)=>ran.push(['redstone',x,e.p])});
 assert.equal(ft.tick(100),0);assert.equal(env.entries.length,7,'nothing is due at elapsed 0');
 assert.equal(ft.tick(101),0);assert.equal(env.entries.length,6,'air goes on the first tick and runs nothing');
 assert.equal(ft.tick(102),1);assert.deepEqual(ran,[['fluid',3,1]]);
 assert.deepEqual(env.entries.map(e=>e.i),[54,12],'the sand on air, the sand at y 300 and the repeater entry on a comparator are dropped; the chest (t 3) and the sand at t 50 wait');
 assert.equal(ft.tick(103),0);assert.deepEqual(env.entries.map(e=>e.i),[12]);
 assert.equal(ft.tick(149),0);assert.equal(ft.tick(150),1);assert.deepEqual(ran.at(-1),['falling',6]);assert.equal(env.entries.length,0);
});
test('foreign ticks: a backlog above 1000 due entries is taken 1000 per tick',()=>{
 const env={version:1,time:0,entries:Array.from({length:2500},(_,k)=>({i:54,x:k,y:5,z:0,t:1,p:0}))};const ft=new ForeignTicks(env,()=>-1,{});
 ft.tick(1);assert.equal(env.entries.length,1500);ft.tick(2);assert.equal(env.entries.length,500);ft.tick(3);assert.equal(env.entries.length,0);
});
