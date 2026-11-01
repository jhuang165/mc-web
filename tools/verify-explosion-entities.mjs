import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'explosion-entity-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/PlayerStepProbe.java'),path.join(root,'probes/XpOrbProbe.java'),path.join(root,'probes/ExplosionEntityProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ExplosionEntityProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const cases=records.filter(c=>c.kind!=='ignition'), ignition=records.filter(c=>c.kind==='ignition');
assert.equal(ignition.length,48);
assert.equal(cases.length,54,'six entity types, three blast powers, three shielding fixtures');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',zc:'EntityArrow',xk:'EntityItem',xw:'EntityTNTPrimed',zj:'EntitySnowball',zl:'EntityEgg',xj:'EntityFallingBlock',aob:'BlockTNT',agw:'Explosion',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged Explosion.doExplosionA against original EntityArrow, EntityItem (stone stack), EntityTNTPrimed, EntitySnowball, EntityEgg and EntityFallingBlock (sand), on XpOrbProbe.XW map-backed World. Entity positions and motion are set after construction; only World block lookup and entity query are doubled. Powers 3/4/6, open/full/partial stone cover; records posY, motion, item health, death and arrow inGround. All six entity types inherit Entity.getEyeHeight=0. Ignition records run unchanged EntityArrow.onUpdate against TNT with fire counters -1/0/1/2/20/300, water/dry, shooter/null and direct/grazing box contact, recording primed TNT fuse, placer and sound. No game classes patched.',cases,ignition};
await writeFile(path.join(root,'../public/research/explosion-entities-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} explosion entity cases`);
