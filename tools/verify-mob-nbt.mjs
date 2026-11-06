// Records the chunk-save NBT of the passive and hostile mobs region import reads through javaMobFromNbt, written and read
// back by the unchanged original classes (tools/probes/MobNbtProbe.java on the HorseProbe/MobMoveProbe world double), in
// public/research/mob-nbt-reference.json; src/mob-nbt.test.js checks java-mobs.js against it. Needs the same JDK, client
// JAR and library JARs as tools/verify-pig-saddle.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-nbt-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','MobNbtProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'MobNbtProbe'],{maxBuffer:1<<28});
const mobs=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(l=>l.case==='mob');
assert.equal(mobs.length,22,'mob records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sg:'EntityList',sa:'Entity',sv:'EntityLivingBase',rx:'EntityAgeable',wf:'EntityAnimal',tg:'EntityTameable',wo:'EntityPig',wh:'EntityCow',wm:'EntityMooshroom',wp:'EntitySheep',wg:'EntityChicken',wv:'EntityWolf',yn:'EntitySpider',xy:'EntityCaveSpider',xz:'EntityCreeper',yp:'EntityWitch',yk:'EntitySilverfish',wr:'EntitySnowman'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/MobNbtProbe.java). Each mob is built with its constructor at (100.5, 64, -20.25), yaw 37.5, and saved with Entity.writeToNBTOptional (sa.c); named keys of that tag are edited and it is loaded with EntityList.createEntityFromNBT (sg.a). nbt is the loaded mob saved again (uncompressed hex); the other fields are its getters.',
 mobs};
await writeFile(path.join(root,'../public/research/mob-nbt-reference.json'),JSON.stringify(reference)+'\n');
console.log('mob nbt reference:',mobs.length,'records',[...new Set(mobs.map(m=>m.id))].join(' '));
