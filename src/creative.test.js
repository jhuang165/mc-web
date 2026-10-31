import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {MC_IDS} from '../tools/inventory-replay.mjs';
import {Survival,ITEMS} from './survival.js';
import {OUTSIDE,makeStack} from './inventory.js';
import {CREATIVE_TABS,SEARCH,SURVIVAL_TAB,SEARCH_ORDER,CreativeScreen,TextField,tabArea,overTab,overTabLabel,itemTab,entryId,resetCreativeTab} from './creative.js';

const reference=JSON.parse(await readFile(new URL('../public/research/creative-reference.json',import.meta.url)));
// Original [id, metadata] to game item; unimplemented items drop out.
// Wool (35) keeps its colour as the stack's damage: a list entry is [19,colour], or 19 for white.
const game=([id,meta])=>id===35?(meta?[19,meta]:19):id===38||id===351?(meta?[MC_IDS[id],meta]:MC_IDS[id]):MC_IDS[id+':'+meta]??(meta===0?MC_IDS[id]:undefined);
const names=s=>[ITEMS[s.id].name];

test('tabs keep the original order, placement and implemented contents',()=>{
 assert.equal(reference.clientSha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
 assert.equal(reference.tabs.length,CREATIVE_TABS.length);
 for(const r of reference.tabs){
  const t=CREATIVE_TABS[r.index];
  assert.deepEqual([t.label,t.background,t.column,t.topRow,t.scrollbar,t.title],[r.label,r.background,r.column,r.topRow,r.scrollbar,r.title],r.label);
  if(t.icon.id)assert.equal(t.icon.id,game(r.icon),r.label);
  if(t!==SEARCH)assert.deepEqual(t.items,r.items.map(game).filter(Boolean),r.label);
 }
 assert.deepEqual(SEARCH_ORDER,reference.tabs[5].items.map(game).filter(Boolean));
 const key=e=>[].concat(e).join(':'),listed=new Set(CREATIVE_TABS.flatMap(t=>t.items).map(key));
 assert.deepEqual([...listed].sort(),[...new Set(SEARCH_ORDER.map(key))].sort());
 assert.equal(itemTab(11).label,'buildingBlocks');assert.equal(itemTab(19).label,'buildingBlocks');assert.equal(itemTab(119).label,'combat');
});

test('tab art and click boxes follow drawTab and func_147049_a',()=>{
 assert.deepEqual(tabArea(CREATIVE_TABS[0],true),{x:0,y:-28,u:0,v:32,iconX:6,iconY:-19});
 assert.deepEqual(tabArea(CREATIVE_TABS[2]),{x:58,y:-28,u:56,v:0,iconX:64,iconY:-19});
 assert.deepEqual(tabArea(SEARCH),{x:167,y:-28,u:140,v:0,iconX:173,iconY:-19});
 assert.deepEqual(tabArea(CREATIVE_TABS[9],true),{x:87,y:132,u:84,v:96,iconX:93,iconY:139});
 // The last column's click box starts two pixels right of its art; boxes are inclusive.
 assert.ok(!overTab(SEARCH,168,-10)&&overTab(SEARCH,169,-10)&&overTab(SEARCH,197,-32)&&overTab(SEARCH,197,0));
 assert.ok(overTab(SURVIVAL_TAB,180,136)&&overTab(SURVIVAL_TAB,180,168)&&!overTab(SURVIVAL_TAB,180,135));
 assert.ok(!overTabLabel(CREATIVE_TABS[0],1,-20)&&overTabLabel(CREATIVE_TABS[0],2,-30)&&overTabLabel(CREATIVE_TABS[0],26,-2)&&!overTabLabel(CREATIVE_TABS[0],27,-2));
});

function open(slots=[],tab=0){
 resetCreativeTab();
 const p=new Survival({slots},'creative'),gui=new CreativeScreen(p.inventory,{playerContainer:()=>p.openInventory(),tooltip:names});
 gui.setTab(CREATIVE_TABS[tab]);
 return {p,gui,inv:p.inventory,c:gui.container,slot:n=>gui.container.slots[n]};
}

test('item tab clicks copy, count and delete stacks like handleMouseClick',()=>{
 const {inv,gui,slot}=open();
 assert.deepEqual(slot(0).stack,makeStack(3,1));
 gui.down(slot(0),0,{time:0});gui.up(slot(0),0);assert.deepEqual(inv.cursor,makeStack(3,1));
 // With a stack held, the click lands on release.
 gui.down(slot(0),0,{time:1000});assert.equal(inv.cursor.count,1);gui.up(slot(0),0);assert.equal(inv.cursor.count,2);
 gui.down(slot(0),1,{time:2000});gui.up(slot(0),1);assert.equal(inv.cursor.count,1);
 gui.down(slot(0),1,{time:3000});gui.up(slot(0),1);assert.equal(inv.cursor,null);
 gui.down(slot(1),0,{shift:true,time:4000});assert.deepEqual(inv.cursor,makeStack(1,64));gui.up(slot(1),0);
 // A different item on the cursor is deleted; the grid never changes.
 gui.down(slot(2),0,{time:5000});gui.up(slot(2),0);assert.equal(inv.cursor,null);assert.deepEqual(slot(1).stack,makeStack(1,1));
 gui.down(slot(2),2,{time:6000});assert.deepEqual(inv.cursor,makeStack(2,64));gui.up(slot(2),2);
 gui.down(slot(45),0,{time:7000});gui.up(slot(45),0);assert.deepEqual(inv.main[0],makeStack(2,64));assert.equal(inv.cursor,null);
 assert.ok(gui.hotbarKey(slot(3),4));assert.deepEqual(inv.main[4],makeStack(12,64));
 gui.dropKey(slot(3));gui.dropKey(slot(3),true);assert.deepEqual(gui.container.drops,[makeStack(12,1),makeStack(12,64)]);
 // Shift-clicking a hotbar slot clears it.
 gui.down(slot(49),0,{shift:true,time:8000});gui.up(slot(49),0);assert.equal(inv.main[4],null);
});

test('clicking outside throws the cursor, one item for the right button',()=>{
 const {inv,gui,c,slot}=open();
 gui.down(slot(0),0,{shift:true,time:0});gui.up(slot(0),0);
 gui.down(null,1,{outside:true,time:1000});gui.up(null,1,{outside:true});
 assert.equal(inv.cursor.count,63);assert.deepEqual(c.drops,[makeStack(3,1)]);
 gui.down(null,0,{outside:true,time:2000});gui.up(null,0,{outside:true});
 assert.equal(inv.cursor,null);assert.deepEqual(c.drops[1],makeStack(3,63));
 // Inside the screen but over no slot, the cursor is thrown as well.
 gui.down(slot(0),0,{time:3000});gui.up(slot(0),0);gui.down(null,0,{time:4000});gui.up(null,0);
 assert.equal(inv.cursor,null);assert.deepEqual(c.drops[2],makeStack(3,1));
});

test('scrolling moves the 9 x 5 window one row per notch and with the scrollbar',()=>{
 const {gui,c,slot}=open([],SEARCH.index);
 assert.equal(c.list.length,SEARCH_ORDER.length);assert.ok(gui.needsScroll());
 // 158 search entries: rows = floor(158 / 9) - 5 + 1 = 13
 // (integer division, as GuiContainerCreative), so each notch moves 1/13; at full scroll the window starts at
 // entry 13 * 9 = 117, slot n shows entry 117 + n, the last entry (157) sits in slot 40 and slot 41 is empty.
 assert.equal(c.rows(),13);
 gui.wheel(-1);gui.wheel(-1);
 assert.equal(gui.scroll,Math.fround(Math.fround(1/13)+1/13));assert.equal(gui.scrollbarY(),32);assert.equal(slot(0).stack.id,entryId(SEARCH_ORDER[18]));
 gui.wheel(1);assert.equal(slot(0).stack.id,entryId(SEARCH_ORDER[9]));
 for(let i=0;i<20;i++)gui.wheel(-1);
 assert.equal(gui.scroll,1);assert.equal(gui.scrollbarY(),113);assert.equal(slot(27).stack.id,entryId(SEARCH_ORDER[144]));
 assert.equal(SEARCH_ORDER.length,158);assert.equal(slot(40).stack.id,entryId(SEARCH_ORDER[157]));assert.equal(slot(41).stack,null);
 gui.press(176,60);assert.ok(gui.scrolling);gui.drag(25.5);assert.equal(gui.scroll,0);
 gui.drag(18+7.5+97/2);assert.equal(gui.scroll,.5);gui.release();gui.drag(200);assert.equal(gui.scroll,.5);
 gui.press(174,60);assert.ok(!gui.scrolling);
 // Building Blocks fits in five rows here, so nothing scrolls.
 gui.setTab(CREATIVE_TABS[0]);gui.wheel(-1);assert.equal(gui.scroll,0);assert.ok(!gui.needsScroll());
});

test('search filters tooltips; T opens it and the first key after a click clears it',()=>{
 const {gui,c,slot}=open();
 assert.ok(!gui.typed({code:'KeyE',key:'e'},null));
 assert.ok(gui.typed({code:'KeyT',key:'t'},null));assert.equal(gui.tab,SEARCH);
 for(const key of 'SWO')gui.typed({code:'Key'+key,key},null);
 assert.equal(gui.field.text,'SWO');
 assert.deepEqual(c.list.map(s=>s.id),SEARCH_ORDER.filter(e=>ITEMS[entryId(e)].name.toLowerCase().includes('swo')).map(entryId));
 // Digits act on the hovered slot first, otherwise they are typed.
 assert.ok(gui.typed({code:'Digit3',key:'3'},slot(0)));assert.equal(gui.field.text,'SWO');assert.equal(gui.inv.main[2].id,c.list[0].id);
 gui.down(slot(1),0,{time:0});gui.up(slot(1),0);
 gui.typed({code:'KeyE',key:'e'},null);assert.equal(gui.field.text,'e');
 gui.typed({code:'Backspace',key:'Backspace'},null);assert.equal(c.list.length,SEARCH_ORDER.length);
 assert.ok(!gui.typed({code:'Escape',key:'Escape'},null));
});

test('the search field keeps 15 allowed characters and a cursor',()=>{
 const f=new TextField();
 f.write('abc§\u0007def');assert.equal(f.text,'abcdef');
 f.key({key:'ArrowLeft'});f.key({key:'ArrowLeft'});f.key({key:'X'});assert.deepEqual([f.text,f.cursor],['abcdXef',5]);
 f.key({key:'Backspace'});f.key({key:'Delete'});assert.deepEqual([f.text,f.cursor],['abcdf',4]);
 f.key({key:'Home'});assert.equal(f.cursor,0);f.key({key:'End'});assert.equal(f.cursor,5);
 f.write('0123456789xyz');assert.equal(f.text,'abcdf0123456789');
 assert.ok(!f.key({key:'a',ctrl:true}));assert.ok(!f.key({key:'Shift'}));
});

test('the survival tab shows player slots at creative positions, with the bin',()=>{
 const {p,gui,inv,c}=open([makeStack(4,10),...Array(8).fill(null),makeStack(8,5)],SURVIVAL_TAB.index);
 assert.equal(c.slots.length,46);
 assert.deepEqual(c.slots.slice(0,5).map(s=>[s.x,s.y]),Array(5).fill([-2000,-2000]));
 assert.deepEqual(c.slots.slice(5,9).map(s=>[s.x,s.y]),[[9,6],[9,33],[63,6],[63,33]]);
 assert.deepEqual([c.slots[9],c.slots[35],c.slots[36],c.slots[44]].map(s=>[s.x,s.y]),[[9,54],[153,90],[9,112],[153,112]]);
 assert.deepEqual([gui.bin.x,gui.bin.y],[173,112]);assert.ok(c.slots.every(s=>s.number===0));
 assert.ok(gui.overBin(172,111)&&gui.overBin(189,128)&&!gui.overBin(190,120));
 // Clicks go to the player's own container.
 gui.down(c.slots[9],0,{time:0});gui.up(c.slots[9],0);assert.deepEqual(inv.cursor,makeStack(8,5));
 gui.down(c.slots[37],0,{time:1000});gui.up(c.slots[37],0);assert.deepEqual(inv.main[1],makeStack(8,5));
 gui.down(c.slots[36],0,{shift:true,time:2000});gui.up(c.slots[36],0);assert.deepEqual(inv.main[9],makeStack(4,10));
 gui.down(c.slots[9],0,{time:3000});gui.up(c.slots[9],0);
 gui.down(gui.bin,0,{time:4000});gui.up(gui.bin,0);assert.equal(inv.cursor,null);assert.equal(inv.main[9],null);
 gui.dropKey(c.slots[37]);assert.deepEqual(gui.container.drops,[makeStack(8,1)]);assert.equal(inv.main[1].count,4);
 // Shift-clicking the bin clears the whole inventory and armor.
 inv.armor[0]=makeStack(400,1);
 gui.down(gui.bin,0,{shift:true,time:5000});gui.up(gui.bin,0);
 assert.ok(inv.main.every(s=>!s)&&inv.armor.every(s=>!s));
 // Leaving restores the 54 creative slots; the tab is remembered for the next screen.
 gui.setTab(CREATIVE_TABS[7]);assert.equal(c.slots.length,54);assert.equal(c.slots[0].stack.id,110);
 const again=new CreativeScreen(p.inventory,{playerContainer:()=>p.openInventory(),tooltip:names});
 assert.equal(again.tab,CREATIVE_TABS[7]);
});

// The survival tab skips the item tabs' one-item branch: any click outside becomes mode 4 and throws the whole cursor.
test('right-clicking outside in the survival tab throws the whole cursor',()=>{
 const {inv,gui,c}=open([makeStack(4,10)],SURVIVAL_TAB.index);
 gui.down(c.slots[36],0,{time:0});gui.up(c.slots[36],0);
 gui.down(null,1,{outside:true,time:1000});gui.up(null,1,{outside:true});
 assert.equal(inv.cursor,null);assert.deepEqual(c.drops,[makeStack(4,10)]);
 assert.equal(gui.send(null,OUTSIDE,0,0),null);
});
