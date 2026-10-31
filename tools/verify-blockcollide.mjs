// Records the tail of Entity.moveEntity (doBlockCollisions and the burning-box fire counter) from
// the unchanged classes (tools/probes/BlockCollideProbe.java) in
// public/research/blockcollide-reference.json; src/block-collisions.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'blockcollide-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/PlayerStepProbe.java'),path.join(root,'probes/BlockCollideProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'BlockCollideProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(cases.length>300,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',yz:'EntityPlayer',blk:'EntityPlayerSP',ahb:'World',aji:'Block',ajt:'BlockCactus',aok:'BlockWeb',alb:'BlockFire',ro:'DamageSource'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'The unchanged EntityPlayerSP through a probe subclass (Rec) that records attackEntityFrom (returning false), setInWeb (then the original EntityPlayer.setInWeb) and playSound, and supplies isWet. Allocated as in PlayerStepProbe on the PlantProbe map-backed World double (stone below y -1), at feet y 0 off the ground, with the given fire counter (sa.e), fireResistance (sa.ab), wet flag and capabilities.isFlying. Each of 22 ticks sets fallDistance 1.5 and calls Entity.moveEntity(0, 0, 0). Per tick: the recorded calls (damage type:amount, web, sound), then fire, isInWeb and fallDistance. Cells are [dx, dy, dz, original id] from (64, 0, 64): cactus 81, web 30, fire 51, still lava 11. No game classes patched.',
 cases};
await writeFile(path.join(root,'../public/research/blockcollide-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} block-collision cases`);
