// Records batch 42 enderman and wolf targeting (tools/probes/EndermanWolfProbe.java, scenarios in EndermanWolfScenarios.java) against a real EntityPlayerMP from the unchanged 1.7.10 classes into
// public/research/enderman-wolf-b42-reference.json (EW_SET=b43: the batch 43 scenarios into enderman-wolf-b43-reference.json); src/enderman-wolf-b42.test.js and enderman-wolf-b43.test.js replay them. Run with MC_RESEARCH=<dir with minecraft-1.7.10.jar>.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'endermanwolf-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
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
// Batch 39: the same kind of edit for EntityLivingBase (sv.class): its Methodref `java/lang/Math.random()D` gets the class SeedMath (probes/SeedMath.java), which records every call
// outside a constructor (an arrow hitting its own mount's rider makes attackEntityFrom draw the knockback direction from Math.random).
{const file=path.join(classes,'sv.class'),buf=await readFile(file);
 const count=buf.readUInt16BE(8),utf=new Map(),cls=new Map(),nat=new Map(),refs=[];let at=10,i=1;
 while(i<count){const tag=buf[at];
  if(tag===1){const len=buf.readUInt16BE(at+1);utf.set(i,buf.toString('latin1',at+3,at+3+len));at+=3+len;}
  else if(tag===3||tag===4){at+=5;}else if(tag===5||tag===6){at+=9;i++;}
  else if(tag===7){cls.set(i,buf.readUInt16BE(at+1));at+=3;}else if(tag===8||tag===16||tag===19||tag===20){at+=3;}
  else if(tag===12){nat.set(i,[buf.readUInt16BE(at+1),buf.readUInt16BE(at+3)]);at+=5;}
  else if(tag===10){refs.push([i,at,buf.readUInt16BE(at+1),buf.readUInt16BE(at+3)]);at+=5;}else if([9,11,17,18].includes(tag)){at+=5;}else if(tag===15){at+=4;}else throw new Error('cp tag '+tag);
  i++;}
 const mathClass=[...cls].find(([,n])=>utf.get(n)==='java/lang/Math')[0];
 const hits=refs.filter(([,,c,n])=>c===mathClass&&utf.get(nat.get(n)[0])==='random'&&utf.get(nat.get(n)[1])==='()D');
 assert.equal(hits.length,1,'sv.class has one Math.random Methodref');
 const name=Buffer.from('SeedMath'),add=Buffer.concat([Buffer.from([1,0,name.length]),name,Buffer.from([7,count>>8,count&255])]);
 const out2=Buffer.concat([buf.subarray(0,at),add,buf.subarray(at)]);
 out2.writeUInt16BE(count+2,8);out2.writeUInt16BE(count+1,hits[0][1]+1);
 await writeFile(file,out2);}
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ArmorEnchantmentProbe','SeedRandom','SeedMath','ServerPlayerProbe','VillageFightProbe','EndermanWolfProbe','EndermanWolfScenarios'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const set=process.env.EW_SET==='b47sp'?'b47sp':process.env.EW_SET==='b46mp'?'b46mp':process.env.EW_SET==='b45cw'?'b45cw':process.env.EW_SET==='b45'?'b45':process.env.EW_SET==='b44'?'b44':process.env.EW_SET==='b43'?'b43':'b42'; // EW_SET=b43 records the batch 43 scenarios (b43wd- prefix) into enderman-wolf-b43-reference.json
const {stdout,stderr}=await exec('java',['-cp',cp,'EndermanWolfProbe',...(set==='b42'?[]:[set])],{maxBuffer:1<<29});
if(process.env.EW_ERR)await writeFile(process.env.EW_ERR,stderr);
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.env.EW_DUMP){await writeFile(process.env.EW_DUMP,JSON.stringify(records)+'\n');process.exit(0);}
assert.ok(records.length>=(set==="b47sp"?19:set==="b46mp"?19:set==="b45cw"?77:set==="b45"?88:set==="b44"?54:set==='b43'?17:55),'records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ya:'EntityEnderman',wv:'EntityWolf',tg:'EntityTameable',vr:'EntityAITargetNonTamed',vs:'EntityAIOwnerHurtByTarget',vt:'EntityAIOwnerHurtTarget',vn:'EntityAIHurtByTarget',vu:'EntityAITarget',mw:'EntityPlayerMP',ahb:'World',...(set==='b44'||set==='b45'||set==='b45cw'||set==='b46mp'||set==='b47sp'?{wf:'EntityAnimal',rx:'EntityAgeable',wh:'EntityCow',wm:'EntityMooshroom',wo:'EntityPig',wi:'EntityHorse',wn:'EntityOcelot',wt:'EntityIronGolem',wr:'EntitySnowman',yp:'EntityWitch',xz:'EntityCreeper',ua:'EntityAIMate',vk:'EntityAITempt',uh:'EntityAIFollowParent',vc:'EntityAIWander',un:'EntityAIWatchClosest',vb:'EntityAILookIdle',ud:'EntityAIEatGrass',tw:'EntityAIAvoidEntity',vg:'EntityAIRunAroundLikeCrazy',uw:'EntityAIOcelotSit',uz:'EntityAIPanic',...(set==='b45cw'||set==='b46mp'||set==='b47sp'?{zo:'EntityPotion',agw:'Explosion',sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',yl:'EntitySkeleton',zc:'EntityArrow',xh:'EntityLightningBolt'}:{})}:{})};
const classes_=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classes_,
 method:(set==='b47sp'?'Batch 47 (serverplayer): the batch 46 harness where the probe player is the server copy under the C03 rules: the client is a separate position (the walk and move ops drive it) that sends a position packet when it moved over 0.03 or 20 ticks passed (EntityClientPlayerMP.sendMotionUpdates), and the copy is put back to the position it had after each EntityPlayerMP.onUpdateEntity (NetHandlerPlayServer.processPlayer), so only its motion keeps what the update did (block collisions, water, lava, web, ladder, the sneak edge, flying). Row elements 6 and 7 are the client onGround flag (op ground) and y; element 8 is the copy position after the tick. Scenarios: knockbacks into a wall, a ceiling and a ledge, in the air, in water, lava, a web and on a ladder, creeper blasts in the open and against obsidian, slow and nudged clients, a herd and a flying creative player. ':set==='b46mp'?'Batch 46 (mobpush): the batch 45 creeperwitch harness (rows with the fifth element) where the probe also runs EntityPlayerMP.onUpdateEntity (mw.i: onLivingUpdate with the motion snap, moveEntity, the ground friction, then collideWithNearbyEntities) on its real player after the mobs each tick, with the statistics map allocated, ticksExisted counted by that update only, motionY -0.0784 and onGround at the start, and the server copy put back at the client x and z after it (a position packet). Row element 5[3] is the player motion (x, y, z); row elements 6 and 7 are whether the copy was onGround when its update began and its y at the start of the tick (inputs the client reports; the replay feeds them). Scenarios: cows and pigs touching, diagonal, coincident, near the 0.01 threshold, a crowd, creative, walking into and through herds, a zombie (touch and hit knockback), witches throwing at a pushed, knocked or walking player and at a knocked cow. ':set==='b45cw'?'Batch 45 (creeperwitch): the batch 44 harness plus a fifth row element [explosions [x,y,z,size,flaming,smoking,push], spawned items/orbs/potions, changed cells, player motion] recorded by a World.newExplosion override and the world random reseeded per record; creeper flags [state, fuse, lastActive, powered, ignited] and witch flags [drinking, timer, held potion, movement speed]. Creepers (fuse, flint and steel, lightning, power 3 and 6, mobGriefing, difficulty, damage and knockback, drops, a skeleton arrow kill) and witches (potion choice, throws on the potion own random, self drinking, drops). Mobs spawned mid-run are never ticked. ':set==='b45'?'Batch 45 (horses): the batch 44 harness with horses of fixed type, variant, tame flag, age and attribute bases (Q, q, D, F, Y, R), horses built by onSpawnWithEgg (V; record.init holds the spawn draws), feeding through EntityPlayer.interactWith and breeding through EntityAIMate (row element 6 of a horse is [love, growingAge, type, variant, tame, temper, max health, speed, jump, health] with the attribute bases as doubles; row element 5 lists the horses spawned that tick in the same form). ':set==='b44'?'Batch 44 (passivedraws): the batch 43 harness extended (row element 6 of animals and wolves also carries [inLove, growingAge]); cows, mooshrooms, pigs, a horse (health, max health and speed fixed to 20, 20, 0.2), wild and tamed ocelots, iron and snow golems, witches and creepers on Entity.rand, with players holding wheat, carrots, raw fish or bones (script ops holdn, use, health), wolf taming, feeding and breeding, cow, pig and ocelot breeding, and the replayed babies a mating task spawns (visible to the parents push for that tick only). ':set==='b43'?'Batch 43 (wanderdraws): the batch 42 harness (Entity.rand logs now include nextDouble as d, row element 8 = [motion x y z, yaw, pitch, head yaw, body yaw, onGround, jumping, moveForward, moveStrafing]); long idle wanders, carried blocks, begging and following wolves. ':'Batch 42. ')+'Unchanged classes on the VillageLiveProbe double (no village), the player a real EntityPlayerMP (ServerPlayerProbe), every mob ticked by Entity.onUpdate. Per tick: [mob rows [x,y,z,health,target index,revenge index,flags,draws], sounds, player health lost, player revenge index, player ticks]; the player has index types.length. See EndermanWolfProbe.java for types and script ops.',
 records};
await writeFile(path.join(root,'../public/research/enderman-wolf-'+set+'-reference.json'),JSON.stringify(reference)+'\n');
console.log('records',records.length);
