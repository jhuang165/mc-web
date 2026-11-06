// Runs tools/probes/FoodItemsProbe.java against the unchanged 1.7.10 classes and records the result in
// public/research/food-items-reference.json (pumpkin pie, enchanted golden apple, monster egg variants 97:3-5);
// src/food-items.test.js replays it against the browser build. Needs a JDK, minecraft-1.7.10.jar (MC_RESEARCH or
// tools/research) and the guava, log4j-api, commons-lang3, netty-all, commons-io and authlib JARs (MC_PROBE_LIBS or a
// local launcher/Gradle cache), like tools/verify-item-names.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'food-items-probe'),clientSha1='e80d9b3bf5085002218d4be59e668bac718abbc6';
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),clientSha1);
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-','commons-io-','authlib-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/FoodItemsProbe.java')],{maxBuffer:1<<24}).catch(e=>{if(/error:/.test(e.stderr))throw e;});
const {stdout}=await exec('java',['-cp',cp,'FoodItemsProbe'],{maxBuffer:1<<24});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const of=kind=>rows.filter(r=>r.kind===kind);
const items=of('item'),blocks=of('block');
assert.equal(items.length,3);assert.equal(blocks.length,7);assert.equal(of('craft').length,6);
// Sanity checks on the facts the browser build relies on.
const [pie,apple,notch]=items;
assert.deepEqual([pie.heal,pie.saturationModifier,pie.useDuration,pie.maxStackSize],[8,0.3,32,64]);
assert.equal(pie.alwaysEdible,false);
assert.deepEqual([apple.heal,apple.saturationModifier,apple.alwaysEdible,apple.glint,notch.glint],[4,1.2,true,false,true]);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={acx:'ItemFood',acy:'ItemAppleGold',amb:'BlockSilverfish',adl:'ItemMultiTexture',auw:'StructureStrongholdPieces$Stones'};
for(const row of items)row.itemStackLimit=row.maxDamage,delete row.maxDamage;
const reference={target:'Minecraft Java 1.7.10',clientSha1,classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration. ItemFood fields and ItemStack facts are read directly; ItemFood/ItemAppleGold.onFoodEaten run against a WorldServer and EntityPlayer allocated without constructors (the player subclass only records addPotionEffect), the potion roll 1000 times; FoodStats.addStats starts from food 0; recipes go through CraftingManager.findMatchingRecipe; BlockSilverfish metadata 0-6 is read through getSubBlocks, ItemStack names, getIcon with a recording icon register, damageDropped, quantityDropped, createStackedBlock and func_150195_a/func_150196_a/func_150197_b. StructureStrongholdPieces.Stones.selectBlocks was read from bytecode (strongholdStones below), not run.',
 strongholdStones:{thresholds:[[0.2,'stonebrick',2],[0.5,'stonebrick',1],[0.55,'monster_egg',2]],otherwise:['stonebrick',0],note:'only monster egg metadata 2 is generated; 97:3-5 appear only through silverfish hiding, Creative and commands'},
 items,subItems:of('subItems')[0],crafting:of('craft'),recipeCount:of('recipeCount')[0].recipesWithOutput322or400,blockInfo:of('blockInfo')[0],blocks,containment:of('containment')[0].cases};
await writeFile(path.join(root,'../public/research/food-items-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`PASS: ${items.length} items, ${blocks.length} monster egg metadata values, ${reference.crafting.length} crafting grids from the original bytecode.`);
