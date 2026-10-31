// Seeded water and lava scenarios and their replay through src/fluids.js, shared
// by tools/verify-fluids.mjs (which checks them against the original classes)
// and src/fluids.test.js (which checks them against the recorded reference).
// A scenario is a dx x dy x dz box inside a stone shell: '#' stone, '.' air,
// '~' settled water and 'L' settled lava (no pending tick), plus [tick, op, x, y,
// z] events applied before that tick, op being remove (to air), stone, water or
// lava (a level 0 source). `rseed` seeds the world Random both sides share and
// `nether` selects the Nether's lava rules.
import {World} from '../src/world.js';
import {Fluids,flowVector,flowAngle,liquidHeightPercent} from '../src/fluids.js';

const DIMS=[14,8,14],ORIGIN=[30,10,30],STONE=3,WATER=10,LAVA=42,COBBLESTONE=12,OBSIDIAN=22;
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function make(name,seed,{density,pools,sources,edits,lavaSources=0,lavaPools=0,lavaEdits=0,ticks=120,span=1,nether=false}){
 const r=rng(seed),[dx,dy,dz]=DIMS,cells=[];
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){
  const shell=x===0||y===0||z===0||x===dx-1||y===dy-1||z===dz-1;
  cells.push(shell||(y<=3&&r()<density*(y===1?1.4:y===2?1:.6))?'#':'.');
 }
 const at=(x,y,z)=>(x*dy+y)*dz+z,pick=()=>[1+Math.floor(r()*(dx-2)),1+Math.floor(r()*(dy-3)),1+Math.floor(r()*(dz-2))];
 for(let i=0;i<pools;i++){const [x,y,z]=pick();for(let a=0;a<3;a++)for(let b=0;b<3;b++){const p=at(Math.min(dx-2,x+a),y,Math.min(dz-2,z+b));if(cells[p]==='.')cells[p]='~';}}
 const events=[];
 for(let i=0;i<sources;i++)events.push([1+Math.floor(r()*30*span),'water',...pick()]);
 for(let i=0;i<edits;i++){const op=r()<.6?'remove':r()<.5?'stone':'water';events.push([1+Math.floor(r()*60*span),op,...pick()]);}
 // Lava is drawn after everything else so the water scenarios keep their cells.
 for(let i=0;i<lavaPools;i++){const [x,y,z]=pick();for(let a=0;a<2;a++)for(let b=0;b<2;b++){const p=at(Math.min(dx-2,x+a),y,Math.min(dz-2,z+b));if(cells[p]==='.')cells[p]='L';}}
 for(let i=0;i<lavaSources;i++)events.push([1+Math.floor(r()*30*span),'lava',...pick()]);
 for(let i=0;i<lavaEdits;i++){const op=r()<.4?'remove':r()<.3?'stone':r()<.5?'water':'lava';events.push([1+Math.floor(r()*60*span),op,...pick()]);}
 events.sort((a,b)=>a[0]-b[0]);
 return {name,dims:DIMS,ticks,grid:cells.join(''),events,...(seed>=100?{rseed:seed,nether}:{})};
}
// Lava: 1.7.10 overworld rules unless `nether`; ticks run long because lava
// waits 30 ticks per spread and four times that before each level rise.
export const LAVA_SCENARIOS=[
 make('lava-open',101,{density:0,pools:0,sources:0,edits:0,lavaSources:1,ticks:400}),
 make('lava-two',102,{density:0,pools:0,sources:0,edits:0,lavaSources:2,ticks:400}),
 make('lava-terraces',103,{density:.5,pools:0,sources:0,edits:0,lavaSources:2,lavaEdits:3,ticks:500}),
 make('lava-maze',104,{density:.8,pools:0,sources:0,edits:0,lavaSources:3,lavaEdits:5,ticks:500}),
 make('lava-pools',105,{density:.4,pools:0,sources:0,edits:0,lavaPools:3,lavaEdits:6,ticks:500}),
 make('lava-water',106,{density:.3,pools:1,sources:1,edits:3,lavaSources:3,lavaPools:1,lavaEdits:6,span:4,ticks:500}),
 make('lava-water-b',107,{density:.45,pools:2,sources:2,edits:6,lavaSources:3,lavaPools:2,lavaEdits:10,span:4,ticks:500}),
 make('lava-water-c',108,{density:.2,pools:2,sources:4,edits:8,lavaSources:5,lavaPools:1,lavaEdits:14,span:6,ticks:600}),
 make('lava-busy',109,{density:.35,pools:1,sources:3,edits:12,lavaSources:6,lavaPools:2,lavaEdits:20,span:6,ticks:600}),
 make('lava-busy-b',110,{density:.25,pools:2,sources:3,edits:10,lavaSources:8,lavaPools:2,lavaEdits:25,span:8,ticks:600}),
 make('nether-open',111,{density:0,pools:0,sources:0,edits:0,lavaSources:1,ticks:200,nether:true}),
 make('nether-terraces',112,{density:.5,pools:0,sources:0,edits:0,lavaSources:3,lavaEdits:6,ticks:300,nether:true}),
 make('nether-water',113,{density:.3,pools:1,sources:2,edits:4,lavaSources:4,lavaPools:1,lavaEdits:12,span:3,ticks:300,nether:true}),
];
// Every scenario also holds events that land on stone, water and air alike.
export const SCENARIOS=[
 make('open-floor',1,{density:0,pools:0,sources:1,edits:0}),
 make('two-sources',2,{density:0,pools:0,sources:2,edits:0}),
 make('terraces',3,{density:.5,pools:0,sources:2,edits:3}),
 make('terraces-b',4,{density:.6,pools:0,sources:3,edits:6}),
 make('maze',5,{density:.8,pools:0,sources:2,edits:6}),
 make('sparse',6,{density:.2,pools:0,sources:3,edits:8}),
 make('pools',7,{density:.4,pools:3,sources:0,edits:8}),
 make('pools-b',8,{density:.3,pools:4,sources:1,edits:12}),
 make('pools-c',9,{density:.5,pools:2,sources:2,edits:12}),
 make('busy',10,{density:.35,pools:2,sources:6,edits:20}),
 make('busy-b',11,{density:.45,pools:1,sources:8,edits:25}),
 make('busy-c',12,{density:.25,pools:3,sources:5,edits:30}),
];

const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;};
export function replay(s){
 const [dx,dy,dz]=s.dims,[ox,oy,oz]=ORIGIN,w=new World('fluid-scenario');
 const pos=(x,y,z)=>[ox+x,oy+y,oz+z];
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){const c=s.grid[(x*dy+y)*dz+z];w.set(...pos(x,y,z),c==='#'?STONE:c==='~'?WATER:c==='L'?LAVA:0,false);}
 let t=0;const fizz=[];
 const fluids=new Fluids(w,{seed:s.rseed??0,nether:!!s.nether,fizz:(x,y,z,pitch)=>fizz.push([t,x-ox,y-oy,z-oz,'random.fizz',0.5,pitch])});
 const grid=()=>{let out='';for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){const p=pos(x,y,z),b=w.get(...p);out+=b===0?'.':b===WATER?String.fromCharCode(97+w.getMeta(...p)):b===LAVA?String.fromCharCode(65+w.getMeta(...p)):b===OBSIDIAN?'@':b===COBBLESTONE?'%':'#';}return out;};
 const hashes=[];
 for(t=1;t<=s.ticks;t++){
  for(const [at,op,x,y,z] of s.events)if(at===t)w.set(...pos(x,y,z),op==='remove'?0:op==='stone'?STONE:op==='lava'?LAVA:WATER);
  fluids.tick();
  hashes.push(hash(grid()));
 }
 const flows=[];
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){const p=pos(x,y,z),b=w.get(...p);if(b===WATER||b===LAVA){const [vx,vy,vz]=flowVector(w,...p,b);flows.push([x,y,z,vx,vy,vz,flowAngle(w,...p,b)]);}}
 return {hashes,grid:grid(),pending:fluids.pending.size,flows,fizz,rng:fluids.random.nextInt()};
}
// Throws at the first difference between the original's and src/fluids.js's results.
export function compare(s,original,mine,percent){
 for(let t=0;t<s.ticks;t++)if(original.hashes[t]!==mine.hashes[t])throw new Error(`${s.name}: grid differs from the original after tick ${t+1}`);
 if(original.grid!==mine.grid)throw new Error(`${s.name}: final grid differs`);
 if(original.pending!==undefined&&original.pending!==mine.pending)throw new Error(`${s.name}: ${mine.pending} pending ticks, original ${original.pending}`);
 if(original.fizz){
  if(original.fizz.length!==mine.fizz.length)throw new Error(`${s.name}: ${mine.fizz.length} fizz sounds, original ${original.fizz.length}`);
  original.fizz.forEach((e,i)=>{const m=mine.fizz[i];for(let k=0;k<5;k++)if(e[k]!==m[k])throw new Error(`${s.name}: fizz ${i} differs at ${k}: original ${e[k]}, JS ${m[k]}`);if(e[5]!==m[5]||Math.fround(e[6])!==m[6])throw new Error(`${s.name}: fizz ${i} volume/pitch: original ${e[5]}/${e[6]}, JS ${m[5]}/${m[6]}`);});
 }
 if(original.rng!==undefined&&original.rng!==mine.rng)throw new Error(`${s.name}: world Random left in a different state (${mine.rng}, original ${original.rng})`);
 if(original.flows.length!==mine.flows.length)throw new Error(`${s.name}: water cell count differs`);
 original.flows.forEach((f,i)=>{for(let k=0;k<7;k++)if(Math.abs(f[k]-mine.flows[i][k])>1e-9)throw new Error(`${s.name}: flow of ${f.slice(0,3)} differs at ${k}: original ${f[k]}, JS ${mine.flows[i][k]}`);});
 percent?.forEach((p,m)=>{if(Math.fround(p)!==liquidHeightPercent(m))throw new Error(`liquid height percent of ${m}: original ${p}, JS ${liquidHeightPercent(m)}`);});
}
