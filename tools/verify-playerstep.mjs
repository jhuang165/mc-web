// Records the 1.7.10 player step-up and partial-block collision from the unchanged EntityPlayerSP,
// Entity.moveEntity and Block collision boxes (tools/probes/PlayerStepProbe.java) in
// public/research/playerstep-reference.json; src/player-step.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'playerstep-probe-run');
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
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/PlayerStepProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'PlayerStepProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(cases.length>300,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',blk:'EntityPlayerSP',aji:'Block',aky:'BlockFarmland',aod:'BlockSnow',ajx:'BlockChest',amd:'BlockLadder',azt:'AxisAlignedBB'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityPlayerSP allocated without its constructor (as SneakProbe), stepHeight 0.5, width 0.6, height 1.8, yOffset 0, on the PlantProbe map-backed World double whose getCollidingBoundingBoxes calls the original Block.addCollisionBoxesToList. Stone below y 0; one obstacle block (original id/metadata) at (64, 0, 65); the player starts at (64.5, 0, 64.5). "move" cases call Entity.moveEntity(0.03, -0.0784, dz) once with the given ySize, onGround and sneak key; "walk" cases run 30 ticks of setAIMoveSpeed(speed) and moveEntityWithHeading(0, 0.98), with an optional stone riser at (64, 0, 66). No game classes patched.',
 cases};
await writeFile(path.join(root,'../public/research/playerstep-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} player step cases`);
