// Records ActiveEffects NBT (EntityLivingBase.writeEntityToNBT / readEntityFromNBT) of every mob kind the port has, written and read back by the unchanged
// 1.7.10 classes (tools/probes/MobEffectsProbe.java, tag b52me), in public/research/mob-effects-reference.json; src/mob-effects-b52.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-effects-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','MobEffectsProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'MobEffectsProbe'],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(rows.filter(r=>r.error).length,0,rows.filter(r=>r.error).map(r=>r.kind+': '+r.error).join('; '));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sv:'EntityLivingBase',rw:'PotionEffect',sg:'EntityList',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',tag:'b52me',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/MobEffectsProbe.java). Each mob is created by EntityList.createEntityByName, PotionEffects are put into its active-effect map, it is saved with Entity.writeToNBTOptional (nbt, uncompressed hex), loaded with EntityList.createEntityFromNBT and the loaded mob is saved again (reload). effects are [id, amplifier, duration, ambient] of the loaded mob.',
 cases:[[],[[1,0,600,0]],[[5,1,100,0],[1,2,3000,1],[10,0,5,0]],[[11,200,1000,0],[22,255,40,0]],[[12,0,2147483647,0],[13,0,7,0]],[[3,0,50,0],[14,0,50,0]]],
 rows};
await writeFile(path.join(root,'../public/research/mob-effects-reference.json'),JSON.stringify(reference)+'\n');
console.log('mob effects reference:',rows.length,'records',new Set(rows.map(r=>r.kind)).size,'kinds');
