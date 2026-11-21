// b92 console92: what /netstat needs to know about a `dispEnts` row (a primed TNT, a fireball, a skull, a golem's snowball) that the wire row does not carry: the data of its S0E
// (6 motion bytes follow when it is above 0), whether the entry sends velocity updates (an S12 after the spawn), the size of the whole-watcher S1C a viewer gets after the spawn
// (executed, public/research/console92-reference.json: PrimedTnt / Fireball / SmallFireball 11, WitherSkull 13), and the tracker packets of the tick when the row has none of its own.
// Nothing here goes on the wire: the info hangs on the row object in a WeakMap.
const infos = new WeakMap();
export const setRowInfo = (row, info) => { infos.set(row, info); return row; };
export const rowInfo = (row) => infos.get(row);
