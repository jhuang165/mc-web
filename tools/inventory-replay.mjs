// Replays tools/probes/inventory-scenarios.txt against the JavaScript
// inventory and produces the same JSON lines as InventoryProbe.java.
import { POPULATION_ITEMS } from '../src/population-content.js';
import { FISHING_ITEMS } from '../src/fishing-content.js';
import { SIGN_ITEMS } from '../src/signs.js';
import {Survival,ITEMS,burnTime,smeltingResult} from '../src/survival.js';
import {makeStack,copyStack,ChestContainer,LargeChestInventory} from '../src/inventory.js';
import {newChest,chestInventory} from '../src/chest.js';
import {YELLOW_FLOWER,RED_FLOWER,DYE,SNOW_LAYER,ICE,SAPLING,WEB,LADDER,CACTUS,TNT,FENCE,RAIL,ANVIL,ENCHANTING_TABLE} from '../src/world.js';

// Minecraft 1.7.10 numeric IDs (and metadata for subtypes) of this build's items.
export const MC_IDS={137:1139,
 1:3,2:1,3:2,4:12,54:41,5:7,6:SAPLING,7:11,12:6,13:25,14:18,15:16,16:15,17:4,18:5,20:9,30:WEB,65:LADDER,'31:1':39,35:19,49:22,41:27,42:26,45:8,47:21,50:20,56:17,57:28,58:13,61:14,78:SNOW_LAYER,79:ICE,80:23,82:24,172:40,
 256:110,257:102,258:106,259:126,260:200,263:301,264:303,265:302,266:304,267:114,268:112,269:108,270:100,271:104,272:113,273:109,274:101,275:105,276:115,277:111,278:103,279:107,
 280:300,283:119,284:118,285:116,286:117,290:120,291:121,292:122,293:123,294:124,295:309,296:305,297:201,318:313,319:202,320:203,332:312,344:316,288:317,365:318,366:319,336:306,337:307,340:314,352:311,359:125,261:127,262:320,287:321,363:204,364:205,367:206,334:315,'263:1':308,351:DYE,37:YELLOW_FLOWER,38:RED_FLOWER,
 375:326,391:322,392:323,393:324,394:325,325:340,326:341,327:342,335:343,
 46:TNT,289:330,
 81:CACTUS,338:327,339:328,353:329,
 298:400,299:401,300:402,301:403,302:404,303:405,304:406,305:407,306:408,307:409,308:410,309:411,310:416,311:417,312:418,313:419,314:412,315:413,316:414,317:415,
 85:FENCE,66:RAIL,331:360,361:361,362:362,329:363,417:364,403:365,321:1700,389:1701,328:366,342:450,333:495,145:ANVIL,116:ENCHANTING_TABLE,
 ...POPULATION_ITEMS,
 ...FISHING_ITEMS,
 ...SIGN_ITEMS,
};
const GAME_IDS=Object.fromEntries(Object.entries(MC_IDS).map(([mc,id])=>[id,mc.split(':').map(Number)]));
const toGame=(id,count,damage)=>{const subtype=MC_IDS[id+':'+damage],game=subtype??MC_IDS[id];if(!game)throw new Error('No game item for Minecraft ID '+id+':'+damage);return makeStack(game,count,subtype?0:damage);};
const json=s=>{if(!s)return null;const [id,meta]=GAME_IDS[s.id]??[-s.id];return[id,s.count,meta??s.damage];};
// Shortest decimal that round-trips as a float, as Java's Float.toString prints it.
const javaFloat=x=>{for(let p=1;p<=9;p++){const v=+x.toPrecision(p);if(Math.fround(v)===x)return v;}return x;};
// Registry lines (burn/smelt) for every mapped item, appended to the shared script.
export function registryCase(){return['case registry',...Object.keys(MC_IDS).flatMap(key=>{const [id,meta=0]=key.split(':');return[`burn ${id} 1 ${meta}`,`smelt ${id} 1 ${meta}`];}),'end'].join('\n');}
export function replay(script){
 const out=[];let p,inv,container,results,drops,broken;
 const stack=(a,i)=>toGame(+a[i],+a[i+1],+a[i+2]);
 for(const raw of script.split('\n')){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;const a=line.split(/\s+/);
  switch(a[0]){
   case 'case':p=new Survival({slots:[]});inv=p.inventory;results=[];drops=[];broken=[];container=Object.assign(p.openInventory(),{drops});out.push({case:a[1]});break;
   case 'creative':inv.creative=true;break;
   case 'remote':break;
   case 'workbench':container=Object.assign(p.openWorkbench(),{drops});break;
   case 'furnace':container=Object.assign(p.openFurnace('0,0,0'),{drops});break;
   case 'chest':container=Object.assign(new ChestContainer(inv,chestInventory(newChest())),{drops});break;
   case 'largechest':container=Object.assign(new ChestContainer(inv,new LargeChestInventory(chestInventory(newChest()),chestInventory(newChest()))),{drops});break;
   case 'inv':inv.main[+a[1]]=stack(a,2);break;
   case 'fill':for(let i=0;i<36;i++)inv.main[i]??=stack(a,1);break;
   case 'burn':results.push(burnTime(stack(a,1)));break;
   case 'smelt':results.push(json(smeltingResult(stack(a,1))));break;
   case 'armorinfo':{const item=ITEMS[MC_IDS[a[1]]];results.push([item.armor,item.defense,item.durability]);break;}
   case 'wear':inv.armor[+a[1]]=stack(a,2);break;
   case 'hurt':{const d=Math.fround(+a[1]),wear=Math.floor(Math.max(1,Math.fround(d/4))),before=inv.armor.map(copyStack),n=p.applyArmor(d);before.forEach((s,i)=>{if(s&&!inv.armor[i])broken.push(json({...s,damage:s.damage+wear}));});results.push([javaFloat(n),p.armorValue]);break;}
   case 'put':container.slots[+a[1]].put(stack(a,2));break;
   case 'cursor':inv.cursor=stack(a,1);break;
   case 'select':inv.current=+a[1];break;
   case 'click':results.push(json(container.click(+a[1],+a[2],+a[3])));break;
   case 'add':{const s=stack(a,1),ok=inv.add(s);results.push([ok,s.count]);break;}
   case 'consume':results.push(inv.consume(MC_IDS[a[1]]));break;
   case 'damage':{const s=copyStack(inv.main[+a[1]]);if(inv.damage(+a[1],+a[2]))broken.push(json({...s,damage:s.damage+ +a[2]}));break;}
   case 'pick':inv.pick(MC_IDS[a[1]],inv.creative);break;
   case 'close':container.close();break;
   case 'end':Object.assign(out.at(-1),{inventory:inv.main.map(json),cursor:json(inv.cursor),armor:inv.armor.map(json),current:inv.current,slots:container.slots.map(s=>json(s.stack)),results,drops:drops.map(json),broken});break;
   default:throw new Error('Unknown inventory script line: '+line);
  }
 }
 return out;
}
