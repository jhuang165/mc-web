// Batch 98 console98: the profile properties S0C (gb.b) writes for a spawning player.
// Bytecode-read (`gb.b`): uuid string, name string, VarInt property count, then per property THREE strings (name, value, signature; no "has signature" flag), then the ints.
// Executed (b96 Console96Probe, console96-reference.json): one property "textures" with a 400 char value and a 684 char signature adds 1097 = 9 + 402 + 686 over the property-less packet.
// A native online-mode server fills the profile from the session server: a "textures" property whose value is base64 of Mojang's pretty-printed JSON (timestamp, profileId, profileName,
// textures.SKIN.url [, CAPE.url]) and whose signature is a 684 char RSA signature. Offline mode (and a player without a custom skin or cape) has no property at all.
// Port-modelled (honest): the port signs nothing and serves skins itself, so the size is what the native shape would be for the account's skin / cape (64 hex texture hashes, a 13 digit timestamp).
import { stringSize, varIntSize } from './net-packet-ids.js';

export const TEXTURES_SIGNATURE = 684;
const URL_BASE = 'http://textures.minecraft.net/texture/';
const base64Length = (n) => 4 * Math.ceil(n / 3);
// the length of the base64 value for a profile with a custom skin and/or cape
export function texturesValueLength(name, { skin = true, cape = false } = {}) {
  const hash = 'x'.repeat(64), url = (k) => `    "${k}" : {\n      "url" : "${URL_BASE}${hash}"\n    }`;
  const body = [skin ? url('SKIN') : null, cape ? url('CAPE') : null].filter(Boolean).join(',\n');
  const json = `{\n  "timestamp" : 1415000000000,\n  "profileId" : "${'0'.repeat(32)}",\n  "profileName" : ${JSON.stringify(String(name ?? ''))},\n  "textures" : {\n${body}\n  }\n}`;
  return base64Length(new TextEncoder().encode(json).length);
}
// the bytes the textures property adds to S0C for a row (`skin` / `cape` = the account's content hashes), 0 without one
export function profilePropertyBytes(row) {
  const skin = !!row?.skin, cape = !!row?.cape;
  if (!skin && !cape) return 0;
  return stringSize('textures') + varIntSize(texturesValueLength(row.name, { skin, cape })) + texturesValueLength(row.name, { skin, cape }) + varIntSize(TEXTURES_SIGNATURE) + TEXTURES_SIGNATURE;
}
