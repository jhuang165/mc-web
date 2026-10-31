// Seeded water scenarios and their replay through src/fluids.js, shared by
// tools/verify-fluids.mjs (which checks them against the original classes) and
// src/fluids.test.js (which checks them against the recorded reference).
// A scenario is a dx x dy x dz box inside a stone shell: '#' stone, '.' air,
// '~' settled water (no pending tick), plus [tick, op, x, y, z] events applied
// before that tick, op being remove (to air), stone or water (a level 0 source).
import {World} from '../src/world.js';
import {Fluids,flowVector,flowAngle,liquidHeightPercent} from '../src/fluids.js';

const DIMS=[14,8,14],ORIGIN=[30,10,30],STONE=3,WATER=10;
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function make(name,seed,{density,pools,sources,edits}){
 const r=rng(seed),[dx,dy,dz]=DIMS,cells=[];
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){
  const shell=x===0||y===0||z===0||x===dx-1||y===dy-1||z===dz-1;
  cells.push(shell||(y<=3&&r()<density*(y===1?1.4:y===2?1:.6))?'#':'.');
 }
 const at=(x,y,z)=>(x*dy+y)*dz+z,pick=()=>[1+Math.floor(r()*(dx-2)),1+Math.floor(r()*(dy-3)),1+Math.floor(r()*(dz-2))];
 for(let i=0;i<pools;i++){const [x,y,z]=pick();for(let a=0;a<3;a++)for(let b=0;b<3;b++){const p=at(Math.min(dx-2,x+a),y,Math.min(dz-2,z+b));if(cells[p]==='.')cells[p]='~';}}
 const events=[];
 for(let i=0;i<sources;i++)events.push([1+Math.floor(r()*30),'water',...pick()]);
 for(let i=0;i<edits;i++){const op=r()<.6?'remove':r()<.5?'stone':'water';events.push([1+Math.floor(r()*60),op,...pick()]);}
 events.sort((a,b)=>a[0]-b[0]);
 return {name,dims:DIMS,ticks:120,grid:cells.join(''),events};
}
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
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){const c=s.grid[(x*dy+y)*dz+z];w.set(...pos(x,y,z),c==='#'?STONE:c==='~'?WATER:0,false);}
 const fluids=new Fluids(w),grid=()=>{let out='';for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++){const b=w.get(...pos(x,y,z));out+=b===0?'.':b===WATER?String.fromCharCode(97+w.getMeta(...pos(x,y,z))):'#';}return out;};
 const hashes=[];
 for(let t=1;t<=s.ticks;t++){
  for(const [at,op,x,y,z] of s.events)if(at===t)w.set(...pos(x,y,z),op==='remove'?0:op==='stone'?STONE:WATER);
  fluids.tick();
  hashes.push(hash(grid()));
 }
 const flows=[];
 for(let x=0;x<dx;x++)for(let y=0;y<dy;y++)for(let z=0;z<dz;z++)if(w.get(...pos(x,y,z))===WATER){const p=pos(x,y,z),[vx,vy,vz]=flowVector(w,...p);flows.push([x,y,z,vx,vy,vz,flowAngle(w,...p)]);}
 return {hashes,grid:grid(),pending:fluids.pending.size,flows};
}
// Throws at the first difference between the original's and src/fluids.js's results.
export function compare(s,original,mine,percent){
 for(let t=0;t<s.ticks;t++)if(original.hashes[t]!==mine.hashes[t])throw new Error(`${s.name}: grid differs from the original after tick ${t+1}`);
 if(original.grid!==mine.grid)throw new Error(`${s.name}: final grid differs`);
 if(original.pending!==undefined&&original.pending!==mine.pending)throw new Error(`${s.name}: ${mine.pending} pending ticks, original ${original.pending}`);
 if(original.flows.length!==mine.flows.length)throw new Error(`${s.name}: water cell count differs`);
 original.flows.forEach((f,i)=>{for(let k=0;k<7;k++)if(Math.abs(f[k]-mine.flows[i][k])>1e-9)throw new Error(`${s.name}: flow of ${f.slice(0,3)} differs at ${k}: original ${f[k]}, JS ${mine.flows[i][k]}`);});
 percent?.forEach((p,m)=>{if(Math.fround(p)!==liquidHeightPercent(m))throw new Error(`liquid height percent of ${m}: original ${p}, JS ${liquidHeightPercent(m)}`);});
}
