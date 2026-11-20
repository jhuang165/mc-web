// Native Java 1.7.10 ItemBoat.onItemRightClick entity checks per entity kind (batch 87).
// See tools/probes/BoatEntityProbe.java and src/boatcheck87-b87.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'boat-entity-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','VehicleProbe','BoatProbe','BoatEntityProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'BoatEntityProbe'],{maxBuffer:1<<27});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={abj:'ItemBoat',ahb:'World',sa:'Entity',xi:'EntityBoat',xk:'EntityItem',sq:'EntityXPOrb',zc:'EntityArrow',zk:'EntityThrowable',zj:'EntitySnowball',zd:'EntityEnderEye',xe:'EntityFishHook',ze:'EntityFireball',zg:'EntityLargeFireball',zi:'EntitySmallFireball',zp:'EntityWitherSkull',xj:'EntityFallingBlock',xw:'EntityTNTPrimed',wz:'EntityEnderCrystal',xl:'EntityMinecart',ss:'EntityHanging',su:'EntityLeashKnot'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),method:'Unchanged native ItemBoat.onItemRightClick on the BoatProbe map-backed World (getEntitiesWithinAABBExcludingEntity lists live entities whose box meets the query; getCollidingBoundingBoxes adds getBoundingBox and the boat collision box of each listed entity). Each non-living entity is built with its native client constructor and placed with Entity.setPosition so its box bottom sits at a chosen height; the looking player is in the entity list. Records give canBeCollidedWith, collisionBorderSize, yOffset, size, position and box with the item count and spawned boat. No patched game classes.',cases};
await writeFile(process.env.MC_BOAT_ENTITY_OUTPUT || path.join(root,'../public/research/boat-entity-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} boat entity records`);
