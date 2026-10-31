// Records overworld weather facts from the unchanged original classes
// (tools/probes/WeatherProbe.java) in public/research/weather-reference.json;
// src/weather.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs. The probe allocates World/WorldInfo/WorldProvider
// without constructors (sun.misc.Unsafe), so it needs no LWJGL, Gson or Netty.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'weather-probe');
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
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/WeatherProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'WeatherProbe'],{maxBuffer:1<<26});
const facts=JSON.parse(stdout);
assert.equal(facts.timers.length,10);assert.equal(facts.sky.rows.length,9*3*19);assert.equal(facts.strike.length,7*4*2*3);assert.equal(facts.bolts.length,36);
assert.ok(facts.timers.every(t=>t.events.length>4&&t.samples.length>100));
assert.ok(facts.bolts.every(b=>b.ticks.at(-1).dead));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',ays:'WorldInfo',aqo:'WorldProvider',aqq:'WorldProviderSurface',xh:'EntityLightningBolt',xg:'EntityWeatherEffect',ahu:'BiomeGenBase',awt:'Material',blt:'EntityRenderer',bma:'RenderGlobal',mt:'WorldServer',sa:'Entity',blf:'EntityRainFX'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes. timers: World.updateWeather (ahb.o) run once per tick from new java.util.Random(seed) with WorldInfo start [rainTime, thunderTime, raining, thundering]; events are [tick, rainTime, thunderTime, raining, thundering] on every tick where the timers or flags did anything but count down by one (and every tick a timer is <= 0); samples are [tick, prevRain, rain, prevThunder, thunder] floats. sky: rows over states [prevRain, rain, prevThunder, thunder, lastLightningBolt], partials, celestial angles (a fixture for World.getCelestialAngle) and biomes (plains, extreme hills, ice plains): sub = calculateSkylightSubtracted, sun = getSunBrightness, star = getStarBrightness, rain = getRainStrength, thunder = getWeightedThunderStrength, cloud = getCloudColour, fog = getFogColor (provider only), sky = getSkyColor per biome for an entity at y 20. strike: [biome, rain strength, canBlockSeeTheSky, precipitationHeight - y, canLightningStrikeAt]. biomes: [id, getFloatTemperature, canSpawnLightningBolt, getEnableSnow]. precipitation: [block id, Material.blocksMovement, Material.isLiquid] for every block that stops Chunk.getPrecipitationHeight. bolts: client-side EntityLightningBolt (E = true) ticked from a seeded Entity.rand with boltLivingTime 1-3: per tick lightningState, boltLivingTime, boltVertex (as a string), World.lastLightningBolt after the tick, dead, and the sounds played [name, volume, pitch]. EntityRenderer.updateFogColor needs LWJGL, so its rain and thunder terms come from the bytecode only (public/research/weather.md).',
 ...facts};
await writeFile(path.join(root,'../public/research/weather-reference.json'),JSON.stringify(reference)+'\n');
console.log('timers',facts.timers.map(t=>t.events.length).join(','),'rows',facts.sky.rows.length,'bolts',facts.bolts.length);
