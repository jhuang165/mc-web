import * as THREE from 'three';
import {WOOL_COLORS} from './world.js';
export const ATLAS_COLUMNS=16,TILE_SIZE=16;
export const TILES=['grass_top','grass_side','dirt','stone','log_oak','log_oak_top','leaves_oak','sand','planks_oak','brick','glass','bedrock','cobblestone','crafting_table_top','crafting_table_side','crafting_table_front','furnace_side','furnace_top','furnace_front_off','furnace_front_on','coal_ore','iron_ore','diamond_ore','gold_ore','wool_colored_white','torch_on','bookshelf','obsidian','snow','clay','gravel','iron_block','gold_block','diamond_block','farmland_dry','farmland_wet',...Array.from({length:8},(_,i)=>'wheat_stage_'+i),'tallgrass','hardened_clay','chest_front','chest_side','chest_top',...WOOL_COLORS.slice(1).map(c=>'wool_colored_'+c.texture)];
// Item and particle faces for the chest, cut from its entity texture (ModelChest UVs).
const CHEST_FACES={chest_front:[[14,33,14,10,1,6],[14,14,14,5,1,2],[1,1,2,4,7,5]],chest_side:[[0,33,14,10,1,6],[0,14,14,5,1,2]],chest_top:[[14,0,14,14,1,1]]};
export const ATLAS_ROWS=Math.ceil(TILES.length/ATLAS_COLUMNS);
const tile=name=>TILES.indexOf(name);
// `meta` is the block metadata; only wool (BlockColored) picks its face by it.
export function blockTile(id,face,lit=false,meta=0){
 if(id===19)return tile('wool_colored_'+WOOL_COLORS[meta&15].texture);
 if(id===1)return tile(face===2?'grass_top':face===3?'dirt':'grass_side');
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
 function tint(mapName){const params=biome==='alpine'?[.2,.3]:[.8,.4],t=params[0],rain=params[1]*t;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(images.get('colormap/'+mapName),0,0);const color=x.getImageData(Math.floor((1-t)*255),Math.floor((1-rain)*255),1,1).data;return`rgb(${color[0]},${color[1]},${color[2]})`;}
 function tinted(source,color){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(source,0,0,16,16);x.globalCompositeOperation='multiply';x.fillStyle=color;x.fillRect(0,0,16,16);x.globalCompositeOperation='destination-in';x.drawImage(source,0,0,16,16);return c;}
 function redraw(){if(!images.size)return;icons.clear();ctx.clearRect(0,0,canvas.width,canvas.height);const grass=tint('grass'),leaves=tint('foliage');TILES.forEach((name,i)=>{const x=i%ATLAS_COLUMNS*16,y=Math.floor(i/ATLAS_COLUMNS)*16;if(CHEST_FACES[name]){for(const[u,v,w,h,dx,dy]of CHEST_FACES[name])ctx.drawImage(images.get('entity/chest/normal'),u,v,w,h,x+dx,y+dy,w,h);return;}let source=images.get('blocks/'+name);if(['grass_top','tallgrass'].includes(name))source=tinted(source,grass);if(name==='leaves_oak')source=tinted(source,leaves);ctx.drawImage(source,0,0,16,16,x,y,16,16);if(name==='grass_side')ctx.drawImage(tinted(images.get('blocks/grass_side_overlay'),grass),x,y);});texture.needsUpdate=true;}
 function icon(id,damage=0){const key=id+':'+damage;if(icons.has(key))return icons.get(key);const c=document.createElement('canvas');c.width=64;c.height=70;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  function face(index,matrix,shade){x.save();x.setTransform(...matrix);const sx=index%ATLAS_COLUMNS*16,sy=Math.floor(index/ATLAS_COLUMNS)*16;x.drawImage(canvas,sx,sy,16,16,0,0,16,16);if(shade){x.globalCompositeOperation='source-atop';x.fillStyle=`rgba(0,0,0,${shade})`;x.fillRect(0,0,16,16);}x.restore();}
  if(id===20||id===39||id>=31&&id<=38){const i=blockTile(id,2);x.drawImage(canvas,i%ATLAS_COLUMNS*16,Math.floor(i/ATLAS_COLUMNS)*16,16,16,3,5,58,58);}else{face(blockTile(id,0,false,damage),[1.75,1,0,2,4,18],.2);face(blockTile(id,4,false,damage),[1.75,-1,0,2,32,34],.08);face(blockTile(id,2,false,damage),[1.75,1,-1.75,1,32,2],0);}
  const url=c.toDataURL();icons.set(key,url);return url;
 }
 const ready=Promise.all([...TILES.filter(n=>!CHEST_FACES[n]).map(n=>'blocks/'+n),'entity/chest/normal','blocks/grass_side_overlay','colormap/grass','colormap/foliage'].map(async n=>images.set(n,await image(n)))).then(()=>redraw());
 return{texture,canvas,ready,icon,setBiome(value){biome=value;redraw();}};
}
