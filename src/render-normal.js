// Block.renderAsNormalBlock (aji.d()) of every original 1.7.10 block id, as dumped by RedstoneProbe (the same rows redstone.js packs, flag bit 2), listed here
// so the mesher can ask it without loading the redstone engine. Air (id 0) answers true natively but is excluded: renderBlockVine's top quad needs a block.
// Evidence: public/research/render-types-pos-reference.json, vines under 40 kinds of block (src/render-types-pos.test.js).
const IDS = new Set([1, 2, 3, 4, 5, 7, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 35, 41, 42, 43, 45, 46, 47, 48, 49, 52, 56, 57, 58, 61, 62, 73, 74, 79, 80, 82, 84, 86, 87, 88, 89, 91, 97, 98, 99, 100, 103, 110, 112, 120, 121, 123, 124, 125, 129, 133, 137, 152, 153, 155, 158, 159, 161, 162, 170, 172, 173, 174]);
export const rendersAsNormalOriginal = (id) => IDS.has(id);
