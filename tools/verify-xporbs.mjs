// Records EntityXPOrb.onUpdate (sq.h) from the unchanged classes (tools/probes/XpOrbProbe.java)
// in public/research/xporb-reference.json; src/xp-orbs.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'xporb-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/PlayerStepProbe.java'),path.join(root,'probes/XpOrbProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'XpOrbProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(cases.filter(c=>!c.case).length,19,'movement cases');
assert.equal(cases.filter(c=>c.case==='explosion').length,9,'explosion cases');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sq:'EntityXPOrb',mw:'EntityPlayerMP',yz:'EntityPlayer',ahb:'World',aji:'Block',alw:'BlockLiquid',agw:'Explosion'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'The unchanged EntityXPOrb (sq) constructed on the PlantProbe map-backed World double (XpOrbProbe.XW extends World directly, so isMaterialInBB and handleMaterialAcceleration are the original methods), then motion, entityId and rand (new Random(seed)) set and onUpdate (sq.h) called for up to 120 ticks. Stone fills y < 0. The optional target is an Unsafe-allocated EntityPlayerSP whose getEyeHeight returns EntityPlayerMP\'s 1.62F (mw.g; the server player\'s posY is its feet) at the listed feet in World.playerEntities; `leave` is the tick it moves 20 blocks along +x. Per tick: posX, posY, posZ, motion, onGround, fire, health, isDead, xpTargetColor (sq.g), target set, then attackEntityFrom and playSound calls. Rec overrides only record attackEntityFrom (then call the original) and playSound. Nine additional cases call unchanged Explosion.doExplosionA (agw.a) on 8 XP orb targets each, at power 3/4/6 in open air and behind full/partial stone cover, recording position, motion, health and death. No game classes patched.',
 cases:cases.filter(c=>!c.case), explosions:cases.filter(c=>c.case==='explosion')};
await writeFile(path.join(root,'../public/research/xporb-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} XP orb cases`);
