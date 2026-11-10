// Records Entity.getEyeHeight (sa.g) for every concrete Entity subclass of the unchanged 1.7.10 JAR (tools/probes/EyeHeightProbe.java)
// in public/research/eye-height-reference.json; src/eye-height.test.js checks the browser port against it. Class names come from the
// ignored joined SRG mapping in the research folder (only names are copied). Needs the same JDK, client JAR and library JARs as tools/verify-hanging.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'eye-height-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-','lwjgl-2'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
// EntityHorse's constructor reads StatCollector (/assets/minecraft/lang/en_US.lang); an empty file stands in so the real constructor runs (translations are not asked).
await mkdir(path.join(probe,'assets/minecraft/lang'),{recursive:true});await writeFile(path.join(probe,'assets/minecraft/lang/en_US.lang'),'');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','EyeHeightProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Dclasses='+classes,'-Dtrace='+(process.env.EYE_TRACE||'-'),'-cp',cp,'EyeHeightProbe'],{maxBuffer:1<<26});
if(process.env.EYE_TRACE)console.error(stderr);
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
// Names from the SRG: "CL: obf net/minecraft/entity/..."
const names={};for(const l of (await readFile(path.join(research,'joined-1.7.10.srg'),'utf8')).split('\n')){const m=/^CL: (\S+) (\S+)$/.exec(l);if(m)names[m[1]]=m[2].split('/').pop();}
const digest=async n=>createHash('sha256').update((await exec('unzip',['-p',jar,n+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
for(const r of rows){r.name=names[r.class]||r.class;r.declaredInName=names[r.declaredIn]||r.declaredIn;}
const hashes={};for(const c of new Set(rows.flatMap(r=>[r.class,r.declaredIn]).filter(Boolean)))hashes[c]=await digest(c);
rows.sort((a,b)=>a.name<b.name?-1:1);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Every concrete subclass of Entity (sa) in the unchanged JAR is constructed through its (World) constructor on MobMoveProbe.ProbeWorld and Entity.getEyeHeight (sa.g) is called; classes without a (World) constructor are built through their real constructors with default arguments (horse with an empty en_US.lang, EntityPlayerMP on server/world doubles, client players on a no-op skin manager, dragon parts from the dragon); a class that still cannot be built would be allocated and asked with marker heights 1, 2, 3 (formula only).',
 classes:rows,classSha256:hashes};
await writeFile(path.join(root,'../public/research/eye-height-reference.json'),JSON.stringify(reference)+'\n');
console.log('eye heights:',rows.length,'classes;',rows.filter(r=>r.how==='allocated').length,'allocated (formula only)');
