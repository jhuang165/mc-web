// Generates the negative/zero-stack container click scripts (batch 28 negstacks3) in the InventoryProbe script format. The same text is run through
// the unchanged classes (ZeroStacksProbe "inventory") and tools/inventory-replay.mjs. `put` fills a container slot, `inv` a main-inventory index,
// `cursor` the held stack; container layouts: player 0 result, 1-4 grid, 5-8 armour, 9-35 main, 36-44 hotbar; furnace 0 input, 1 fuel, 2 output, 3-29 main,
// 30-38 hotbar; chest 0-26 chest, 27-53 main, 54-62 hotbar; dispenser 0-8; hopper 0-4; brewing 0-2 bottles, 3 ingredient.
const BASIC = { diamond: [264, 0], sword: [267, 0] };
const LAYOUT = {
  player: { open: [], targets: [9, 36, 1], other: 10, items: BASIC },
  furnace: { open: ["furnace"], targets: [0, 1, 2, 3], other: 4, items: { ...BASIC, coal: [263, 0], ingot: [265, 0], pork: [320, 0] } },
  chest: { open: ["chest"], targets: [0, 27], other: 1, items: BASIC },
  dispenser: { open: ["dispenser"], targets: [0, 9], other: 1, items: BASIC },
  hopper: { open: ["hopper"], targets: [0, 5], other: 1, items: BASIC },
  brewing: { open: ["brewing"], targets: [0, 3, 4], other: 1, items: { wart: [372, 0], bottle: [374, 0], potion: [373, 0], diamond: [264, 0] } },
};
export function negStackScript() {
  const out = [];
  let n = 0;
  const add = (name, lines) => { out.push(`case ${name}`, ...lines, "end", ""); n++; };
  for (const [cn, L] of Object.entries(LAYOUT)) for (const [iname, [id, dmg]] of Object.entries(L.items)) for (const size of [-3, -1, 0]) for (const target of L.targets) {
    const stack = (c) => `${id} ${c} ${dmg}`;
    const base = [...L.open];
    const put = (slot, c, item = stack(c)) => (slot < 9 && cn === "player" && false ? "" : `put ${slot} ${item}`);
    const setup = [...base, put(target, size)];
    // pickups, both buttons, with an empty cursor and with a same-item / other-item / negative cursor
    for (const [cname, cursor] of [["empty", null], ["same5", stack(5)], ["other5", "3 5 0"], ["neg2", stack(-2)], ["zero", stack(0)]]) {
      for (const b of [0, 1]) add(`${cn}-${iname}-${size}-t${target}-pick-b${b}-cursor-${cname}`, [...setup, ...(cursor ? [`cursor ${cursor}`] : []), `click ${target} ${b} 0`, `click ${L.other} ${b} 0`]);
    }
    add(`${cn}-${iname}-${size}-t${target}-shift`, [...setup, `click ${target} 0 1`]);
    add(`${cn}-${iname}-${size}-t${target}-shift-right`, [...setup, `click ${target} 1 1`]);
    add(`${cn}-${iname}-${size}-t${target}-shift-merge`, [...setup, `inv 3 ${stack(10)}`, `inv 12 ${stack(7)}`, `click ${target} 0 1`]);
    for (const b of [0, 1, 2, 8]) {
      add(`${cn}-${iname}-${size}-t${target}-key${b}-empty`, [...setup, `click ${target} ${b} 2`]);
      add(`${cn}-${iname}-${size}-t${target}-key${b}-held`, [...setup, `inv ${b} ${stack(4)}`, `click ${target} ${b} 2`]);
      add(`${cn}-${iname}-${size}-t${target}-key${b}-negheld`, [...setup, `inv ${b} ${stack(-2)}`, `click ${target} ${b} 2`]);
    }
    add(`${cn}-${iname}-${size}-t${target}-q0`, [...setup, `click ${target} 0 4`]);
    add(`${cn}-${iname}-${size}-t${target}-q1`, [...setup, `click ${target} 1 4`]);
    add(`${cn}-${iname}-${size}-t${target}-double`, [...setup, `cursor ${stack(3)}`, `put ${L.other} ${stack(2)}`, `click ${target} 0 6`]);
    add(`${cn}-${iname}-${size}-t${target}-double-negcursor`, [...setup, `cursor ${stack(-1)}`, `put ${L.other} ${stack(2)}`, `click ${target} 0 6`]);
    for (const [dn, start, mid, end] of [["left", 0, 1, 2], ["right", 4, 5, 6], ["middle", 8, 9, 10]]) {
      add(`${cn}-${iname}-${size}-t${target}-drag-${dn}`, [...setup, `cursor ${stack(8)}`, `click -999 ${start} 5`, `click ${target} ${mid} 5`, `click ${L.other} ${mid} 5`, `click -999 ${end} 5`]);
      add(`${cn}-${iname}-${size}-t${target}-drag-${dn}-neg`, [...setup, `cursor ${stack(-6)}`, `click -999 ${start} 5`, `click ${target} ${mid} 5`, `click ${L.other} ${mid} 5`, `click -999 ${end} 5`]);
    }
    add(`${cn}-${iname}-${size}-t${target}-close`, [...setup, `cursor ${stack(size)}`, "close"]);
  }
  return { script: out.join("\n"), count: n };
}
