// Records the unchanged EntityMinecart.applyEntityCollision (xl.g) between plain, chest and furnace carts and the command cart's watchers 23/24
// (tools/probes/FurnaceCartProbe.java) in public/research/furnace-cart-reference.json; src/furnace-cart-b49.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'furnace-cart-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','FurnaceCartProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'FurnaceCartProbe'],{maxBuffer:1<<26});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(lines.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',xl:'EntityMinecart',xs:'EntityMinecartEmpty',xm:'EntityMinecartChest',xq:'EntityMinecartFurnace',xn:'EntityMinecartCommandBlock',xo:'EntityMinecartCommandBlock$1',agp:'CommandBlockLogic'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged classes with the MinecartProbe map-backed World double: xl.g(sa) (applyEntityCollision) called on cart A with cart B, for type pairs plain/chest/furnace, offsets, A yaws and motions; records A and B motion x, y, z and isAirBorne afterwards. Command cart: EntityMinecartCommandBlock watchers 23 and 24 read from its DataWatcher fresh, after setCommand + func_145755_a (the run, no MinecraftServer), after addChatMessage (agp.a(fj), the [hh:mm:ss] prefix scrubbed), and after writeToNBT. No game classes patched.',
 collisions:lines[0].rows,command:lines[1].rows};
await writeFile(path.join(root,'../public/research/furnace-cart-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${reference.collisions.length} collision rows, ${reference.command.length} command rows`);
