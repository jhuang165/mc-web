// BlockSapling.func_149878_d selection, 1.7.10, using the ported native tree generators.
import {WorldGenTrees,WorldGenBigTree,WorldGenForest,WorldGenTaiga2,WorldGenMegaPineTree,WorldGenMegaJungle,WorldGenSavannaTree,WorldGenCanopyTree} from './tree-generators.js';
import {GenWorld} from './gen-world.js';
let registry;
export const treeRegistryReady=import('./block-registry.js').then(m=>(registry=m));
// The native-id view of a Trees object for the ported generators (also used by the legacy big-oak path).
function nativeAdapter(trees,notify){
  const w=trees.world;
  return {
    getBlock:(a,b,c)=>registry.toOriginal(w.get(a,b,c),w.getMeta(a,b,c))?.[0]??0,
    setBlock:(a,b,c,id,meta=0,flags=3)=>{const m=registry.fromOriginal(id,meta);if(!m?.exact)throw new Error(`Unmapped tree ${id}:${meta}`);return trees.edit(a,b,c,m.id,m.meta,notify&&(flags&1)!==0);},
    isOpaqueCube:id=>GenWorld.prototype.isOpaqueCube(id),
  };
}
// Batch 72: BlockSapling.func_149878_d's WorldGenBigTree branch for an oak in a legacy 64-high world (the roll itself is drawn by the caller).
// Native keeps no height rule beyond reading air above the build limit and dropping writes there, which world.put does (out-of-range cells are
// ignored), so a tall tree is cut at the world top just as at 256. Returns null while the block registry is not loaded, else whether it grew.
export function growBigOak(trees,x,y,z,{notify=true}={}){
  if(!registry)return null;
  const w=trees.world,meta=w.getMeta(x,y,z)&7;
  w.put(x,y,z,0,0,true);
  const ok=new WorldGenBigTree(true).generate(nativeAdapter(trees,notify),trees.random,x,y,z);
  if(!ok)w.put(x,y,z,48,meta,true);
  trees.flush();return ok;
}
export function growSapling(trees,x,y,z,{notify=true}={}){
  const w=trees.world,r=trees.random,type=w.getMeta(x,y,z)&7,big=r.nextInt(10)===0;
  let gen=big?new WorldGenBigTree(true):new WorldGenTrees(true),dx=0,dz=0,square=false;
  if([1,3,5].includes(type)) {
    outer:for(let a=0;a>=-1;a--)for(let b=0;b>=-1;b--){
      if([[0,0],[1,0],[0,1],[1,1]].every(([i,j])=>w.get(x+a+i,y,z+b+j)===48&&(w.getMeta(x+a+i,y,z+b+j)&7)===type)){
        dx=a;dz=b;square=true;break outer;
      }
    }
  }
  if(type===1)gen=square?new WorldGenMegaPineTree(false,r.nextBoolean()):new WorldGenTaiga2(true);
  if(type===2)gen=new WorldGenForest(true,false);
  if(type===3)gen=square?new WorldGenMegaJungle(true,10,20,3,3):new WorldGenTrees(true,4+r.nextInt(7),3,3,false);
  if(type===4)gen=new WorldGenSavannaTree(true);
  if(type===5){if(!square)return 'failed';gen=new WorldGenCanopyTree(true);}
  const cells=square?[[x+dx,z+dz],[x+dx+1,z+dz],[x+dx,z+dz+1],[x+dx+1,z+dz+1]]:[[x,z]];
  for(const [a,b] of cells)w.put(a,y,b,0,0,true);
  const adapter=nativeAdapter(trees,notify);
  const ok=gen.generate(adapter,r,x+dx,y,z+dz);
  if(!ok)for(const [a,b] of cells)w.put(a,y,b,48,type,true);
  trees.flush();return ok?'grew':'failed';
}
