// Records EntityEnderman behaviour from the unchanged original classes (tools/probes/EndermanProbe.java on the
// MobMoveProbe world double) in public/research/enderman-reference.json; src/enderman.test.js checks the browser
// port against it. Needs the same JDK, client JAR and library JARs as tools/verify-wolf.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'enderman-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/EndermanProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'EndermanProbe'],{maxBuffer:1<<28,timeout:540000});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const facts=pick('facts')[0];assert.ok(facts);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ya:'EntityEnderman',yg:'EntityMob',td:'EntityCreature',sv:'EntityLivingBase',bhk:'ModelEnderman',bnm:'RenderEnderman'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration on a block-map world double (stone below y 0; settable blocks, daylight, sky, rain, line of sight, brightness; captured sounds, particles, spawned entities), with a real new ya(world) and a constructor-less EntityPlayer. Each tick row is one ya.e() call from a fresh seeded Entity.rand, so the port can replay the exact draw order.',
 facts,stare:pick('stare'),stareSeq:pick('stareSeq'),teleportTo:pick('teleportTo'),teleportRandom:pick('teleportRandom'),teleportToEntity:pick('teleportToEntity'),hurt:pick('hurt'),dropItem:pick('dropItem')[0],drops:pick('drops'),pick:pick('pick'),pickTotal:pick('pickTotal')[0],place:pick('place'),placeTotal:pick('placeTotal')[0],tick:pick('tick'),chase:pick('chase')};
await writeFile(path.join(root,'../public/research/enderman-reference.json'),JSON.stringify(reference)+'\n');
console.log('enderman reference:',Object.entries(reference).filter(([,v])=>Array.isArray(v)).map(([k,v])=>`${k}=${v.length}`).join(' '));
