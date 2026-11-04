import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adventureExempt, mayHitBlock } from "./adventure.js";
import { internalIdsFor, toOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { Survival, gameModeOf, GAME_MODE_IDS } from "./survival.js";
import { tickPlayerMining } from "./player-mining.js";
import { createCommandHost } from "./command-host.js";

const reference = JSON.parse(await readFile(new URL("../public/research/adventure-reference.json", import.meta.url)));

test("the reference comes from the 1.7.10 client and covers every registered block", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.blocks.length, 171);
  assert.deepEqual(reference.gates.map((g) => g.site), ["PlayerControllerMP.onPlayerDestroyBlock", "PlayerControllerMP.clickBlock", "ItemInWorldManager.onBlockClicked", "ItemInWorldManager.tryHarvestBlock"]);
});

test("isCurrentToolAdventureModeExempt matches the native answer for every port block and probed item", () => {
  const items = reference.items.map((original) => [original, itemFromOriginal(original)?.id]).filter(([, live]) => live != null);
  assert.ok(items.length >= 25, "the probed tools exist in the port");
  let checked = 0;
  for (const block of reference.blocks) {
    for (const internal of internalIdsFor(block.id)) {
      for (let meta = 0; meta < 16; meta++) {
        if (toOriginal(internal, meta)?.[0] !== block.id) continue;
        const air = block.id === 0;
        assert.equal(adventureExempt(internal, meta, 0), !air && block.exempt, `block ${block.id} (${internal}:${meta}) by hand`);
        for (const [original, live] of items) {
          assert.equal(adventureExempt(internal, meta, live), !air && (block.exempt || block.tools.includes(original)), `block ${block.id} with item ${original}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 2000, "checked " + checked);
});

test("only adventure consults the exemption", () => {
  const dirt = internalIdsFor(3)[0];
  for (const mode of ["survival", "creative"]) assert.equal(mayHitBlock(new Survival({}, mode), dirt, 0, 0), true, mode);
  assert.equal(mayHitBlock(new Survival({}, "adventure"), dirt, 0, 0), false);
  assert.equal(mayHitBlock(new Survival({}, "adventure"), dirt, 0, itemFromOriginal(256).id), true, "an iron shovel digs dirt");
  assert.equal(gameModeOf("adventure"), "adventure");
  assert.equal(gameModeOf("spectator"), "creative");
  assert.deepEqual(GAME_MODE_IDS, { survival: 0, creative: 1, adventure: 2 });
});

test("a held click on a non-exempt block is not re-dispatched and draws no hit particles", () => {
  for (const allowed of [false, true]) {
    const calls = [], state = { playing: true, mineHeld: true, target: { block: [0, 0, 0], adjacent: [0, 1, 0] }, cooldown: 0, mining: null, survival: new Survival({}, "adventure") };
    tickPlayerMining(state, { getBlock: () => 1, edit: () => calls.push("edit"), hitParticles: () => calls.push("hit"), mayHit: () => allowed });
    assert.deepEqual(calls, allowed ? ["edit", "hit"] : []);
  }
});

test("/gamemode and /defaultgamemode accept adventure", () => {
  const set = [], active = {};
  const host = createCommandHost({ survival: () => new Survival(), active: () => active, setMode: (m) => set.push(m) });
  host.setGameMode("adventure");
  host.setDefaultGameMode("adventure");
  assert.deepEqual(set, ["adventure"]);
  assert.equal(active.defaultGameMode, "adventure");
});
