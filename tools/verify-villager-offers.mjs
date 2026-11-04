// Replays unchanged 1.7.10 EntityVillager.t(int) initial trade generation.
// java.util.Collections' shared shuffle Random is seeded in the probe for repeatable fixtures.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
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
const out=path.join(research,'villager-offers-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','VillagerProbe','VillagerOffersProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['--add-opens=java.base/java.util=ALL-UNNAMED','-cp',cp,'VillagerOffersProbe'],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(s=>s.startsWith('{')).map(JSON.parse);
const quantityMaps=rows.find(r=>r.kind==='quantityMaps'),cases=rows.filter(r=>r.profession!==undefined);
assert.ok(quantityMaps);assert.equal(cases.length,400);assert.equal(cases.filter(r=>r.limit===999).length,200);assert.equal(cases.filter(r=>r.limit===1).length,200);
const sha=async c=>createHash('sha256').update((await exec('unzip',['-p',jar,c+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classHashes={};for(const [c,name] of [['yv','EntityVillager'],['agn','MerchantRecipe'],['ago','MerchantRecipeList'],['afv','EnchantmentHelper'],['aft','Enchantment']])classHashes[c]={name,sha256:await sha(c)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',runtime:'Java 19 probe; Collections.shuffle shared Random seeded separately per case',classes:classHashes,quantityMaps,cases};
await writeFile(path.join(root,'../public/research/villager-offers-reference.json'),JSON.stringify(reference)+'\n');
console.log(`native initial profession cases ${cases.length} (5 professions × 40 seeds × full/one-offer), recipes ${cases.reduce((n,r)=>n+r.offers.length,0)}`);
