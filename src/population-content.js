// Content reached by Java 1.7.10 Overworld population. Internal ids append after 0.24.0.
// Kept independent of survival/world module initialization so both can use the same catalogue.
import { ANVIL, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE, BED } from './world.js';
import { STAIRS, stairRecipeResult } from './stairs.js';
import { DISPENSER, STICKY_PISTON, PISTON, PISTON_HEAD, SLIMEBALL, DISPENSER_ITEM, DROPPER, DROPPER_ITEM, STICKY_PISTON_ITEM, PISTON_ITEM, ORIGINAL_ITEMS as DISPENSER_PISTON_ITEMS } from './dispenser-piston.js';
import { STONE_BRICKS, DOUBLE_STONE_SLAB, STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, ITEM_STONE_BRICKS, ITEM_STONE_SLAB, ITEM_END_PORTAL_FRAME, ITEM_CAULDRON, ITEM_FLOWER_POT, STONE_BRICK_NAMES, SLAB_NAMES, slabDrops } from './stone-utility.js';
import { REDSTONE_WIRE, LEVER, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, REPEATER, TRIPWIRE_HOOK, TRIPWIRE, ITEM_LEVER, ITEM_STONE_PLATE, ITEM_WOODEN_PLATE, ITEM_STONE_BUTTON, ITEM_TRIPWIRE_HOOK, ITEM_REPEATER, ITEM_REDSTONE, ITEM_STRING, REDSTONE_ITEM_IDS, REDSTONE_ITEM_NAMES, redstoneDrops } from './redstone-blocks.js';
import * as RS2 from './redstone-blocks-2.js';
import { quartzOreXp } from './nether-blocks.js';
import { installShapedItems, installShapedMaterials, installShapedRecipes, shapedCraftingResult, shapedDrops, isShaped } from './shaped-blocks.js';
import { POTION_ITEM_ROWS } from './potion-items.js';
import { coloredDrops, coloredCraftingResult } from './colored-blocks.js';
export const POPULATION_ITEMS = Object.freeze({21:63,73:64,74:65,129:66,86:67,97:68,175:69,162:70,161:71,106:72,127:73,48:74,39:75,40:76,99:77,100:78,32:79,174:80,103:81,'44:1':82,'31:0':83,'31:2':84,24:56,110:57,159:58,111:59,145:ANVIL,116:ENCHANTING_TABLE,53:87,67:88,109:89,128:90,134:91,135:92,136:93,108:94,163:95,164:96,
  // Doors (items 324/330 are internal 470/471), iron bars and glass panes (the block items).
  324:470,330:471,101:IRON_BARS,102:1100,
  // ItemBed (original 355): one stack-of-one item placing both halves (bed-reference.json).
  355:472,
  // Slimeball (341) and the dispenser and both pistons, whose block ids 115-117 collide with the tool item ids (dispenser-piston.js).
  ...DISPENSER_PISTON_ITEMS,
  // Stone utility blocks (stone-utility-reference.json): original stone bricks 98, slab 44 (damage = type; 44:1 above stays the sandstone slab), end frame 120, cauldron 380, flower pot 390. Tools own items 100-127, so the block items are 1000 + block id.
  98:ITEM_STONE_BRICKS,44:ITEM_STONE_SLAB,120:ITEM_END_PORTAL_FRAME,380:ITEM_CAULDRON,390:ITEM_FLOWER_POT,
  // Redstone components (redstone-blocks-reference.json): lever 69, plates 70/72, button 77 and hook 131 are 1000 + block id; the repeater item 356 keeps its number; dust (331) and string (287) are the existing items 360 and 321.
  // Potions and brewing (potion-items.js): original 369 blaze rod, 370 ghast tear, 371 gold nugget, 372 nether wart, 373 potion (385), 374 glass bottle (384), 376 fermented spider eye, 377 blaze powder, 378 magma cream, 379 brewing stand item, 382 glistering melon, 396 golden carrot.
  369:387,370:389,371:394,372:386,373:385,374:384,376:391,377:388,378:390,379:1134,154:1133,382:392,396:393,
  ...REDSTONE_ITEM_IDS,
  // Second redstone family (redstone-blocks-2-reference.json): torch 76, lamp 123, redstone block 152, wooden button 143, weighted plates 147/148, daylight sensor 151, glowstone 89 (1000 + block id); comparator 404, quartz 406, glowstone dust 348.
  ...RS2.REDSTONE2_ITEM_IDS,
  // Powered rail 27, detector rail 28 and activator rail 157 are 1000 + internal block id 135-137 (powered-rails.js).
  27:1135,28:1136,157:1137,
  // Structure loot (strongholds): ender pearl 368, empty map 395 and compass 345 are internal 378-380 (inert items).
  // Shaped blocks (shaped-blocks.js): wood slab 126, fence gate 107, trapdoor 96, cobblestone wall 139 (1000 + internal block id; double slab 125 has no item).
  126:1165,107:1167,96:1168,139:1169,
  368:378,395:379,345:380,388:367,360:368,357:369,282:370,281:371,322:372,2256:373,2257:374,421:375,418:376,419:377});
export const TREE_NAMES=['Oak','Spruce','Birch','Jungle','Acacia','Dark oak'];
export const DOUBLE_NAMES=['Sunflower','Lilac','Double tallgrass','Large fern','Rose bush','Peony'];
export const POPULATION_VARIANTS={7:TREE_NAMES.map(s=>s+' planks'),4:TREE_NAMES.slice(0,4).map(s=>s+' log'),5:TREE_NAMES.slice(0,4).map(s=>s+' leaves'),48:TREE_NAMES.map(s=>s+' sapling'),69:DOUBLE_NAMES,70:TREE_NAMES.slice(4).map(s=>s+' log'),71:TREE_NAMES.slice(4).map(s=>s+' leaves'),68:['Stone monster egg','Cobblestone monster egg','Stone brick monster egg']};
export function installPopulationItems(items){
  installShapedItems(items);
  for(const [id,variants] of Object.entries(POPULATION_VARIANTS)) items[id].variants=variants;
  items[ANVIL].variants=['Anvil','Slightly Damaged Anvil','Very Damaged Anvil'];
  items[BED].hidden=true; // BlockBed has no item of its own: the bed item places it
  items[WOODEN_DOOR].hidden=true;items[IRON_DOOR].hidden=true; // BlockDoor has no item of its own: the door items place it
  // Slimeball (original 341) and the items of the dispenser, sticky piston and piston; the head has none.
  items[SLIMEBALL]={id:SLIMEBALL,name:'Slimeball',texture:'slimeball',stack:64,color:'#7ebf6e'};
  for(const [id,name,color] of [[DISPENSER_ITEM,'Dispenser','#6f6f6f'],[DROPPER_ITEM,'Dropper','#6f6f6f'],[STICKY_PISTON_ITEM,'Sticky Piston','#7e9a5a'],[PISTON_ITEM,'Piston','#9c8d6b']])items[id]={id,name,stack:64,block:true,color};
  items[65].hidden=true;items[73].hidden=true;items[77].hidden=true;items[78].hidden=true;items[83].hidden=true;
  for(const [id,name,texture,extra] of [
    [367,'Emerald','emerald'],[368,'Melon','melon',{food:2,saturation:.3}],
    [369,'Cookie','cookie',{food:2,saturation:.1}], [370,'Mushroom stew','mushroom_stew',{food:6,saturation:.6,stack:1,container:371}],
    [371,'Bowl','bowl'],
    // ItemDoor (items 324 and 330): stack limit 1, placed on the top face (doors-panes-reference.json).
    [470,'Wooden Door','door_wood',{stack:1}],[1100,'Glass pane',undefined,{block:true}],[471,'Iron Door','door_iron',{stack:1}],[472,'Bed','bed',{stack:1}],[372,'Golden apple','apple_golden',{food:4,saturation:1.2}],
    [ITEM_STONE_BRICKS,'Stone bricks',undefined,{block:true,variants:STONE_BRICK_NAMES}],[ITEM_STONE_SLAB,'Stone slab',undefined,{block:true,variants:SLAB_NAMES.slice(0,8)}],[ITEM_END_PORTAL_FRAME,'End portal frame',undefined,{block:true}],
    [ITEM_LEVER,REDSTONE_ITEM_NAMES[ITEM_LEVER],undefined,{block:true}],[ITEM_STONE_PLATE,REDSTONE_ITEM_NAMES[ITEM_STONE_PLATE],undefined,{block:true}],[ITEM_WOODEN_PLATE,REDSTONE_ITEM_NAMES[ITEM_WOODEN_PLATE],undefined,{block:true}],[ITEM_STONE_BUTTON,REDSTONE_ITEM_NAMES[ITEM_STONE_BUTTON],undefined,{block:true}],[ITEM_TRIPWIRE_HOOK,REDSTONE_ITEM_NAMES[ITEM_TRIPWIRE_HOOK],undefined,{block:true}],[ITEM_REPEATER,REDSTONE_ITEM_NAMES[ITEM_REPEATER],'repeater'],
    [1135,'Powered Rail',undefined,{block:true}],[1136,'Detector Rail',undefined,{block:true}],[1137,'Activator Rail',undefined,{block:true}],
    ...Object.entries(RS2.REDSTONE2_ITEM_NAMES).map(([id,name])=>[+id,name,RS2.REDSTONE2_ITEM_TEXTURES[id],RS2.REDSTONE2_ITEM_TEXTURES[id]?undefined:{block:true}]),
    [1133,'Hopper','hopper'],
    [ITEM_CAULDRON,'Cauldron','cauldron'],[ITEM_FLOWER_POT,'Flower pot','flower_pot'],
    [373,'Music disc 13','record_13',{stack:1}],[374,'Music disc cat','record_cat',{stack:1}],
    // EntityWitch (witch.js): the glass bottle (original 374) and the potion item (original 373, a witch's held and dropped potion).
    [384,'Glass Bottle','potion_bottle_empty'],[385,'Potion','potion_bottle_drinkable',{stack:1}],
    ...POTION_ITEM_ROWS,
    [378,'Ender Pearl','ender_pearl',{stack:16}],[379,'Empty Map','map_empty'],[380,'Compass','compass_static'],
    [375,'Name tag','name_tag'],[376,'Golden horse armor','gold_horse_armor',{stack:1}], [377,'Diamond horse armor','diamond_horse_armor',{stack:1}],
  ]) items[id]={id,name,texture,stack:64,color:'#8caa59',...extra};
}
export function installPopulationMaterials(m){
  installShapedMaterials(m);
  Object.assign(m,{
    63:{hardness:3,kind:'pickaxe',tier:1,drop:351},64:{hardness:3,kind:'pickaxe',tier:2,drop:360},65:{hardness:3,kind:'pickaxe',tier:2,drop:360},66:{hardness:3,kind:'pickaxe',tier:2,drop:367},
    67:{hardness:1,kind:'axe'},68:{hardness:.75,drop:0},69:{hardness:0,drop:0},70:{hardness:2,kind:'axe'},71:{hardness:.2,drop:0},72:{hardness:.2,drop:0},73:{hardness:.2,drop:351},74:{hardness:2,kind:'pickaxe',tier:0},75:{hardness:0},76:{hardness:0},77:{hardness:.2,drop:75},78:{hardness:.2,drop:76},79:{hardness:0,drop:0},80:{hardness:.5,drop:0},81:{hardness:1,kind:'axe',drop:368},82:{hardness:2,kind:'pickaxe',tier:0},83:{hardness:0,drop:0},84:{hardness:0,drop:0},
    [ANVIL]:{hardness:5,kind:'pickaxe',tier:0},
    // Stone utility blocks (stone-utility-reference.json): rock/iron need a pickaxe; the end frame is unbreakable; the pot breaks instantly.
    [STONE_BRICKS]:{hardness:1.5,kind:'pickaxe',tier:0},[DOUBLE_STONE_SLAB]:{hardness:2,kind:'pickaxe',tier:0},[STONE_SLAB]:{hardness:2,kind:'pickaxe',tier:0},
    [END_PORTAL_FRAME]:{hardness:Infinity,drop:0},[CAULDRON]:{hardness:2,kind:'pickaxe',tier:0},[134]:{hardness:.5,kind:'pickaxe',tier:0},[133]:{hardness:3,kind:'pickaxe',tier:0},[FLOWER_POT]:{hardness:0},
    // BlockEnchantmentTable: Material.rock, hardness 5 (block-metadata-reference.json); drops itself.
    [ENCHANTING_TABLE]:{hardness:5,kind:'pickaxe',tier:0},
    // BlockDoor (wood: hardness 3, any tool; iron: hardness 5, needs a pickaxe), BlockPane (iron bars: hardness 5 and a pickaxe, drops itself; glass pane: 0.3, drops nothing).
    // BlockBed: Material.cloth, hardness 0.2, no tool; the foot half drops the bed item, the head half nothing.
    [BED]:{hardness:.2,drop:472},
    [WOODEN_DOOR]:{hardness:3,kind:'axe',drop:470},[IRON_DOOR]:{hardness:5,kind:'pickaxe',tier:0,drop:471},
    // BlockDispenser (rock, hardness 3.5, pickaxe), BlockPistonBase and BlockPistonExtension (hardness 0.5, no tool; the head drops nothing): dispenser-piston-reference.json.
    [DISPENSER]:{hardness:3.5,kind:'pickaxe',tier:0,drop:DISPENSER_ITEM},[DROPPER]:{hardness:3.5,kind:'pickaxe',tier:0,drop:DROPPER_ITEM},[STICKY_PISTON]:{hardness:.5,drop:STICKY_PISTON_ITEM},[PISTON]:{hardness:.5,drop:PISTON_ITEM},[PISTON_HEAD]:{hardness:.5,drop:0},
    [IRON_BARS]:{hardness:5,kind:'pickaxe',tier:0},[GLASS_PANE]:{hardness:.3,drop:0},
    // Redstone components (redstone-blocks-reference.json): hardness 0.5 for the lever, plates and button (the stone plate is rock: pickaxe), 0 for the rest.
    [REDSTONE_WIRE]:{hardness:0,drop:ITEM_REDSTONE},[LEVER]:{hardness:.5,drop:ITEM_LEVER},[STONE_PRESSURE_PLATE]:{hardness:.5,kind:'pickaxe',tier:0,drop:ITEM_STONE_PLATE},[WOODEN_PRESSURE_PLATE]:{hardness:.5,kind:'axe',drop:ITEM_WOODEN_PLATE},[STONE_BUTTON]:{hardness:.5,drop:ITEM_STONE_BUTTON},[REPEATER]:{hardness:0,drop:ITEM_REPEATER},[TRIPWIRE_HOOK]:{hardness:0,drop:ITEM_TRIPWIRE_HOOK},[TRIPWIRE]:{hardness:0,drop:ITEM_STRING},
  });
  // Second redstone family (redstone-blocks-2-reference.json): native hardness; the redstone block and weighted plates need a pickaxe; lit/unlit twins drop the unlit item; the moving piston is unbreakable.
  for(const [id,h] of Object.entries(RS2.HARDNESS2)){
    const b=+id,drop=RS2.redstoneDrops2(b)[0]?.id??0;
    m[b]=h<0?{hardness:Infinity,drop:0}:{hardness:h,...(RS2.NEEDS_PICKAXE2.includes(b)?{kind:'pickaxe',tier:0}:{}),...(b===RS2.GLOWSTONE?{}:{drop})};
  }
  // BlockRailBase subclasses: hardness 0.7, Material.circuits (no tool needed), each drops its own item.
  for(const b of [135,136,137])m[b]={hardness:.7,drop:1000+b};
  // BlockStairs takes its model block's hardness and material (stairs-reference.json): planks are wood (axe), the rest rock.
  for(const [id,s] of Object.entries(STAIRS))m[id]=s.kind==='pickaxe'?{hardness:s.hardness,kind:'pickaxe',tier:0}:{hardness:s.hardness,kind:'axe'};
}
export function installPopulationRecipes({recipe,shapeless}){
  recipe('anvil','Anvil',['BBB',' I ','III'],{B:26,I:302},ANVIL);
  // " B " / "D#D" / "###": book, two diamonds, four obsidian (CraftingManager).
  recipe('enchanting-table','Enchanting table',[' B ','DOD','OOO'],{B:314,D:303,O:22},ENCHANTING_TABLE);
  // Native recipes 102/103: iron ingots around redstone make a compass (345 -> 380); paper around a compass makes an empty map (395 -> 379).
  recipe('compass','Compass',[' I ','IRI',' I '],{I:302,R:360},380);
  recipe('empty-map','Empty Map',['PPP','PCP','PPP'],{P:328,C:380},379);
  // CraftingManager: ItemDoor.wood "##","##","##" planks; iron "##" x3 ingots; panes: 6 glass in two rows of three (16); bars: 6 iron ingots (16).
  recipe('wooden-door','Wooden Door',['PP','PP','PP'],{P:7},470,1);
  recipe('iron-door','Iron Door',['II','II','II'],{I:302},471,1);
  // CraftingManager: three wool of any colour over three planks of any kind make one bed.
  recipe('bed','Bed',['WWW','PPP'],{W:19,P:7},472,1);
  recipe('glass-pane','Glass pane',['GGG','GGG'],{G:9},1100,16);
  // CraftingManager (potion-items.js): glass bottle (3 glass in a V, 3 bottles), gold nugget both ways, blaze powder, magma cream, fermented spider eye, glistering melon, golden carrot, brewing stand.
  recipe('glass-bottle','Glass Bottle',['G G',' G '],{G:9},384,3);
  recipe('gold-ingot-from-nuggets','Gold ingot',['NNN','NNN','NNN'],{N:394},304);
  shapeless(394,9,0,304);
  shapeless(388,2,0,387);
  shapeless(390,1,0,388,SLIMEBALL);
  shapeless(391,1,0,326,75,329);
  recipe('glistering-melon','Glistering Melon',['NNN','NMN','NNN'],{N:394,M:368},392);
  recipe('golden-carrot','Golden Carrot',['NNN','NCN','NNN'],{N:394,C:322},393);
  // CraftingManager: five iron ingots around a chest make a hopper (hopper-reference.json).
  recipe('hopper','Hopper',['I I','ICI',' I '],{I:302,C:41},1133);
  recipe('brewing-stand','Brewing Stand',[' B ','CCC'],{B:387,C:12},1134);
  recipe('iron-bars','Iron bars',['III','III'],{I:302},IRON_BARS,16);
  // CraftingManager: dispenser (C104) 7 cobblestone around a bow and redstone, piston (C106) 3 planks / 4 cobblestone / iron ingot / redstone, sticky piston (C242) slimeball over a piston.
  recipe('dispenser','Dispenser',['CCC','CBC','CRC'],{C:12,B:127,R:360},DISPENSER_ITEM);
  recipe('dropper','Dropper',['CCC','C C','CRC'],{C:12,R:360},DROPPER_ITEM); // CraftingManager: 7 cobblestone around redstone (dispenser-piston.js DROPPER)
  recipe('piston','Piston',['PPP','CIC','CRC'],{P:7,C:12,I:302,R:360},PISTON_ITEM);
  recipe('sticky-piston','Sticky Piston',['S','P'],{S:SLIMEBALL,P:PISTON_ITEM},STICKY_PISTON_ITEM);
  recipe('golden-apple','Golden apple',['GGG','GAG','GGG'],{G:304,A:200},372);
  recipe('sandstone','Sandstone',['SS','SS'],{S:6},56);
  // CraftingManager (stone-utility-reference.json): four stone make four bricks; seven iron a cauldron; three clay bricks a flower pot. Slabs are in populationCraftingResult.
  recipe('stone-bricks','Stone bricks',['SS','SS'],{S:3},ITEM_STONE_BRICKS,4);
  recipe('cauldron','Cauldron',['I I','I I','III'],{I:302},ITEM_CAULDRON);
  recipe('flower-pot','Flower pot',['B B',' B '],{B:306},ITEM_FLOWER_POT);
  // CraftingManager (redstone-blocks-reference.json): lever = stick over cobblestone, plates = two stone / two planks in a row, button = stone, hook = iron ingot, stick, planks (2). The repeater (C164) needs a redstone torch, absent here.
  recipe('lever','Lever',['S','C'],{S:300,C:12},ITEM_LEVER);
  recipe('stone-pressure-plate','Stone pressure plate',['SS'],{S:3},ITEM_STONE_PLATE);
  recipe('wooden-pressure-plate','Wooden pressure plate',['PP'],{P:7},ITEM_WOODEN_PLATE);
  recipe('stone-button','Stone button',['S'],{S:3},ITEM_STONE_BUTTON);
  recipe('tripwire-hook','Tripwire hook',['I','S','P'],{I:302,S:300,P:7},ITEM_TRIPWIRE_HOOK,2);
  // CraftingManager (redstone-blocks-2-reference.json recipes 13, 21, 100, 164, 175, 237, 240, 241, 248, 262): redstone torch, lamp, block (and nine dust back), comparator, daylight sensor, repeater, glowstone, weighted plates, wooden button.
  recipe('redstone-torch','Redstone torch',['R','S'],{R:360,S:300},RS2.ITEM_REDSTONE_TORCH);
  recipe('redstone-lamp','Redstone lamp',[' R ','RGR',' R '],{R:360,G:RS2.ITEM_GLOWSTONE},RS2.ITEM_REDSTONE_LAMP);
  recipe('redstone-block','Block of redstone',['RRR','RRR','RRR'],{R:360},RS2.ITEM_REDSTONE_BLOCK);
  recipe('redstone-from-block','Redstone',['B'],{B:RS2.ITEM_REDSTONE_BLOCK},360,9);
  recipe('comparator','Redstone comparator',[' T ','TQT','SSS'],{T:RS2.ITEM_REDSTONE_TORCH,Q:RS2.ITEM_QUARTZ,S:3},RS2.ITEM_COMPARATOR);
  recipe('repeater','Redstone repeater',['TRT','SSS'],{T:RS2.ITEM_REDSTONE_TORCH,R:360,S:3},ITEM_REPEATER);
  installShapedRecipes({recipe,shapeless});
  // Daylight sensor (C109): three glass, three quartz, three wood slabs of any type.
  recipe('daylight-sensor','Daylight sensor',['GGG','QQQ','SSS'],{G:9,Q:RS2.ITEM_QUARTZ,S:1165},RS2.ITEM_DAYLIGHT_SENSOR);
  recipe('glowstone','Glowstone',['DD','DD'],{D:RS2.ITEM_GLOWSTONE_DUST},RS2.ITEM_GLOWSTONE);
  recipe('light-weighted-plate','Light weighted pressure plate',['GG'],{G:304},RS2.ITEM_LIGHT_PLATE);
  recipe('heavy-weighted-plate','Heavy weighted pressure plate',['II'],{I:302},RS2.ITEM_HEAVY_PLATE);
  recipe('wooden-button','Wooden button',['P'],{P:7},RS2.ITEM_WOODEN_BUTTON);
  // CraftingManager (powered-rails.md): 6 gold + stick + redstone -> 6 powered rails; 6 iron + stone plate + redstone -> 6 detector rails; 6 iron + 2 sticks + redstone torch -> 6 activator rails.
  recipe('powered-rail','Powered rail',['G G','GSG','GRG'],{G:304,S:300,R:360},1135,6);
  recipe('detector-rail','Detector rail',['I I','IPI','IRI'],{I:302,P:ITEM_STONE_PLATE,R:360},1136,6);
  recipe('activator-rail','Activator rail',['ISI','ITI','ISI'],{I:302,S:300,T:RS2.ITEM_REDSTONE_TORCH},1137,6);
  recipe('bowl','Bowls',['W W',' W '],{W:7},371,4);
  recipe('melon','Melon block',['MMM','MMM','MMM'],{M:368},81);
  shapeless(370,1,0,75,76,371);
  shapeless(361,4,0,67);shapeless(362,1,0,368);
  for(const [meta,dye] of [[0,11],[1,13],[4,1],[5,9]])shapeless(351,2,dye,[69,meta]);
}
export const populationXp=(id,r)=>id===63?2+Math.floor(r()*4):id===64||id===65?1+Math.floor(r()*5):id===66?3+Math.floor(r()*5):id===156?quartzOreXp(r):0;
// Native BlockOre, BlockRedstoneOre, BlockHugeMushroom, BlockMelon and BlockDoublePlant drops.
export function populationDrops(id,meta,{random=Math.random,shears=false}={}){
  if(id===ANVIL)return[{id:ANVIL,count:1,damage:(meta&15)>>2}];
  {const colored=coloredDrops(id,meta);if(colored)return colored;}
  if(isShaped(id))return shapedDrops(id,meta);
  if(id>=REDSTONE_WIRE&&id<=TRIPWIRE)return redstoneDrops(id);
  if(RS2.isRedstone2Block(id))return RS2.redstoneDrops2(id,meta,{random});
  // BlockDoor.getItemDropped: the lower half drops its door item, the upper half nothing; BlockPane (glass) drops nothing.
  if(id===WOODEN_DOOR||id===IRON_DOOR)return meta&8?[]:[{id:id===WOODEN_DOOR?470:471,count:1}];
  // BlockBed.getItemDropped: the foot half drops the bed item, the head half (bit 3) nothing.
  if(id===BED)return meta&8?[]:[{id:472,count:1}];
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
  // BlockStoneBrick drops itself with its variant; slabs drop their type (the double slab twice); the end frame drops nothing; the pot's plant is added by the caller (potDrops).
  if(id===STONE_BRICKS)return[{id:ITEM_STONE_BRICKS,count:1,damage:meta&3}];
  if(id===DOUBLE_STONE_SLAB||id===STONE_SLAB)return slabDrops(id,meta);
  if(id===END_PORTAL_FRAME)return[];
  if(id===CAULDRON)return[{id:ITEM_CAULDRON,count:1}];
  if(id===133)return[{id:1133,count:1}]; // BlockHopper drops the hopper item (the contents drop from the tile)
  if(id===134)return[{id:1134,count:1}]; // BlockBrewingStand drops the brewing stand item (the potions drop from the tile)
  if(id===FLOWER_POT)return[{id:ITEM_FLOWER_POT,count:1}];
  if(id===83||id===84)return shears?[{id:39,count:1,damage:id===84?2:0}]:random()<1/8?[{id:309,count:1}]:[];
  if(id===69){if(meta&8)return[];const t=meta&7;if(t===2||t===3)return shears?[{id:39,count:2,damage:t===2?1:2}]:t===2&&random()<1/8?[{id:309,count:1}]:[];return[{id:69,count:1,damage:t}];}
  return null;
}

// Metadata-sensitive recipes are matched before the old ID-only shaped recipe catalogue.
export function populationCraftingResult(cells,size){
  const filled=cells.filter(Boolean);
  const colored=coloredCraftingResult(cells,size);if(colored)return colored; // colored-blocks.js recipes (stained glass, panes, carpet, storage blocks, jack o'lantern)
  const stairs=stairRecipeResult(cells,size);if(stairs)return stairs;
  const shaped=shapedCraftingResult(cells,size);if(shaped)return shaped;
  if(filled.length===1&&[4,70].includes(filled[0].id))return{id:7,count:4,damage:(filled[0].damage&3)+(filled[0].id===70?4:0)};
  if(filled.length===9&&size===3&&cells[4]?.id===351&&cells.every((s,i)=>i===4||s?.id===40))return{id:58,count:8,damage:15-cells[4].damage};
  if(filled.length===4&&filled.every(s=>s.id===56))for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if([cells[y*size+x],cells[y*size+x+1],cells[(y+1)*size+x],cells[(y+1)*size+x+1]].every(s=>s?.id===56))return{id:56,count:4,damage:2};
  if(filled.length===2&&filled.every(s=>s.id===82))for(let i=0;i<cells.length-size;i++)if(cells[i]?.id===82&&cells[i+size]?.id===82)return{id:56,count:1,damage:1};
  if(filled.length===3)for(let y=0;y<size;y++)for(let x=0;x<=size-3;x++){
    const a=cells[y*size+x],b=cells[y*size+x+1],c=cells[y*size+x+2];
    if(a?.id===305&&b?.id===351&&b.damage===3&&c?.id===305)return{id:369,count:8,damage:0};
    if([a,b,c].every(s=>s?.id===56))return{id:82,count:6,damage:0};
    // Slab recipes: stone 0, cobblestone 3, brick block 4, any stone bricks 5.
    const slab=[[3,0],[12,3],[8,4],[ITEM_STONE_BRICKS,5]].find(([i])=>[a,b,c].every(s=>s?.id===i));
    if(slab)return{id:ITEM_STONE_SLAB,count:6,damage:slab[1]};
  }
  return null;
}

export function installPopulationSmelting(smelt){Object.assign(smelt,{63:[351,4],64:360,66:367,70:308});}
