// Live support/growth for population plants and BlockRedstoneOre activation.
import {normalCube,WATER,LILY_PAD} from './world.js';
import {cropDrops} from './farming.js';
import {populationDrops} from './population-content.js';
import {solidTopSurface} from './doors-panes.js';
import {FLOWER_POT,potContents} from './stone-utility.js';
import {touchRedstoneOre,randomTickRedstoneOre} from './redstone-ore.js';
import {mushroomCanStay,mushroomSpread,isMushroom} from './plant-light.js';
const sides=[[0,1],[-1,0],[0,-1],[1,0]];
export function populationPlantCanStay(w,x,y,z,id=w.get(x,y,z)){
  const below=w.get(x,y-1,z),meta=w.getMeta(x,y,z);
  if(id===69)return meta&8?w.get(x,y-1,z)===69&&!(w.getMeta(x,y-1,z)&8):[1,2,29,30].includes(below)&&w.get(x,y+1,z)===69;
  // BlockDeadBush.canPlaceBlockOn: sand, hardened clay, stained clay or dirt (not grass); BlockTallGrass (grass/shrub/fern) is a plain BlockBush.
  if([39,79,83,84].includes(id))return id===79?[2,6,40,58].includes(below):[1,2,29,30].includes(below);
  // BlockMushroom.canBlockStay (plant-light.js): mycelium, podzol, or an opaque block below with full light < 13.
  if(isMushroom(id))return mushroomCanStay(w,x,y,z);
  // BlockFlowerPot.canBlockStay: the block below needs a solid top surface.
  if(id===FLOWER_POT)return solidTopSurface(w,x,y-1,z);
  if(id===73){const [dx,dz]=sides[meta&3];return w.get(x+dx,y,z+dz)===4&&(w.getMeta(x+dx,y,z+dz)&3)===3;}
  // BlockLilyPad.canBlockStay: still water (metadata 0) directly below.
  if(id===LILY_PAD)return below===WATER&&w.getMeta(x,y-1,z)===0;
  if(id===72)return normalCube(w.get(x,y+1,z))||sides.some(([dx,dz],i)=>(meta&(1<<i))&&(normalCube(w.get(x+dx,y,z+dz))||w.get(x,y+1,z)===72&&(w.getMeta(x,y+1,z)&(1<<i))));
  return true;
}
// BlockVine.func_150093_a: a face bit survives when its wall is a normal cube or the vine above carries the same face.
export function vineMeta(w,x,y,z){
  const meta=w.getMeta(x,y,z);let next=meta;
  if(meta>0)for(let i=0;i<4;i++){const bit=1<<i,[dx,dz]=sides[i];if((meta&bit)&&!normalCube(w.get(x+dx,y,z+dz))&&!(w.get(x,y+1,z)===72&&(w.getMeta(x,y+1,z)&bit)))next&=~bit;}
  return next;
}
export class PopulationBlocks{
  constructor(world,{drop=()=>{},apply=()=>{},random}={}){this.world=world;this.drop=drop;this.apply=apply;this.random=random;this.busy=false;}
  // BlockRedstoneOre.func_150185_e / updateTick (redstone-ore.js); `opts` = {rand, spawn} for the reddust sparkle.
  touch(x,y,z,opts={}){return touchRedstoneOre(this.world,x,y,z,{...opts,changed:this.apply});}
  randomTick(x,y,z,id){
    if(id===65)return randomTickRedstoneOre(this.world,x,y,z,{changed:this.apply});
    if(isMushroom(id)&&this.random){const to=mushroomSpread(this.world,x,y,z,this.random);if(to){this.world.set(to[0],to[1],to[2],id,true,0);this.apply([[to[0],to[1],to[2],0,id]]);}return true;}
    if(id===73&&this.random?.nextInt(5)===0){const m=this.world.getMeta(x,y,z);if((m>>2)<2){this.world.set(x,y,z,73,true,m+4);this.apply([[x,y,z,73,73]]);}return true;}
    return false;
  }
  watch(){const next=this.world.onChange,w=this.world;w.onChange=(x,y,z,old,now)=>{
    next?.(x,y,z,old,now);if(this.busy)return;this.busy=true;const changes=[];
    try{for(const [a,b,c] of [[x,y,z],[x,y-1,z],[x,y+1,z],[x-1,y,z],[x+1,y,z],[x,y,z-1],[x,y,z+1]]){
      const id=w.get(a,b,c);if(id===72&&populationPlantCanStay(w,a,b,c,id)){const nm=vineMeta(w,a,b,c);if(nm!==w.getMeta(a,b,c)){w.set(a,b,c,72,true,nm);changes.push([a,b,c,72,72]);}continue;}if(![39,69,72,73,75,76,79,83,84,LILY_PAD,FLOWER_POT].includes(id)||populationPlantCanStay(w,a,b,c,id))continue;
      const m=w.getMeta(a,b,c),drops=id===39?cropDrops(39):populationDrops(id,m)??[{id,count:1}];
      if(id===FLOWER_POT){const held=potContents(w,a,b,c);if(held)drops.push({id:held.id,count:1,damage:held.damage});}
      w.set(a,b,c,0);changes.push([a,b,c,id,0]);this.drop(drops,a,b,c);
      if(id===69&&!(m&8)&&w.get(a,b+1,c)===69){w.set(a,b+1,c,0);changes.push([a,b+1,c,69,0]);}
    }}finally{this.busy=false;}
    if(changes.length)this.apply(changes);
  };return this;}
}
