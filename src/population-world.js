// Finite Java 1.7.10 v11 population. All 64 terrain/start searches precede population;
// x outer / z inner. The unpopulated terrain halo is lazy and its writes are discarded.
// Missing villages/strongholds/temples perform no draws or writes. World.rand starts at 0;
// light services are explicit 0 block/full light and 15 saved sky fixtures, not propagation.
import { mineshaftGenWorldClass } from './mineshaft-world.js';
import { MapGenMineshaft } from './mineshaft-generator.js';
import { JavaRandom } from './java-random.js';
import { BiomeDecoration } from './biome-decorator.js';
import { populateBeforeDecoration } from './population-stage.js';
import { populateTail } from './population-tail.js';

const key = (x,z) => `${x},${z}`;
export class PopulationArea {
  constructor({seed, chunkX, chunkZ, size=8, terrain, biomeAt, worldRandSeed=0n}) {
    this.seed=BigInt(seed); this.chunkX=chunkX; this.chunkZ=chunkZ; this.size=size;
    const Base=mineshaftGenWorldClass();
    this.world=new (class extends Base {
      // Halo terrain is available, but never populated or searched for new structure starts.
      chunkExists() { return true; }
      // BlockWeb drops Item.string when a water spring washes it away.
      dropBlockAsItem(id,x,y,z,meta,fortune) {
        if(id!==30) return super.dropBlockAsItem(id,x,y,z,meta,fortune);
        if(this.rand.nextFloat()<=1) this.spawnItem(x,y,z,287,1,0);
      }
      spawnEntity(e) {
        if(e.type === 'MinecartChest') this.carts.push(e);
        else this.animals.push(e);
        this.onEntity?.(e); return true;
      }
    })({rand:new JavaRandom(worldRandSeed),terrain});
    this.world.biomeAt=biomeAt; this.world.animals=[];
    this.mineshafts=new MapGenMineshaft(this.seed);
    this.decoration=new BiomeDecoration(); this.order=[];
  }
  run(hooks={}) {
    const {world:w,chunkX:cx,chunkZ:cz,size,seed}=this;
    for(let x=cx;x<cx+size;x++) for(let z=cz;z<cz+size;z++) {
      this.mineshafts.generate(x,z); w.chunk(x,z);
    }
    const r=new JavaRandom(seed);
    for(let x=cx;x<cx+size;x++) for(let z=cz;z<cz+size;z++) {
      this.order.push([x,z]); hooks.beforePopulate?.(x,z);
      const result=populateBeforeDecoration(w,r,seed,x,z,{structures:(random,a,b)=>{
        this.mineshafts.generateStructuresInChunk(w,random,a,b); return false;
      }});
      populateTail(w,r,this.decoration,x,z,result.biome.slot);
      hooks.afterPopulate?.(x,z,r,result);
    }
    return this;
  }
}
let mapper=null;
export const populationBlockMapperReady=import("./block-registry.js").then(m=>(mapper??=m.fromOriginal));
export function setPopulationBlockMapper(fn) { mapper=fn; }
const stackRecord=(s,slot)=>({slot,id:s[0],count:s[1],damage:s[2],...(s[3]?.length?{stored:s[3].map(([id,lvl])=>({id,lvl}))}:{})});
export function generateLivePopulation(world,{seed,originals,ringTerrain,mapBlock=mapper}) {
  if(!mapBlock) throw new Error('population-world: original block mapper not ready');
  const ox=world.originX, oz=world.originZ, cx=ox>>4, cz=oz>>4;
  const pass=new PopulationArea({seed,chunkX:cx,chunkZ:cz,
    terrain:(x,z)=>originals.get(key(x,z))??ringTerrain(x,z),
    biomeAt:(x,z)=>world.javaGenerator.manager.biomeAt(x,z)}).run();
  const w=pass.world, inside=(x,z)=>x>=ox&&z>=oz&&x<ox+128&&z<oz+128;
  const states=new Map();
  for(let a=0;a<8;a++) for(let b=0;b<8;b++) {
    const c=w.chunk(cx+a,cz+b), live=world.chunkAt(a,b);
    for(let x=0;x<16;x++) for(let z=0;z<16;z++) for(let y=0;y<256;y++) {
      const id=c.getBlock(x,y,z), meta=c.getMeta(x,y,z), packed=id*16+meta;
      let m=states.get(packed);
      if(!m) {
        m=mapBlock(id,meta);
        if(!m?.exact) throw new Error(`population-world: unmapped original block ${id}:${meta}`);
        states.set(packed,m);
      }
      const i=(x*16+z)*256+y; live.blocks[i]=m.id; live.meta[i]=m.meta;
      // Chests retain facing in their live tile; flowing/still share a runtime family.
    }
    live.tickCounts=null;
  }
  const local=b=>[b.minX-ox,b.minY,b.minZ-oz,b.maxX-ox,b.maxY,b.maxZ-oz];
  world.generatedStructures={
    mineshafts:pass.mineshafts.structureMap.values().filter(s=>s.boundingBox.intersectsWithXZ(ox,oz,ox+127,oz+127))
      .map(s=>({chunkX:s.chunkX-cx,chunkZ:s.chunkZ-cz,boundingBox:local(s.boundingBox)})),
    spawners:w.liveSpawners().filter(t=>inside(t.x,t.z)).map(t=>({x:t.x-ox,y:t.y,z:t.z-oz,entityId:t.name})),
    minecartChests:w.carts.filter(e=>inside(e.x,e.z)).map(e=>({x:e.x-ox,y:e.y,z:e.z-oz,items:e.slots.flatMap((s,i)=>s?[stackRecord(s,i)]:[])})),
    chests:[...w.chunks.values()].flatMap(c=>[...c.tiles.values()]).filter(t=>t.kind==='chest'&&inside(t.x,t.z))
      .map(t=>({x:t.x-ox,y:t.y,z:t.z-oz,facing:w.getBlockMetadata(t.x,t.y,t.z),items:t.slots.flatMap((s,i)=>s?[stackRecord(s,i)]:[])})),
    animals:w.animals.filter(e=>inside(e.x,e.z)).map(e=>({...e,x:e.x-ox,z:e.z-oz})),
    pendingTicks:w.pending.filter(([x,,z])=>inside(x,z)).map(([x,y,z,id,delay])=>({x:x-ox,y,z:z-oz,id,delay})),
    droppedItems:w.items.filter(d=>inside(d.x,d.z)).length,
  };
  return pass;
}
