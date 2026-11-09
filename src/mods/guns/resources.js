// Keep old TaCZ keys stable, while other packs retain their namespace.
export const resourceKey = value => String(value ?? '').replace(/^tacz:/, '');
export const CS2_ROOT = '/mods/cs2/';
export function packResource(folder, suffix, location) {
  const value = String(location ?? ''), at = value.indexOf(':');
  const ns = at < 0 ? 'tacz' : value.slice(0, at), file = at < 0 ? value : value.slice(at + 1);
  const root = ns === 'cs2' ? CS2_ROOT : '/mods/tacz/';
  return `${root}pack/assets/${ns}/${folder}/${file}${suffix}`;
}
