// Records dye, flower and wool-dyeing facts from the unchanged original classes
// (tools/probes/DyeProbe.java) in public/research/dyes-reference.json;
// src/dyes.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dye-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/DyeProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'DyeProbe'],{maxBuffer:1<<24});
const facts=JSON.parse(stdout);
assert.equal(facts.dyeTextures.length,16);assert.equal(facts.universe.length,44);assert.equal(facts.flowerChoice.plains.results.length,4000);assert.equal(facts.noise.values.length,1500);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={acj:'ItemDye',aex:'RecipesDyes',afe:'CraftingManager',alc:'BlockFlower',ahu:'BiomeGenBase',aip:'BiomeGenPlains',awl:'NoiseGeneratorPerlin',awo:'NoiseGeneratorSimplex',aka:'BlockColored'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration. universe lists [item id, damage] (dyes 0-15, dandelion, red flowers 0-8, wool 0-15, bone, stone). recipes holds every non-empty CraftingManager.findMatchingRecipe result for 1-3 universe items in a 3x3 grid (multisets, indices into universe, in enumeration order) and every 4-item multiset of dyes and bone: [[indices],[result id,count,damage]]. flowerChoice is BiomeGenBase.func_150572_a for ocean (base) and plains over seeded Random draws: [block id, metadata]. noise is BiomeGenBase.ad (Perlin, 1 octave) at (x/200, z/200).',
 ...facts};
await writeFile(path.join(root,'../public/research/dyes-reference.json'),JSON.stringify(reference)+'\n');
console.log('recipes',facts.recipes.length,'tulips',facts.flowerChoice.plains.results.filter(r=>r[1]>=4&&r[0]===38).length);
