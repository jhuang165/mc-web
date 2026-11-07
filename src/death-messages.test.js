import test from "node:test";
import assert from "node:assert/strict";
import { deathMessage, DEATH_TEXT } from "./death-messages.js";

test("anvil death message matches the pinned en_US language entry", () => {
  assert.equal(DEATH_TEXT.anvil, "%1$s was squashed by a falling anvil");
  assert.equal(deathMessage("anvil"), "Player was squashed by a falling anvil");
  assert.equal(deathMessage("anvil", "Alex"), "Alex was squashed by a falling anvil");
});

import { EN_US } from "./lang-en-us.js";
import { ATTACK_TEXT } from "./death-messages.js";
import { lang } from "./lang.js";

test("attacker death messages: the English fallbacks are the pinned en_US values", () => {
  for (const [k, v] of Object.entries(ATTACK_TEXT)) assert.equal(v, EN_US["death.attack." + k], k);
});

test("attacker death messages name the DamageSource entity", () => {
  assert.equal(deathMessage("a zombie", "Alex", { source: "mob", attacker: { type: "zombie" } }), "Alex was slain by Zombie");
  assert.equal(deathMessage("a zombie", "Alex", { attacker: { type: "pigman" }, source: "mob" }), "Alex was slain by Zombie Pigman");
  assert.equal(deathMessage("a zombie", "Alex", { source: "mob", attacker: { type: "zombie", customName: "Bob" } }), "Alex was slain by Bob");
  assert.equal(deathMessage("an arrow", "Alex", { attacker: { type: "skeleton" } }), "Alex was shot by Skeleton");
  assert.equal(deathMessage("an arrow", "Alex", { attacker: { x: 0, z: 0 } }), "Alex was shot by arrow", "an arrow with no living shooter names the arrow");
  assert.equal(deathMessage("fireball", "Alex", { source: "fireball", attacker: { type: "ghast" } }), "Alex was fireballed by Ghast");
  assert.equal(deathMessage("an explosion", "Alex", { source: "explosion", attacker: { type: "creeper" } }), "Alex was blown up by Creeper");
  assert.equal(deathMessage("an explosion", "Alex", { source: "explosion" }), "Alex blew up");
  assert.equal(deathMessage("magic", "Alex", { attacker: { type: "witch" } }), "Alex was killed by Witch using magic");
  assert.equal(deathMessage("magic", "Alex"), "Alex was killed by magic");
  assert.equal(deathMessage("a zombie", "Alex", { source: "mob", attacker: { type: "skeleton" }, item: "Sting" }), "Alex was slain by Skeleton", "mob has no .item key");
  assert.equal(deathMessage("an arrow", "Alex", { attacker: { type: "skeleton" }, item: "Sting" }), "Alex was shot by Skeleton using [Sting]");
  assert.equal(deathMessage("a fall", "Alex"), "Alex hit the ground too hard");
});

test("attacker death messages go through the selected language", () => {
  const saved = lang.table;
  lang.table = { "death.attack.mob": "%2$s hat %1$s erledigt", "entity.Zombie.name": "Zombie!" };
  try {
    assert.equal(deathMessage("a zombie", "Alex", { source: "mob", attacker: { type: "zombie" } }), "Zombie! hat Alex erledigt");
  } finally { lang.table = saved; }
});
