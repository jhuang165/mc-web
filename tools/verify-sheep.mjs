// Records EntitySheep facts from the unchanged original classes
// (tools/probes/SheepProbe.java) in public/research/sheep-reference.json;
// src/sheep.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'sheep-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/SheepProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SheepProbe'],{maxBuffer:1<<24});
const facts=JSON.parse(stdout);
assert.equal(facts.mix.length,256);assert.equal(facts.fleeceColors.length,16);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wp:'EntitySheep',afe:'CraftingManager',aae:'InventoryCrafting'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration. fleeceColors is EntitySheep.fleeceColorTable (rgb floats by wool metadata). colorRolls are func_70895_a(Random) for consecutive draws from java.util.Random(42). mix[a*16+b] is the child fleece colour for parents a and b: 15 - the dye damage of the 2 x 1 crafting result, or -1 when no recipe matches (the child takes a random parent colour).',
 ...facts};
await writeFile(path.join(root,'../public/research/sheep-reference.json'),JSON.stringify(reference)+'\n');
const counts={};for(const v of facts.colorRolls.values)counts[v]=(counts[v]||0)+1;
console.log('colour rolls',JSON.stringify(counts),'mixes',facts.mix.filter(v=>v>=0).length);
