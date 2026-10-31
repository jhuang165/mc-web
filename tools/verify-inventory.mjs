// Runs tools/probes/inventory-scenarios.txt through the unchanged 1.7.10
// inventory/container classes and the JavaScript port, then records the
// original outputs in public/research/inventory-reference.json.
// Needs a JDK, the original client JAR (tools/research, the parent workspace's
// tools/research, or MC_RESEARCH) and Guava, log4j-api and commons-lang3 JARs
// (MC_PROBE_LIBS, or found in local Minecraft/Gradle library caches).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {replay,registryCase} from './inventory-replay.mjs';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'inventory-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe can share the default package.
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/InventoryProbe.java')]);
const script=(await readFile(path.join(root,'probes/inventory-scenarios.txt'),'utf8'))+'\n'+registryCase()+'\n';
const child=execFile('java',['-cp',cp,'InventoryProbe'],{maxBuffer:1<<24});child.stdin.end(script);
const stdout=await new Promise((resolve,reject)=>{let text='',err='';child.stdout.on('data',d=>text+=d);child.stderr.on('data',d=>err+=d);child.on('close',code=>code?reject(new Error(err)):resolve(text));});
const original=stdout.trim().split('\n').map(line=>JSON.parse(line)),actual=replay(script);
assert.equal(actual.length,original.length);
let failed=0;for(let i=0;i<original.length;i++){try{assert.deepEqual(actual[i],original[i]);}catch{failed++;console.error(`MISMATCH ${original[i].case}\n original ${JSON.stringify(original[i])}\n js       ${JSON.stringify(actual[i])}`);}}
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yx:'InventoryPlayer',zs:'Container',aay:'Slot',aax:'SlotCrafting',aak:'SlotFurnace',aap:'ContainerPlayer',aaf:'ContainerWorkbench',aaj:'ContainerFurnace',aae:'InventoryCrafting',aaw:'InventoryCraftResult',afe:'CraftingManager',afa:'FurnaceRecipes',apg:'TileEntityFurnace',aad:'ContainerChest',ra:'InventoryLargeChest',aow:'TileEntityChest',add:'ItemStack',abb:'ItemArmor',sv:'EntityLivingBase'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes, after Block/Item registration, run with a constructor-less player/world double that records dropped and broken stacks. Utility libraries: '+libs.map(l=>path.basename(l)).join(', ')+'. Item IDs are Minecraft IDs.',
 script,cases:original};
await writeFile(path.join(root,'../public/research/inventory-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${original.length} inventory cases; ${failed} mismatches.`);if(failed)process.exitCode=1;
