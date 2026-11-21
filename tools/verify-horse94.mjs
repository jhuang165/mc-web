// Records the input a real EntityPlayerMP rider takes through C0C and feeds a saddled EntityHorse (tools/probes/Horse94Probe.java) in public/research/horse94-reference.json;
// src/horse94-b94.test.js checks the browser port against it. Needs the same JDK and library JARs as tools/verify-horse.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse94-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/HorseProbe.java'),path.join(root,'probes/VillagerProbe.java'),path.join(root,'probes/ServerPlayerProbe.java'),path.join(root,'probes/HorseRearProbe.java'),path.join(root,'probes/Horse88Probe.java'),path.join(root,'probes/Horse92Probe.java'),path.join(root,'probes/Horse94Probe.java')]);
const run=async(...a)=>(await exec('java',['-cp',cp,'Horse94Probe',...a],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const playerRider=await run(),dismounts=await run('dismounts');
assert.equal(playerRider.length,6);assert.equal(dismounts.length,4);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'playerRider: a real EntityPlayerMP (mw, allocated without its constructor) takes C0C through mw.a(FFZZ) and rides the unchanged wi (EntityHorse) on Horse88Probe.W88; per tick the network phase of the previous server tick (the C05 runs mw.i = yz.h -> sv.e, then the C0C), the horse lastTickPos / prevRotation, wi.h() (reads the rider bd / be), then the rider sv.ab(). dismounts: the unchanged World.updateEntities (ahb.h) with a zombie rider (own update stubbed) in the loaded entity list. See tools/probes/Horse94Probe.java.',
 playerRider,dismounts};
await writeFile(path.join(root,'../public/research/horse94-reference.json'),JSON.stringify(reference)+'\n');
console.log('horse94 reference: '+playerRider.length+' player rider scenarios, '+dismounts.length+' dismount scenarios');
