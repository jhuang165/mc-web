import * as THREE from 'three';
import {biomeFacts} from './biomes.js';
import {WOOL_COLORS,RED_FLOWER,RED_FLOWERS,YELLOW_FLOWER,SAPLING,WEB,LADDER,CARROTS,POTATOES,CACTUS,REEDS,TNT,SANDSTONE,MYCELIUM,STAINED_CLAY,LILY_PAD,FENCE,RAIL,MOB_SPAWNER,ANVIL,isCrop,isFlower} from './world.js';
import {FENCE_ITEM_BOXES} from './fences.js';
import {anvilModelBoxes} from './anvil-block.js';
export const ATLAS_COLUMNS=16,TILE_SIZE=16;
export const TILES=['grass_top','grass_side','dirt','stone','log_oak','log_oak_top','leaves_oak','sand','planks_oak','brick','glass','bedrock','cobblestone','crafting_table_top','crafting_table_side','crafting_table_front','furnace_side','furnace_top','furnace_front_off','furnace_front_on','coal_ore','iron_ore','diamond_ore','gold_ore','wool_colored_white','torch_on','bookshelf','obsidian','snow','clay','gravel','iron_block','gold_block','diamond_block','farmland_dry','farmland_wet',...Array.from({length:8},(_,i)=>'wheat_stage_'+i),'tallgrass','hardened_clay','chest_front','chest_side','chest_top',...WOOL_COLORS.slice(1).map(c=>'wool_colored_'+c.texture)];
// Item and particle faces for the chest, cut from its entity texture (ModelChest UVs).
const CHEST_FACES={chest_front:[[14,33,14,10,1,6],[14,14,14,5,1,2],[1,1,2,4,7,5]],chest_side:[[0,33,14,10,1,6],[0,14,14,5,1,2]],chest_top:[[14,0,14,14,1,1]]};
// BlockFlower textures: dandelion, then the red flower's nine species by metadata.
TILES.push('web','flower_dandelion',...RED_FLOWERS.map(f=>'flower_'+f.texture),'ice','grass_side_snowed','sapling_oak','ladder','tnt_side','tnt_top','tnt_bottom',...['carrots','potatoes'].flatMap(n=>Array.from({length:4},(_,i)=>n+'_stage_'+i)));
// BlockReed (one crossed texture, tinted by the biome grass colour) and BlockCactus's side, top and bottom.
TILES.push('reeds','cactus_side','cactus_top','cactus_bottom');
// Mineshaft blocks: BlockRail uses rail_normal_turned for the curves (metadata 6-9).
TILES.push('rail_normal','rail_normal_turned','mob_spawner');
TILES.push('anvil_base','anvil_top_damaged_0','anvil_top_damaged_1','anvil_top_damaged_2');
TILES.push('red_sand','dirt_podzol_top','dirt_podzol_side','sandstone_top','sandstone_bottom','sandstone_normal','sandstone_carved','sandstone_smooth','mycelium_top','mycelium_side','waterlily',...WOOL_COLORS.map(c=>'hardened_clay_stained_'+c.texture));
const TREE_TEXTURES=['oak','spruce','birch','jungle','acacia','big_oak'];
TILES.push(...TREE_TEXTURES.slice(1).map(t=>'planks_'+t),'lapis_ore','redstone_ore','emerald_ore','pumpkin_side','pumpkin_top','pumpkin_face_off','vine','cocoa_stage_0','cocoa_stage_1','cocoa_stage_2','cobblestone_mossy','mushroom_brown','mushroom_red','mushroom_block_skin_brown','mushroom_block_skin_red','mushroom_block_skin_stem','mushroom_block_inside','deadbush','ice_packed','melon_side','melon_top','fern',
  ...TREE_TEXTURES.slice(1).flatMap(t=>['log_'+t,'log_'+t+'_top','leaves_'+t,'sapling_'+(t==='big_oak'?'roofed_oak':t)]),
  ...['sunflower','syringa','grass','fern','rose','paeonia'].flatMap(t=>['double_plant_'+t+'_bottom','double_plant_'+t+'_top']));
export const ATLAS_ROWS=Math.ceil(TILES.length/ATLAS_COLUMNS);
const tile=name=>TILES.indexOf(name);
// `meta` selects wool colours, flower variants and root-crop growth textures.
// `snowy` is true when the block above is a snow layer or snow block: BlockGrass then shows grass_side_snowed on its sides.
export function blockTile(id,face,lit=false,meta=0,snowy=false){
 if(id===ANVIL)return tile(face===2?'anvil_top_damaged_'+(((meta&15)>>2)%3):'anvil_base');
 if(id===7)return tile('planks_'+(TREE_TEXTURES[meta&7]??'oak'));
 if(id===63)return tile('lapis_ore');
 if(id===64||id===65)return tile('redstone_ore');
 if(id===66)return tile('emerald_ore');
 if(id===67)return tile(face===2||face===3?'pumpkin_top':face===[4,0,5,1][meta&3]?'pumpkin_face_off':'pumpkin_side');
 if(id===68)return tile(meta===1?'cobblestone':'stone');
 if(id===69)return tile('double_plant_'+['sunflower','syringa','grass','fern','rose','paeonia'][meta&7]+'_'+(meta&8?'top':'bottom'));
 if(id===4||id===70){const type=TREE_TEXTURES[(id===70?4:0)+(meta&3)]??'oak',axis=meta&12;return tile('log_'+type+((axis===0&&(face===2||face===3)||axis===4&&(face===0||face===1)||axis===8&&(face===4||face===5))?'_top':''));}
 if(id===5||id===71)return tile('leaves_'+(TREE_TEXTURES[(id===71?4:0)+(meta&3)]??'oak'));
 if(id===48)return tile('sapling_'+((meta&7)===5?'roofed_oak':TREE_TEXTURES[meta&7]??'oak'));
 if(id===72)return tile('vine');
 if(id===73)return tile('cocoa_stage_'+Math.min(2,meta>>2));
 if(id===74)return tile('cobblestone_mossy');
 if(id===75||id===76)return tile(id===75?'mushroom_brown':'mushroom_red');
 if(id===77||id===78){const cap=meta>=1&&meta<=9&&(face===2||face===0&&[3,6,9].includes(meta)||face===1&&[1,4,7].includes(meta)||face===4&&meta<=3||face===5&&meta>=7);return tile(cap?(id===77?'mushroom_block_skin_brown':'mushroom_block_skin_red'):meta===10&&face!==2&&face!==3?'mushroom_block_skin_stem':'mushroom_block_inside');}
 if(id===79||id===83)return tile('deadbush');
 if(id===80)return tile('ice_packed');
 if(id===81)return tile(face===2||face===3?'melon_top':'melon_side');
 if(id===82)return tile(face===2?'sandstone_top':face===3?'sandstone_bottom':'sandstone_normal');
 if(id===84)return tile('fern');
 if(id===2&&meta===2)return tile(face===2?'dirt_podzol_top':face===3?'dirt':'dirt_podzol_side');
 if(id===6&&meta===1)return tile('red_sand');
 if(id===SANDSTONE)return tile(face===2?'sandstone_top':face===3?'sandstone_bottom':meta===1?'sandstone_carved':meta===2?'sandstone_smooth':'sandstone_normal');
 if(id===MYCELIUM)return tile(face===2?'mycelium_top':face===3?'dirt':'mycelium_side');
 if(id===STAINED_CLAY)return tile('hardened_clay_stained_'+WOOL_COLORS[meta&15].texture);
 if(id===LILY_PAD)return tile('waterlily');
 if(id===19)return tile('wool_colored_'+WOOL_COLORS[meta&15].texture);
 if(id===YELLOW_FLOWER)return tile('flower_dandelion');
 if(id===RED_FLOWER)return tile('flower_'+RED_FLOWERS[Math.min(meta,RED_FLOWERS.length-1)].texture);
 if(id===1)return tile(face===2?'grass_top':face===3?'dirt':snowy?'grass_side_snowed':'grass_side');
 if(id===CARROTS||id===POTATOES)return tile((id===CARROTS?'carrots':'potatoes')+'_stage_'+(meta>=7?3:meta===6?2:meta>>1));
 if(id===WEB)return tile('web');
 if(id===LADDER)return tile('ladder');
 if(id===FENCE)return tile('planks_oak');
 if(id===RAIL)return tile(meta>=6?'rail_normal_turned':'rail_normal');
 if(id===MOB_SPAWNER)return tile('mob_spawner');
 // BlockTNT.getIcon: tnt_bottom below (side 0), tnt_top above (side 1), tnt_side around.
 if(id===TNT)return tile(face===2?'tnt_top':face===3?'tnt_bottom':'tnt_side');
 if(id===REEDS)return tile('reeds');
 if(id===CACTUS)return tile(face===2?'cactus_top':face===3?'cactus_bottom':'cactus_side');
 if(id===SAPLING)return tile('sapling_oak');
 if(id===46)return tile('snow');
 if(id===47)return tile('ice');
 if(id===4)return tile(face===2||face===3?'log_oak_top':'log_oak');
 if(id===13)return tile(face===2?'crafting_table_top':face===3?'planks_oak':face===4||face===5?'crafting_table_front':'crafting_table_side');
 if(id===14)return tile(face===2||face===3?'furnace_top':face===4?(lit?'furnace_front_on':'furnace_front_off'):'furnace_side');
 if(id===41)return tile(face===2||face===3?'chest_top':face===4?'chest_front':'chest_side');
 if(id===21)return tile(face===2||face===3?'planks_oak':'bookshelf');
 if(id===29||id===30)return tile(face===2?(id===30?'farmland_wet':'farmland_dry'):'dirt');
 if(id>=31&&id<=38)return tile('wheat_stage_'+(id-31));
 const name={2:'dirt',3:'stone',5:'leaves_oak',6:'sand',7:'planks_oak',8:'brick',9:'glass',11:'bedrock',12:'cobblestone',15:'coal_ore',16:'iron_ore',17:'diamond_ore',18:'gold_ore',19:'wool_colored_white',20:'torch_on',22:'obsidian',23:'snow',24:'clay',25:'gravel',26:'iron_block',27:'gold_block',28:'diamond_block',39:'tallgrass',40:'hardened_clay'}[id];return tile(name||'stone');
}
export function tileRect(index,inset=.02){const x=index%ATLAS_COLUMNS,y=Math.floor(index/ATLAS_COLUMNS);return{u0:(x*TILE_SIZE+inset)/(ATLAS_COLUMNS*TILE_SIZE),u1:((x+1)*TILE_SIZE-inset)/(ATLAS_COLUMNS*TILE_SIZE),v0:1-((y+1)*TILE_SIZE-inset)/(ATLAS_ROWS*TILE_SIZE),v1:1-(y*TILE_SIZE+inset)/(ATLAS_ROWS*TILE_SIZE)};}
function image(name){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Texture missing: '+name));i.src='/media/1.7.10/'+name+'.png';});}
export function createBlockAtlas(){
 const canvas=document.createElement('canvas');canvas.width=ATLAS_COLUMNS*TILE_SIZE;canvas.height=ATLAS_ROWS*TILE_SIZE;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;const images=new Map(),icons=new Map();let biome='meadow';
 function tint(mapName){const facts=biomeFacts(biome),t=facts.temperature,rain=facts.rainfall*t;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(images.get('colormap/'+mapName),0,0);const color=x.getImageData(Math.floor((1-t)*255),Math.floor((1-rain)*255),1,1).data;return`rgb(${color[0]},${color[1]},${color[2]})`;}
 function tinted(source,color){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(source,0,0,16,16);x.globalCompositeOperation='multiply';x.fillStyle=color;x.fillRect(0,0,16,16);x.globalCompositeOperation='destination-in';x.drawImage(source,0,0,16,16);return c;}
 function redraw(){if(!images.size)return;icons.clear();ctx.clearRect(0,0,canvas.width,canvas.height);const grass=tint('grass'),leaves=tint('foliage');TILES.forEach((name,i)=>{const x=i%ATLAS_COLUMNS*16,y=Math.floor(i/ATLAS_COLUMNS)*16;if(CHEST_FACES[name]){for(const[u,v,w,h,dx,dy]of CHEST_FACES[name])ctx.drawImage(images.get('entity/chest/normal'),u,v,w,h,x+dx,y+dy,w,h);return;}let source=images.get('blocks/'+name);if(['grass_top','tallgrass','reeds','fern','vine','double_plant_grass_bottom','double_plant_grass_top','double_plant_fern_bottom','double_plant_fern_top'].includes(name))source=tinted(source,grass);if(name.startsWith('leaves_'))source=tinted(source,name==='leaves_spruce'?'rgb(97,153,97)':name==='leaves_birch'?'rgb(128,167,85)':leaves);ctx.drawImage(source,0,0,16,16,x,y,16,16);if(name==='grass_side')ctx.drawImage(tinted(images.get('blocks/grass_side_overlay'),grass),x,y);});texture.needsUpdate=true;}
 function icon(id,damage=0){const key=id+':'+damage;if(icons.has(key))return icons.get(key);const c=document.createElement('canvas');c.width=64;c.height=70;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  if(id===ANVIL){anvilIcon(x,damage);const url=c.toDataURL();icons.set(key,url);return url;}
  function face(index,matrix,shade,drop=0){x.save();x.setTransform(...matrix);const sx=index%ATLAS_COLUMNS*16,sy=Math.floor(index/ATLAS_COLUMNS)*16;x.drawImage(canvas,sx,sy,16,16-drop,0,drop,16,16-drop);if(shade){x.globalCompositeOperation='source-atop';x.fillStyle=`rgba(0,0,0,${shade})`;x.fillRect(0,0,16,16);}x.restore();}
  // RenderBlocks.renderBlockAsItem for the fence (render type 11): two posts and two bars along z,
  // painted back to front in the inventory projection (z across, x into the picture).
  if(id===FENCE){fenceIcon(x);const url=c.toDataURL();icons.set(key,url);return url;}
 if([69,72,75,76,79,83,84].includes(id)||id===20||id===39||id===SAPLING||id===WEB||id===LADDER||id===REEDS||id===RAIL||isFlower(id)||isCrop(id)){const i=blockTile(id,2,false,damage);x.drawImage(canvas,i%ATLAS_COLUMNS*16,Math.floor(i/ATLAS_COLUMNS)*16,16,16,3,5,58,58);}else{const drop=id===46?14:0;/* ItemSnow draws the layer's 2/16 bounds, a flat slab */face(blockTile(id,0,false,damage),[1.75,1,0,2,4,18],.2,drop);face(blockTile(id,4,false,damage),[1.75,-1,0,2,32,34],.08,drop);face(blockTile(id,2,false,damage),[1.75,1,-1.75,1,32,2+drop*2],0);}
  const url=c.toDataURL();icons.set(key,url);return url;
 }
 function anvilIcon(ctx,damage){
  const meta=(damage&3)<<2;
  const p=(x,y,z)=>[32+28*(z-x),34+16*(x+z)-32*y],
    paint=(face,points,shade=0)=>{const t=blockTile(ANVIL,face,false,meta),sx=t%ATLAS_COLUMNS*16,sy=Math.floor(t/ATLAS_COLUMNS)*16,[a,b,c,d]=points;
      ctx.save();ctx.setTransform((b[0]-a[0])/16,(b[1]-a[1])/16,(d[0]-a[0])/16,(d[1]-a[1])/16,a[0],a[1]);ctx.drawImage(canvas,sx,sy,16,16,0,0,16,16);
      if(shade){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(0,0,0,${shade})`;ctx.fillRect(0,0,16,16);}ctx.restore();};
  for(const [x0,y0,z0,x1,y1,z1] of anvilModelBoxes(meta)){
    paint(0,[p(x1,y0,z0),p(x1,y0,z1),p(x1,y1,z1),p(x1,y1,z0)],.2);
    paint(4,[p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)],.08);
    paint(2,[p(x0,y1,z0),p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1)]);
  }
 }
 // Item projection P(a,b,h) = (32 + 1.75(a-b), 2 + a + b + 2(16-h)) in pixels, a = 16z, b = 16x.
 function fenceIcon(x){const t=blockTile(FENCE,0),sx=t%ATLAS_COLUMNS*16,sy=Math.floor(t/ATLAS_COLUMNS)*16;
  const shaded=(shade)=>{const s=document.createElement('canvas');s.width=s.height=16;const g=s.getContext('2d');g.drawImage(canvas,sx,sy,16,16,0,0,16,16);if(shade){g.globalCompositeOperation='source-atop';g.fillStyle=`rgba(0,0,0,${shade})`;g.fillRect(0,0,16,16);}return s;};
  const tiles=[shaded(.2),shaded(.08),shaded(0)],wrap=(u)=>((u%16)+16)%16;
  const quad=(src,matrix,u0,v0,u1,v1)=>{if(u1<=u0||v1<=v0)return;x.save();x.setTransform(...matrix);const su=wrap(u0),sv=wrap(v0);x.drawImage(src,su,sv,u1-u0,v1-v0,u0,v0,u1-u0,v1-v0);x.restore();};
  const [p1,p2,top,bottom]=FENCE_ITEM_BOXES,bars=(z0,z1)=>[bottom,top].map(b=>[b[0],b[1],z0,b[3],b[4],z1]);
  for(const [x0,y0,z0,x1,y1,z1] of [...bars(-.125,0),p1,...bars(.25,.75),p2,...bars(1,1.125)]){
   const a0=z0*16,a1=z1*16,b0=x0*16,b1=x1*16,h0=y0*16,h1=y1*16;
   quad(tiles[0],[1.75,1,0,2,32-1.75*b1,2+b1],a0,16-h1,a1,16-h0);
   quad(tiles[1],[1.75,-1,0,2,32+1.75*(a1-16),18+a1],16-b1,16-h1,16-b0,16-h0);
   quad(tiles[2],[1.75,1,-1.75,1,32,2+2*(16-h1)],a0,b0,a1,b1);
  }
 }
 const ready=Promise.all([...TILES.filter(n=>!CHEST_FACES[n]).map(n=>'blocks/'+n),'entity/chest/normal','blocks/grass_side_overlay','colormap/grass','colormap/foliage'].map(async n=>images.set(n,await image(n)))).then(()=>redraw());
 return{texture,canvas,ready,icon,setBiome(value){biome=value;redraw();}};
}
