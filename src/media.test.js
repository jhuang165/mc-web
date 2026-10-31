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
  assert.equal(Object.keys(audio.files).length, 155);
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
    "random.eat",
    "game.player.hurt",
    "step.grass",
    "dig.stone",
    "mob.pig.say",
    "mob.zombie.hurt",
    "random.bow",
    "mob.sheep.say",
    "mob.sheep.shear",
  ])
    assert.ok(audio.events[event], event);
});
