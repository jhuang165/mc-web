// Records the saddled pig, EntityAIControlledByPlayer, ItemSaddle and ItemCarrotOnAStick from the unchanged original
// classes (tools/probes/PigSaddleProbe.java on the HorseProbe/MobMoveProbe world double) in
// public/research/pig-saddle-reference.json; src/pig-saddle.test.js checks the browser port against it. Needs the same
// JDK, client JAR and library JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'pig-saddle-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','PigSaddleProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'PigSaddleProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const cases={facts:1,interact:9,saddle:9,steer:7,ride:10,use:10,drops:36,nbt:2,nbtMissing:1};
for(const [c,n] of Object.entries(cases))assert.equal(pick(c).length,n,c);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wo:'EntityPig',ub:'EntityAIControlledByPlayer',adt:'ItemSaddle',abp:'ItemCarrotOnAStick',ayg:'PathFinder',add:'ItemStack',bbv:'GuiIngame',boo:'RenderPig'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/PigSaddleProbe.java): stone below y 0 and an optional wall at z >= 2. The pig is built with new wo(world) and its task list is read but never ticked. ride: per tick the probe runs ub.e() (which itself calls e(0, speed)), zeroes moveForward like the move helper, runs the jump helper and the onLivingUpdate jump, then e(strafe, 0). interact: wo.a(yz). saddle: ItemSaddle.itemInteractionForEntity / hitEntity. steer: wo.bE and ub.a. use: ItemCarrotOnAStick.onItemRightClick. drops: wo.b(true, looting). nbt: wo.b(dh) and a(dh). The GuiIngame mount hearts and RenderPig saddle layer are read from bytecode (pig-saddle.md).',
 counts:cases,facts:pick('facts')[0],...Object.fromEntries(Object.keys(cases).filter(k=>k!=='facts').map(k=>[k,pick(k)]))};
await writeFile(path.join(root,'../public/research/pig-saddle-reference.json'),JSON.stringify(reference)+'\n');
console.log('pig saddle reference:',Object.entries(cases).map(([k,v])=>k+'='+v).join(' '));
