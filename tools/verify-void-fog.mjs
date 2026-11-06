// Records the unchanged 1.7.10 void fog rules; see VoidFogProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'void-fog-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/VoidFogProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'VoidFogProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.deepEqual(Object.fromEntries(['provider','color','far','particle'].map(c=>[c,count(c)])),{provider:12,color:56,far:144,particle:104});
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aqo:'WorldProvider',aqq:'WorldProviderSurface',aqp:'WorldProviderHell',aqr:'WorldProviderEnd',ahm:'WorldType',blt:'EntityRenderer',bjf:'WorldClient'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'provider: original WorldProvider.getWorldHasVoidParticles (aqo.j) and getVoidFogYFactor (aqo.k) on the surface, Hell and End providers with each WorldType (aqo.c) and hasNoSky (aqo.g, set by Hell/End b()). color, far, particle: arithmetic transcribed from the javap of EntityRenderer.updateFogColor (blt.a(F) bytes 685-799), setupFog (blt.a(IF) bytes 410-519; creative skips it via capabilities.isCreativeMode) and WorldClient.doVoidFogParticles (bjf.b bytes 116-137) with the same double/float widths. EntityRenderer needs a GL client, so those three are replayed, not run.',records};
await writeFile(path.join(root,'../public/research/void-fog-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} void fog records`);
