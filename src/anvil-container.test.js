import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnvilContainer, liveStackToNative, nativeStackToLive } from './anvil-container.js';
import { makeStack } from './inventory.js';
import { Survival } from './survival.js';

const playerInventory = () => new Survival({}, 'survival').inventory;
const pick = (damage=0, extras={}) => makeStack(103,1,damage,undefined,extras); // diamond pickaxe -> native 278

test('live/native stack adapters preserve supported anvil tags and book aliases',()=>{
 const stack=pick(12,{repairCost:7,displayName:'Deep miner',enchantments:[{id:32,lvl:3}],unbreakable:false,color:0x1265af});
 assert.deepEqual(liveStackToNative(stack),{id:278,count:1,damage:12,repairCost:7,displayName:'Deep miner',enchantments:[{id:32,lvl:3}],unbreakable:false,color:0x1265af});
 assert.deepEqual(nativeStackToLive(liveStackToNative(stack)),stack);
 const book=makeStack(365,1,0,[{id:16,lvl:2}]);
 assert.deepEqual(liveStackToNative(book).storedEnchantments,[{id:16,lvl:2}]);
 assert.deepEqual(nativeStackToLive(liveStackToNative(book)),makeStack(365,1,0,[{id:16,lvl:2}],{storedEnchantments:[{id:16,lvl:2}]}));
});

test('rename updates a live result, charges levels, preserves metadata and calls block-use hook',()=>{
 const paid=[],used=[],changed=[];
 const anvil=new AnvilContainer({inventory:playerInventory(),experienceLevel:()=>30,payExperienceLevels:n=>paid.push(n),itemName:s=>s.id===278?'Diamond Pickaxe':'item',onUse:e=>used.push(e),onInputChanged:e=>changed.push(e)});
 anvil.setInput(0,pick(23,{repairCost:4,enchantments:[{id:32,lvl:2}],unbreakable:true}));
 anvil.setName('Miner');
 assert.equal(anvil.output.displayName,'Miner');assert.equal(anvil.output.damage,23);assert.equal(anvil.output.repairCost,2);
 assert.equal(anvil.maximumCost,12);assert.equal(anvil.tooExpensive,false);assert.equal(anvil.canTake(),true);
 const result=anvil.takeOutput();
 assert.equal(result.displayName,'Miner');assert.deepEqual(result.enchantments,[{id:32,lvl:2}]);assert.equal(result.unbreakable,true);
 assert.deepEqual(paid,[12]);assert.deepEqual(used,[{stack:result,cost:12,creative:false}]);
 assert.equal(anvil.inputs.getStack(0),null);assert.equal(changed.length,2);
});

test('dyed leather survives native anvil rename and repair metadata updates',()=>{
 const anvil=new AnvilContainer({inventory:playerInventory(),experienceLevel:()=>30,payExperienceLevels:()=>{}});
 anvil.setInput(0,makeStack(400,1,0,undefined,{color:0x193f77,repairCost:4}));
 anvil.setName('Blue cap');
 assert.equal(anvil.output.id,400);assert.equal(anvil.output.color,0x193f77);assert.equal(anvil.output.displayName,'Blue cap');
 const result=anvil.takeOutput();assert.equal(result.color,0x193f77);assert.equal(result.displayName,'Blue cap');assert.equal(result.repairCost,2);
 const repair=new AnvilContainer({inventory:playerInventory(),experienceLevel:()=>30,payExperienceLevels:()=>{}});
 repair.setInput(0,makeStack(400,1,20,undefined,{color:0x193f77}));
 repair.setInput(1,makeStack(315,2));
 assert.equal(repair.output.damage,0);assert.equal(repair.output.color,0x193f77);
 assert.equal(repair.takeOutput().color,0x193f77);assert.equal(repair.inputs.getStack(1),null);
});

test('material repairs consume only the used material count and refresh output',()=>{
 const paid=[],used=[],inventory=playerInventory();
 const anvil=new AnvilContainer({inventory,experienceLevel:()=>50,payExperienceLevels:n=>paid.push(n),onUse:e=>used.push(e)});
 anvil.setInput(0,makeStack(115,1,800,undefined,{repairCost:3})); // diamond sword -> native 276
 anvil.setInput(1,makeStack(303,4)); // diamond -> native 264
 assert.ok(anvil.output);assert.equal(anvil.output.damage,0);
 assert.equal(anvil.stackSizeToBeUsedInRepair,3);assert.equal(anvil.canTake(),true);
 const cost=anvil.maximumCost;
 const result=anvil.takeOutput();
 assert.equal(result.damage,0);assert.equal(anvil.inputs.getStack(0),null);assert.equal(anvil.inputs.getStack(1).count,1);
 assert.equal(paid[0],cost);
 assert.equal(used.length,1);assert.equal(used[0].creative,false);
});

test('container click and shift-click take the result, while close drops cursor and both inputs',()=>{
 const used=[],inv=playerInventory(),anvil=new AnvilContainer({inventory:inv,experienceLevel:()=>40,payExperienceLevels:()=>{},onUse:e=>used.push(e)});
 anvil.setInput(0,pick());anvil.setName('Shifted');
 const cost=anvil.maximumCost;
 const shifted=anvil.click(2,0,1);
 assert.equal(shifted.displayName,'Shifted');assert.equal(inv.main[8].displayName,'Shifted');assert.equal(used.length,1);assert.equal(used[0].cost,cost);
 anvil.setInput(0,pick(4));anvil.setInput(1,makeStack(302,2));
 inv.cursor=makeStack(4,3);anvil.close();
 assert.equal(anvil.drops.length,3);assert.deepEqual(anvil.drops.map(s=>s.count).sort((a,b)=>a-b),[1,2,3]);
 assert.equal(anvil.inputs.getStack(0),null);assert.equal(anvil.inputs.getStack(1),null);
});

test('input shift-clicks move to player inventory and player shift-clicks move into the first input',()=>{
 const inv=playerInventory(),anvil=new AnvilContainer({inventory:inv,experienceLevel:()=>0});
  anvil.setInput(0,makeStack(4,5));
  anvil.transfer(0);
  assert.equal(anvil.inputs.getStack(0),null);assert.equal(inv.main[9].count,5);
  inv.main[0]=makeStack(302,2);
  anvil.transfer(30);
  assert.equal(inv.main[0],null);assert.equal(anvil.inputs.getStack(0).id,302);assert.equal(anvil.inputs.getStack(0).count,2);
 anvil.setInput(0,pick());anvil.setName('Costly');
 assert.equal(anvil.canTake(),false);anvil.click(2,0,0);assert.equal(inv.cursor,null);assert.ok(anvil.output);
});

test('shift-clicking a renamed stackable result transfers what fits, then consumes the operation',()=>{
 const inv=playerInventory(),used=[],anvil=new AnvilContainer({inventory:inv,experienceLevel:()=>40,onUse:e=>used.push(e)});
 for(let i=0;i<inv.main.length;i++)inv.main[i]=makeStack(4,64);
 inv.main[0]=makeStack(303,60,0,undefined,{displayName:'Shiny',repairCost:2}); // diamonds
 anvil.setInput(0,makeStack(303,64));anvil.setName('Shiny');
 assert.equal(anvil.output.count,64);assert.equal(anvil.maximumCost,39);
 const transferred=anvil.transfer(2);
 assert.equal(transferred.count,64);assert.equal(inv.main[0].count,64);
 assert.equal(anvil.inputs.getStack(0),null);assert.equal(used.length,1);assert.equal(used[0].cost,39);
});
