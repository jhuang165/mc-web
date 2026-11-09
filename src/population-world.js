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
import { StructurePopulation } from './structure-population.js';
import { MapGenVillage } from './village-generator.js';
import { MapGenStronghold } from './stronghold-generator.js';
import { MapGenScatteredFeature } from './scattered-feature-generator.js';
import { strongholdPositions } from './structure-placement.js';
import { structureWorldClass } from './structure-world-blocks.js';
import { potContentsOfMeta } from './stone-utility.js';
import { FlatStructureCache, flatStructurePopulation } from './flat-structures.js';
import { FlatChunkManager } from './flat-world.js';
import { nativeNeighborWorldClass } from './native-neighbor-world.js';
import { StructureRedstone } from './structure-redstone.js';

const key = (x,z) => `${x},${z}`;
// Original ids whose add/break callbacks the structure fixtures replay as no-ops (stairs, fences' neighbours,
// TNT, ...); see structure-population-area.js, which these overrides repeat verbatim.
const QUIET_ADDED = [46, 53, 67, 108, 109, 114, 128, 134, 135, 136], QUIET_BROKEN = [53, 67, 108, 109, 114, 128, 134, 135, 136];
// Per-world cache of what is a pure function of the seed and expensive: the stronghold ring positions
// (a biome search). Starts themselves are rebuilt per area, because populate mutates their pieces.
export class StructureCache {
  constructor(seed, manager) { this.seed = BigInt.asIntN(64, BigInt(seed)); this.manager = manager; this.strongholds = null; }
  strongholdPositions() { return (this.strongholds ??= strongholdPositions(this.seed, this.manager)); }
  generators() {
    return {
      mineshaft: new MapGenMineshaft(this.seed),
      village: new MapGenVillage(this.seed, this.manager),
      stronghold: new MapGenStronghold(this.seed, this.strongholdPositions()),
      scatteredFeature: new MapGenScatteredFeature(this.seed, this.manager),
    };
  }
}
export class PopulationArea {
  // `margin` extra rows/columns on the -x/-z side are searched and populated too (streamed cells use
  // 1, so every kept column receives the writes of the populate calls that overlap it). Finite v11
  // worlds keep 0.
  //
  // `structures` (generation versions 14/15) runs the full native four-feature chain (mineshaft, village,
  // stronghold, scatteredFeature) instead of mineshafts only; it needs `manager` (or a StructureCache).
  //
  // `mapFeatures:false` (streamed generation 17, a level.dat with MapFeatures off) builds no structure generator at all: no search,
  // no structure populate, village false. Lakes, dungeons and decoration still run (ChunkProviderGenerate/Flat.populate).
  //
  // `flat` (a FlatGeneratorInfo, flat-world.js) runs ChunkProviderFlat's structure list and populate instead
  // (flat-structures.js): the enabled features only, no animals, no snow, decoration only when the preset has it.
  constructor({seed, chunkX, chunkZ, size=8, margin=0, terrain, biomeAt, worldRandSeed=0n, structures=false, manager=null, structureCache=null, flat=null, mapFeatures=true, neighbors=false}) {
    this.seed=BigInt(seed); this.chunkX=chunkX; this.chunkZ=chunkZ; this.size=size; this.margin=margin; this.flat=flat; this.mapFeatures=mapFeatures; this.neighbors=neighbors&&(structures||!!flat); this.relaxRedstone=false;
    const full=structures||!!flat, Base0=full?structureWorldClass(mineshaftGenWorldClass()):mineshaftGenWorldClass(), Base=this.neighbors?nativeNeighborWorldClass(this,Base0):Base0;
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
        else if(e.type === 'PrimedTnt') (this.primedTnt ??= []).push(e);
        else this.animals.push(e);
        this.onEntity?.(e); return true;
      }
    })({rand:new JavaRandom(worldRandSeed),terrain});
    this.world.biomeAt=biomeAt; this.world.animals=[];
    if(this.neighbors) this.redstone=new StructureRedstone(this.world);
    if(full) {
      const w=this.world;
      const added=w.blockAdded.bind(w), broke=w.breakBlock.bind(w);
      // BlockTNT.onBlockAdded reads the power around it natively (neighbours mode); the older worlds keep it silent.
      const quiet=this.neighbors?QUIET_ADDED.filter(id=>id!==46):QUIET_ADDED;
      w.blockAdded=(id,x,y,z)=>quiet.includes(id)?undefined:added(id,x,y,z);
      w.breakBlock=(id,x,y,z,meta)=>QUIET_BROKEN.includes(id)?undefined:broke(id,x,y,z,meta);
      w.getTopSolidOrLiquid=(x,z)=>w.getTopSolidOrLiquidBlock(x,z);
      w.getAverageGroundLevel=()=>64;
      w.notifyBlocksOfNeighborChange=(x,y,z,source)=>w.notifyNeighbors(x,y,z,source);
      const cache=structureCache??(flat?new FlatStructureCache(this.seed,manager??new FlatChunkManager(flat.biome),flat,mapFeatures):new StructureCache(this.seed,manager));
      this.structures=flat
        ?new (flatStructurePopulation(StructurePopulation))({worldSeed:this.seed,manager:cache.manager,world:w,generators:cache.generators(),info:flat,mapFeatures})
        :new StructurePopulation({worldSeed:this.seed,manager:cache.manager,world:w,generators:cache.generators()});
      this.mineshafts=this.structures.generators.mineshaft;
    } else this.mineshafts=new MapGenMineshaft(this.seed);
    this.decoration=new BiomeDecoration(); this.order=[];
  }
  run(hooks={}) {
    const {world:w,chunkX:cx,chunkZ:cz,size,margin,seed}=this;
    for(let x=cx-margin;x<cx+size;x++) for(let z=cz-margin;z<cz+size;z++) {
      if(this.structures) { w.chunk(x,z); this.structures.searchChunk(x,z); }
      else { if(this.mapFeatures) this.mineshafts.generate(x,z); w.chunk(x,z); }
    }
    const r=new JavaRandom(seed);
    for(let x=cx-margin;x<cx+size;x++) for(let z=cz-margin;z<cz+size;z++) {
      this.order.push([x,z]); hooks.beforePopulate?.(x,z);
      const result=this.structures?this.structures.populateChunk(r,x,z)
        :populateBeforeDecoration(w,r,seed,x,z,{structures:this.mapFeatures?(random,a,b)=>{
          this.mineshafts.generateStructuresInChunk(w,random,a,b); return false;
        }:null});
      if(this.flat) { if(this.flat.has('decoration')) this.decoration.decorate(w,r,result.biome.slot,x*16,z*16); }
      else populateTail(w,r,this.decoration,x,z,result.biome.slot);
      hooks.afterPopulate?.(x,z,r,result);
    }
    return this;
  }
}
let mapper=null;
export const populationBlockMapperReady=import("./block-registry.js").then(m=>(mapper??=m.fromOriginal));
export function setPopulationBlockMapper(fn) { mapper=fn; }
export const populationBlockMapper=()=>mapper;
const stackRecord=(s,slot)=>({slot,id:s[0],count:s[1],damage:s[2],...(s[3]?.length?{stored:s[3].map(([id,lvl])=>({id,lvl}))}:{})});
// Tile records of an area world inside `inside(x,z)`, in absolute block coordinates and original ids:
// chests, jungle-temple dispensers and swamp-hut flower pots. Shared by the finite and streamed handoffs.
export function structureTileRecords(w,inside) {
  const out={chests:[],dispensers:[],pots:[]};
  for(const c of w.chunks.values()) for(const t of c.tiles.values()) {
    if(!inside(t.x,t.z)) continue;
    const items=t.slots?.flatMap((s,i)=>s?[stackRecord(s,i)]:[]);
    if(t.kind==='chest') out.chests.push({x:t.x,y:t.y,z:t.z,facing:w.getBlockMetadata(t.x,t.y,t.z),items});
    else if(t.kind==='dispenser') out.dispensers.push({x:t.x,y:t.y,z:t.z,facing:w.getBlockMetadata(t.x,t.y,t.z),items});
    else if(t.kind==='flowerPot'&&w.getBlock(t.x,t.y,t.z)===140) {
      // TileEntityFlowerPot is created by metadata (BlockFlowerPot.func_149929_a); records keep internal plant ids.
      const p=potContentsOfMeta(w.getBlockMetadata(t.x,t.y,t.z));
      if(p) out.pots.push({x:t.x,y:t.y,z:t.z,id:p.id,damage:p.damage});
    }
  }
  return out;
}
// Bounding-box summaries (area-local) of village, stronghold and scattered-feature starts that touch the area.
export function structureSummaries(pass,intersects,local,toChunk) {
  const pick=(gen,extra)=>gen.structureMap.values().filter(s=>intersects(s.boundingBox))
    .map(s=>({...toChunk(s),boundingBox:local(s.boundingBox),...(extra?extra(s):{})}));
  const g=pass.structures.generators;
  return {
    villages:pick(g.village),
    strongholds:pick(g.stronghold),
    temples:pick(g.scatteredFeature,s=>({kind:{TeDP:'desert',TeJP:'jungle',TeSH:'swamp_hut'}[s.components[0]?.constructor.saveId]??'unknown'})),
  };
}
export function generateLivePopulation(world,{seed,originals,ringTerrain,mapBlock=mapper}) {
  if(!mapBlock) throw new Error('population-world: original block mapper not ready');
  const ox=world.originX, oz=world.originZ, cx=ox>>4, cz=oz>>4;
  const pass=new PopulationArea({seed,chunkX:cx,chunkZ:cz,
    terrain:(x,z)=>originals.get(key(x,z))??ringTerrain(x,z),
    biomeAt:(x,z)=>world.javaGenerator.manager.biomeAt(x,z),
    structures:world.generationVersion>=14,manager:world.javaGenerator.manager}).run();
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
  const tiles=structureTileRecords(w,inside), shift=t=>({...t,x:t.x-ox,z:t.z-oz});
  world.generatedStructures={
    mineshafts:pass.mineshafts.structureMap.values().filter(s=>s.boundingBox.intersectsWithXZ(ox,oz,ox+127,oz+127))
      .map(s=>({chunkX:s.chunkX-cx,chunkZ:s.chunkZ-cz,boundingBox:local(s.boundingBox)})),
    spawners:w.liveSpawners().filter(t=>inside(t.x,t.z)).map(t=>({x:t.x-ox,y:t.y,z:t.z-oz,entityId:t.name})),
    minecartChests:w.carts.filter(e=>inside(e.x,e.z)).map(e=>({x:e.x-ox,y:e.y,z:e.z-oz,items:e.slots.flatMap((s,i)=>s?[stackRecord(s,i)]:[])})),
    chests:tiles.chests.map(shift),
    ...(pass.structures?{dispensers:tiles.dispensers.map(shift),pots:tiles.pots.map(shift),
      ...structureSummaries(pass,b=>b.intersectsWithXZ(ox,oz,ox+127,oz+127),local,s=>({chunkX:s.chunkX-cx,chunkZ:s.chunkZ-cz}))}:{}),
    animals:w.animals.filter(e=>inside(e.x,e.z)).map(e=>({...e,x:e.x-ox,z:e.z-oz})),
    pendingTicks:w.pending.filter(([x,,z])=>inside(x,z)).map(([x,y,z,id,delay])=>({x:x-ox,y,z:z-oz,id,delay})),
    droppedItems:w.items.filter(d=>inside(d.x,d.z)).length,
  };
  return pass;
}
