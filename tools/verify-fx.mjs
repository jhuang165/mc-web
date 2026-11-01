import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fx-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(probe,'org/lwjgl/opengl/DisplayMode.java'),path.join(probe,'org/lwjgl/LWJGLException.java'),path.join(probe,'org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/ParticleProbe.java'),path.join(root,'probes/FxProbe.java')]);
const {stdout}=await exec('java',['--add-opens','java.base/java.util=ALL-UNNAMED','--add-opens','java.base/java.lang=ALL-UNNAMED','-cp',cp,'FxProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('particle'),31);assert.equal(count('crit2'),1);assert.equal(count('water'),5);assert.equal(count('hearts'),1);assert.equal(count('death'),1);assert.equal(count('potion'),15);assert.equal(count('crumbs'),4);assert.equal(count('bonemeal'),4);assert.equal(count('display'),17);assert.equal(count('voidfog'),3);assert.equal(count('inside'),5);assert.equal(count('drown'),1);assert.equal(count('draw'),25);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bkm:'EntityFX',bjv:'EntityBubbleFX',bjx:'EntityCritFX',bjw:'EntityCrit2FX',bkf:'EntityFlameFX',bkk:'EntityLavaFX',blf:'EntityRainFX',bky:'EntitySplashFX',bkh:'EntityHeartFX',bkx:'EntitySpellParticleFX',bla:'EntityAuraFX',bkz:'EntitySuspendFX',bjy:'EntityDropParticleFX',bju:'EntityBreakingFX',bma:'RenderGlobal',bkn:'EffectRenderer',sa:'Entity',sv:'EntityLivingBase',sw:'EntityLiving',wf:'EntityAnimal',alt:'BlockLeaves',aen:'PotionHelper',acj:'ItemDye'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Original constructors through RenderGlobal.doSpawnParticle (Particles All, viewer at 10.5, 65.62, 10.5) and each onUpdate, in ParticleProbe.PWorld with stone below y 64 and per-fixture water pool (1), stone ceiling at y 66 (2), lava pool (3) or ceiling at y 70 (4). Math.random raw state before construction and Entity.rand rewound to before the EntityFX draws are recorded for replay. tracks: x, y, z, motion, age, texture index, isDead, onGround, rgb per tick; events: World.spawnParticle calls in onUpdate. EntityRainFX and EntityCrit2FX are constructed directly. Spawn sites run the original Entity.handleWaterMovement (handleMaterialAcceleration forced wet, no push), EntityAnimal.handleHealthUpdate(18), EntityLivingBase.onDeathUpdate at deathTime 20, updatePotionEffects (40 calls, normal/ambient/player yOffset), renderBrokenItemStack and ItemDye bone-meal sparkles on a constructor-less EntityAnimal subclass with seeded Entity.rand. display: Block.randomDisplayTick of the torch (5 metadata), lit furnace, fire (stone floor, two plank layouts) and liquids (still/flowing/falling water and lava under a stone-topped ceiling, covered lava) at (10, 70, 10) with seeded Random: calls, WorldClient.playSound calls and the Random state after. Leaves (BlockLeaves) runs with World.canLightningStrikeAt answered by the case (rain, rain over stone, dry). voidfog: WorldClient.doVoidFogParticles at (10, 4, 10) in an all-air world with seeded World.rand. inside: Entity.isInsideOfMaterial(water) for a 0.9 x 1.3 body stepping through one water cell of levels 0, 1, 3, 7 and 8. drown: 25 ticks of EntityLiving.onEntityUpdate (EntityLivingBase air, then the living-sound roll) under the still pool from 3 air, with attackEntityFrom recorded and refused. No classes patched; no GL renderer run.',records};
await writeFile(path.join(root,'../public/research/fx-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} FX records`);
