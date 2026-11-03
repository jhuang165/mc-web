// Live support/growth for population plants and BlockRedstoneOre activation.
import {normalCube} from './world.js';
import {populationDrops} from './population-content.js';
import {solidTopSurface} from './doors-panes.js';
import {FLOWER_POT,potContents} from './stone-utility.js';
const sides=[[0,1],[-1,0],[0,-1],[1,0]];
export function populationPlantCanStay(w,x,y,z,id=w.get(x,y,z)){
  const below=w.get(x,y-1,z),meta=w.getMeta(x,y,z);
  if(id===69)return meta&8?w.get(x,y-1,z)===69&&!(w.getMeta(x,y-1,z)&8):[1,2,29,30].includes(below)&&w.get(x,y+1,z)===69;
  if([79,83,84].includes(id))return id===79?[1,2,6,40,58].includes(below):[1,2,29,30].includes(below);
  if([75,76].includes(id))return below===57||below===2&&w.getMeta(x,y-1,z)===2||normalCube(below);
  // BlockFlowerPot.canBlockStay: the block below needs a solid top surface.
  if(id===FLOWER_POT)return solidTopSurface(w,x,y-1,z);
  if(id===73){const [dx,dz]=sides[meta&3];return w.get(x+dx,y,z+dz)===4&&(w.getMeta(x+dx,y,z+dz)&3)===3;}
  if(id===72)return normalCube(w.get(x,y+1,z))||sides.some(([dx,dz],i)=>(meta&(1<<i))&&(normalCube(w.get(x+dx,y,z+dz))||w.get(x,y+1,z)===72&&(w.getMeta(x,y+1,z)&(1<<i))));
  return true;
}
export class PopulationBlocks{
  constructor(world,{drop=()=>{},apply=()=>{},random}={}){this.world=world;this.drop=drop;this.apply=apply;this.random=random;this.busy=false;}
  touch(x,y,z){if(this.world.get(x,y,z)!==64)return false;this.world.set(x,y,z,65);this.apply([[x,y,z,64,65]]);return true;}
  randomTick(x,y,z,id){
    if(id===65){this.world.set(x,y,z,64);this.apply([[x,y,z,65,64]]);return true;}
    if(id===73&&this.random?.nextInt(5)===0){const m=this.world.getMeta(x,y,z);if((m>>2)<2){this.world.set(x,y,z,73,true,m+4);this.apply([[x,y,z,73,73]]);}return true;}
    return false;
  }
  watch(){const next=this.world.onChange,w=this.world;w.onChange=(x,y,z,old,now)=>{
    next?.(x,y,z,old,now);if(this.busy)return;this.busy=true;const changes=[];
    try{for(const [a,b,c] of [[x,y,z],[x,y-1,z],[x,y+1,z],[x-1,y,z],[x+1,y,z],[x,y,z-1],[x,y,z+1]]){
      const id=w.get(a,b,c);if(![69,72,73,75,76,79,83,84,FLOWER_POT].includes(id)||populationPlantCanStay(w,a,b,c,id))continue;
      const m=w.getMeta(a,b,c),drops=populationDrops(id,m)??[{id,count:1}];
      if(id===FLOWER_POT){const held=potContents(w,a,b,c);if(held)drops.push({id:held.id,count:1,damage:held.damage});}
      w.set(a,b,c,0);changes.push([a,b,c,id,0]);this.drop(drops,a,b,c);
      if(id===69&&!(m&8)&&w.get(a,b+1,c)===69){w.set(a,b+1,c,0);changes.push([a,b+1,c,69,0]);}
    }}finally{this.busy=false;}
    if(changes.length)this.apply(changes);
  };return this;}
}
