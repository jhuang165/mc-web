// Captures bounded EntityVillager offer-generation seeds plus unchanged MerchantRecipe use rules.
// The fixture output is replayed by src/villager-trading.test.js.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile), root=path.dirname(fileURLToPath(import.meta.url)), exists=p=>access(p).then(()=>true,()=>false);
const dirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const d of dirs)if(await exists(path.join(d,'minecraft-1.7.10.jar'))){research=d;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function lib(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const d of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(d))continue;const {stdout}=await exec('find',[d,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(lib));
const out=path.join(research,'villager-trading-probe'), classes=path.join(out,'classes'), probe=path.join(out,'probe');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/VillagerTradingProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'VillagerTradingProbe'],{maxBuffer:1<<26});
const rows=stdout.trim().split('\n').filter(s=>s.startsWith('{')).map(JSON.parse);
const matching=rows.find(r=>r.kind==='matching'), recipeUse=rows.find(r=>r.kind==='recipeUse'), replacement=rows.find(r=>r.kind==='replacement'), preference=rows.find(r=>r.kind==='preference');
assert.ok(matching&&recipeUse&&replacement&&preference);assert.equal(matching.results.length,6);assert.equal(recipeUse.afterUses.length,7);assert.equal(replacement.rows.length,4);assert.equal(preference.results.length,5);
const sha=async c=>createHash('sha256').update((await exec('unzip',['-p',jar,c+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classesRef={};for(const [c,name] of [['ago','MerchantRecipeList'],['agn','MerchantRecipe']])classesRef[c]={name,sha256:await sha(c)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classesRef,
 method:'Unchanged MerchantRecipeList.a(add,add,int) matching, MerchantRecipe.f/a(int)/g/h use-state changes, MerchantRecipe NBT write/read, and MerchantRecipeList.a(agn) replacement were executed directly. Matching uses native Item identity and count rules; metadata and stack-tag fixtures show both are ignored. Positive index checks one recipe only; zero/negative searches in order.',
 matching,recipeUse,replacement,preference};
await writeFile(path.join(root,'../public/research/villager-trading-reference.json'),JSON.stringify(reference)+'\n');
console.log(`native matching ${matching.results.length}, use states ${recipeUse.afterUses.length}, replacements ${replacement.rows.length}`);
