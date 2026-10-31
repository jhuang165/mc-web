// Records unchanged sugar cane, cactus and falling blocks; see PlantProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'plant-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'PlantProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>100,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ane:'BlockReed',ajt:'BlockCactus',akx:'BlockFalling',anh:'BlockSand',ali:'BlockGravel',xj:'EntityFallingBlock',abi:'ItemReed',ash:'WorldGenReed',arh:'WorldGenCactus',asj:'WorldGenSand',aia:'BiomeDecorator',aic:'BiomeGenDesert',xk:'EntityItem',sq:'EntityXPOrb',ro:'DamageSource',awt:'Material',aji:'Block',sa:'Entity',ahb:'World',afa:'FurnaceRecipes',afe:'CraftingManager'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),method:'Unchanged BlockReed, BlockCactus, BlockFalling/BlockSand/BlockGravel, EntityFallingBlock, ItemReed, WorldGenReed/Cactus/Sand, EntityItem/EntityXPOrb.attackEntityFrom, FurnaceRecipes and CraftingManager on a map-backed World double (original block ids; setBlock is a plain write without neighbour notifications; spawned entities and scheduled updates are recorded). Fixtures: soil at (0,63,0) with water/neighbours on a 4-bit side mask (x-1, x+1, z-1, z+1), a stone floor below y 1 for falls, and a pond (still water where x*x+z*z<=10 at y 63) for the decorators. No game classes patched',records};
await writeFile(path.join(root,'../public/research/plant-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original plant records:',records.length);
