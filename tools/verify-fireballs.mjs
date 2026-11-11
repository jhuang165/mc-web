// Batch 40 fireballs: records large and small fireballs ticked whole (ze.h) on the unchanged 1.7.10 classes (probes/FireballProbe.java, the LegacyAiProbe double)
// into public/research/fireballs-reference.json; src/fireballs-native.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fireballs-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ArmorEnchantmentProbe','SeedRandom','SeedMath','ServerPlayerProbe','VillageFightProbe','FireballProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'FireballProbe'],{maxBuffer:1<<29});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.env.FB_DUMP){await writeFile(process.env.FB_DUMP,JSON.stringify(records)+'\n');process.exit(0);} // development aid (with FB_ONLY): the records of this run, nothing else written
const b41=records.filter(r=>r.name.startsWith('fb41-')),b42=records.filter(r=>r.name.startsWith('fb42-')),b43=records.filter(r=>r.name.startsWith('fb43-')),old=records.filter(r=>!/^fb4[123]-/.test(r.name));
assert.ok(process.env.FB_PREFIX==="fb43-"?b43.length>=28:process.env.FB_PREFIX==='fb42-'?b42.length>=15:process.env.FB_PREFIX?b41.length>=8:old.length>=20,'fireball records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ym:'EntitySlime',yf:'EntityMagmaCube',yd:'EntityGhast',xx:'EntityBlaze',sr:'EntityFlying',td:'EntityCreature',yg:'EntityMob',sw:'EntityLiving',sv:'EntityLivingBase',sa:'Entity',zg:'EntityLargeFireball',zi:'EntitySmallFireball',ze:'EntityFireball'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 39. Unchanged classes in the VillageLiveProbe double (real sight rays, a real EntityPlayer double in closePlayers, real water when `water`), every mob ticked by Entity.onUpdate. Mobs by `types` (s slime, m magma cube, g ghast, b blaze; `sizes` for the first two), then the player, then split slimes in spawn order. Row: [[per entity x, y, z, vx, vy, vz, yaw, onGround, health, target index, type fields, Entity.rand draws], sounds, level events, spawned fireballs]. Entity.rand of a mob is seeded seed*10+index; an entity built mid-run is a SeedRandom (seed listed). The player is never ticked; EntityPlayer.collideWithPlayer is emulated right after each slime update.',
 records:old};
// Batch 41: fireballs-b41-reference.json (the inGround path and blaze volleys at mobs; mobs ticked: record field tickMobs). The older file is rewritten only with FB_REWRITE_OLD=1.
const reference41={...reference,method:'Batch 41. Same double, row layout and script ops as fireballs-reference.json, plus: `ground k x y z` sets EntityFireball.inGround, xTile, yTile, zTile and inTile of ball k to the block at (x, y, z) (no 1.7.10 path sets them; EntityFireball.onUpdate then runs natively: ticksAlive counts to 600, a missing or different tile releases the ball with its motion scaled by three Random floats); `air x y z` removes a block; `hurt` kinds a<i> (an arrow shot by mob i) and t<i> (a thrown snowball of mob i). With `tickMobs` every mob is updated each tick before the fireballs (types x skeleton, w snow golem added) and a fireball a mob spawns joins the list at once and ticks in the same pass; `shots` lists them as [tick, large, shooter index, Entity.rand seed].',records:b41};
// Batch 42: fireballs-b42-reference.json (FB_PREFIX=fb42-): one loaded entity list in insertion order (`unified`: mobs and balls walked by index, a ball a mob launches joins the end; `join k` adds mob k at that tick, `idle k` never adds it, `health k h` setHealth), ghast balls at mobs, the ghast's target (slot 9) and a snowball thrown at a blaze (`snow v i`, EntitySnowball.onImpact executed).
const reference42={...reference41,method:'Batch 42. Same double and row layout as fireballs-b41-reference.json (rows keep the ghast target index in slot 9 of an entity: the player index or -1), with `unified: true` records walking ONE list in insertion order as World.updateEntities does (a ball launched before a mob joined updates before it; a ball launched in the pass updates in it; the mobs that tick are those of `types` not named by a `join` or `idle` op), plus the ops `join k`, `idle k`, `health k h` and `snow v i` (a snowball of thrower i lands on entity v through zj.a(MovingObjectPosition), hurts row [v, damaged, health]).',records:b42};
const reference43={...reference42,method:'Batch 43. Same double, ops and rows as fireballs-b42-reference.json (unified list, mobs ticked), plus `draws: true`: a seventh row section lists, per entity in list order, the draws its own Random made during that tick (each as [kind, value] exactly as VillageFightProbe.Log records them). Idle wanderers (spider, pigman, blaze, silverfish over their wander, hide and despawn), the small ghast balls at mobs on the seeds batch 42 avoided, and an iron golem beside a blaze that it kills (corpse motion and corpse draws included).',records:b43};
if(process.env.FB_PREFIX==='fb43-')await writeFile(path.join(root,'../public/research/fireballs-b43-reference.json'),JSON.stringify(reference43)+'\n');
if(process.env.FB_PREFIX==='fb42-')await writeFile(path.join(root,'../public/research/fireballs-b42-reference.json'),JSON.stringify(reference42)+'\n');
if(process.env.FB_PREFIX==='fb41-'||process.env.FB_REWRITE_B41)await writeFile(path.join(root,'../public/research/fireballs-b41-reference.json'),JSON.stringify(reference41)+'\n');
if(!process.env.FB_PREFIX||process.env.FB_REWRITE_OLD)await writeFile(path.join(root,'../public/research/fireballs-reference.json'),JSON.stringify(reference)+'\n');
console.log('fireball records:',records.length);
