// Native Java 1.7.10 Block.getRenderColor sweep (cart display tint) and EntityBoat client splash records.
// See tools/probes/LeafColorProbe.java and src/displayfx-b52.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'leafcolor-probe');
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
const grassPng=path.join(root,'../public/media/1.7.10/colormap/grass.png'),foliagePng=path.join(root,'../public/media/1.7.10/colormap/foliage.png');
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','VehicleProbe','BoatProbe','LeafColorProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'LeafColorProbe',grassPng,foliagePng],{maxBuffer:1<<27});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={adb:'Item',add:'ItemStack',aji:'Block',blm:'RenderBlocks',aha:'ColorizerGrass',agx:'ColorizerFoliage'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',tag:'b53lc',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),colormaps:{grass:await sha(grassPng),foliage:await sha(foliagePng)},
 method:'Item.getColorFromItemStack (adb.a(add, int), passes 0 and 1) of every registered item id and damage 0..15, with Block.getRenderColor (aji.i(int)) of the block behind a block item, its render type and RenderBlocks.renderItemIn3d, the shipped colormaps fed to ColorizerGrass/ColorizerFoliage. No patched game classes.',
 records};
await writeFile(path.join(root,'../public/research/leafcolor-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} leafcolor records`);
