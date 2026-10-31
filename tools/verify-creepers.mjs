// Records unchanged Explosion, EntityCreeper, EntityTNTPrimed and BlockTNT behaviour; see
// tools/probes/CreeperProbe.java and public/research/creepers.md.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'creeper-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ChickenProbe.java'),path.join(root,'probes/CreeperProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'CreeperProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('facts'),1);assert.equal(count('fixture'),1);assert.equal(count('explode'),48);assert.equal(count('damage'),18);
assert.equal(count('fuse'),5);assert.equal(count('tnt'),3);assert.equal(count('chain'),40);assert.equal(count('cdrops'),200);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={agw:'Explosion',ahb:'World',xz:'EntityCreeper',vi:'EntityAICreeperSwell',xw:'EntityTNTPrimed',aob:'BlockTNT',aji:'Block',alb:'BlockFire',sw:'EntityLiving',sv:'EntityLivingBase',sa:'Entity',bhj:'ModelCreeper',bni:'RenderCreeper',boy:'RenderTNTPrimed'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),method:'Unchanged Explosion.doExplosionA/doExplosionB(false), EntityCreeper.onUpdate/fall/dropFewItems, EntityAICreeperSwell, EntityTNTPrimed.onUpdate, BlockTNT.onBlockDestroyedByExplosion/onBlockDestroyedByPlayer, Block.dropBlockAsItemWithChance and ModelCreeper.setRotationAngles on a World subclass that stores blocks in a map (stone below y 0 outside the fixture), captures spawned entities and sounds, and runs newExplosion like WorldServer (no client particles). The fixture is a seeded 24x9x24 terrain listed in the fixture record (x,y,z,id,meta with original ids). world.rand is a java.util.Random seeded per record. Creeper AI task lists are emptied except where EntityAICreeperSwell is run directly. TNT initial motion comes from Math.random and is recorded. No game classes patched',records};
await writeFile(path.join(root,'../public/research/creeper-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original creeper/explosion records:',records.length);
