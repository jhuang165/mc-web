// Runs unchanged 1.7.10 RecipeArmorDyes / ItemArmor / ItemStack on a small dyed-armor matrix.
// Requires tools/research/minecraft-1.7.10.jar (or MC_RESEARCH), a JDK and vanilla probe libraries.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, 'minecraft-1.7.10.jar'))) { research = dir; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), out = path.join(research, 'leather-dye-probe'), CLIENT_SHA1 = 'e80d9b3bf5085002218d4be59e668bac718abbc6';
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), CLIENT_SHA1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries'), path.join(os.homedir(), '.gradle/caches')]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec('find', [dir, '-name', prefix + '*.jar', '-not', '-name', '*sources*'], { maxBuffer: 1 << 24 });
    const hit = stdout.split('\n').filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'commons-io-', 'authlib-', 'netty-'].map(library));
const classes = path.join(out, 'classes'); await rm(classes, {recursive:true,force:true}); await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
await mkdir(path.join(classes,'assets/minecraft/lang'),{recursive:true});
await writeFile(path.join(classes,'assets/minecraft/lang/en_US.lang'),'# empty language table for headless native probe\n');
const srg = await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'), className=(mcp)=>{
  const line=srg.split('\n').find((l)=>l.endsWith(' net/minecraft/'+mcp.replaceAll('.','/') ));
  if(!line)throw new Error(`Missing MCP class mapping for ${mcp}`);return line.split(' ')[1];
};
const names=['item/crafting/RecipesArmorDyes','inventory/InventoryCrafting','inventory/Container','item/ItemStack','item/Item','nbt/NBTTagCompound','world/World','init/Items','inventory/ContainerWorkbench','init/Bootstrap','item/ItemArmor','entity/passive/EntitySheep'];
const mapped=names.map(className), probe=path.join(out,'probe'); await mkdir(probe,{recursive:true}); const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/LeatherDyeProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'LeatherDyeProbe',...mapped],{maxBuffer:1<<24});
const parsed=stdout.trim().split('\n').filter((l)=>l.startsWith('{')).map(JSON.parse), dyeRow=parsed.find((r)=>r.kind==='dyeColors'), records=parsed.filter((r)=>r.kind==='case');
assert.equal(dyeRow.colors.length,16); assert.equal(records.length,324);
const byName=Object.fromEntries(records.map((r)=>[r.name,r.color]));
assert.equal(byName.noDye,null); assert.equal(byName.invalidItem,null); assert.equal(byName.twoArmors,null); assert.equal(byName.dyeOnly,null);
const reference={target:'Minecraft Java 1.7.10',clientSha1:CLIENT_SHA1,jvm:String((await exec('java',['-XshowSettings:properties','-version'])).stderr).match(/java\.version = (\S+)/)?.[1]||'unknown',
  method:'Unchanged RecipeArmorDyes.matches/getCraftingResult, ItemArmor color NBT, ItemStack, InventoryCrafting, registered ItemDye colors and unchanged EntitySheep color table. Records cover every single dye, all 256 dye pairs, each of 16 dyes mixed with prior black, white and 0x123456 colors, plus rejected grids. RecipeArmorDyes is invoked directly with its native 3x3 InventoryCrafting. Output colors and null-match cases are emitted from native display.color.',dyeColors:dyeRow.colors,records};
await writeFile(path.join(root,'../public/research/leather-dye-reference.json'),JSON.stringify(reference)+'\n');
console.log('Unchanged Java leather dye records:',records.length,'cases');
