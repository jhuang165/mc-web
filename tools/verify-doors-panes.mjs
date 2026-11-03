// Probe unchanged BlockDoor, BlockPane, ItemDoor and the removal/notification order around them.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes the fixture replayed by
// src/doors-panes.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'door-pane-probe');
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
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/DoorPaneProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'DoorPaneProbe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.deepEqual([count('facts'),count('item'),count('door'),count('doorAlone'),count('pane'),count('paneRender')],[4,2,64,16,64,2]);
assert.ok(count('connect')>100&&count('toggle')>=128&&count("place")>=367&&count('break')>=200&&count('neighbour')>=100);
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout,keys=/^(tile\.(doorWood|doorIron|fenceIron|thinGlass)\.name|item\.(doorWood|doorIron)\.name)=/;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>keys.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={akn:'BlockDoor',aoa:'BlockPane',ach:'ItemDoor',aji:'Block',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockDoor (ids 64, 71), BlockPane (ids 101, 102) and ItemDoor (items 324, 330) on a map-backed world double that dispatches the original neighbour notifications: setBlock calls breakBlock/onBlockAdded and, with flag 1, notifies the six neighbours with the previous block in World order (x-1, x+1, y-1, y+1, z-1, z+1); setBlockMetadataWithNotify notifies only for flag 1; drops are real EntityItems; isBlockIndirectlyGettingPowered reads an explicit set of powered cells. Breaking replays ItemInWorldManager: onBlockHarvested, setBlockToAir, onBlockDestroyedByPlayer and, for a survival player that can harvest, dropBlockAsItem. Door shapes are per 8 lower x 4 upper metadata combinations, pane shapes per 16 connection sets. Client door sound: RenderGlobal.playAuxSFX case 1003 plays random.door_open when Math.random() < 0.5 and random.door_close otherwise at pitch rand * 0.1 + 0.9, volume 1. No game classes patched',
 names,records};
const file=path.join(root,'../public/research/doors-panes-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original door/pane records: ${records.length}, ${(await readFile(file)).length} bytes`);
