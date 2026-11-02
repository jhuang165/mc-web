// Content reached by Java 1.7.10 Overworld population. Internal ids append after 0.24.0.
// Kept independent of survival/world module initialization so both can use the same catalogue.
export const POPULATION_ITEMS = Object.freeze({21:63,73:64,74:65,129:66,86:67,97:68,175:69,162:70,161:71,106:72,127:73,48:74,39:75,40:76,99:77,100:78,32:79,174:80,103:81,'44:1':82,'31:0':83,'31:2':84,24:56,110:57,159:58,111:59,
  388:367,360:368,357:369,282:370,281:371,322:372,2256:373,2257:374,421:375,418:376,419:377});
export const TREE_NAMES=['Oak','Spruce','Birch','Jungle','Acacia','Dark oak'];
export const DOUBLE_NAMES=['Sunflower','Lilac','Double tallgrass','Large fern','Rose bush','Peony'];
export const POPULATION_VARIANTS={7:TREE_NAMES.map(s=>s+' planks'),4:TREE_NAMES.slice(0,4).map(s=>s+' log'),5:TREE_NAMES.slice(0,4).map(s=>s+' leaves'),48:TREE_NAMES.map(s=>s+' sapling'),69:DOUBLE_NAMES,70:TREE_NAMES.slice(4).map(s=>s+' log'),71:TREE_NAMES.slice(4).map(s=>s+' leaves'),68:['Stone monster egg','Cobblestone monster egg','Stone brick monster egg']};
export function installPopulationItems(items){
  for(const [id,variants] of Object.entries(POPULATION_VARIANTS)) items[id].variants=variants;
  items[65].hidden=true;items[73].hidden=true;items[77].hidden=true;items[78].hidden=true;items[83].hidden=true;
  for(const [id,name,texture,extra] of [
    [367,'Emerald','emerald'],[368,'Melon','melon',{food:2,saturation:.3}],
    [369,'Cookie','cookie',{food:2,saturation:.1}], [370,'Mushroom stew','mushroom_stew',{food:6,saturation:.6,stack:1,container:371}],
    [371,'Bowl','bowl'],[372,'Golden apple','apple_golden',{food:4,saturation:1.2}],
    [373,'Music disc 13','record_13',{stack:1}],[374,'Music disc cat','record_cat',{stack:1}],
    [375,'Name tag','name_tag'],[376,'Golden horse armor','gold_horse_armor',{stack:1}], [377,'Diamond horse armor','diamond_horse_armor',{stack:1}],
  ]) items[id]={id,name,texture,stack:64,color:'#8caa59',...extra};
}
export function installPopulationMaterials(m){
  Object.assign(m,{
    63:{hardness:3,kind:'pickaxe',tier:1,drop:351},64:{hardness:3,kind:'pickaxe',tier:2,drop:360},65:{hardness:3,kind:'pickaxe',tier:2,drop:360},66:{hardness:3,kind:'pickaxe',tier:2,drop:367},
    67:{hardness:1,kind:'axe'},68:{hardness:.75,drop:0},69:{hardness:0,drop:0},70:{hardness:2,kind:'axe'},71:{hardness:.2,drop:0},72:{hardness:.2,drop:0},73:{hardness:.2,drop:351},74:{hardness:2,kind:'pickaxe',tier:0},75:{hardness:0},76:{hardness:0},77:{hardness:.2,drop:75},78:{hardness:.2,drop:76},79:{hardness:0,drop:0},80:{hardness:.5,drop:0},81:{hardness:1,kind:'axe',drop:368},82:{hardness:2,kind:'pickaxe',tier:0},83:{hardness:0,drop:0},84:{hardness:0,drop:0},
  });
}
export function installPopulationRecipes({recipe,shapeless}){
  recipe('golden-apple','Golden apple',['GGG','GAG','GGG'],{G:304,A:200},372);
  recipe('sandstone','Sandstone',['SS','SS'],{S:6},56);
  recipe('bowl','Bowls',['W W',' W '],{W:7},371,4);
  recipe('melon','Melon block',['MMM','MMM','MMM'],{M:368},81);
  shapeless(370,1,0,75,76,371);
  shapeless(361,4,0,67);shapeless(362,1,0,368);
  for(const [meta,dye] of [[0,11],[1,13],[4,1],[5,9]])shapeless(351,2,dye,[69,meta]);
}
export const populationXp=(id,r)=>id===63?2+Math.floor(r()*4):id===64||id===65?1+Math.floor(r()*5):id===66?3+Math.floor(r()*5):0;
// Native BlockOre, BlockRedstoneOre, BlockHugeMushroom, BlockMelon and BlockDoublePlant drops.
export function populationDrops(id,meta,{random=Math.random,shears=false}={}){
  if(id===63)return[{id:351,count:4+Math.floor(random()*5),damage:4}];
  if(id===64||id===65)return[{id:360,count:4+Math.floor(random()*2)}];
  if(id===66)return[{id:367,count:1}];
  if(id===67)return[{id:67,count:1}];
  if(id===70)return[{id:70,count:1,damage:meta&3}];
  if(id===72)return shears?[{id:72,count:1}]:[];
  if(id===73)return[{id:351,count:(meta>>2)>=2?3:1,damage:3}];
  if(id===77||id===78){const n=Math.max(0,Math.floor(random()*10)-7);return n?[{id:id===77?75:76,count:n}]:[];}
  if(id===79)return shears?[{id:79,count:1}]:[];
  if(id===81)return[{id:368,count:3+Math.floor(random()*5)}];
  if(id===82)return[{id:82,count:1,damage:meta&7}];
  if(id===83||id===84)return shears?[{id:39,count:1,damage:id===84?2:0}]:random()<1/8?[{id:309,count:1}]:[];
  if(id===69){if(meta&8)return[];const t=meta&7;if(t===2||t===3)return shears?[{id:39,count:2,damage:t===2?1:2}]:t===2&&random()<1/8?[{id:309,count:1}]:[];return[{id:69,count:1,damage:t}];}
  return null;
}

// Metadata-sensitive recipes are matched before the old ID-only shaped recipe catalogue.
export function populationCraftingResult(cells,size){
  const filled=cells.filter(Boolean);
  if(filled.length===1&&[4,70].includes(filled[0].id))return{id:7,count:4,damage:(filled[0].damage&3)+(filled[0].id===70?4:0)};
  if(filled.length===9&&size===3&&cells[4]?.id===351&&cells.every((s,i)=>i===4||s?.id===40))return{id:58,count:8,damage:15-cells[4].damage};
  if(filled.length===4&&filled.every(s=>s.id===56))for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if([cells[y*size+x],cells[y*size+x+1],cells[(y+1)*size+x],cells[(y+1)*size+x+1]].every(s=>s?.id===56))return{id:56,count:4,damage:2};
  if(filled.length===2&&filled.every(s=>s.id===82))for(let i=0;i<cells.length-size;i++)if(cells[i]?.id===82&&cells[i+size]?.id===82)return{id:56,count:1,damage:1};
  if(filled.length===3)for(let y=0;y<size;y++)for(let x=0;x<=size-3;x++){
    const a=cells[y*size+x],b=cells[y*size+x+1],c=cells[y*size+x+2];
    if(a?.id===305&&b?.id===351&&b.damage===3&&c?.id===305)return{id:369,count:8,damage:0};
    if([a,b,c].every(s=>s?.id===56))return{id:82,count:6,damage:0};
  }
  return null;
}

export function installPopulationSmelting(smelt){Object.assign(smelt,{63:[351,4],64:360,66:367,70:308});}
