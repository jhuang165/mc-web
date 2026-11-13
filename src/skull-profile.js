// GameProfile NBT of 1.7.10: NBTUtil.func_152459_a (dv.a(dh), read) and func_152460_a (dv.a(dh, GameProfile), write), as ItemSkull, BlockSkull and
// TileEntitySkull use them (bytecode-read and executed in tools/probes/ItemTags2Probe.java, public/research/item-tags2-reference.json).
//   profile = { name: string|null, id: string|null (lower-case UUID text), properties: [[key, [{ value, signature? }]]] }
// Skin textures are not fetched (no network): a profile without textures is drawn with the default Steve skin, as native does while no lookup answers.
import { NBT } from './nbt.js';

const tag = (type, value) => ({ type, value });
const blank = (s) => s === null || s === undefined || s === ''; // qn.b: null or empty (not whitespace)
const str = (m, k) => (m.get(k)?.type === NBT.STRING ? m.get(k).value : '');
const isStr = (m, k) => m.get(k)?.type === NBT.STRING;
// java.util.UUID.fromString (Java 7/8): exactly five '-' parts, each Long.decode("0x" + part); the result is re-printed as 8-4-4-4-12 hex digits.
export function uuidText(text) {
  const parts = String(text).split('-');
  if (parts.length !== 5) return null;
  const v = [];
  for (const p of parts) {
    if (!/^[0-9a-fA-F]+$/.test(p) || p.length > 16) return null;
    v.push(BigInt('0x' + p));
  }
  if (v[0] >= 1n << 63n || v[1] >= 1n << 63n || v[2] >= 1n << 63n || v[3] >= 1n << 63n || v[4] >= 1n << 63n) return null; // Long.decode overflow
  const msb = BigInt.asUintN(64, (((v[0] << 16n) | (v[1] & 0xFFFFn)) << 16n) | (v[2] & 0xFFFFn)), lsb = BigInt.asUintN(64, ((v[3] & 0xFFFFn) << 48n) | v[4]);
  const hex = (n, d) => n.toString(16).padStart(d, '0').slice(-d);
  const m = hex(msb, 16), l = hex(lsb, 16);
  return `${m.slice(0, 8)}-${m.slice(8, 12)}-${m.slice(12)}-${l.slice(0, 4)}-${l.slice(4)}`;
}
/** NBTUtil.func_152459_a over a compound's entries Map: the profile, or null (no Name and no Id, or an unreadable Id with no Name: native throws there). */
export function profileFromNbt(entries) {
  if (!(entries instanceof Map)) return null;
  const name = isStr(entries, 'Name') ? entries.get('Name').value : null, idText = isStr(entries, 'Id') ? entries.get('Id').value : null;
  if (blank(name) && blank(idText)) return null;
  const id = idText === null ? null : uuidText(idText);
  if (id === null && blank(name)) return null; // GameProfile: "Name and ID cannot both be blank" (an IllegalArgumentException natively)
  const properties = [];
  if (entries.get('Properties')?.type === NBT.COMPOUND) {
    for (const [key, t] of entries.get('Properties').value) {
      const list = t.type === NBT.LIST && (t.value.elementType === NBT.COMPOUND || !t.value.items.length) ? t.value.items : [];
      properties.push([key, list.map((p) => ({ value: str(p, 'Value'), ...(isStr(p, 'Signature') ? { signature: p.get('Signature').value } : {}) }))]);
    }
  }
  return { name, id, properties };
}
/** TileEntitySkull / ItemSkull with a string SkullOwner or an ExtraType: new GameProfile(null, name). */
export const profileFromName = (name) => ({ name, id: null, properties: [] });
/** NBTUtil.func_152460_a: the entries Map written for a profile (Name only when not empty, Id when known, Properties only when non-empty). */
export function profileToNbt(profile) {
  const out = new Map();
  if (!blank(profile.name)) out.set('Name', tag(NBT.STRING, profile.name));
  if (profile.id) out.set('Id', tag(NBT.STRING, profile.id));
  const props = profile.properties.filter(([, values]) => values.length);
  if (props.length) {
    out.set('Properties', tag(NBT.COMPOUND, new Map(props.map(([key, values]) => [key, tag(NBT.LIST, { elementType: NBT.COMPOUND,
      items: values.map((p) => new Map([['Value', tag(NBT.STRING, p.value)], ...(p.signature !== undefined && p.signature !== null ? [['Signature', tag(NBT.STRING, p.signature)]] : [])])) })]))));
  }
  return out;
}
/** GameProfile.isComplete and the "textures" property: whether a skin could be drawn from this profile (Skins are not fetched; none means Steve). */
export const hasTextures = (profile) => !!profile?.properties.some(([k, v]) => k === 'textures' && v.length);
export const cloneProfile = (p) => (p ? structuredClone(p) : null);
/** The profile of a SkullOwner item tag (string or compound, any other type: none), or null. */
export function profileOfOwnerTag(t) {
  if (t?.type === NBT.COMPOUND) return profileFromNbt(t.value);
  if (t?.type === NBT.STRING && t.value.length > 0) return profileFromName(t.value); // ItemSkull.onItemUse: a non-empty string only
  return null;
}
/** TileEntitySkull.readFromNBT: only a player head (SkullType 3, a missing byte reads 0) reads a profile (executed: ownerType1 in item-tags2-reference.json). The Owner compound (NBTUtil.func_152459_a), else a non-empty ExtraType string as GameProfile(null, name); the lookup that follows needs the network and is skipped. */
export function profileOfSkullTile(entries) {
  if (!(entries instanceof Map)) return null;
  if (Number(entries.get('SkullType')?.value ?? 0) !== 3) return null;
  if (entries.get('Owner')?.type === NBT.COMPOUND) return profileFromNbt(entries.get('Owner').value);
  if (isStr(entries, 'ExtraType') && entries.get('ExtraType').value !== '') return profileFromName(entries.get('ExtraType').value);
  return null;
}
/** TileEntitySkull.writeToNBT's Owner entry for a stored tile (none without a profile). Native writes no ExtraType. */
export const skullOwnerEntry = (tile) => (tile?.profile ? tag(NBT.COMPOUND, profileToNbt(tile.profile)) : null);
