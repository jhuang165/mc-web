import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("every shipped original sound and texture matches its recorded source hash", async () => {
  const audio = JSON.parse(
      await readFile(
        new URL("../public/audio/1.7.10/manifest.json", import.meta.url),
      ),
    ),
    media = JSON.parse(
      await readFile(
        new URL("../public/media/1.7.10/provenance.json", import.meta.url),
      ),
    );
  assert.equal(Object.keys(audio.files).length, 247);
  for (const file of [...Object.values(audio.files), ...media.assets]) {
    const bytes = await readFile(
      new URL("../public" + file.url, import.meta.url),
    );
    assert.equal(
      createHash("sha1").update(bytes).digest("hex"),
      file.sha1,
      file.url,
    );
  }
  for (const event of [
    "random.click",
    "random.pop",
    "random.orb",
    "random.levelup",
    "random.eat","random.drink",
    "game.player.hurt",
    "step.grass",
    "dig.stone",
    "mob.pig.say",
    "mob.zombie.hurt",
    "random.bow","random.bowhit","mob.skeleton.say","mob.skeleton.hurt","mob.skeleton.death","mob.skeleton.step",
    "mob.spider.say", "mob.spider.death", "mob.spider.step",
    "mob.sheep.say",
    "mob.sheep.shear",
    "mob.creeper.say", "mob.creeper.death", "creeper.primed", "game.tnt.primed", "random.explode",
    "mob.irongolem.hit", "mob.irongolem.death", "mob.irongolem.throw", "mob.irongolem.walk",
  ])
    assert.ok(audio.events[event], event);
});
