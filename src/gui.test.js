import {test} from 'node:test';import assert from 'node:assert/strict';import {guiScale,stackCount} from './gui.js';
import {tooltipLines} from './gui.js';
import {anvilName,anvilCost} from './gui.js';
import {pendingContainerStacks} from './gui.js';
test('save snapshots preserve anvil inputs and cursor tags without duplicating the calculated result',()=>{
 const input={id:102,count:1,damage:20,enchantments:[{id:34,lvl:2}],displayName:'Saved pick'};
 const view={kind:'anvil',container:{inv:{cursor:{id:302,count:2,damage:0}},inputs:{stacks:[input,null]},output:{...input,damage:0}}};
 const pending=pendingContainerStacks(view);assert.equal(pending.length,2);assert.equal(pending[1].damage,20);
 pending[1].enchantments[0].lvl=5;assert.equal(input.enchantments[0].lvl,2);
 assert.deepEqual(pendingContainerStacks(null),[]);
});
test('repair screen filters its name field and distinguishes excessive and unaffordable costs',()=>{
 assert.equal(anvilName('A\nB\u00a7c\u007f'), 'ABc');assert.equal(anvilName('x'.repeat(41)).length,40);
 assert.deepEqual(anvilCost({maximumCost:40,tooExpensive:true}),{text:'Too Expensive!',unavailable:true});
 assert.deepEqual(anvilCost({maximumCost:7,output:{},canTake:()=>false}),{text:'Enchantment Cost: 7',unavailable:true});
 assert.deepEqual(anvilCost({maximumCost:7,output:{},canTake:()=>true}),{text:'Enchantment Cost: 7',unavailable:false});
 assert.equal(anvilCost({maximumCost:7,output:null}).text,'');
});
test('preserved item metadata appears in tooltips without duplicating the legacy book alias',()=>{
 const item={name:'Iron sword',attack:6,durability:250};
 const stack={damage:10,displayName:'<Moon & Stars>',enchantments:[{id:16,lvl:2},{id:255,lvl:1}],unbreakable:true};
 const lines=tooltipLines(item,stack,true);
 assert.deepEqual(lines[0],{text:'<Moon & Stars>',italic:true,color:'aqua'});
 assert.deepEqual(lines.map(l=>l.text),['<Moon & Stars>','Sharpness II','','+6 Attack Damage','Unbreakable','Durability: 240 / 250']);
 const stored=[{id:34,lvl:3}],book=tooltipLines({name:'Enchanted Book',storesEnchantments:true},{damage:0,stored,storedEnchantments:stored});
 assert.deepEqual(book,[{text:'Enchanted Book',color:'yellow'},{text:'Unbreaking III',color:'gray'}]);
 assert.equal(tooltipLines(item,{damage:0,displayName:''})[0].text,'');
});
test('GUI scaling keeps integer pixels and the original minimum 320 by 240 logical resolution',()=>{assert.equal(guiScale(740,988),2);assert.equal(guiScale(1280,720),3);assert.equal(guiScale(1920,1080),4);assert.equal(guiScale(375,667),1);assert.equal(guiScale(1280,720,2),2);assert.equal(guiScale(740,988,4),2);});
test('native stack overlays omit singletons and empty stacks',()=>{for(const n of [0,1,undefined,NaN])assert.equal(stackCount(n),'');assert.equal(stackCount(64),'<b class="item-count">64</b>');assert.equal(stackCount(4),'<b class="item-count">4</b>');});
test('durability bars follow RenderItem: hidden when undamaged, green to red, shrinking from 13 pixels',async()=>{const {durabilityBar,tooltipLines}=await import('./gui.js');assert.equal(durabilityBar(0,59),'');assert.match(durabilityBar(1,59),/--bar:13;--bar-color:rgb\(4,251,0\);--bar-shade:rgb\(1,63,0\)/);assert.match(durabilityBar(30,59),/--bar:6;--bar-color:rgb\(130,125,0\)/);assert.match(durabilityBar(59,59),/--bar:0;--bar-color:rgb\(255,0,0\);--bar-shade:rgb\(63,63,0\)/);
 assert.deepEqual(tooltipLines({name:'Iron sword',attack:6,durability:250},{damage:10},true).map(l=>l.text),['Iron sword','','+6 Attack Damage','Durability: 240 / 250']);assert.deepEqual(tooltipLines({name:'Dirt'},{damage:0},true).map(l=>l.text),['Dirt']);});
test('save snapshots keep the enchanting table input and the cursor',()=>{
 const input={id:102,count:1,damage:3};
 const view={kind:'enchanting',container:{inv:{cursor:{id:302,count:2,damage:0}},inputs:{stacks:[input]}}};
 const pending=pendingContainerStacks(view);assert.equal(pending.length,2);assert.equal(pending[1].id,102);
 assert.notEqual(pending[1],input);
});
