// ScaledResolution keeps at least a 320 x 240 logical viewport.
export function guiScale(width,height,requested=0){let scale=1;const limit=requested>0?requested:1000;while(scale<limit&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;return scale;}
export function stackCount(count){return Number.isFinite(count)&&count>1?`<b class="item-count">${Math.floor(count)}</b>`:'';}
export const CONTAINER_POSITIONS={inventory:{grid:[88,26],result:[144,36],label:[86,16]},workbench:{grid:[30,17],result:[124,35],label:[28,6]},bag:[8,84],hotbar:[8,142],inventoryLabel:[8,72],itemSize:16,pitch:18,countAnchor:[17,9]};
