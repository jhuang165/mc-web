// Extract original crafting and smelting registries and sampled matching. Same local JDK/JAR requirements as verify-creative.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'recipe-catalogue-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/CatalogueProbe.java'),path.join(root,'probes/RecipeCatalogueProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'RecipeCatalogueProbe'],{maxBuffer:1<<24});
const records=stdout.trim().split('\n').map(JSON.parse);
const byKind=kind=>records.filter(r=>r.kind===kind).map(({kind,...r})=>r);
const crafting=byKind('crafting'),smelting=byKind('smelting'),smeltingXp=byKind('smeltingXp'),samples=byKind('sample');
assert.deepEqual([crafting.length,smelting.length,smeltingXp.length,samples.length],[317,22,22,2756], 'Pinned native recipe/sample counts');
assert.deepEqual(crafting.map(r=>r.index),crafting.map((_,i)=>i));
assert.deepEqual(['shaped','shapeless','special'].map(t=>crafting.filter(r=>r.type===t).length),[258,54,5]);
assert.equal(new Set(samples.map(s=>s.recipe)).size,312, 'Every fixed recipe has a native sample');
for(const r of crafting){
 if(r.type==='shaped')assert.equal(r.ingredients.length,r.width*r.height);
 if(r.type!=='special')assert(r.declaredOutput && r.declaredOutput.count>0);
}
for(const sample of samples){
 assert.equal(sample.cells.length,sample.size*sample.size);
 assert(crafting[sample.recipe].type!=='special');
 assert(sample.result,`Fixed native recipe ${sample.recipe} must match its sampled grid`);
}
for(const r of smelting){assert(r.sample.output);assert.equal(r.sample.input.damage,r.input.damage===32767?0:r.input.damage);}
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={afe:'CraftingManager',afg:'IRecipe',afh:'ShapedRecipes',afi:'ShapelessRecipes',afa:'FurnaceRecipes',aae:'InventoryCrafting',aeu:'RecipesArmorDyes',aew:'RecipeBookCloning',aey:'RecipeFireworks',afb:'RecipesMapCloning',afc:'RecipesMapExtending'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original CraftingManager sorted list and recipe object fields read by reflection; list indexes preserve dispatch precedence. Exact ShapedRecipes/ShapelessRecipes distinguished from special classes (including shaped subclasses). Null output/ingredients on dynamic recipes retained. Ingredients retain wildcard damage 32767, counts, empty cells and NBT; shaped copy-NBT flag retained. Fixed-recipe examples execute original CraftingManager.findMatchingRecipe with null world, single-count stacks and wildcard damage 0 at every fitting offset/mirror in 2x2/3x3 grids. Shapeless recipes use compact layouts, not exhaustive permutations. Special recipes and the manager repair shortcut require separate semantic cases. Full FurnaceRecipes input/result map and separate output/XP map extracted; maps sorted by stack representation for reproducibility, not native iteration order. Original furnace result/XP lookups also executed for each exact input or wildcard input with damage zero. This is registration and sampled matching evidence, not full recipe/container acceptance.',
 crafting,smelting,smeltingXp,samples};
await writeFile(path.join(root,'../public/research/recipe-registry-reference.json'),JSON.stringify(reference)+'\n');
console.log(JSON.stringify({crafting:crafting.length,types:crafting.reduce((a,r)=>(a[r.type]=(a[r.type]||0)+1,a),{}),smelting:smelting.length,smeltingXp:smeltingXp.length,samples:samples.length}));
