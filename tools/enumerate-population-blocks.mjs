// Conservative write-domain audit plus executable coverage of every occupied biome slot.
// This is not a sampling-only claim: domains below include all setter arguments/metadata
// expressions in the ported population/tree/feature/callback sources, including rare wells.
import {writeFile} from 'node:fs/promises';
import {BIOME_LIST} from '../src/java-biomes.js';
import {ChunkProviderGenerate,BiomeTerrainState} from '../src/terrain-generator.js';
import {MapGenCaves,MapGenRavine} from '../src/mapgen.js';
import {GenWorld} from '../src/gen-world.js';
import {JavaRandom} from '../src/java-random.js';
import {BiomeDecoration} from '../src/biome-decorator.js';
import {fromOriginal} from '../src/block-registry.js';
const range=n=>Array.from({length:n},(_,i)=>i);
// Includes terrain retained under population, metadata notification side effects and all legal
// metadata in emitted families. Values marked conservative may not occur naturally in a seed.
export const WRITE_DOMAINS={
  0:[0],1:[0],2:[0],3:[0,1,2],4:[0],5:[0],7:[0],8:range(16),9:range(16),10:range(16),11:range(16),12:[0,1],13:[0],14:[0],15:[0],16:[0],
  17:range(12),18:[0,1,2,3,8,9,10,11],21:[0],24:[0,1,2],30:[0],31:[0,1,2],32:[0],37:[0],38:range(9),39:[0],40:[0],44:[1],48:[0],49:[0],50:[1,2,3,4,5],52:[0],54:[2,3,4,5],56:[0],66:range(10),73:[0],74:[0],78:[0],79:[0],80:[0],81:[0],82:[0],83:[0],85:[0],86:[0,1,2,3],97:[0],99:range(11),100:range(11),103:[0],106:range(16),110:[0],111:[0],127:range(8),129:[0],159:range(16),161:[0,1,8,9],162:[0,1,4,5,8,9],172:[0],174:[0],175:[0,1,2,3,4,5,8],
};
const audit=[];
for(const type of ['default','amplified','largeBiomes'])for(const biome of BIOME_LIST.filter(Boolean)){
  // Nether/End slots are inventoried, not Overworld populate targets. Their decorator has
  // dimension-specific quartz/end-spike generators that this Overworld chain never calls.
  if(biome.slot===8||biome.slot===9){audit.push({type,slot:biome.slot,scope:'not an Overworld population target',states:[]});continue;}
  const seed=8675309n,g=new ChunkProviderGenerate(seed,type,new BiomeTerrainState());
  const top=(x,z)=>g.biomeState.topBlock(g.manager.biomeAt(x,z)),ca=new MapGenCaves(seed,g.manager,top),ra=new MapGenRavine(seed,g.manager,top);
  const w=new GenWorld({rand:new JavaRandom(0n),biomeAt:()=>biome}),states=new Set();
  // Synthetic biome routing, real terrain; lazy halo with no population.
  w.chunkExists=()=>true;w.chunk=(x,z)=>{let c=w.chunks.get(`${x},${z}`);if(!c){const t=g.provideChunk(x,z);ca.generate(x,z,t.blocks);ra.generate(x,z,t.blocks);c=w.addChunk(x,z,t.blocks,t.metadata);}return c;};
  w.onCall=(kind,x,y,z,id,meta)=>{if(kind===1)states.add(`${id}:${meta}`);};
  new BiomeDecoration().decorate(w,new JavaRandom(seed),biome.slot,0,0);
  audit.push({type,slot:biome.slot,states:[...states].sort((a,b)=>parseInt(a)-parseInt(b)||+a.split(':')[1]-+b.split(':')[1])});
}
const states=Object.entries(WRITE_DOMAINS).flatMap(([id,metas])=>metas.map(meta=>{const m=fromOriginal(+id,meta);return{id:+id,meta,internal:m?.id??null,exact:m?.exact??false};}));
const missing=states.filter(s=>!s.exact);
if(missing.length)throw new Error('Unmapped population states: '+JSON.stringify(missing));
const out={target:'Minecraft Java 1.7.10',method:'Conservative source write domains, including terrain retained under population and callback metadata, plus executable decorator routing across all 61 occupied biome slots and three world types. Nether/End slots inventoried but not Overworld targets. Rare branches are included by source audit even if not observed. No claim that every conservative metadata value is naturally emitted.',states,audit};
await writeFile(new URL('../public/research/population-blocks.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(states.length,'states;',audit.length,'biome/world-type entries;',new Set(states.map(s=>s.id)).size,'original block families; all map exactly');
