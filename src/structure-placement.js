// Native placement predicates, standalone until all structure pieces/content are ported.
// Does not add structures to the version-13 generator or alter saved terrain.
import { JavaRandom } from './java-random.js';
import { BIOME_LIST } from './java-biomes.js';
export const VILLAGE_BIOMES=[1,2,35], TEMPLE_BIOMES=[2,17,21,22,6];
export function scatteredCandidate(seed,x,z,{distance=32,salt=14357617}={}) {
 if(!Number.isInteger(distance)||distance<9)throw new RangeError('Invalid structure distance');
 const rx=Math.floor(x/distance),rz=Math.floor(z/distance),random=new JavaRandom(BigInt.asIntN(64,BigInt(rx)*341873128712n+BigInt(rz)*132897987541n+BigInt(seed)+BigInt(salt)));
 return {x:rx*distance+random.nextInt(distance-8),z:rz*distance+random.nextInt(distance-8),random};
}
export function villageCandidate(seed,manager,x,z,options={}) {
 const p=scatteredCandidate(seed,x,z,{...options,salt:10387312});
 return x===p.x&&z===p.z&&manager.areBiomesViable(x*16+8,z*16+8,0,VILLAGE_BIOMES);
}
export function templeCandidate(seed,manager,x,z,options={}) {
 const p=scatteredCandidate(seed,x,z,options);
 return x===p.x&&z===p.z&&TEMPLE_BIOMES.includes(manager.biomeAt(x*16+8,z*16+8).slot);
}
export function strongholdPositions(seed,manager,{count=3,distance=32,spread=3}={}) {
 if(!Number.isInteger(count)||count<1||count>4096||!Number.isFinite(distance)||distance<1||!Number.isInteger(spread)||spread<1)throw new RangeError('Invalid stronghold settings');
 const random=new JavaRandom(seed),allowed=BIOME_LIST.filter(b=>b&&b.rootHeight>0).map(b=>b.slot),out=[];
 let angle=random.nextDouble()*Math.PI*2,ring=1;
 for(let i=0;i<count;i++) {
  const radius=(1.25*ring+random.nextDouble())*distance*ring;
  let x=Math.floor(Math.cos(angle)*radius+.5),z=Math.floor(Math.sin(angle)*radius+.5);
  const pos=manager.findBiomePosition(x*16+8,z*16+8,112,allowed,random);if(pos){x=pos[0]>>4;z=pos[2]>>4;}
  out.push([x,z]);angle+=Math.PI*2*ring/spread;
  if(i===spread){ring+=2+random.nextInt(5);spread+=1+random.nextInt(2);}
 }
 return out;
}
