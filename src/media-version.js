// Generation of the resource pack state. 0 = the page loaded it as is (urls untouched, so vanilla loads are byte-identical to before);
// each in-place refresh bumps it so images are re-requested instead of being served from the browser's memory cache.
// The service worker ignores the query (it matches url.pathname).
let generation=0;
export const mediaGeneration=()=>generation;
export const bumpMediaGeneration=()=>++generation;
export function versioned(url,gen=generation){return gen?url+(url.includes('?')?'&':'?')+'r='+gen:url;}
export function unversioned(url){return url.replace(/[?&]r=\d+$/,'');}
