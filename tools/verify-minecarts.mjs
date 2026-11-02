// Records the unchanged EntityMinecartChest (xm), EntityMinecartContainer (xp) and EntityMinecart (xl)
// from the pinned 1.7.10 client (tools/probes/MinecartProbe.java) in
// public/research/minecart-reference.json; src/minecarts.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'minecart-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'MinecartProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(cases.length,34,'minecart cases');
const byName=Object.fromEntries(cases.map(c=>[c.name,c]));
// Sanity: the fist sequence breaks on the fifth hit; creative breaks spill contents without the cart items.
assert.ok(byName['hits-fist'].ticks[4][0][0][9]);
assert.ok(byName['hits-spaced'].ticks.every(t=>!t[0][0][9]));
const ids=c=>c.ticks.flatMap(t=>t[2]).map(i=>i[0]);
assert.ok(ids(byName['hits-fist']).includes(328)&&ids(byName['hits-fist']).includes(54));
assert.ok(!ids(byName['hit-creative']).includes(328)&&ids(byName['hit-creative']).includes(265));
assert.ok(ids(byName['hit-creative-named']).includes(328));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',xl:'EntityMinecart',xp:'EntityMinecartContainer',xm:'EntityMinecartChest',aje:'BlockRailBase',ajf:'BlockRailBase$Rail',xk:'EntityItem',ahb:'World',bhq:'ModelMinecart',boi:'RenderMinecart'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityMinecartChest (xm) subclassed only to log attackEntityFrom, on the XpOrbProbe map-backed World double (MinecartProbe.MW extends World directly; stone below y 0 unless `void`), with World.getCollidingBoundingBoxes\' entity part (ahb.a(sa,azt)) and a recording spawnEntityInWorld. Each cart: rand = new Random(1000 + index), entityId = index + 1, motion set after construction; `loot` fills the first cart with MinecartProbe.LOOT (original ids; slot 20 is an enchanted book with StoredEnchantments [{id 16, lvl 2}]). Each tick: scheduled attackEntityFrom (generic source, or DamageSource.causePlayerDamage of an Unsafe-allocated EntityPlayerSP with PlayerCapabilities.isCreativeMode per `creative`); `push` calls cart.applyEntityCollision(player) (EntityLivingBase.collideWithNearbyEntities\' call); then for every live cart in order lastTickPos and prevRotation are set (World.updateEntityWithOptionalForce) and onUpdate (xl.h) runs. `blocker` lists the player in the entity list so moveEntity collides with its box. Per tick per cart: posX, posY, posZ, motion, onGround, rotationYaw, rotationPitch, isDead, damage, rollingAmplitude, rollingDirection, isInWeb, boundingBox.minY, fire, and the RenderMinecart rail points func_70489_a(pos) and func_70495_a(pos, +-(double)0.3f); then the attackEntityFrom log and the spawned EntityItems (item id, count, damage, position, motion, delayBeforeCanPickup, tag); push cases add the player motion x/z. `nbt` is Entity.writeToNBT (sa.e) before the first tick, UUIDMost/UUIDLeast removed (writeToNBTOptional would add id \"MinecartChest\", but the logging subclass has no EntityList name). Spawned EntityItem motion is Math.random() for entityDropItem (delay 10) items; only the container spill motion is from the cart rand. No game classes patched.',
 cases};
await writeFile(path.join(root,'../public/research/minecart-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} minecart cases, ${cases.reduce((n,c)=>n+c.ticks.length,0)} ticks`);
