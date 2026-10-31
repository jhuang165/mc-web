import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url)),exec=promisify(execFile);
const output=path.join(root,'../public'),research=path.join(root,'research');
const sha1=b=>createHash('sha1').update(b).digest('hex');
async function download(url,expected){const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}: ${url}`);const b=Buffer.from(await r.arrayBuffer());if(expected&&sha1(b)!==expected)throw new Error('Asset integrity mismatch');return b;}
const version=JSON.parse(await readFile(path.join(research,'version-1.7.10.json'),'utf8'));
const indexBytes=await download(version.assetIndex.url,version.assetIndex.sha1),index=JSON.parse(indexBytes).objects;
const definition=index['minecraft/sounds.json'];
const sounds=JSON.parse(await download(`https://resources.download.minecraft.net/${definition.hash.slice(0,2)}/${definition.hash}`,definition.hash));
const selected=Object.entries(index).filter(([name])=>/^minecraft\/sounds\/(?:ambient\/weather\/|step\/|dig\/|damage\/|mob\/(?:pig|cow|sheep|zombie|chicken)\/|liquid\/(?:swim|splash)|random\/(?:click|pop|break|glass|eat|drink|burp|fizz|successful_hit|orb|levelup|chestopen|chestclosed|bow\.))/.test(name)&&name.endsWith('.ogg'));
const audioRoot=path.join(output,'audio/1.7.10'),files={};await mkdir(audioRoot,{recursive:true});
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<selected.length){const [name,asset]=selected[cursor++],relative=name.replace('minecraft/sounds/','');const destination=path.join(audioRoot,relative);await mkdir(path.dirname(destination),{recursive:true});let bytes;try{bytes=await readFile(destination);}catch{}if(!bytes||sha1(bytes)!==asset.hash){bytes=await download(`https://resources.download.minecraft.net/${asset.hash.slice(0,2)}/${asset.hash}`,asset.hash);await writeFile(destination,bytes);}files[relative.replace(/\.ogg$/,'')]={url:'/audio/1.7.10/'+relative,sha1:asset.hash,bytes:asset.size};}}));
const events={};for(const [name,event] of Object.entries(sounds)){const variants=(event.sounds||[]).filter(s=>{const name=typeof s==='string'?s:s.name;return !!files[name]||(typeof s==='object'&&s.type==='event');});if(variants.length)events[name]={...event,sounds:variants};}
await writeFile(path.join(audioRoot,'manifest.json'),JSON.stringify({target:'Minecraft Java 1.7.10',assetIndexSha1:version.assetIndex.sha1,credit:'Original Minecraft sound effects © Mojang / Microsoft. These are original game resources, not newly synthesized effects.',files,events},null,2)+'\n');
const jar=path.join(research,'minecraft-1.7.10.jar');if(sha1(await readFile(jar))!=='e80d9b3bf5085002218d4be59e668bac718abbc6')throw new Error('Unexpected client JAR');
const stage=path.join(research,'texture-extract');await mkdir(stage,{recursive:true});
await exec('unzip',['-o','-q',jar,'assets/minecraft/textures/*','-d',stage]);
const mediaRoot=path.join(output,'media/1.7.10');await cp(path.join(stage,'assets/minecraft/textures'),mediaRoot,{recursive:true});
const {stdout:listing}=await exec('unzip',['-Z1',jar,'assets/minecraft/textures/*']);
const assets=[];for(const member of listing.trim().split('\n').filter(n=>n.endsWith('.png')||n.endsWith('.mcmeta'))){const relative=member.replace('assets/minecraft/textures/',''),bytes=await readFile(path.join(mediaRoot,relative));assets.push({member,url:'/media/1.7.10/'+relative,sha1:sha1(bytes),bytes:bytes.length});}
await writeFile(path.join(mediaRoot,'provenance.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:sha1(await readFile(jar)),credit:'Original Minecraft texture assets © Mojang / Microsoft.',assets},null,2)+'\n');
console.log(`Imported and verified ${Object.keys(files).length} sound clips and ${assets.length} original textures.`);
