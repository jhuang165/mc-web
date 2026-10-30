import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {replay} from '../tools/inventory-replay.mjs';
import {Survival} from './survival.js';
import {ContainerScreen,OUTSIDE,makeStack} from './inventory.js';

test('every inventory script matches the unchanged original 1.7.10 classes',async()=>{
 const reference=JSON.parse(await readFile(new URL('../public/research/inventory-reference.json',import.meta.url)));
 assert.equal(reference.clientSha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
 const actual=replay(reference.script);assert.equal(actual.length,reference.cases.length);assert.ok(actual.length>=46);
 for(let i=0;i<actual.length;i++)assert.deepEqual(actual[i],reference.cases[i],reference.cases[i].case);
});

function screen(slots){const p=new Survival({slots}),c=p.openInventory();return{p,c,inv:p.inventory,gui:new ContainerScreen(c),slot:n=>c.slots[n]};}
test('a press picks up immediately and the matching release is ignored',()=>{
 const {inv,gui,slot}=screen([null,null,null,null,null,null,null,null,null,makeStack(4,10)]);
 gui.down(slot(9),0,{time:0});assert.deepEqual(inv.cursor,makeStack(4,10));gui.up(slot(9),0);assert.deepEqual(inv.cursor,makeStack(4,10));
 gui.down(slot(10),1,{time:1000});gui.up(slot(10),1);assert.deepEqual(inv.main[10],makeStack(4,1));assert.equal(inv.cursor.count,9);
});
test('left and right drags split the cursor like GuiContainer, with a preview',()=>{
 const {inv,gui,slot}=screen([...Array(9).fill(null),makeStack(4,64)]);
 gui.down(slot(9),0,{time:0});gui.up(slot(9),0);
 gui.down(slot(10),0,{time:1000});for(const n of [10,11,12])gui.move(slot(n));
 const {slots,cursor}=gui.preview();assert.equal(slots.get(slot(11)).count,21);assert.equal(cursor.count,1);
 gui.up(slot(12),0);assert.deepEqual([10,11,12].map(i=>inv.main[i].count),[21,21,21]);assert.deepEqual(inv.cursor,makeStack(4,1));
 gui.down(slot(13),1,{time:2000});gui.up(slot(13),1);assert.equal(inv.cursor,null);assert.equal(inv.main[13].count,1);
});
test('a quick second click collects matching stacks; a release on another button cancels a drag',()=>{
 const {inv,gui,slot}=screen([makeStack(4,30),...Array(8).fill(null),makeStack(4,10),makeStack(4,20)]);
 gui.down(slot(9),0,{time:0});gui.up(slot(9),0);gui.down(slot(9),0,{time:100});gui.up(slot(9),0);
 assert.deepEqual(inv.cursor,makeStack(4,60));assert.equal(inv.count(4),0);
 gui.down(slot(12),0,{time:1000});gui.move(slot(12));gui.move(slot(13));gui.up(slot(13),1);assert.deepEqual(inv.cursor,makeStack(4,60));
});
test('shift double-click shift-clicks every matching stack, but only while the clicked slot still holds one',()=>{
 const emptied=screen([...Array(9).fill(null),makeStack(4,10),makeStack(4,20)]);
 emptied.gui.down(emptied.slot(9),0,{shift:true,time:0});emptied.gui.up(emptied.slot(9),0,{shift:true});
 emptied.gui.down(emptied.slot(9),0,{shift:true,time:100});emptied.gui.up(emptied.slot(9),0,{shift:true});
 assert.deepEqual(emptied.inv.main[0],makeStack(4,10));assert.deepEqual(emptied.inv.main[10],makeStack(4,20));
 const {inv,gui,slot}=screen([...Array(8).fill(0).map(()=>makeStack(2,64)),makeStack(4,60),makeStack(4,10),makeStack(4,20),makeStack(3,5)]);
 gui.down(slot(9),0,{shift:true,time:0});gui.up(slot(9),0,{shift:true});assert.deepEqual([inv.main[8].count,inv.main[9].count],[64,6]);
 gui.down(slot(9),0,{shift:true,time:100});gui.up(slot(9),0,{shift:true});
 assert.equal(inv.main[8],null);assert.deepEqual(inv.main.slice(9,12),[makeStack(4,64),makeStack(4,26),makeStack(3,5)]);
});
test('hotbar and drop keys act on the hovered slot; clicking outside throws the cursor',()=>{
 const {inv,c,gui,slot}=screen([...Array(9).fill(null),makeStack(4,10)]);
 assert.equal(gui.hotbarKey(slot(9),2),true);assert.deepEqual(inv.main[2],makeStack(4,10));
 gui.dropKey(slot(38));gui.dropKey(slot(38),true);assert.deepEqual(c.drops,[makeStack(4,1),makeStack(4,9)]);
 inv.main[9]=makeStack(3,3);gui.down(slot(9),0,{time:0});gui.up(slot(9),0);gui.down(null,1,{outside:true,time:1000});gui.up(null,1,{outside:true});
 assert.deepEqual(c.drops.at(-1),makeStack(3,1));assert.equal(inv.cursor.count,2);assert.equal(OUTSIDE,-999);
});
test('closing the inventory throws the cursor and crafting grid, like the original container',()=>{
 const {inv,c}=screen([makeStack(4,3)]);c.click(36,0,0);c.click(1,1,0);c.close();
 assert.deepEqual(c.drops,[makeStack(4,2),makeStack(4,1)]);assert.equal(inv.cursor,null);assert.equal(c.result.stack,null);
});
