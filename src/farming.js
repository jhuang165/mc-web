import {hash,isCrop,cropAge,cropKind,CARROTS,POTATOES,HEIGHT} from './world.js';
import {plantedBlock,rootDrops} from './crops.js';
import {isStem,stemTick,stemCanFertilize,stemFertilized} from './stems-cake.js';
import {JavaRandom} from './java-random.js';
import {ringRandomActive} from './streaming-ticks.js';
export const RANDOM_TICK_CHANCE=3/4096;
export function cropDrops(block,random=Math.random,meta=0){if(block===CARROTS||block===POTATOES)return rootDrops(block,cropAge(block,meta),n=>Math.floor(random()*n));if(block===39)return random()<1/8?[{id:309,count:1}]:[];if(!isCrop(block))return null;if(block<38)return[{id:309,count:1}];let seeds=0;for(let i=0;i<3;i++)if(Math.floor(random()*15)<=7)seeds++;return[{id:305,count:1},...(seeds?[{id:309,count:seeds}]:[])];}
// BlockCrops.canBlockStay (farmland below) and BlockFarmland.onNeighborBlockChange (a solid block above turns it to dirt): both run on EVERY
// neighbour update of the cell (block-sweep-reference.json nb column), not only when the cell below or above changes. Applies the changes
// around (x, y, z) and returns them as {x, y, z, old, now, drops}.
const NEIGHBOURS=[[0,0,0],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
export function farmNeighbourChange(world,x,y,z,random=Math.random){
 const out=[];
 for(const[dx,dy,dz]of NEIGHBOURS){
  const cx=x+dx,cy=y+dy,cz=z+dz,b=world.get(cx,cy,cz);
  if(isCrop(b)&&![29,30].includes(world.get(cx,cy-1,cz))){const drops=cropDrops(b,random,world.getMeta(cx,cy,cz));world.set(cx,cy,cz,0);out.push({x:cx,y:cy,z:cz,old:b,now:0,drops});}
  else if((b===29||b===30)&&world.solid(cx,cy+1,cz)&&world.get(cx,cy+1,cz)!==46){world.set(cx,cy,cz,2);out.push({x:cx,y:cy,z:cz,old:b,now:2,drops:[]});}
 }
 return out;
}
export class Farming {
 constructor(world,saved=[]){this.world=world;this.fields=new Map();this.updates=new Map();for(const [key,b]of world.edits)if(b===29||b===30)this.fields.set(key,b===30?7:0);if(Array.isArray(saved))for(const entry of saved){if(!Array.isArray(entry)||entry.length!==2)continue;const[key,m]=entry;if((this.fields.has(key)||(world.streaming&&typeof key==='string'&&(()=>{const p=key.split(',').map(Number);return p.length===3&&p.every(Number.isInteger)&&world.inside(...p)&&!world.isLoaded(p[0],p[2]);})()))&&Number.isInteger(m)&&m>=0&&m<=7)this.fields.set(key,m);}}
 change(x,y,z,b,meta=0){if(this.world.set(x,y,z,b,true,meta))this.updates.set(`${x},${y},${z}`,[x,y,z]);}
 observe(x,y,z){const b=this.world.get(x,y,z),key=[x,y,z].join(',');if(b===29||b===30){if(!this.fields.has(key))this.fields.set(key,b===30?7:0);}else this.fields.delete(key);}
 // BlockFarmland.onFallenUpon: the roll comes first; then an entity that is not a player needs gamerule mobGriefing (`grief`).
 trample(x,y,z,distance,random=Math.random,grief=true){if(![29,30].includes(this.world.get(x,y,z))||random()>=Math.fround(Math.fround(distance)-0.5)||!grief)return false;this.change(x,y,z,2);this.fields.delete(`${x},${y},${z}`);return true;}
 till(x,y,z){if(![1,2].includes(this.world.get(x,y,z))||this.world.get(x,y+1,z)!==0)return false;this.change(x,y,z,29);this.fields.set(`${x},${y},${z}`,0);return true;}
 plant(x,y,z,item=309){const b=plantedBlock(item);if(!b||![29,30].includes(this.world.get(x,y,z))||this.world.get(x,y+1,z)!==0||y>=(this.world.height??HEIGHT)-2)return false;this.observe(x,y,z);this.change(x,y+1,z,b);return true;}
 setAge(x,y,z,b,age){this.change(x,y,z,cropKind(b)===31?31+age:b,cropKind(b)===31?0:age);}
// BlockStem.updateTick (stems-cake.js): light at y + 1, the crop growth rate, then ageing or the fruit; its java.util.Random is the world's.
 growStem(x,y,z,daylight){const rand=(this.stemRandom??=new JavaRandom(Math.floor(Math.random()*2**48)));let any=false;for(const[wx,wy,wz,b,meta]of stemTick(this.world,x,y,z,rand,{light:this.lightLevel?this.lightLevel(x,y+1,z):this.light(x,y+1,z,daylight),moisture:(mx,my,mz)=>this.fields.get(`${mx},${my},${mz}`)??(this.world.get(mx,my,mz)===30?7:0)})){this.change(wx,wy,wz,b,meta);any=true;}return any;}
 fertilize(x,y,z,random=Math.random){const sb=this.world.get(x,y,z);if(isStem(sb)){const m=this.world.getMeta(x,y,z);if(!stemCanFertilize(m))return false;this.change(x,y,z,sb,stemFertilized(m,{nextInt:n=>Math.floor(random()*n)}));return true;}const b=sb,age=cropAge(b,this.world.getMeta(x,y,z));if(!isCrop(b)||age===7)return false;this.setAge(x,y,z,b,Math.min(7,age+2+Math.floor(random()*4)));return true;}
 nearWater(x,y,z){for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)for(let dy=0;dy<=1;dy++)if(this.world.get(x+dx,y+dy,z+dz)===10)return true;return false;}
 soilTick(x,y,z){const key=`${x},${y},${z}`;if(![29,30].includes(this.world.get(x,y,z))){this.fields.delete(key);return;}let m=this.fields.get(key)||0;if(this.nearWater(x,y,z)||this.rained?.(x,y,z))m=7;else if(m>0)m--;else if(!isCrop(this.world.get(x,y+1,z))){this.change(x,y,z,2);this.fields.delete(key);return;}this.fields.set(key,m);const id=m>0?30:29;if(this.world.get(x,y,z)!==id)this.change(x,y,z,id);}
 growthRate(x,y,z){let rate=1;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const b=this.world.get(x+dx,y-1,z+dz);if(b===29||b===30){let value=(this.fields.get(`${x+dx},${y-1},${z+dz}`)??(b===30?7:0))>0?3:1;if(dx||dz)value/=4;rate+=value;}}
 const kind=cropKind(this.world.get(x,y,z)),crop=(dx,dz)=>cropKind(this.world.get(x+dx,y,z+dz))===kind,row=crop(-1,0)||crop(1,0),column=crop(0,-1)||crop(0,1),diagonal=crop(-1,-1)||crop(-1,1)||crop(1,-1)||crop(1,1);if(row&&column||diagonal)rate/=2;return rate;}
 light(x,y,z,daylight){let sky=true;for(let by=y+1;by<(this.world.height??HEIGHT);by++)if(this.world.solid(x,by,z)){sky=false;break;}let level=sky?Math.floor(daylight*15):0;if(level>=9)return level;for(let dx=-5;dx<=5;dx++)for(let dz=-5;dz<=5;dz++)for(let dy=-3;dy<=3;dy++){if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>5)continue;if(this.world.get(x+dx,y+dy,z+dz)===20)level=Math.max(level,14-Math.abs(dx)-Math.abs(dy)-Math.abs(dz));}return level;}
  grow(x,y,z,daylight,random=Math.random,nextInt=null){const b=this.world.get(x,y,z);if(isStem(b))return this.growStem(x,y,z,daylight);const age=cropAge(b,this.world.getMeta(x,y,z));if(!isCrop(b)||age===7||(this.lightLevel?this.lightLevel(x,y+1,z):this.light(x,y,z,daylight))<9)return false;const denominator=Math.floor(25/this.growthRate(x,y,z))+1;if((nextInt?nextInt(denominator):Math.floor(random()*denominator))!==0)return false;this.setAge(x,y,z,b,age+1);return true;}
 // b68 chunkscan2: the dedicated server's route. BlockFarmland.updateTick, BlockCrops.updateTick and BlockStem.updateTick are RANDOM block ticks (func_149653_t / tickRandomly true), so the
 // server sets `sharedRandomTicks` and Weather.tickChunk's loop over the active chunk set calls randomTick below with the world's java.util.Random; tick() then only drains the changes.
 // Single player keeps the hash scan in tick() (same 3/4096 mean rate, not the native draw order).
 randomTick(x,y,z,b=this.world.get(x,y,z),random=this.random){if(b===29||b===30){this.observe(x,y,z);this.soilTick(x,y,z);return true;}if(!isCrop(b)&&!isStem(b))return false;this.grow(x,y,z,0,null,random?n=>random.nextInt(n):null);return true;}
 tick(time,daylight){if(this.sharedRandomTicks)return this.drain();for(const key of this.fields.keys()){const[x,y,z]=key.split(',').map(Number);if(this.world.streaming&&!ringRandomActive(this.world,x,z))continue;if(hash(x+time*13,z,this.world.numericSeed+91)<RANDOM_TICK_CHANCE)this.soilTick(x,y,z);if(hash(x+time*29,z,this.world.numericSeed+449)<RANDOM_TICK_CHANCE)this.grow(x,y+1,z,daylight,()=>hash(x+time,z,780));}return this.drain();}
 drain(){const out=[...this.updates.values()];this.updates.clear();return out;}
 serialize(){return[...this.fields];}
}
