// Batch 56 (b56dl): the render-type sweep of renderBlockAsItem and the entity brightness (tools/probes/DisplayLightProbe.java). src/display-light-b56.test.js replays public/research/display-light-reference.json.
import {execFile} from 'node:child_process';import os from 'node:os';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'displaylight-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-2','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
// the stub GL11 and the probe come first on the classpath; no LWJGL jar is on the classpath (org.lwjgl.LWJGLException and OpenGLException are stubbed too, and Minecraft (bao) and GameSettings (bbj) are stubs that only carry ambientOcclusion = 2).
const cp=[probe,classes,...libs].join(path.delimiter);
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/displayquads/org/lwjgl/opengl/GL11.java'),path.join(root,'probes/displayquads/org/lwjgl/LWJGLException.java'),path.join(root,'probes/displayquads/org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/displayquads/bao.java'),path.join(root,'probes/displayquads/bbj.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','DisplayLightProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const grassPng=path.join(root,'../public/media/1.7.10/colormap/grass.png'),foliagePng=path.join(root,'../public/media/1.7.10/colormap/foliage.png');
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'DisplayLightProbe',grassPng,foliagePng],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=250,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={blm:'RenderBlocks',aji:'Block',sa:'Entity',ahb:'World',apx:'Chunk',apz:'ExtendedBlockStorage',aqo:'WorldProvider'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',tag:'b56dl',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'sweep: for every block id 1..255 Block.getRenderType (aji.b), RenderBlocks.renderItemIn3d (blm.a(int)) and the quads (glDrawArrays count / 4, summed over the draws) a fresh RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)) draws at metadata 0..15 with brightness 0.37 and a recording GL11 stub (a thrown exception is recorded as its class name); firstColor is the first glColor4f it issued. entity: a real EntityMinecartEmpty (xs) in a World stand-in over a real Chunk (apx) and ExtendedBlockStorage (apz) section y 64..79; Entity.getBrightness (sa.d(F)), Entity.getBrightnessForRender (sa.c(F)) and Entity.isBurning (sa.al()) are the real methods, the provider table is the real WorldProvider light table.',
 records};
await writeFile(path.join(root,'../public/research/display-light-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} displaylight records`);
