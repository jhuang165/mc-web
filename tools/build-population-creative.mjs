import fs from 'node:fs';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const {MC_IDS}=await import(root+'/tools/inventory-replay.mjs');
const {ITEMS}=await import(root+'/src/survival.js');
const ref=JSON.parse(fs.readFileSync(root+'/public/research/creative-reference.json'));
const entries=ref.tabs.map(t=>t.items.flatMap(([id,meta])=>{
 const specific=MC_IDS[id+':'+meta];if(specific!==undefined)return[specific];
 const internal=MC_IDS[id];if(internal===undefined||internal===65||internal===73||internal===77||internal===78||internal===83)return[];
 const item=ITEMS[internal];if(!item)return[];
 if(meta===0)return[internal];if(meta<(item.variants?.length??1))return[[internal,meta]];return[];
}));
// Books get their tag-bearing entries from creative.js, rather than bare native stacks.
for(const list of entries){for(let i=list.length-1;i>=0;i--)if(list[i]===365)list.splice(i,1);}
fs.writeFileSync(root+'/src/population-creative.js', '// Generated from the unchanged native creative-reference.json registry/tab order.\nexport const POPULATION_CREATIVE='+JSON.stringify(entries)+';\n');
