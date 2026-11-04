// Runs the unchanged BlockRailPowered (27 / 157), BlockRailDetector (28), BlockRail (66), BlockRailBase$Rail and real
// EntityMinecartEmpty / EntityMinecartChest from the pinned 1.7.10 client through tools/probes/RailProbe.java (inside the
// RedstoneProbe World double) and writes public/research/powered-rails-reference.json for src/powered-rails.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'rail-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','NbtProbe','RedstoneProbe','RailProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<26});
const {stdout}=await exec('java',['-cp',cp,'RailProbe'],{maxBuffer:1<<27});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(cases.length,11,'rail cases');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={amt:'BlockRailPowered',aki:'BlockRailDetector',amy:'BlockRail',aje:'BlockRailBase',ajf:'BlockRailBase$Rail',xl:'EntityMinecart',xs:'EntityMinecartEmpty',xm:'EntityMinecartChest',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged rail blocks and minecart entities inside the RedstoneProbe World double (real Chunk objects, native setBlock/notify/power code, scripted pending ticks), origin (20,20,20). Per tick: scripted setBlock/setBlockToAir events, world time +1, pending ticks, then each cart lastTickPos/prevRotation + onUpdate. Per tick record: cart [x,y,z,vx,vy,vz,onGround,isDead,yaw], watched cells (id<<4|meta), detector outputs [weak,strong up,strong down,comparator], comparator tile signals, drops, log.',
 cases};
await writeFile(path.join(root,'../public/research/powered-rails-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} rail cases, ${cases.reduce((n,c)=>n+c.ticks.length,0)} ticks`);
