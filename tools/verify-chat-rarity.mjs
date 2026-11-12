// Records the executed ItemStack.func_151000_E and getRarity for every item (tools/probes/ChatRarityProbe.java) in public/research/chat-rarity-reference.json; src/chat-rarity-b55.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-chat-component.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chat-rarity-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
// The client jar ships no en_US.lang (it lives in the asset index); StringTranslate (de) reads it from the classpath. The lines the trees need are taken
// from the port's table and recorded; the executed part is how fr/fq/fn/dd/de turn them into formatted and unformatted text.
const LANG_KEYS=['commands.help.header','commands.tp.usage','commands.help.footer','commands.generic.deprecatedId','chat.type.admin','commands.give.success','commands.tp.success.coordinates','commands.generic.usage','chat.type.achievement','chat.type.announcement','chat.type.text','commands.message.display.incoming','commands.message.display.outgoing','chat.type.emote','death.attack.player','death.attack.mob','death.attack.generic'];
const {EN_US}=await import(path.join(root,'../src/lang-en-us.js'));
const lang=Object.fromEntries(LANG_KEYS.map(k=>{assert.ok(EN_US[k]!=null,k);return [k,EN_US[k]];}));
const res=path.join(out,'res');await rm(res,{recursive:true,force:true});await mkdir(path.join(res,'assets/minecraft/lang'),{recursive:true});
await writeFile(path.join(res,'assets/minecraft/lang/en_US.lang'),Object.entries(lang).map(([k,v])=>k+'='+v).join('\n')+'\n');
const cp=[probe,res,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/ChatRarityProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ChatRarityProbe'],{maxBuffer:1<<26});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={add:'ItemStack',adb:'Item',adq:'EnumRarity',fq:'ChatComponentText',fn:'ChatStyle',fk:'IChatComponent$Serializer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged ItemStack (add) func_151000_E (E) and getRarity (w) over every registered item: rarity is [id, plain, plain diffs, ench-tag, ench diffs, StoredEnchantments, stored diffs] with diffs [[damage, rarity]] against damage 0 over 0..299 and the potion damages; rows are [name, fk.a JSON, getFormattedText, getUnformattedText, rarity, NBT string] for named stacks. EnumRarity names: common, uncommon, rare, epic.',
 rarity:lines[0].rarity,rows:lines[0].rows};
await writeFile(path.join(root,'../public/research/chat-rarity-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.rarity.length} items, ${reference.rows.length} rows`);
