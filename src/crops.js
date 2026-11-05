// BlockCrops/BlockCarrot/BlockPotato and EntityZombie's rare drops in Java 1.7.10.
import { CARROTS, POTATOES } from './world.js';
import { stemPlantedBy } from './stems-cake.js';
export const CARROT=322,POTATO=323,BAKED_POTATO=324,POISONOUS_POTATO=325;
export const cropItem=block=>block===CARROTS?CARROT:block===POTATOES?POTATO:309;
export const plantedBlock=item=>item===309?31:item===CARROT?CARROTS:item===POTATO?POTATOES:stemPlantedBy(item);
// Root crops share BlockCrops' base drop and three seed rolls. Here the seed and
// produce are the same item, giving one to four roots at maturity (fortune 0).
export function rootDrops(block,age,nextInt){
  const id=cropItem(block);let count=1;
  if(age===7)for(let i=0;i<3;i++)if(nextInt(15)<=age)count++;
  const drops=[{id,count}];
  if(block===POTATOES&&age===7&&nextInt(50)===0)drops.push({id:POISONOUS_POTATO,count:1});
  return drops;
}
// EntityLivingBase.onDeath: recentlyHit > 0, nextInt(200) < 5 without Looting.
// EntityZombie.dropRareDrop then chooses iron, carrot or potato with equal weight.
export function zombieRareDrop(recentlyHit,nextInt){
  return recentlyHit>0&&nextInt(200)<5?[302,CARROT,POTATO][nextInt(3)]:0;
}
