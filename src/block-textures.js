import {versioned,unversioned} from './media-version.js';
import {requestAsset,retryAsset,retryUrl} from './asset-requests.js';
import {parseAnimationMcmeta,spriteFrames,SpriteAnimation,fetchMcmeta,TICKS_PER_SECOND} from './texture-animation.js';
import {colormapSource} from './colormap-source.js';
import {atlasMips,mipChain} from './render-settings.js';
import * as THREE from 'three';
import {setColormaps,itemGrassColor,itemFoliageColor,PINE,BIRCH,LILY_PAD_COLOR} from './biome-colors.js';
import {WOOL_COLORS,RED_FLOWER,RED_FLOWERS,YELLOW_FLOWER,SAPLING,WEB,LADDER,CARROTS,POTATOES,CACTUS,REEDS,TNT,SANDSTONE,MYCELIUM,STAINED_CLAY,LILY_PAD,FENCE,RAIL,MOB_SPAWNER,ANVIL,ENCHANTING_TABLE,BED,WOODEN_DOOR,IRON_DOOR,IRON_BARS,GLASS_PANE,isCrop,isFlower} from './world.js';
import {FENCE_ITEM_BOXES} from './fences.js';
import {bedTexture} from './bed.js';
import {anvilModelBoxes} from './anvil-block.js';
import {SHAPED_TILES,woodSlabTexture,wallTexture} from './shaped-blocks.js';
import {STEM_CAKE_TILES} from './stems-cake.js';
import {WART_TILES,wartStage} from './nether-wart.js';
import {REDSTONE_TILES} from './redstone-blocks.js';
import {REDSTONE2_TILES,redstone2TileName} from './redstone-blocks-2.js';
import {STAIRS,STAIR_ITEM_BOXES} from './stairs.js';
import {isNetherBlock,isNetherFence,quartzTexture} from './nether-blocks.js';
import {STONE_BRICKS,DOUBLE_STONE_SLAB,STONE_SLAB,END_PORTAL_FRAME,CAULDRON,FLOWER_POT,SLAB_TEXTURES,stoneBrickTexture} from './stone-utility.js';
import {isDispenserPiston,iconNameForFace,blockForItem,PISTON_HEAD,DISPENSER,DROPPER} from './dispenser-piston.js';
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
// BlockRailPowered / BlockRailDetector icons: the plain texture, and *_powered while metadata bit 8 is set (internal ids 135-137).
const STRAIGHT_RAIL_TILES=['rail_golden','rail_detector','rail_activator'];
TILES.push(...STRAIGHT_RAIL_TILES.flatMap(n=>[n,n+'_powered']));
TILES.push('beacon');
TILES.push('anvil_base','anvil_top_damaged_0','anvil_top_damaged_1','anvil_top_damaged_2');
// BlockEnchantmentTable.getIcon: bottom (side 0), top (side 1), otherwise the side texture.
TILES.push('enchanting_table_top','enchanting_table_side','enchanting_table_bottom');
TILES.push('red_sand','dirt_podzol_top','dirt_podzol_side','sandstone_top','sandstone_bottom','sandstone_normal','sandstone_carved','sandstone_smooth','mycelium_top','mycelium_side','waterlily',...WOOL_COLORS.map(c=>'hardened_clay_stained_'+c.texture));
const TREE_TEXTURES=['oak','spruce','birch','jungle','acacia','big_oak'];
TILES.push(...TREE_TEXTURES.slice(1).map(t=>'planks_'+t),'lapis_ore','redstone_ore','emerald_ore','pumpkin_side','pumpkin_top','pumpkin_face_off','vine','cocoa_stage_0','cocoa_stage_1','cocoa_stage_2','cobblestone_mossy','mushroom_brown','mushroom_red','mushroom_block_skin_brown','mushroom_block_skin_red','mushroom_block_skin_stem','mushroom_block_inside','deadbush','ice_packed','melon_side','melon_top','fern',
  ...TREE_TEXTURES.slice(1).flatMap(t=>['log_'+t,'log_'+t+'_top','leaves_'+t,'sapling_'+(t==='big_oak'?'roofed_oak':t)]),
  ...['sunflower','syringa','grass','fern','rose','paeonia'].flatMap(t=>['double_plant_'+t+'_bottom','double_plant_'+t+'_top']));
// BlockStairs.getIcon delegates to the model block: stone brick stairs need the stone brick texture.
if(!TILES.includes('stonebrick'))TILES.push('stonebrick');
// BlockDoor, BlockPane: the two halves of each door, the pane's end strip and the bars (blocks/ textures).
for(const t of ['door_wood_lower','door_wood_upper','door_iron_lower','door_iron_upper','glass_pane_top','iron_bars'])if(!TILES.includes(t))TILES.push(t);
// BlockBed: foot and head top, end and side textures (the bottom is planks_oak).
if(!TILES.includes('command_block'))TILES.push('command_block');
for(const t of ['noteblock','jukebox_side','jukebox_top'])if(!TILES.includes(t))TILES.push(t); // BlockNote and BlockJukebox
for(const t of ['bed_feet_top','bed_feet_end','bed_feet_side','bed_head_top','bed_head_end','bed_head_side'])if(!TILES.includes(t))TILES.push(t);
// BlockDispenser fronts and the piston's five textures (BlockPistonBase / BlockPistonExtension icons); furnace_top and furnace_side are shared with the furnace.
for(const t of ['dispenser_front_horizontal','dispenser_front_vertical','dropper_front_horizontal','dropper_front_vertical','piston_top_normal','piston_top_sticky','piston_side','piston_bottom','piston_inner'])if(!TILES.includes(t))TILES.push(t);
// Stone bricks, slabs, end portal frame, cauldron, flower pot (stone-utility-reference.json): original blocks/ textures.
for(const t of ['stonebrick_mossy','stonebrick_cracked','stonebrick_carved','stone_slab_top','stone_slab_side','endframe_top','endframe_side','endframe_eye','end_stone','cauldron_top','cauldron_inner','cauldron_side','cauldron_bottom','flower_pot','water_still','nether_brick','quartz_block_side','quartz_block_top','quartz_block_bottom','brick','cobblestone','planks_oak','sandstone_normal','sandstone_top','sandstone_bottom','dirt'])if(!TILES.includes(t))TILES.push(t);
// Redstone components (redstone-blocks.js): dust, lever, repeater and tripwire textures and the planks/stone/torch/slab ones they reuse.
for(const t of REDSTONE_TILES)if(!TILES.includes(t))TILES.push(t);
for(const t of REDSTONE2_TILES)if(!TILES.includes(t))TILES.push(t); // second redstone family (redstone-blocks-2.js): torches, lamps, redstone block, plates, comparator, daylight sensor, glowstone
for(const t of ['hopper_outside','hopper_inside','hopper_top'])if(!TILES.includes(t))TILES.push(t); // BlockHopper (hopper.js)
for(const t of ['brewing_stand','brewing_stand_base'])if(!TILES.includes(t))TILES.push(t); // BlockBrewingStand (brewing.js)
// Colored and storage blocks (colored-blocks.js): stained glass and panes in 16 colours, hay, coal, lapis, emerald, sponge, lit pumpkin face.
for(const t of ['hay_block_side','hay_block_top','coal_block','lapis_block','emerald_block','sponge','pumpkin_face_on',...['white','orange','magenta','light_blue','yellow','lime','pink','gray','silver','cyan','purple','blue','brown','green','red','black'].flatMap(c=>['glass_'+c,'glass_pane_top_'+c,'wool_colored_'+c])])if(!TILES.includes(t))TILES.push(t);
if(!TILES.includes('stone_slab_top'))TILES.push('stone_slab_top');
// Nether, End and quartz building blocks (nether-blocks.js); end_stone, nether_brick and quartz_block_side/top/bottom are already above.
for(const t of ['netherrack','soul_sand','quartz_ore','quartz_block_chiseled','quartz_block_chiseled_top','quartz_block_lines','quartz_block_lines_top'])if(!TILES.includes(t))TILES.push(t);
if(!TILES.includes('cobblestone'))TILES.push('cobblestone');
if(!TILES.includes('dragon_egg'))TILES.push('dragon_egg'); // dragon-egg.js
for(const t of SHAPED_TILES)if(!TILES.includes(t))TILES.push(t); // trapdoor, cobblestone_mossy (shaped-blocks.js)
for(const t of STEM_CAKE_TILES)if(!TILES.includes(t))TILES.push(t); // stem and cake textures (stems-cake.js)
for(const t of ['portal',...WART_TILES])if(!TILES.includes(t))TILES.push(t); // BlockPortal (animated in scene.js) and BlockNetherWart stages (nether-wart.js)
// BlockGrass overlay (RenderBlocks, Fancy graphics): grey, tinted per vertex by the chunk mesher over the untinted grass_side.
if(!TILES.includes('grass_side_overlay'))TILES.push('grass_side_overlay');
export const ATLAS_ROWS=Math.ceil(TILES.length/ATLAS_COLUMNS);
const tile=name=>TILES.indexOf(name);
export const tileByName=tile;
export const namedTile=tile;
// `meta` selects wool colours, flower variants and root-crop growth textures.
// `snowy` is true when the block above is a snow layer or snow block: BlockGrass then shows grass_side_snowed on its sides.
export function blockTile(id,face,lit=false,meta=0,snowy=false){
 if(id===1139)id=139;
 if(id===164)return tile('portal');
 if(id===170)return tile(WART_TILES[wartStage(meta)]); // BlockNetherWart.getIcon
 if(id===159||id===160)return tile(id===159?'pumpkin_stem_disconnected':'melon_stem_disconnected');
 if(id===161)return tile(face===2?'cake_top':face===3?'cake_bottom':face===1&&meta>0?'cake_inner':'cake_side'); // BlockCake.getIcon: inner on the west side of a cut cake

 if(id>=1140&&id<=1148)id-=1000;
 if(id>=140&&id<=148){const c=WOOL_COLORS[meta&15].texture;if(id===140)return tile('glass_'+c);if(id===141)return tile(face===2||face===3?'glass_pane_top_'+c:'glass_'+c);if(id===142)return tile('wool_colored_'+c);if(id===143){const a=meta&12;return tile(face===2&&a===0||face===3&&a===0||face<2&&a===4||face>3&&a===8?'hay_block_top':'hay_block_side');}if(id===144)return tile('coal_block');if(id===145)return tile('lapis_block');if(id===146)return tile('emerald_block');if(id===147)return tile('sponge');return tile(face===2||face===3?'pumpkin_top':face===[4,0,5,1][meta&3]?'pumpkin_face_on':'pumpkin_side');}
 if(id===1177||id===1178)id-=1000; // note block and jukebox items
 if(id===177)return tile('noteblock');
 if(id===178)return tile(face===2?'jukebox_top':'jukebox_side');
 if(id>=1165&&id<=1169)id-=1000; // shaped-blocks.js items
 if(id===1940||id===1941)id-=1778; // trapped chest 162 and ender chest 163 items (chest-blocks.js)
 if(id===163)return tile('obsidian'); // BlockEnderChest.getIcon is obsidian (the model comes from entity/chest/ender.png)
 if(id===165||id===166)return tile(woodSlabTexture(meta));
 if(id===167)return tile('planks_oak');
 if(id===168)return tile('trapdoor');
 if(id===169)return tile(wallTexture(meta));
 if(id===1101||id===1103||id===1104)id-=1000; // the stone bricks, slab and end portal frame items (1000 + block id) show their block's textures
 if(id>=1108&&id<=1113)id-=1000; // item ids of the lever, plates, button and hook
 if(id>=1120&&id<=1131)id-=1000; // item ids of the second redstone family (redstone-blocks-2.js)
 if(id>=1135&&id<=1137)id-=1000; // item ids of the powered, detector and activator rails
 if(id>=135&&id<=137)return tile(STRAIGHT_RAIL_TILES[id-135]+(meta&8?'_powered':''));
 if(id>=119&&id<=131)return tile(redstone2TileName(id,face));
 if(id===107)return tile('redstone_dust_cross');
 if(id===108)return tile('lever');
 if(id===109||id===111)return tile('stone');
 if(id===110)return tile('planks_oak');
 if(id===112)return tile(face===1?'repeater_off':face===0?'redstone_torch_off':'stone_slab_top');
 if(id===113)return tile('trip_wire_source');
 if(id===114)return tile('trip_wire');
 if(blockForItem(id)){id=blockForItem(id);meta=id===DISPENSER||id===DROPPER?3:1;} // item ids 1115-1117 draw as the native item meta
 if(STAIRS[id]){const m=STAIRS[id].model;return tile(m==='planks'?'planks_'+TREE_TEXTURES[STAIRS[id].modelDamage]:m==='sandstone'?(face===2?'sandstone_top':face===3?'sandstone_bottom':'sandstone_normal'):m==='quartz'?(face===2?'quartz_block_top':face===3?'quartz_block_bottom':'quartz_block_side'):m);}
 // BlockDoor.getIcon: the lower or upper half's texture by metadata (bit 3); BlockPane: glass / iron_bars sides, glass_pane_top ends.
 if(id===WOODEN_DOOR||id===IRON_DOOR)return tile((id===WOODEN_DOOR?'door_wood_':'door_iron_')+(meta&8?'upper':'lower'));
 // BlockBed.getIcon; `face` is this renderer's face index (+x, -x, +y, -y, +z, -z), the icon wants Minecraft's side number.
 if(id===139)return tile('command_block');
 if(id===BED)return tile(bedTexture([5,4,1,0,3,2][face]??1,meta));
 if(id===IRON_BARS)return tile('iron_bars');
 if(id===GLASS_PANE)return tile(face===2||face===3?'glass_pane_top':'glass');
 if(isDispenserPiston(id))return tile(iconNameForFace(id,meta,face));
 if(id===ENCHANTING_TABLE)return tile(face===2?'enchanting_table_top':face===3?'enchanting_table_bottom':'enchanting_table_side');
 if(id===173)return tile(meta===1?'obsidian':meta===2?'beacon':'glass'); // RenderBlocks.renderBlockBeacon: meta selects the box part (0 glass shell, 1 obsidian base, 2 beacon core)
 if(id===ANVIL)return tile(face===2?'anvil_top_damaged_'+(((meta&15)>>2)%3):'anvil_base');
 if(id===7)return tile('planks_'+(TREE_TEXTURES[meta&7]??'oak'));
 if(isNetherBlock(id)&&!STAIRS[id]){ // nether-blocks.js: netherrack, soul sand, End stone, nether brick, its fence, quartz ore and block
  if(id===157)return tile(quartzTexture(meta,face));
  return tile(id===156?'quartz_ore':id===151?'soul_sand':id===152?'end_stone':id===150?'netherrack':'nether_brick');
 }
 if(id===63)return tile('lapis_ore');
 if(id===64||id===65)return tile('redstone_ore');
 if(id===66)return tile('emerald_ore');
 if(id===67)return tile(face===2||face===3?'pumpkin_top':face===[4,0,5,1][meta&3]?'pumpkin_face_off':'pumpkin_side');
 if(id===68)return tile(['stone','cobblestone','stonebrick','stonebrick_mossy','stonebrick_cracked','stonebrick_carved'][meta]??'stone'); // BlockSilverfish.getIcon: metadata 0-5, anything else is stone
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
 if(id===STONE_BRICKS)return tile(stoneBrickTexture(meta>3?0:meta&3));
 // BlockStoneSlab.getIcon: the double slab's bit 3 (43:8, 43:9) forces the top texture on every side; type 0 uses slab_side on the sides, the other types a per-face set.
 if(id===DOUBLE_STONE_SLAB||id===STONE_SLAB){const t=SLAB_TEXTURES[meta&7];return tile(id===DOUBLE_STONE_SLAB&&meta&8?t[1]:face===2?t[1]:face===3?t[2]:t[0]);}
 if(id===171)return tile('dragon_egg'); // BlockDragonEgg: one icon on every face
 if(id===END_PORTAL_FRAME)return tile(meta&16?'endframe_eye':face===2?'endframe_top':face===3?'end_stone':'endframe_side');
 if(id===CAULDRON)return tile(meta&32?'water_still':meta&16?'cauldron_inner':face===2?'cauldron_top':face===3?'cauldron_bottom':'cauldron_side');
 // BlockHopper.getIcon: the top rim on side 1, hopper_outside elsewhere; meta bit 16 is the renderer's inner wall (hopper_outside), bit 32 the bowl floor (hopper_inside).
 if(id===133)return tile(meta&32?'hopper_inside':meta&16?'hopper_outside':face===2?'hopper_top':'hopper_outside');
 if(id===134)return tile(meta&16?'brewing_stand_base':'brewing_stand');
 if(id===FLOWER_POT)return tile('flower_pot');
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
 if(id===41||id===162)return tile(face===2||face===3?'chest_top':face===4?'chest_front':'chest_side');
 if(id===21)return tile(face===2||face===3?'planks_oak':'bookshelf');
 if(id===29||id===30)return tile(face===2?(id===30?'farmland_wet':'farmland_dry'):'dirt');
 if(id>=31&&id<=38)return tile('wheat_stage_'+(id-31));
 const name={2:'dirt',3:'stone',5:'leaves_oak',6:'sand',7:'planks_oak',8:'brick',9:'glass',11:'bedrock',12:'cobblestone',15:'coal_ore',16:'iron_ore',17:'diamond_ore',18:'gold_ore',19:'wool_colored_white',20:'torch_on',22:'obsidian',23:'snow',24:'clay',25:'gravel',26:'iron_block',27:'gold_block',28:'diamond_block',39:'tallgrass',40:'hardened_clay'}[id];return tile(name||'stone');
}
export function tileRect(index,inset=.02){const x=index%ATLAS_COLUMNS,y=Math.floor(index/ATLAS_COLUMNS);return{u0:(x*TILE_SIZE+inset)/(ATLAS_COLUMNS*TILE_SIZE),u1:((x+1)*TILE_SIZE-inset)/(ATLAS_COLUMNS*TILE_SIZE),v0:1-((y+1)*TILE_SIZE-inset)/(ATLAS_ROWS*TILE_SIZE),v1:1-(y*TILE_SIZE+inset)/(ATLAS_ROWS*TILE_SIZE)};}
// A resource pack tile may be larger than 16 px (HD) or an animation strip (width x n*width): the atlas keeps its 16 px cells and draws the first square frame, scaled.
function frameSize(source){return Math.max(1,Math.min(source.width||16,source.height||16));}
function image(name){const url=versioned('/media/1.7.10/'+name+'.png');return retryAsset(attempt=>requestAsset(()=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Texture missing: '+name));i.src=retryUrl(url,attempt);})));}
export function createBlockAtlas(){
 const canvas=document.createElement('canvas');canvas.width=ATLAS_COLUMNS*TILE_SIZE;canvas.height=ATLAS_ROWS*TILE_SIZE;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
 const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;const images=new Map(),icons=new Map();let biome='meadow',opaque=false,mipLevels=0;
 // Two atlases: `canvas`/`texture` carry the item colours (ColorizerGrass.getColor(0.5, 1.0) etc.: GUI icons, held and dropped blocks, particles);
 // `tcanvas`/`terrain` keep the grass, foliage, vine, reed and lily tiles grey and the grass side without its overlay, because the chunk
 // mesher multiplies the per-position biome colour (biome-colors.js) into the vertex colours as Block.colorMultiplier does.
 const tcanvas=document.createElement('canvas');tcanvas.width=canvas.width;tcanvas.height=canvas.height;const tctx=tcanvas.getContext('2d',{willReadFrequently:true});tctx.imageSmoothingEnabled=false;
 const terrain=new THREE.CanvasTexture(tcanvas);terrain.magFilter=terrain.minFilter=THREE.NearestFilter;terrain.generateMipmaps=false;
 const css=c=>`rgb(${c>>16&255},${c>>8&255},${c&255})`;
 function tinted(source,color,frame=0){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');const f=frameSize(source);x.drawImage(source,0,frame*f,f,f,0,0,16,16);x.globalCompositeOperation='multiply';x.fillStyle=color;x.fillRect(0,0,16,16);x.globalCompositeOperation='destination-in';x.drawImage(source,0,frame*f,f,f,0,0,16,16);return c;}
 function pixels(name){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(images.get('colormap/'+name),0,0);return x.getImageData(0,0,256,256).data;}
 const GRASS_TILES=['grass_top','tallgrass','reeds','fern','vine','double_plant_grass_bottom','double_plant_grass_top','double_plant_fern_bottom','double_plant_fern_top'];
 // terrainMode: grey tinted tiles and no overlay in the grass side (the mesher adds both per position). Otherwise the item colours.
 // Block tile animation (batch 17): a tile whose png is a strip with a ".png.mcmeta" animation section animates as
 // TextureAtlasSprite.updateAnimation does (texture-animation.js, probed). `shown` is the frame index drawn per tile name.
 const shown=new Map();let anims=new Map(),animToken=0,lastTick=0;
 async function loadAnimations(){
  const token=++animToken,next=new Map();
  await Promise.all(TILES.filter(n=>!CHEST_FACES[n]).map(async n=>{
   const img=images.get('blocks/'+n);if(!img||!(img.height>=2*img.width))return;
   const text=await fetchMcmeta(unversioned(versioned('/media/1.7.10/blocks/'+n+'.png')));if(text==null)return;
   try{const meta=parseAnimationMcmeta(text);if(meta)next.set(n,new SpriteAnimation(spriteFrames(meta,img.width,img.height)));}catch(e){console.warn('blocks/'+n+'.png.mcmeta: '+e.message);}
  }));
  if(token!==animToken)return;
  anims=next;shown.clear();for(const[n,a]of anims)shown.set(n,a.frameAtTick(lastTick));
  if(anims.size)redraw();
 }
 // Called each render with the 20 Hz client tick count; redraws only the tiles whose frame changed and re-uploads the atlas then.
 function animate(tick){
  lastTick=tick;if(!anims.size)return false;
  const changed=new Set();
  for(const[n,a]of anims){const f=a.frameAtTick(tick);if(shown.get(n)!==f){shown.set(n,f);changed.add(n);}}
  if(!changed.size)return false;
  icons.clear();drawAtlas(ctx,false,changed);drawAtlas(tctx,true,changed);
  // Only the changed tiles' mip chains are rebuilt (a whole-atlas atlasMips pass costs ~17 ms; portal changes every tick).
  if(mipLevels)for(const n of changed){const i=TILES.indexOf(n),x=i%ATLAS_COLUMNS*16,y=Math.floor(i/ATLAS_COLUMNS)*16;tileMips(texture,ctx,x,y);tileMips(terrain,tctx,x,y);}
  texture.needsUpdate=true;terrain.needsUpdate=true;return true;
 }
 // One tile's mip levels written into the existing level canvases (same per-tile chain as atlasMips).
 function tileMips(tex,g,x,y){if(tex.mipmaps.length<2)return;const max=tex.mipmaps.length-1,chain=mipChain(g.getImageData(x,y,TILE_SIZE,TILE_SIZE).data,TILE_SIZE,TILE_SIZE,max);for(let l=1;l<chain.length&&l<=max;l++){const c=chain[l];tex.mipmaps[l].getContext('2d').putImageData(new ImageData(c.data,c.width,c.height),x>>l,y>>l);}}
 function drawAtlas(g,terrainMode,only=null){const grass=css(itemGrassColor()),foliage=css(itemFoliageColor()),chestImg=images.get('entity/chest/normal'),chestScale=chestImg.width/64;TILES.forEach((name,i)=>{if(only&&!only.has(name))return;const x=i%ATLAS_COLUMNS*16,y=Math.floor(i/ATLAS_COLUMNS)*16;if(only)g.clearRect(x,y,16,16);const fr=shown.get(name)??0;if(CHEST_FACES[name]){for(const[u,v,w,h,dx,dy]of CHEST_FACES[name])g.drawImage(chestImg,u*chestScale,v*chestScale,w*chestScale,h*chestScale,x+dx,y+dy,w,h);return;}let source=images.get('blocks/'+name+(opaque&&name.startsWith('leaves_')?'_opaque':''));if(!terrainMode){if(GRASS_TILES.includes(name))source=tinted(source,grass,fr);else if(name.startsWith('leaves_'))source=tinted(source,name==='leaves_spruce'?css(PINE):name==='leaves_birch'?css(BIRCH):foliage,fr);else if(name==='waterlily')source=tinted(source,css(LILY_PAD_COLOR),fr);}{const f=frameSize(source),k=source instanceof HTMLCanvasElement?0:fr;g.drawImage(source,0,k*f,f,f,x,y,16,16);}if(name==='grass_side'&&!terrainMode)g.drawImage(tinted(images.get('blocks/grass_side_overlay'),grass),x,y);});}
 function redraw(){if(!images.size)return;icons.clear();setColormaps(pixels('grass'),pixels('foliage'));ctx.clearRect(0,0,canvas.width,canvas.height);tctx.clearRect(0,0,tcanvas.width,tcanvas.height);drawAtlas(ctx,false);drawAtlas(tctx,true);updateMips(texture,ctx,canvas);updateMips(terrain,tctx,tcanvas);texture.needsUpdate=true;terrain.needsUpdate=true;}
 // TextureMap mipmaps (render-settings.js atlasMips): per-tile chains, NEAREST_MIPMAP_LINEAR when above level 0.
 function updateMips(tex,g,cv){const n=Math.min(mipLevels,4);if(n===0){if(tex.mipmaps.length){tex.mipmaps=[];tex.minFilter=THREE.NearestFilter;tex.dispose();}return;}const d=g.getImageData(0,0,cv.width,cv.height).data,chain=atlasMips(d,cv.width,cv.height,TILE_SIZE,n);tex.mipmaps=chain.map((l,i)=>{if(i===0)return cv;const c=document.createElement('canvas');c.width=l.width;c.height=l.height;c.getContext('2d').putImageData(new ImageData(l.data,l.width,l.height),0,0);return c;});tex.minFilter=THREE.NearestMipmapLinearFilter;const key=chain.length+':'+tex.mipmaps.length;if(tex.userData.mipKey!==key)tex.dispose();tex.userData.mipKey=key;}
 function icon(id,damage=0){if(id===1139)id=139;if(id===1940||id===1941)id-=1778;if(id>=1140&&id<=1148)id-=1000;if(id===1177||id===1178)id-=1000;if(id===1100)id=GLASS_PANE;if(id>=1135&&id<=1137)id-=1000;if(id>=1108&&id<=1113)id-=1000;if(id>=1120&&id<=1131)id-=1000;if(id===1101)id=STONE_BRICKS;if(id===1103)id=STONE_SLAB;if(id===1104)id=END_PORTAL_FRAME;if(blockForItem(id)){/* RenderBlocks.renderBlockAsItem: the dispenser draws its front as metadata 3, a piston as metadata 1 */id=blockForItem(id);damage=id===DISPENSER||id===DROPPER?3:1;}const key=id+':'+damage;if(icons.has(key))return icons.get(key);const c=document.createElement('canvas');c.width=64;c.height=70;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  if(id===173){beaconIcon(x);const url=c.toDataURL();icons.set(key,url);return url;}
  if(id===ANVIL){anvilIcon(x,damage);const url=c.toDataURL();icons.set(key,url);return url;}
  function face(index,matrix,shade,drop=0){x.save();x.setTransform(...matrix);const sx=index%ATLAS_COLUMNS*16,sy=Math.floor(index/ATLAS_COLUMNS)*16;x.drawImage(canvas,sx,sy,16,16-drop,0,drop,16,16-drop);if(shade){x.globalCompositeOperation='source-atop';x.fillStyle=`rgba(0,0,0,${shade})`;x.fillRect(0,0,16,16);}x.restore();}
  // RenderBlocks.renderBlockAsItem for the fence (render type 11): two posts and two bars along z,
  // painted back to front in the inventory projection (z across, x into the picture).
  if(id===FENCE||isNetherFence(id)){fenceIcon(x,id);const url=c.toDataURL();icons.set(key,url);return url;}
  if(STAIRS[id]){stairIcon(x,id);const url=c.toDataURL();icons.set(key,url);return url;}
 if([171,69,72,75,76,79,83,84,108,113,119,120,IRON_BARS,GLASS_PANE,141].includes(id)||id===20||id===39||id===SAPLING||id===WEB||id===LADDER||id===REEDS||id===RAIL||(id>=135&&id<=137)||isFlower(id)||isCrop(id)){const i=blockTile(id,id===141?0:2,false,damage);x.drawImage(canvas,i%ATLAS_COLUMNS*16,Math.floor(i/ATLAS_COLUMNS)*16,16,16,3,5,58,58);}else{const drop=id===46?14:id===129?10:id===ENCHANTING_TABLE?4:id===82||id===STONE_SLAB?8:id===END_PORTAL_FRAME?3:0;/* ItemSnow draws the layer's 2/16 bounds, a flat slab */face(blockTile(id,0,false,damage),[1.75,1,0,2,4,18],.2,drop);face(blockTile(id,4,false,damage),[1.75,-1,0,2,32,34],.08,drop);face(blockTile(id,2,false,damage),[1.75,1,-1.75,1,32,2+drop*2],0);}
  const url=c.toDataURL();icons.set(key,url);return url;
 }
 // RenderBlocks.renderBlockAsItem (type 34): the inner boxes first, then the glass shell over them.
 function beaconIcon(ctx){
  const p=(x,y,z)=>[32+28*(z-x),34+16*(x+z)-32*y];
  for(const [m,[x0,y0,z0,x1,y1,z1]] of [[1,[.125,.00625,.125,.875,.1875,.875]],[2,[.1875,.1875,.1875,.8125,.875,.8125]],[0,[0,0,0,1,1,1]]]){
   const paint=(face,points,shade=0)=>{const t=blockTile(173,face,false,m),sx=t%ATLAS_COLUMNS*16,sy=Math.floor(t/ATLAS_COLUMNS)*16,[a,b,c,d]=points;
    ctx.save();ctx.setTransform((b[0]-a[0])/16,(b[1]-a[1])/16,(d[0]-a[0])/16,(d[1]-a[1])/16,a[0],a[1]);ctx.drawImage(canvas,sx,sy,16,16,0,0,16,16);
    if(shade){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(0,0,0,${shade})`;ctx.fillRect(0,0,16,16);}ctx.restore();};
   paint(0,[p(x1,y0,z0),p(x1,y0,z1),p(x1,y1,z1),p(x1,y1,z0)],.2);
   paint(4,[p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)],.08);
   paint(2,[p(x0,y1,z0),p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1)]);
  }
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
 // RenderBlocks.renderBlockAsItem for render type 10: the back half (z 0-0.5, full height) then the front half
 // (z 0.5-1, half height) in the same isometric projection as the anvil icon.
 function stairIcon(ctx,id){
  const p=(x,y,z)=>[32+28*(z-x),34+16*(x+z)-32*y],
   paint=(face,points,shade=0)=>{const t=blockTile(id,face),sx=t%ATLAS_COLUMNS*16,sy=Math.floor(t/ATLAS_COLUMNS)*16,[a,b,c,d]=points;
    ctx.save();ctx.setTransform((b[0]-a[0])/16,(b[1]-a[1])/16,(d[0]-a[0])/16,(d[1]-a[1])/16,a[0],a[1]);ctx.drawImage(canvas,sx,sy,16,16,0,0,16,16);
    if(shade){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(0,0,0,${shade})`;ctx.fillRect(0,0,16,16);}ctx.restore();};
  for(const [x0,y0,z0,x1,y1,z1] of STAIR_ITEM_BOXES){
   paint(0,[p(x1,y0,z0),p(x1,y0,z1),p(x1,y1,z1),p(x1,y1,z0)],.2);
   paint(4,[p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)],.08);
   paint(2,[p(x0,y1,z0),p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1)]);
  }
 }
 // Item projection P(a,b,h) = (32 + 1.75(a-b), 2 + a + b + 2(16-h)) in pixels, a = 16z, b = 16x.
 function fenceIcon(x,id=FENCE){const t=blockTile(id,0),sx=t%ATLAS_COLUMNS*16,sy=Math.floor(t/ATLAS_COLUMNS)*16;
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
 const ready=Promise.all([...TILES.filter(n=>!CHEST_FACES[n]).map(n=>'blocks/'+n),'entity/chest/normal','blocks/grass_side_overlay','colormap/grass','colormap/foliage',...TILES.filter(n=>n.startsWith('leaves_')).map(n=>'blocks/'+n+'_opaque')].map(async n=>images.set(n,n.startsWith('colormap/')?colormapSource(await image(n),images.get(n),m=>console.warn(m)):await image(n)))).then(()=>{redraw();return loadAnimations();});
 // Resource pack refresh: re-read every image (versioned url, so the service worker's new overrides are fetched) and redraw in place.
 const names=()=>[...TILES.filter(n=>!CHEST_FACES[n]).map(n=>'blocks/'+n),'entity/chest/normal','blocks/grass_side_overlay','colormap/grass','colormap/foliage',...TILES.filter(n=>n.startsWith('leaves_')).map(n=>'blocks/'+n+'_opaque')];
 async function reload(){const next=new Map(await Promise.all(names().map(async n=>[n,n.startsWith('colormap/')?colormapSource(await image(n),images.get(n),m=>console.warn(m)):await image(n)])));images.clear();for(const[k,v]of next)images.set(k,v);anims=new Map();shown.clear();redraw();await loadAnimations();}
 return{texture,terrain,canvas,ready,reload,animate,icon,setBiome(value){biome=value;},get biome(){return biome;},get leavesOpaque(){return opaque;},setOpaqueLeaves(v){opaque=!!v;redraw();},setFiltering(levels,aniso,max=1){const a=Math.max(1,Math.min(aniso,max)),changed=levels!==mipLevels;mipLevels=levels;for(const t of[texture,terrain])if(t.anisotropy!==a){t.anisotropy=a;t.needsUpdate=true;}if(changed)redraw();}};
}
