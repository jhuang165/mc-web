// Records tools/probes/ItemTagsProbe.java (Lore, SkullOwner, CustomPotionEffects, map tags on ItemStack; the real EntityPotion.onImpact) in public/research/item-tags-reference.json; src/item-tags-b57.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-item-tags.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'item-tags-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','ItemTagsProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'ItemTagsProbe'],{maxBuffer:1<<28});
const all=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const tags=all.filter(r=>r.tag==='b57tag').map(r=>r.row),splash=all.filter(r=>r.tag==='b57splash');
assert.deepEqual(tags.filter(r=>r.error).map(r=>r.name),['skullOwnerCompoundNoName']);
assert.equal(tags.filter(r=>r.tooltipError||r.tooltipError||r.tooltipAdvancedError).length,0,JSON.stringify(tags.filter(r=>r.tooltipError||r.tooltipAdvancedError).slice(0,3)));
assert.equal(splash.filter(r=>r.error!==null).length,0,JSON.stringify(splash.filter(r=>r.error!==null).slice(0,2)));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={add:'ItemStack',adp:'ItemPotion',zo:'EntityPotion',rv:'Potion',rw:'PotionEffect'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged ItemStack, ItemPotion, ItemSkull, EntityPotion (probes/ItemTagsProbe.java). tags: stacks with display.Lore, SkullOwner, CustomPotionEffects and map_is_scaling (some malformed on purpose): the tag as a descriptor (["b",n] byte, ["h",n] short, ["i",n] int, ["s",x] string, ["l",[..]] list, ["c",{..}] compound), ItemStack.getDisplayName, getTooltip(null player, advanced false/true), ItemPotion.getEffects(stack) rows [id, duration, amplifier, ambient], hasEffect, liquid colour, writeToNBT toString. splash: the real EntityPotion.onImpact on a world double whose entity query lists the doubled mobs; one potion stack thrown at impact (0,64,0) with eight mob kinds at an offset, each target recording health, effects and size; direct is the hit kind index.',
 tags,splash};
await writeFile(path.join(root,'../public/research/item-tags-reference.json'),JSON.stringify(reference)+'\n');
console.log(tags.length,'tag rows',splash.length,'splash rows');
