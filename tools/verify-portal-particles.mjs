import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'portal-particle-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(probe,'org/lwjgl/opengl/DisplayMode.java'),path.join(probe,'org/lwjgl/LWJGLException.java'),path.join(probe,'org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/ParticleProbe.java'),path.join(root,'probes/FxProbe.java'),path.join(root,'probes/PortalParticleProbe.java')]);
const {stdout}=await exec('java',['--add-opens','java.base/java.util=ALL-UNNAMED','--add-opens','java.base/java.lang=ALL-UNNAMED','-cp',cp,'PortalParticleProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.length,8);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bkt:'EntityPortalFX',bkm:'EntityFX'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityPortalFX constructors, full onUpdate lifetimes, renderParticle scale and packed getBrightnessForRender at three partial ticks and three lightmap fixtures. World doubles and Tessellator reads reuse FxProbe. Math.random raw state before and after construction and captured Entity.rand raw state before its six nextFloat draws enable replay. No classes patched and no GL draw.',records};
await writeFile(path.join(root,'../public/research/portal-particle-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} native portal particle records`);
