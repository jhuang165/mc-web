// Recipe viewer mod (not 1.7.10): the item list, search, paging and recipe-view history, without any DOM (panel.js draws it).
import { ITEMS } from "../../survival.js";
import { SEARCH_ORDER } from "../../creative.js";
import { makeStack } from "../../inventory.js";
import { stackName } from "../../item-names.js";
import { recipesFor, usesOf } from "./recipes.js";

// Every registered item: the creative search order first (it carries the potion and enchanted book subtypes), then each other
// ITEMS entry and variant by id. Reserved block-id holes and items marked hidden are left out.
export function itemList(items = ITEMS, order = SEARCH_ORDER) {
  const out = [], seen = new Set();
  const push = (id, damage = 0, stored) => {
    if (!id || !items[id]) return;
    const k = `${id}:${damage}:${stored ? JSON.stringify(stored) : ""}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(makeStack(id, 1, damage, stored));
  };
  for (const e of order) Array.isArray(e) ? push(e[0], e[1] ?? 0, e[2]) : push(e);
  for (const id of Object.keys(items).map(Number).sort((a, b) => a - b)) {
    const item = items[id];
    if (!id || item.hidden || item.reserved) continue;
    const n = Array.isArray(item.variants) ? item.variants.length : 1;
    for (let d = 0; d < n; d++) push(id, d);
  }
  return out;
}

// Search words must all appear in the item's display name, in any order, ignoring case.
export function matches(name, query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const n = String(name).toLowerCase();
  return words.every((w) => n.includes(w));
}

export const pageCount = (length, perPage) => Math.max(1, Math.ceil(length / Math.max(1, perPage)));
// Paging wraps around at both ends.
export const turnPage = (page, delta, pages) => (((page + delta) % pages) + pages) % pages;

export class ViewerState {
  constructor({ list = () => itemList(), name = (s) => stackName(s, ITEMS), recipes = recipesFor, uses = usesOf } = {}) {
    Object.assign(this, { listFn: list, name, recipes, uses });
    this.query = "";
    this.page = 0;
    this.view = null; // { mode: "recipes" | "uses", stack, entries, page }
    this.back = [];
    this.forward = [];
    this.cache = null;
  }
  // The item list is read again after a mod changes ITEMS.
  reset() { this.cache = null; this.filteredFor = null; }
  all() { return (this.cache ??= this.listFn()); }
  filtered() {
    if (this.filteredFor !== this.query) {
      this.filteredFor = this.query;
      this.filteredList = this.query.trim() ? this.all().filter((s) => matches(this.name(s), this.query)) : this.all();
    }
    return this.filteredList;
  }
  setQuery(q) {
    if (q === this.query) return;
    this.query = q;
    this.page = 0;
  }
  pages(perPage) { return pageCount(this.filtered().length, perPage); }
  pageItems(perPage) {
    this.page = Math.min(this.page, this.pages(perPage) - 1);
    return this.filtered().slice(this.page * perPage, (this.page + 1) * perPage);
  }
  turn(delta, perPage) { this.page = turnPage(this.page, delta, this.pages(perPage)); }

  // Opens the recipes or uses of a stack; false (and nothing changes) when there are none.
  show(mode, stack) {
    if (!stack) return false;
    const entries = mode === "uses" ? this.uses(stack) : this.recipes(stack);
    if (!entries.length) return false;
    if (this.view) this.back.push(this.view);
    this.forward = [];
    this.view = { mode, stack: { id: stack.id, count: 1, damage: stack.damage | 0, ...(stack.stored ? { stored: stack.stored } : {}) }, entries, page: 0 };
    return true;
  }
  goBack() {
    if (!this.back.length) return false;
    if (this.view) this.forward.push(this.view);
    this.view = this.back.pop();
    return true;
  }
  goForward() {
    if (!this.forward.length) return false;
    if (this.view) this.back.push(this.view);
    this.view = this.forward.pop();
    return true;
  }
  close() { this.view = null; this.back = []; this.forward = []; }
  viewPages(perPage) { return this.view ? pageCount(this.view.entries.length, perPage) : 1; }
  viewEntries(perPage) {
    if (!this.view) return [];
    const v = this.view;
    v.page = Math.min(v.page, this.viewPages(perPage) - 1);
    return v.entries.slice(v.page * perPage, (v.page + 1) * perPage);
  }
  turnView(delta, perPage) { if (this.view) this.view.page = turnPage(this.view.page, delta, this.viewPages(perPage)); }
}
