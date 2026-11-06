// npm run music:fetch — installs the original Minecraft 1.7.10 music and record streams (sounds.json "stream": true; about
// 100 MB in 41 files) into public/audio/1.7.10-streams/, which Git ignores. The game plays music and records only when
// that directory's manifest.json exists, and silently skips them otherwise.
// Every file comes from the 1.7.10 asset index (SHA-1 1863782e33ce7b584fc45b037325a1964e095d3e) and is SHA-1 checked
// against it before it is written; the index itself is checked against that hash. Sources, in order:
//   index:   $MC_ASSET_INDEX, tools/research/assets-1.7.10.json (here or in a parent folder), the launcher's
//            assets/indexes/1.7.10.json, then Mojang's launcher metadata host.
//   objects: $MC_ASSETS (an assets folder holding objects/<hh>/<hash>), the launcher's assets/objects, then Mojang's
//            resources host. sounds.json (the event definitions) may also come from $MC_SOUNDS_JSON or a public mirror
//            of the 1.7.10 assets; whatever the source, its hash must match the index entry.
// Original Minecraft music and records © Mojang / Microsoft (C418); they are not redistributed in this repository.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import path from 'node:path';import os from 'node:os';
const INDEX_SHA1='1863782e33ce7b584fc45b037325a1964e095d3e';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'public/audio/1.7.10-streams');
const sha1=b=>createHash('sha1').update(b).digest('hex'),exists=p=>access(p).then(()=>true,()=>false);
const launcher=[path.join(os.homedir(),'Library/Application Support/minecraft'),path.join(os.homedir(),'.minecraft'),process.env.APPDATA&&path.join(process.env.APPDATA,'.minecraft')].filter(Boolean);
async function local(p,hash){try{const b=await readFile(p);return sha1(b)===hash?b:null;}catch{return null;}}
async function remote(url,hash){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)return null;const b=Buffer.from(await r.arrayBuffer());return sha1(b)===hash?b:null;}catch{return null;}
}
async function first(sources,hash){for(const s of sources){const b=s.startsWith('http')?await remote(s,hash):await local(s,hash);if(b)return b;}return null;}
const parents=[];for(let d=root,i=0;i<6;i++,d=path.dirname(d))parents.push(path.join(d,'tools/research/assets-1.7.10.json'));
const indexBytes=await first([process.env.MC_ASSET_INDEX,...parents,...launcher.map(d=>path.join(d,'assets/indexes/1.7.10.json')),
  `https://launchermeta.mojang.com/v1/packages/${INDEX_SHA1}/1.7.10.json`].filter(Boolean),INDEX_SHA1);
if(!indexBytes)throw new Error('The 1.7.10 asset index was not found (set MC_ASSET_INDEX to a copy of 1.7.10.json).');
const objects=JSON.parse(indexBytes).objects;
const objectSources=hash=>[process.env.MC_ASSETS&&path.join(process.env.MC_ASSETS,'objects',hash.slice(0,2),hash),
  ...launcher.map(d=>path.join(d,'assets/objects',hash.slice(0,2),hash)),`https://resources.download.minecraft.net/${hash.slice(0,2)}/${hash}`].filter(Boolean);
const soundsEntry=objects['minecraft/sounds.json'];
const mirror='https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.7.10/assets/minecraft/sounds.json';
const soundsBytes=await first([process.env.MC_SOUNDS_JSON,...objectSources(soundsEntry.hash),mirror].filter(Boolean),soundsEntry.hash);
if(!soundsBytes)throw new Error('sounds.json from the 1.7.10 index was not found (set MC_SOUNDS_JSON).');
const sounds=JSON.parse(soundsBytes),events={},names=new Set();
for(const [event,def] of Object.entries(sounds)){
  // Streamed events only: music.* (category music) and records.* (category record, which note blocks share but do not stream).
  if(!def.sounds.some(s=>typeof s==='object'&&s.stream))continue;
  events[event]=def;
  for(const s of def.sounds)if(typeof s==='object'&&s.type!=='event')names.add(s.name);else if(typeof s==='string')names.add(s);
}
await mkdir(out,{recursive:true});
const files={},missing=[];let total=0;
for(const name of names){
  const entry=objects[`minecraft/sounds/${name}.ogg`];
  if(!entry){missing.push(name);continue;}
  const file=path.join(out,name+'.ogg');
  let bytes=await local(file,entry.hash);
  if(!bytes){bytes=await first(objectSources(entry.hash),entry.hash);if(!bytes){missing.push(name);continue;}await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
  files[name]={url:`/audio/1.7.10-streams/${name}.ogg`,sha1:entry.hash,bytes:entry.size,stream:true};total+=entry.size;
}
if(missing.length)throw new Error(`Missing ${missing.length} stream(s): ${missing.join(', ')} (set MC_ASSETS to a launcher assets folder).`);
await writeFile(path.join(out,'manifest.json'),JSON.stringify({target:'Minecraft Java 1.7.10',assetIndexSha1:INDEX_SHA1,soundsJsonSha1:soundsEntry.hash,
  credit:'Original Minecraft music and records © Mojang / Microsoft (C418). Installed locally by npm run music:fetch; not redistributed in Git.',files,events},null,2)+'\n');
console.log(`${Object.keys(files).length} music and record streams (${(total/1e6).toFixed(1)} MB) and ${Object.keys(events).length} events in public/audio/1.7.10-streams/`);
