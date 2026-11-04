// Probe the unchanged BlockBed (26), ItemBed (355), EntityPlayer.sleepInBedAt / wakeUpPlayer / verifyRespawnCoordinates and
// World.isDaytime (tools/probes/BedProbe.java). Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes
// public/research/bed-reference.json, replayed by src/bed.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'bed-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'BedProbe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=(c,k)=>records.filter(r=>r.case===c&&(k===undefined||r.kind===k)).length;
assert.deepEqual([count('facts'),count('item'),count('daytime')],[1,1,1]);
assert.ok(count('place')===233&&count('neighbour')===24&&count('break')===16&&count('activate')===314&&count('wake')===34&&count('tick')===4&&count('spawn')===196&&count('verify')===474,'case counts '+JSON.stringify(records.reduce((a,r)=>(a[r.case]=(a[r.case]||0)+1,a),{})));
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout,keys=/^(tile\.bed\.(name|occupied|noSleep|notSafe|notValid)|item\.bed\.name|multiplayer\.stopSleeping)=/;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>keys.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
assert.equal(Object.keys(names).length,7);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={ajh:'BlockBed',abg:'ItemBed',yz:'EntityPlayer',ahb:'World',mt:'WorldServer',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockBed (id 26), ItemBed (item 355), EntityPlayer.sleepInBedAt / wakeUpPlayer / verifyRespawnCoordinates / the onUpdate sleep timer (replayed with the original isInBed) and World.isDaytime over the real calculateSkylightSubtracted, on the DoorPaneProbe map-backed world double with the original neighbour-notification order, a chunk-provider proxy, a monster list for the 8x5x8 box and a player list. Remote worlds are not simulated. WorldServer.tick (sleep skip: worldTime + 24000 - worldTime % 24000 when doDaylightCycle, wakeAllPlayers, resetRainAndThunder) and EntityPlayerMP respawn are read from bytecode, not executed. No game classes patched',
 names,records};
const file=path.join(root,'../public/research/bed-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original bed records: ${records.length}, ${(await readFile(file)).length} bytes`);
