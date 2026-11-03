import test from "node:test";
import assert from "node:assert/strict";
import { deathMessage, DEATH_TEXT } from "./death-messages.js";

test("anvil death message matches the pinned en_US language entry", () => {
  assert.equal(DEATH_TEXT.anvil, "%1$s was squashed by a falling anvil");
  assert.equal(deathMessage("anvil"), "Player was squashed by a falling anvil");
  assert.equal(deathMessage("anvil", "Alex"), "Alex was squashed by a falling anvil");
});
