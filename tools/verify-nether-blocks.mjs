// Probe the unchanged netherrack, soul sand, End stone, nether brick (block/fence/stairs), quartz ore/block/stairs and
// stone-slab 6/7 classes plus CraftingManager and FurnaceRecipes. Requires the pinned 1.7.10 JAR, a JDK and probe libraries;
// writes the fixture replayed by src/nether-blocks.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'nether-blocks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/NetherBlocksProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'NetherBlocksProbe'],{maxBuffer:1<<26}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),count=c=>records.filter(r=>r.case===c).length;
const expected={facts:11,mining:9,drop:15,icons:21,harvest:7,soulSandBoxes:1,soulSandSlow:10,quartzPlace:5,stairPlace:2,fenceConnect:171,netherFenceShape:48};
for(const [kind,n] of Object.entries(expected))assert.equal(count(kind),n,kind);
assert.ok(count('recipe')>=9&&count('smelt')>=2,'recipes');
const facts=Object.fromEntries(records.filter(r=>r.case==='facts').map(r=>[r.id,r]));
assert.equal(facts[87].hardness,0.4);assert.equal(facts[88].hardness,0.5);assert.equal(facts[121].hardness,3);
// en_US.lang names.
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout;
const keys=/^(tile\.(hellrock|hellsand|whiteStone|netherBrick|netherFence|stairsNetherBrick|netherquartz|quartzBlock\.[A-Za-z]+|stairsQuartz|stoneSlab\.(netherBrick|quartz))\.name|item\.(netherbrick|netherquartz)\.name)=/;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>keys.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={aji:'Block',amg:'BlockNetherrack',ano:'BlockSoulSand',amn:'BlockOre',amx:'BlockQuartz',akz:'BlockFence',ans:'BlockStairs',any:'BlockStoneSlab',afe:'CraftingManager',afa:'FurnaceRecipes',add:'ItemStack',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged registry objects 87, 88, 112, 113, 114, 121, 153, 155, 156, 43 and 44 over a map-backed World double (ahb subclass; spawnEntityInWorld is a sink that records EntityItem stacks and EntityXPOrb values so dropBlockAsItemWithChance and dropXpOnBlockBreak run unchanged, one Random(seed) per sample), an Unsafe-allocated zombie for Entity.doBlockCollisions on soul sand, CraftingManager and FurnaceRecipes read from the live lists. No game classes patched',
 names,records};
await writeFile(path.join(root,'../public/research/nether-blocks-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original nether-block records:',records.length);
