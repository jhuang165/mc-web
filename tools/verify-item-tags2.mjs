// Records tools/probes/ItemTags2Probe.java (SkullOwner / Owner GameProfile NBT, TileEntitySkull, BlockSkull drop, ItemMap tooltip, splash potion dispenser) in
// public/research/item-tags2-reference.json; src/itemtags2-b58.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-item-tags2.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'item-tags2-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','ItemTagsProbe','ItemTags2Probe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'ItemTags2Probe'],{maxBuffer:1<<28});
const all=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const by=t=>all.filter(r=>r.tag===t);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={dv:'NBTUtil',aeb:'ItemSkull',anl:'BlockSkull',apn:'TileEntitySkull',adh:'ItemMap',kw:'Bootstrap splash potion dispense behaviour',zo:'EntityPotion'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged NBTUtil, ItemSkull, BlockSkull, TileEntitySkull, ItemMap, ItemStack and the Bootstrap splash potion dispense class (probes/ItemTags2Probe.java; JDK '+process.version+' driver, java 19 runs the probe: UUID.fromString of unusual ids follows that JDK). profile: a SkullOwner compound through dv.a(dh), the written compound text, the ItemSkull title and the stack NBT. tile: TileEntitySkull read/write of Owner and ExtraType. drop: BlockSkull.breakBlock spawned stacks. map: ItemStack.getTooltip and ItemMap.addInformation on a world double with/without map data. dispense: the EntityPotion built by the dispenser behaviour.',
 profiles:by('b58profile'),tiles:by('b58tile'),drops:by('b58drop'),maps:by('b58map'),dispense:by('b58dispense')};
await writeFile(path.join(root,'../public/research/item-tags2-reference.json'),JSON.stringify(reference)+'\n');
console.log(reference.profiles.length,'profile rows',reference.tiles.length,'tile',reference.drops.length,'drop',reference.maps.length,'map',reference.dispense.length,'dispense');
