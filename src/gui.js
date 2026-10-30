// ScaledResolution keeps at least a 320 x 240 logical viewport.
export function guiScale(width,height,requested=0){let scale=1;const limit=requested>0?requested:1000;while(scale<limit&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;return scale;}
export function stackCount(count){return Number.isFinite(count)&&count>1?`<b class="item-count">${Math.floor(count)}</b>`:'';}
export const CONTAINER_POSITIONS={inventory:{grid:[88,26],result:[144,36],label:[86,16]},workbench:{grid:[30,17],result:[124,35],label:[28,6]},bag:[8,84],hotbar:[8,142],inventoryLabel:[8,72],itemSize:16,pitch:18,countAnchor:[17,9]};
// RenderItem.renderItemOverlayIntoGUI: damaged items only; a 13 x 2 black bar,
// a 12-pixel shade row, then round(13 - 13d/max) pixels from green to red.
export function durabilityBar(damage,max){
 if(!max||!(damage>0))return'';
 const width=Math.round(13-damage*13/max),k=Math.round(255-damage*255/max);
 return`<i class="durability-bar" style="--bar:${width};--bar-color:rgb(${255-k},${k},0);--bar-shade:rgb(${(255-k)>>2},63,0)"></i>`;
}
// ItemStack.getTooltip: name, a blank line and attack modifiers, then the
// F3+H advanced line "Durability: remaining / max" for damaged items.
export function tooltipLines(item,stack,advanced=false){
 if(!item)return[];
 const lines=[{text:item.name}],attack=item.attack;
 if(attack)lines.push({text:''},{text:`+${attack} Attack Damage`,color:'blue'});
 if(advanced&&item.durability&&stack.damage>0)lines.push({text:`Durability: ${item.durability-stack.damage} / ${item.durability}`});
 return lines;
}
