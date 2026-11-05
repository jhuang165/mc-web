import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'hanging-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','HangingProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'HangingProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=k=>cases.filter(c=>c.kind===k).length;
assert.equal(count('arts'),1);assert.equal(cases.find(c=>c.kind==='arts').arts.length,26);
assert.equal(count('bounds'),12);assert.equal(count('surface'),4);assert.equal(count('frame'),10);assert.equal(count('painting-hit'),4);assert.equal(count('tick'),5);assert.equal(count('place'),30);assert.equal(count('nbt-read'),11);assert.equal(count('select-none'),1);
// Sanity: the first player hit on an item frame drops the item and keeps the frame; the second breaks it.
const survival=cases.find(c=>c.kind==='frame'&&c.name==='survival');
assert.deepEqual(survival.steps.slice(-2).map(s=>[s[4],s[6].map(d=>d[0])]),[[false,[4]],[true,[389]]]);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ss:'EntityHanging',tb:'EntityPainting',st:'EntityItemFrame',tc:'EnumArt',acz:'ItemHangingEntity',sa:'Entity',te:'DataWatcher',xk:'EntityItem',ahb:'World',bon:'RenderPainting',bnx:'RenderItemFrame'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityPainting (tb), EntityItemFrame (st), EntityHanging (ss), EnumArt (tc) and ItemHangingEntity (acz) on the MinecartProbe.MW map-backed World double (plus a player list for the DataWatcher callback), subclassed only to replace Entity.rand (sa.Z) from the entityInit hook (c()) that Entity\'s constructor calls, so the real constructor loop picks the art with new Random(seed). Directions are Direction indices (0 south/+z, 1 west/-x, 2 north/-z, 3 east/+x); entity state is [direction, tileX, tileY, tileZ, posX, posY, posZ, rotationYaw, prevRotationYaw, minX, minY, minZ, maxX, maxY, maxZ, widthPixels, heightPixels, isDead]. updateBoundingBox\' -0.03125 slack inverts the thickness axis (min greater than max); that is native and reproduced. `arts` is EnumArt.values() as [title, sizeX, sizeY, offsetX, offsetY]. `bounds`: every art (6-argument constructor) and the frame at three tiles for every direction. `surface`: onValidSurface for every art and direction against a solid plane at the tile; bit 0 full plane, 1 a solid cell in front, 2 another hanging entity at the same place, 3..27 the plane cell (dx, dy) removed for dy -2..2, dx -2..2 (dx along the wall tangent). `select`: seeds 0..11 through the real EntityPainting(world,x,y,z,dir) constructor against walls of W by H blocks clicked at a corner cell; picks are [art index, onValidSurface, posX, posY, posZ]; valid lists the arts that fit. `frame` and `painting-hit`: interactFirst with a held stack (Unsafe-allocated player, InventoryPlayer slot 0, PlayerCapabilities.isCreativeMode), attackEntityFrom, onBroken, moveEntity and writeEntityToNBT steps; per step [action, return, displayed item, rotation, isDead, held stack, spawned EntityItems [id, count, damage, x, y, z, delayBeforeCanPickup, tag], nbt]. Item motion is Math.random() and not recorded. `tick`: onUpdate for 130 ticks (supporting plane removed at removeAt). `place`: ItemStack.onItemUse against one stone block at (0,65,0) for sides 0..5 (Creative stack restoration is ItemInWorldManager, not recorded). `nbt-read`: readEntityFromNBT then writeEntityToNBT. No game classes patched.',
 cases};
await writeFile(path.join(root,'../public/research/hanging-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} hanging records (${[...new Set(cases.map(c=>c.kind))].map(k=>k+' '+count(k)).join(', ')})`);
