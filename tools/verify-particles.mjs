// Records unchanged 1.7.10 block particles (EntityFX, EntityDiggingFX, EntityBlockDustFX,
// EffectRenderer, RenderGlobal, Entity.onEntityUpdate's sprint particle); see
// tools/probes/ParticleProbe.java. Writes public/research/particle-reference.json, which
// src/particles.test.js replays. Needs a JDK, the client JAR and guava, log4j-api,
// commons-lang3 and gson library JARs (Minecraft's launcher libraries or MC_PROBE_LIBS).
// Minecraft's static initialiser builds org.lwjgl.opengl.DisplayMode values, so a stub
// of that class and of LWJGLException and OpenGLException (named in exception tables) are
// compiled in; nothing else from LWJGL is loaded.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'particle-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(probe,'org/lwjgl/opengl/DisplayMode.java'),path.join(probe,'org/lwjgl/LWJGLException.java'),path.join(probe,'org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/ParticleProbe.java')]);
const {stdout}=await exec('java',['--add-opens','java.base/java.util=ALL-UNNAMED','--add-opens','java.base/java.lang=ALL-UNNAMED','-cp',cp,'ParticleProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const byCase=Object.fromEntries(records.map(r=>[r.case,r]));
assert.equal(byCase['destroy-stone'].particles.length,64);
assert.equal(byCase['hit-stone-0'].particles.length,4);
assert.equal(byCase['hit-air'].particles.length,0);
assert.equal(byCase['sprint-1-0'].particles.length,3);
assert.equal(byCase['sprint-far'].particles.length,0);
assert.equal(byCase['dust-1'].particles.length,40);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bkm:'EntityFX',bld:'EntityDiggingFX',blc:'EntityBlockDustFX',bkn:'EffectRenderer',bma:'RenderGlobal',sa:'Entity',aji:'Block',azt:'AxisAlignedBB',aok:'BlockWeb',aky:'BlockFarmland'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on a constructor-less WorldClient double (stone below y 64 plus per-case cells; getCollidingBoundingBoxes calls Block.addCollisionBoxesToList). blocks: Block.blockParticleGravity, getIcon(0, meta).getIconName() after registerBlockIcons with a recording IIconRegister (fancy leaves), getRenderColor(meta) and the block bounds [minX,minY,minZ,maxX,maxY,maxZ]. Every other record: `math` is the internal state of Math.random\'s generator before the case, `calls` the World.spawnParticle arguments, `particles` each new EntityFX right after construction with `seed` = its Entity.rand internal state before the constructor, `tracks` [posX, posY, posZ, onGround] after each EffectRenderer.updateEffects until it is removed. destroy-*: addBlockDestroyEffects on an air cell. hit-*: four addBlockHitEffects calls (EffectRenderer.rand = new Random(7) once, before hit-stone-0). sprint-*: three Entity.onEntityUpdate calls on a sprinting 0.6 x 1.8 entity (yOffset 1.62, posY 64 + 1.62f, motion 0.28, 0, -0.11, Entity.rand new Random(99)) standing on [vanilla id, meta]. dust-N: RenderGlobal.playAuxSFX(2006, 50, 63, 50, N) over grass with World.rand new Random(5). The view entity is next to the action except sprint-far',
 records};
await writeFile(path.join(root,'../public/research/particle-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original particle records:',records.length,records.map(r=>r.case+':'+(r.particles?.length??r.blocks?.length??'')).join(' '));
