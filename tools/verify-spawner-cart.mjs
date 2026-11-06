// Records the unchanged EntityMinecartMobSpawner (xt) / MinecartMobSpawner logic (xu) / MobSpawnerBaseLogic (agq) / WeightedRandomMinecart (agr)
// from the pinned 1.7.10 client (tools/probes/SpawnerCartProbe.java on MinecartProbe's World double) in public/research/spawner-cart-reference.json,
// plus facts read from the RenderMinecartMobSpawner (boj) and CommandSummon (bu) bytecode. src/spawner-cart.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawner-cart-probe');
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
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','MobSpawnerProbe','SpawnerCartProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'SpawnerCartProbe'],{maxBuffer:1<<27});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const facts=records.find(r=>r.case==='facts'),nbt=records.filter(r=>r.case==='nbt'),scenarios=records.filter(r=>r.case==='scenario');
assert.equal(facts.type,4);assert.equal(facts.displayBlock,52);assert.equal(facts.offset,6);
assert.equal(nbt.length,14);assert.equal(scenarios.length,11);
const by=Object.fromEntries(scenarios.map(s=>[s.name,s]));
assert.ok(by['falling-fast-delays'].ticks.some(t=>t.spawned),'a spawn happens');
assert.ok(by['kill-drops-minecart'].ticks.some(t=>t.drops),'a kill drops items');
// Bytecode facts.
const javap=async c=>(await exec('javap',['-c','-p','-constants','-cp',classes,c],{maxBuffer:1<<24})).stdout;
const boj=await javap('boj'),bu=await javap('bu'),xt=await javap('xt'),xu=await javap('xu');
assert.match(boj,/Method bmp\.a:/,'RenderMinecartMobSpawner draws the spinning mob through TileEntityMobSpawnerRenderer');
assert.match(boj,/Method xt\.e:\(\)Lagq;/);
assert.match(xt,/Method xu\.\"?<init>/);
assert.match(xu,/Method (?:java\/lang\/|)?(?:ahb|[a-z]+)\.a:\(Lsa;B\)V/,'event 1 goes through World.setEntityState');
// CommandSummon: Riding loop = EntityList.createEntityFromNBT, setLocationAndAngles, spawnEntityInWorld, Entity.mountEntity.
for(const k of ['String Riding','String commands.summon.failed','String commands.summon.success','Method sg.a:(Ldh;Lahb;)Lsa;','Method sa.a:(Lsa;)V'])assert.ok(bu.includes(k),k);
const render={spawnerCart:{renderer:'RenderMinecartMobSpawner (boj)',blockRenderedBy:'RenderMinecart.renderBlockAsItem path (boi.a)',mobRenderedBy:'TileEntityMobSpawnerRenderer.renderTileEntityMobSpawner (bmp.a) with the cart logic',
 mobArguments:'the cart posX/posY/posZ (absolute world coordinates, not 0), partial tick',frame:'inside the cart scale 0.75 and raise (offset-8)/16 transform'}};
const summon={riding:{loop:'createEntityFromNBT(tag) -> setLocationAndAngles(x,y,z,rotation) -> spawnEntityInWorld -> entity.mountEntity(mount)',mountAt:'the command x,y,z (not the rider position)',
 nullMountEnds:'a failed mount creation ends the loop; the already spawned riders stay',onSpawnWithEgg:'only runs without a data tag (the rider/mount objects are created from tags)',
 abstractIds:{Mob:48,Monster:49,result:'commands.summon.failed (Unable to summon object)'}}};
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xt:'EntityMinecartMobSpawner',xu:'EntityMinecartMobSpawner$1',agq:'MobSpawnerBaseLogic',agr:'WeightedRandomMinecart',xl:'EntityMinecart',bu:'CommandSummon',boj:'RenderMinecartMobSpawner',boi:'RenderMinecart',bmp:'TileEntityMobSpawnerRenderer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityMinecartMobSpawner (xt) on MinecartProbe.MW with a stone floor below y=19. World.rand is an LCG-identical Random with a readable state; CaveSpider and Spider are subclasses that only seed Entity.rand and log getCanSpawnHere. Every tick sets lastTickPos/prevRotation like the world tick, then cart.h(). nbt cases use the real readEntityFromNBT/writeEntityToNBT. Render and CommandSummon facts come from bytecode.',
 facts,render,summon,nbt,scenarios};
await writeFile(path.join(root,'../public/research/spawner-cart-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${nbt.length} nbt cases, ${scenarios.length} scenarios, ${scenarios.reduce((n,c)=>n+c.ticks.length,0)} ticks`);
