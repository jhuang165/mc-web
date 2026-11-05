// Records ContainerHorseInventory, leash, lead, name tag behaviour from the unchanged original classes
// (tools/probes/HorseProbe.java and ModelProbe.java, on the MobMoveProbe world double) in
// public/research/horse-gear-reference.json; src/horse.test.js checks the browser port against it. Needs the same JDK,
// client JAR and library JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse-gear-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/HorseProbe.java'),path.join(root,'probes/HorseGearProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'HorseGearProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const cases={container:7,slotValid:98,transfer:80,usable:12,drops:4,leash:24,leashHolderDead:1,leashUse:16,unleash:2,knot:10,knotNoFence:1,knotClick:4,nameTag:30,recipe:1,itemIds:1};
for(const [c,n] of Object.entries(cases))assert.equal(pick(c).length,n,c);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aam:'ContainerHorseInventory',aan:'ContainerHorseInventory saddle Slot',aao:'ContainerHorseInventory armour Slot',zt:'AnimalChest',wi:'EntityHorse',sw:'EntityLiving',td:'EntityCreature',su:'EntityLeashKnot',adf:'ItemLead',adm:'ItemNameTag',bft:'GuiScreenHorseInventory'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/HorseGearProbe.java), with an entity list, a fence block and an empty chunk provider so pathfinding runs. container: new aam(inventory, AnimalChest, horse) slot layout. slotValid: Slot.isItemValid. transfer: transferStackInSlot. usable: canInteractWith. drops: EntityHorse.cK. leash: td.bL (updateLeashedState) called three times per distance and vertical offset. leashUse: EntityLiving.c(EntityPlayer) with a lead. knot: ItemLead.onItemUse over a fence. knotClick: EntityLeashKnot.interact. nameTag: ItemNameTag.itemInteractionForEntity. recipe: the CraftingManager recipe whose result is the lead. The leash catenary render and the jump bar are not probed (see horse-gear.md Gaps).',
 counts:cases,container:pick('container'),slotValid:pick('slotValid'),transfer:pick('transfer'),usable:pick('usable'),drops:pick('drops'),leash:pick('leash'),leashHolderDead:pick('leashHolderDead'),leashUse:pick('leashUse'),unleash:pick('unleash'),knot:pick('knot'),knotNoFence:pick('knotNoFence'),knotClick:pick('knotClick'),nameTag:pick('nameTag'),recipe:pick('recipe'),itemIds:pick('itemIds')[0]};
await writeFile(path.join(root,'../public/research/horse-gear-reference.json'),JSON.stringify(reference)+'\n');
console.log('horse gear reference:',Object.entries(cases).map(([k,v])=>k+'='+v).join(' '));
