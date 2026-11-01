import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'explosion-particle-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(path.join(probe,'org/lwjgl/opengl'),{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
await writeFile(path.join(probe,'org/lwjgl/opengl/DisplayMode.java'),'package org.lwjgl.opengl; public class DisplayMode { public DisplayMode(int w, int h) {} }\n');
await writeFile(path.join(probe,'org/lwjgl/LWJGLException.java'),'package org.lwjgl; public class LWJGLException extends Exception {}\n');
await writeFile(path.join(probe,'org/lwjgl/opengl/OpenGLException.java'),'package org.lwjgl.opengl; public class OpenGLException extends RuntimeException {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(probe,'org/lwjgl/opengl/DisplayMode.java'),path.join(probe,'org/lwjgl/LWJGLException.java'),path.join(probe,'org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/ParticleProbe.java'),path.join(root,'probes/ExplosionParticleProbe.java')]);
const {stdout}=await exec('java',['--add-opens','java.base/java.util=ALL-UNNAMED','--add-opens','java.base/java.lang=ALL-UNNAMED','-cp',cp,'ExplosionParticleProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='particle').length,32);
assert.equal(records.filter(r=>r.case==='burst').length,8);
assert.equal(records.filter(r=>r.case==='tnt-smoke').length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bkm:'EntityFX',bka:'EntityExplodeFX',bki:'EntityLargeExplodeFX',bkj:'EntityHugeExplodeFX',bkv:'EntitySmokeFX',agw:'Explosion',xw:'EntityTNTPrimed',sa:'Entity',bkn:'EffectRenderer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Original explosion particle constructors and onUpdate in ParticleProbe.PWorld with stone below y 64 and per-fixture wall/ceiling/web/cactus/farmland/ladder. Math.random raw state before construction and Entity.rand raw state before the constructor recorded for deterministic replay. tracks: position, motion, age, texture index, isDead, onGround. events: huge-emitter World.spawnParticle calls per tick. Burst cases run original client Explosion.doExplosionB(true) on four affected air positions with World.rand seed 19. The TNT case runs EntityTNTPrimed.onUpdate through a three-tick fuse and records the smoke position and the final no-smoke death tick. No classes patched. Render frame/UV formulas are bytecode-derived; no GL renderer run.',records};
await writeFile(path.join(root,'../public/research/explosion-particles-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} explosion particle records`);
