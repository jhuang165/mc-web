import {stackPotionEffects,loreLines} from './item-tags.js';
import {fireworkLines} from './fireworks.js';
import {storedEnchantmentLines} from './enchanted-books.js';
import {copyStack} from './inventory.js';
import {stackHasEffect} from './armor-enchantments.js';
import {potionName,potionTooltip,getPotionEffects} from './potions.js';
import {stackName} from './item-names.js';
import {translate} from './lang.js';
import {bookInfoLines} from './books.js';
import {ITEM_FILLED_MAP,mapStore,mapTooltipLines} from './maps.js';
import {advancedTitleSuffix} from './advanced-tooltip-id.js';
const POTION_CLASS={'#aaaaaa':'gray','#ff5555':'red','#aa00aa':'purple','#5555ff':'blue'};
// A save snapshots unfinished input/cursor stacks, never a calculated output.
export function pendingContainerStacks(view){
 const c=view?.container;if(!c)return[];
 return [c.inv.cursor,...(c.grid?.stacks??[]),...(view.kind==='anvil'||view.kind==='enchanting'?c.inputs.stacks:[])].filter(Boolean).map(copyStack);
}
// GuiRepair's 40-character field and ChatAllowedCharacters filter.
export const anvilName = text => String(text).replace(/[\u0000-\u001f\u007f\u00a7]/g,'').slice(0,40);
export function anvilCost(container){
 if(!(container.maximumCost>0))return {text:'',unavailable:false};
 if(container.tooExpensive)return {text:'Too Expensive!',unavailable:true};
 if(!container.output)return {text:'',unavailable:false};
 return {text:`Enchantment Cost: ${container.maximumCost}`,unavailable:!container.canTake()};
}
// ScaledResolution keeps at least a 320 x 240 logical viewport.
export function guiScale(width,height,requested=0){let scale=1;const limit=requested>0?requested:1000;while(scale<limit&&width/(scale+1)>=320&&height/(scale+1)>=240)scale++;return scale;}
export function stackCount(count){return Number.isFinite(count)&&count>1?`<b class="item-count">${Math.floor(count)}</b>`:'';}
// ItemArmor.getColor: only leather has a tint, with an optional display.color override.
export function itemTint(item,stack){
 if(!item?.tint)return null;
 const color=stack?.color;
 return Number.isInteger(color)&&color>=0&&color<=0xffffff?`#${color.toString(16).padStart(6,'0')}`:item.tint;
}
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
 const named=typeof stack.displayName==='string',potion=stack.id===385;
 const lines=[{text:stackName(stack,{[stack.id]:item})}],attack=item.attack;
 if(potion)for(const l of potionTooltip(stack.damage|0,stackPotionEffects(stack)))lines.push({text:l.text,color:POTION_CLASS[l.color]??'gray'});
 if(named)lines[0].italic=true;
 if(advanced){const suffix=advancedTitleSuffix(stack,lines[0].text.length>0);lines[0].text+=(named&&suffix?'§r':'')+suffix;} // named: native text is "§oBob§r (#0035/5)" (executed b59), so the suffix is not italic (b60)
 else if(stack.id===ITEM_FILLED_MAP&&!advanced)lines[0].text+=` #${stack.damage|0}`; // ItemStack.getTooltip: an unnamed filled map shows its id (executed, item-tags2-reference.json)
 for(const text of fireworkLines(stack))lines.push({text,color:'gray'});
 // ItemEditableBook.addInformation: the gray "by <author>" line (the name is the title, see item-names.js).
 for(const text of bookInfoLines(stack))lines.push({text:text.slice(2),color:'gray'});
 // ItemMap.addInformation (maps.js): the scale lines with F3+H; the map data is read, not created, as on a client world that has not received it yet.
 if(stack.id===ITEM_FILLED_MAP)for(const text of mapTooltipLines(mapStore.get(stack.damage|0),advanced))lines.push({text,color:'gray'});
 // ItemEnchantedBook: EnumRarity.uncommon (yellow name) while it stores enchantments, and
 // addInformation lists them; renderToolTip draws every later line gray.
 const stored=item.storesEnchantments?(stack.storedEnchantments??stack.stored):undefined;
 if(Array.isArray(item.rarity))lines[0].color=item.rarity[Math.min(stack.damage|0,item.rarity.length-1)]; // Item.getRarity: the golden apple is rare (aqua), the enchanted one epic (light purple)
 else if(item.rarity==='rare')lines[0].color='aqua'; // ItemRecord.getRarity: EnumRarity.rare (executed b55 ChatRarityProbe)
 if(Array.isArray(stack.enchantments))lines[0].color='aqua';
 if(stored?.length)lines[0].color='yellow';
 for(const text of storedEnchantmentLines(stored))lines.push({text,color:'gray'});
 for(const text of storedEnchantmentLines(stack.enchantments))lines.push({text,color:'gray'});
 // ItemRecord: EnumRarity.rare (aqua name) and addInformation's item.record.<name>.desc line in gray.
 if(item.record){lines[0].color??='aqua';lines.push({text:item.description,color:'gray'});}
 // ItemStack.getTooltip (executed, ItemTagsProbe): the enchantments, then the dyed line, then display.Lore (dark purple italic), then attribute modifiers.
 if(Number.isInteger(stack.color)&&stack.color>=0&&stack.color<=0xffffff)lines.push(advanced?{text:`Color: #${stack.color.toString(16).toUpperCase()}`,color:'gray'}:{text:translate('item.dyed','Dyed'),color:'gray',italic:true});
 for(const l of loreLines(stack))lines.push(l);
 if(attack)lines.push({text:''},{text:`+${attack} ${translate('attribute.name.generic.attackDamage','Attack Damage')}`,color:'blue'});
 if(stack.unbreakable)lines.push({text:translate('item.unbreakable','Unbreakable'),color:'blue'});
 if(advanced&&item.durability&&stack.damage>0)lines.push({text:`Durability: ${item.durability-stack.damage} / ${item.durability}`});
 return lines;
}
// ItemStack.hasEffect: RenderItem.renderEffect draws the enchantment glint over an item's icon. The glint is an
// overlay carrying the icon's silhouette as a mask (container-ui.css .enchant-glint); the original's texture-matrix
// scroll of misc/enchanted_item_glint.png is approximated by a CSS animation, not replayed pixel for pixel.
export function withGlint(iconHtml,stack,item){
 // ItemPotion.hasEffect: a potion with at least one effect glints.
 if(!stackHasEffect(stack,item)&&!(stack?.id===385&&stackPotionEffects(stack)?.length))return iconHtml;
 const m=/src="([^"]+)"/.exec(iconHtml)||/--base:url\('([^']+)'\)/.exec(iconHtml);
 return iconHtml+(m?`<i class="enchant-glint" style="--glint-mask:url('${m[1]}')"></i>`:'');
}
