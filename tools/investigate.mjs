import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);
const root=path.dirname(fileURLToPath(import.meta.url));
const research=path.join(root,'research');
await mkdir(research,{recursive:true});
async function get(url){const res=await fetch(url);if(!res.ok)throw new Error(`${res.status}: ${url}`);return res;}
async function exists(p){try{await access(p);return true;}catch{return false;}}
console.log('Resolving the official Minecraft 1.7.10 artifact…');
const manifest=await(await get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
const version=manifest.versions.find(v=>v.id==='1.7.10');
if(!version)throw new Error('1.7.10 is missing from the manifest');
const metadata=await(await get(version.url)).json();
await writeFile(path.join(research,'version-1.7.10.json'),JSON.stringify(metadata,null,2));
const client=metadata.downloads.client,jar=path.join(research,'minecraft-1.7.10.jar');
if(!await exists(jar))await writeFile(jar,Buffer.from(await(await get(client.url)).arrayBuffer()));
const data=await readFile(jar),sha1=createHash('sha1').update(data).digest('hex');
if(sha1!==client.sha1)throw new Error('Client integrity check failed');
console.log(`Verified client SHA-1: ${sha1}`);
const mappings=path.join(research,'mcp-1.7.10-srg.zip');
if(!await exists(mappings))await writeFile(mappings,Buffer.from(await(await get('https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp/1.7.10/mcp-1.7.10-srg.zip')).arrayBuffer()));
const {stdout:srg}=await exec('unzip',['-p',mappings,'joined.srg'],{maxBuffer:20*1024*1024});
await writeFile(path.join(research,'joined-1.7.10.srg'),srg);
const evidence=path.join(research,'rea-1.7.10-evidence.json');
if(!await exists(evidence)){
  console.log('Running REA 6.8.0 archive inspection under an isolated Node 24 runtime…');
  const {stdout}=await exec('npm',['exec','--yes','--package=node@24','--package=rea-agents@6.8.0','--','rea','inspect-artifact',jar,'--detail','summary','--evidence_output',evidence,'--json'],{maxBuffer:20*1024*1024});
  await writeFile(path.join(research,'rea-1.7.10-summary.json'),stdout);
}else console.log('Retaining the existing REA evidence (REA never overwrites evidence).');
for(const [mapped,name] of [['net/minecraft/entity/EntityLivingBase','living'],['net/minecraft/entity/Entity','entity'],['net/minecraft/client/Minecraft','client'],['net/minecraft/util/FoodStats','food'],['net/minecraft/entity/player/EntityPlayer','player'],['net/minecraft/item/crafting/CraftingManager','crafting'],['net/minecraft/item/crafting/RecipesTools','tool-recipes'],['net/minecraft/item/crafting/RecipesWeapons','weapon-recipes'],['net/minecraft/tileentity/TileEntityFurnace','furnace'],['net/minecraft/world/WorldProvider','world-provider'],['net/minecraft/block/Block','blocks'],['net/minecraft/client/renderer/ItemRenderer','item-renderer'],['net/minecraft/client/renderer/EntityRenderer','entity-renderer'],['net/minecraft/client/model/ModelBiped','biped'],['net/minecraft/client/model/ModelQuadruped','quadruped'],['net/minecraft/item/ItemFood','food-item'],['net/minecraft/item/ItemSword','sword'],['net/minecraft/block/BlockCrops','crops'],['net/minecraft/block/BlockFarmland','farmland'],['net/minecraft/item/ItemHoe','hoe'],['net/minecraft/client/renderer/entity/RenderPlayer','render-player'],['net/minecraft/entity/passive/EntityAnimal','animal'],['net/minecraft/entity/ai/EntityAIMate','mate-ai'],['net/minecraft/entity/item/EntityXPOrb','experience-orb'],['net/minecraft/client/gui/GuiGameOver','death-screen'],['net/minecraft/item/crafting/FurnaceRecipes','furnace-recipes'],['net/minecraft/item/ItemTool','tool'],['net/minecraft/item/ItemPickaxe','pickaxe'],['net/minecraft/item/ItemSpade','shovel'],['net/minecraft/item/ItemAxe','axe'],['net/minecraft/item/ItemShears','shears'],['net/minecraft/client/multiplayer/PlayerControllerMP','player-controller'],['net/minecraft/inventory/ContainerPlayer','inventory-container'],['net/minecraft/inventory/ContainerWorkbench','workbench-container'],['net/minecraft/client/renderer/entity/RenderItem','render-item']]){
  const line=srg.split('\n').find(l=>l.startsWith('CL: ')&&l.trim().endsWith(' '+mapped));
  if(!line)throw new Error(`No mapping for ${mapped}`);
  const symbol=line.split(' ')[1];
  const {stdout}=await exec('javap',['-classpath',jar,'-c','-p',symbol],{maxBuffer:20*1024*1024});
  await writeFile(path.join(research,`${name}-1.7.10-bytecode.txt`),stdout);
  console.log(`${mapped} → ${symbol}: bytecode listing saved`);
}
console.log(`Research saved to ${research}. Raw classes stay local; the separate media importer copies original textures and selected sounds into the web build.`);
