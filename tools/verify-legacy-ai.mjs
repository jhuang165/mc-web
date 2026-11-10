// Batch 39 legacyai: records slimes, magma cubes, ghasts and blazes ticked whole on the unchanged 1.7.10 classes (probes/LegacyAiProbe.java, which
// reuses the VillageFightProbe double) into public/research/legacy-ai-reference.json; src/legacy-ai.test.js replays it Random draw for Random draw.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'legacy-ai-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
// Batch 32: Entity (sa) builds its Entity.rand with `new Random()` (clock seeded). Add a constant-pool Class entry SeedRandom (probes/SeedRandom.java extends
// Random and counts seeds up from a value the probe sets) and point the one `new Random; dup; invokespecial <init>` of sa.class at it: no instruction of
// Entity changes except those two operands, every other use of Random in sa keeps the java/util/Random entry.
{const file=path.join(classes,'sa.class'),buf=await readFile(file);
 const count=buf.readUInt16BE(8),utf=new Map(),classes_=new Map(),methods=new Map();let at=10,i=1;
 while(i<count){const tag=buf[at];
  if(tag===1){const len=buf.readUInt16BE(at+1);utf.set(i,buf.toString('latin1',at+3,at+3+len));at+=3+len;}
  else if(tag===3||tag===4){at+=5;}else if(tag===5||tag===6){at+=9;i++;}
  else if(tag===7){classes_.set(i,buf.readUInt16BE(at+1));at+=3;}else if(tag===8||tag===16||tag===19||tag===20){at+=3;}
  else if(tag===10){methods.set(i,at);at+=5;}else if([9,11,12,17,18].includes(tag)){at+=5;}else if(tag===15){at+=4;}else throw new Error('cp tag '+tag);
  i++;}
 const randomClass=[...classes_].find(([,n])=>utf.get(n)==='java/util/Random')[0];
 const code=Buffer.from([0xbb,randomClass>>8,randomClass&255,0x59,0xb7]);let hit=-1,found=0;for(let k=buf.indexOf(code);k>=0;k=buf.indexOf(code,k+1)){found++;hit=k;}
 assert.equal(found,1,'sa.class has one new Random');
 const method=buf.readUInt16BE(hit+5),entry=methods.get(method);
 const name=Buffer.from('SeedRandom'),add=Buffer.concat([Buffer.from([1,0,name.length]),name,Buffer.from([7,count>>8,count&255])]); // utf8 at index count, Class at count + 1
 const out2=Buffer.concat([buf.subarray(0,at),add,buf.subarray(at)]);
 out2.writeUInt16BE(count+2,8);out2.writeUInt16BE(count+1,entry+1);out2.writeUInt16BE(count+1,hit+add.length+1); // the cp entries precede `at`, so the Methodref offset is unchanged
 await writeFile(file,out2);}
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ArmorEnchantmentProbe','SeedRandom','VillageFightProbe','LegacyAiProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'LegacyAiProbe'],{maxBuffer:1<<29});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.env.LA_DUMP){await writeFile(process.env.LA_DUMP,JSON.stringify(records)+'\n');process.exit(0);} // development aid (with LA_ONLY): the records of this run, nothing else written
assert.ok(records.length>=30,'legacyai records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ym:'EntitySlime',yf:'EntityMagmaCube',yd:'EntityGhast',xx:'EntityBlaze',sr:'EntityFlying',td:'EntityCreature',yg:'EntityMob',sw:'EntityLiving',sv:'EntityLivingBase',sa:'Entity',zg:'EntityLargeFireball',zi:'EntitySmallFireball',ze:'EntityFireball'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 39. Unchanged classes in the VillageLiveProbe double (real sight rays, a real EntityPlayer double in closePlayers, real water when `water`), every mob ticked by Entity.onUpdate. Mobs by `types` (s slime, m magma cube, g ghast, b blaze; `sizes` for the first two), then the player, then split slimes in spawn order. Row: [[per entity x, y, z, vx, vy, vz, yaw, onGround, health, target index, type fields, Entity.rand draws], sounds, level events, spawned fireballs]. Entity.rand of a mob is seeded seed*10+index; an entity built mid-run is a SeedRandom (seed listed). The player is never ticked; EntityPlayer.collideWithPlayer is emulated right after each slime update.',
 records};
await writeFile(path.join(root,'../public/research/legacy-ai-reference.json'),JSON.stringify(reference)+'\n');
console.log('legacyai records:',records.length,'bytes:',JSON.stringify(reference).length);
