// ItemStack tag <-> browser stack for Book and Quill / Written Book (ItemWritableBook / ItemEditableBook): tag.pages (list of
// strings), tag.author and tag.title (strings). Keeps the region-export.js and region-import.js hooks one line each.
import { NBT } from './nbt.js';

const tag = (type, value) => ({ type, value });
// Adds pages / author / title to the `tag` entries object of an item compound.
export function writeBookTags(stack, entries) {
  if (Array.isArray(stack.pages) && stack.pages.every((p) => typeof p === 'string')) entries.pages = tag(NBT.LIST, { elementType: stack.pages.length ? NBT.STRING : NBT.END, items: [...stack.pages] });
  if (typeof stack.author === 'string') entries.author = tag(NBT.STRING, stack.author);
  if (typeof stack.title === 'string') entries.title = tag(NBT.STRING, stack.title);
}
// Reads pages / author / title from an item `tag` compound Map onto the stack; returns the keys it consumed.
export function readBookNbt(stack, nbt) {
  const pages = nbt.get('pages');
  if (pages?.type === NBT.LIST && (pages.value.elementType === NBT.STRING || !pages.value.items.length)) stack.pages = pages.value.items.map(String);
  const author = nbt.get('author'), title = nbt.get('title');
  if (author?.type === NBT.STRING) stack.author = author.value;
  if (title?.type === NBT.STRING) stack.title = title.value;
  return ['pages', 'author', 'title'];
}
