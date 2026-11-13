// Native Java 1.7.10 EntityBoat client copy (remote world) in water.
// See tools/probes/BoatCopyProbe.java and src/boat-copy-b54.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'boatcopy-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','VehicleProbe','BoatProbe','BoatCopyProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'BoatCopyProbe'],{maxBuffer:1<<27});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xi:'EntityBoat',abj:'ItemBoat',sa:'Entity'};
const ride2=cases.filter(c=>c.kind==='ride2');cases.splice(0,cases.length,...cases.filter(c=>c.kind!=='ride2'));
const reference={tag:'b56bc',target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),method:'Unchanged EntityBoat (xi) ticked on a remote (client) world stand-in: Entity.onUpdate -> handleWaterMovement, then the isRemote interpolation / S12 coasting branch, in still and flowing water; S12 (xi.i) and position packets (xi.a(DDDFFI), 3 increments) applied before given ticks; the splash sound call logged. Batch 56 adds kind ride: the client player mounted through sa.a(sa), setIsBoatEmpty(false), the rider input fields set per tick, xi.h and xi.ac run on the remote world stand-in. No patched game classes.',cases};
const collide={tag:'b57bx',target:'Minecraft Java 1.7.10',clientSha1:reference.clientSha1,classes:reference.classes,method:'Unchanged EntityBoat (xi) as the ridden client copy on a remote world stand-in (as the b56 ride records), with other entities in the world list: a second boat (xi), a minecart (xm), a second player stand-in, an item (xk), moved by scripted per-tick offsets before the copy updates. World.getCollidingBoundingBoxes is the MinecartProbe stand-in of ahb.a(sa, azt) (other.getBoundingBox, then mover.getCollisionBox(other); bytecode-read equal). The rider is the real EntityLivingBase.fall (sv.b) on a stand-in with EntityPlayerSP.playSound (World.playSound, logged as played) and EntityClientPlayerMP.attackEntityFrom (return false, counted). Worlds by label: open = water x -4..24, z -8..8, y -1..0; pool = water -4..4 square; empty; floor12 / floor20 = sand / glass at y -1 over -3..4. No patched game classes.',cases:ride2};
await writeFile(process.env.MC_BOATCOLLIDE_OUTPUT || path.join(root,'../public/research/boat-collide-reference.json'),JSON.stringify(collide)+'\n');
await writeFile(process.env.MC_BOATCOPY_OUTPUT || path.join(root,'../public/research/boat-copy-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} boat copy records, ${ride2.length} boat collide records`);
