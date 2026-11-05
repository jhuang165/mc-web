// Records ItemMonsterPlacer (spawn egg), ItemExpBottle/EntityExpBottle and ItemFireball behaviour from the unchanged original classes
// (tools/probes/SpawnEggProbe.java on the MobMoveProbe world double) in public/research/spawn-eggs-reference.json;
// src/spawn-eggs.test.js checks the browser port against it. Needs the same JDK, client JAR and library JARs as verify-wolf.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawn-eggs-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/SpawnEggProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SpawnEggProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const eggs=pick('egg'),use=pick('use'),useEach=pick('useEach'),water=pick('water'),expThrow=pick('expThrow'),expLaunch=pick('expLaunch'),expImpact=pick('expImpact'),fire=pick('fire'),named=pick('named'),noEgg=pick('noEgg');
assert.equal(eggs.length,24);assert.equal(expImpact.length,400);assert.equal(expLaunch.length,18);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aee:'ItemMonsterPlacer',acp:'ItemExpBottle',acq:'ItemFireball',zn:'EntityExpBottle',zk:'EntityThrowable',sg:'EntityList',sh:'EntityList.EntityEggInfo',sq:'EntityXPOrb'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration on the MobMoveProbe world double (stone below y 0) extended with a cell map and effect recording, and a constructor-less EntityPlayer. egg: EntityList.entityEggs with both ItemMonsterPlacer colour passes and display names. use: aee.a onItemUse per side, fence, creative/survival/remote. useEach: every egg once. water: onItemRightClick. expThrow/expLaunch: ItemExpBottle and the EntityThrowable launch replayed with a seeded Entity.rand (the constructor draws an unseeded one). expImpact: EntityExpBottle.onImpact, 400 seeded impacts. fire: ItemFireball.onItemUse.',
 items:pick('items')[0],eggs,noEgg,use,useEach,named,water,expConstants:pick('expConstants')[0],expThrow,expLaunch,expImpact,expImpactRemote:pick('expImpactRemote')[0],xpSplit:pick('xpSplit')[0],fire};
await writeFile(path.join(root,'../public/research/spawn-eggs-reference.json'),JSON.stringify(reference)+'\n');
console.log('spawn eggs reference:',eggs.length,'eggs,',use.length,'use rows,',water.length,'water rows,',expLaunch.length,'launch rows,',expImpact.length,'impacts,',fire.length,'fire rows');
