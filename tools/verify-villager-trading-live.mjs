// Drives the unchanged EntityVillager/ContainerMerchant/InventoryMerchant/SlotMerchantResult through scripted trading sessions
// (interact, select, payment, result clicks, close, restock ticks). Writes public/research/villager-trading-live-reference.json.
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
const out=path.join(research,'villager-trading-live-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','ModelProbe','VillagerProbe','VillagerOffersProbe','InventoryProbe','VillagerTradeLiveProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['--add-opens=java.base/java.util=ALL-UNNAMED','-cp',cp,'VillagerTradeLiveProbe'],{maxBuffer:1<<29});
const rows=stdout.trim().split('\n').filter(s=>s.startsWith('{')).map(JSON.parse);
const stackLimits=rows.find(r=>r.kind==='stackLimits').limits,refusals=rows.filter(r=>r.kind==='refusal'),trading=rows.filter(r=>r.kind==='trading');
assert.equal(refusals.length,4);assert.equal(trading.length,60);
const steps=trading.flatMap(c=>c.steps);
const count=f=>steps.filter(f).length;
const sha=async c=>createHash('sha256').update((await exec('unzip',['-p',jar,c+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classHashes={};for(const [c,name] of [['yv','EntityVillager'],['aat','ContainerMerchant'],['aas','InventoryMerchant'],['aau','SlotMerchantResult'],['agn','MerchantRecipe'],['ago','MerchantRecipeList']])classHashes[c]={name,sha256:await sha(c)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',runtime:'Java probe; Collections.shuffle shared Random reseeded per case; entity Random seeded per case',classes:classHashes,stackLimits,refusals,trading};
await writeFile(path.join(root,'../public/research/villager-trading-live-reference.json'),JSON.stringify(reference)+'\n');
const trades=count(s=>s.state.sounds.some(x=>x.startsWith("mob.villager.yes"))&&s.step.op==='click');
console.log(`native trading cases ${trading.length} (5 professions x 12 seeds) + ${refusals.length} interact refusals, steps ${steps.length}, result clicks with yes sound ${trades}, restock-visible ticks ${count(s=>s.step.op==='tick')}`);
