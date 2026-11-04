import { test } from "node:test";
import assert from "node:assert/strict";
import useReference from "../public/research/ender-pearl-use-reference.json" with { type: "json" };
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { Projectiles } from "./projectiles.js";
import { Arrows, BOW, ARROW, releasePower } from "./bow.js";
import { SNOWBALL, EGG, ENDER_PEARL, isThrowable, throwHeldItem, releaseHeldBow } from "./player-throw-simulation.js";
import { captureReleaseAction, dispatchReleaseAction } from "./player-actions.js";
import {JavaRandom} from './java-random.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const feet = () => ({ x: 8.5, y: 20, z: 8.5 });

test('pearl sound pitch replays the native Item.rand float calculation',()=>{
  // EnderPearlUseProbe seeds Item.itemRand with 71 before invoking the original item.
  const random=new JavaRandom(71),native=useReference.cases.find(c=>c.case==='survival-server').events[0].split('|');
  const survival=new Survival({slots:[makeStack(ENDER_PEARL,2)]},'survival');let sound;
  throwHeldItem({survival,projectiles:new Projectiles(()=>0.5),position:feet(),yaw:0,pitch:0},ENDER_PEARL,{
    random:()=>random.nextFloat(),playSound:(name,options)=>{sound={name,...options};},
  });
  assert.deepEqual(sound,{name:native[1],volume:Number(native[2]),pitch:Math.fround(Number(native[3]))});
});

test("thrown items: the pitch draw precedes the projectile seed; Survival takes one and resets the hand", () => {
  assert.deepEqual([SNOWBALL, EGG, ENDER_PEARL, 332, BOW].map(isThrowable), [true, true, true, false, false]);
  for (const [id, mode] of [[SNOWBALL, "survival"], [EGG, "survival"], [SNOWBALL, "creative"]]) {
    const draws = [], shared = seeded(7), random = () => { const v = shared(); draws.push(v); return v; };
    const survival = new Survival({ slots: [makeStack(id, 4)] }, mode), calls = [];
    const state = { survival, projectiles: new Projectiles(random), position: feet(), yaw: 0.3, pitch: -0.2 };
    const result = throwHeldItem(state, id, {
      random,
      playSound: (name, options) => calls.push([name, options.volume, options.pitch]),
      resetEquipped: () => calls.push("reset"), renderHotbar: () => calls.push("hotbar"), markUnsaved: () => calls.push("dirty"),
    });
    assert.equal(result.kind, id === EGG ? "egg" : "snowball");
    assert.equal(state.projectiles.balls[0], result.ball);
    assert.equal(draws.length, 2, "one sound pitch draw then one Entity.rand seed draw");
    assert.equal(calls[0][2], 0.4 / (draws[0] * 0.4 + 0.8));
    // The ball's Entity.rand stream came from the second draw.
    const twin = new Projectiles(() => draws[1]).throwSnowball(feet(), 0.3, -0.2);
    assert.deepEqual([result.ball.mx, result.ball.my, result.ball.mz], [twin.mx, twin.my, twin.mz]);
    assert.deepEqual(calls.slice(1), mode === "creative" ? [] : ["reset", "hotbar", "dirty"]);
    assert.equal(survival.count(id), mode === "creative" ? 4 : 3);
  }
  // Without a playSound hook the pitch is still drawn, so headless RNG order matches.
  const draws = [];
  const state = { survival: new Survival({ slots: [makeStack(SNOWBALL)] }), position: feet(), yaw: 0, pitch: 0,
    projectiles: new Projectiles(() => { draws.push("seed"); return 0.5; }) };
  throwHeldItem(state, SNOWBALL, { random: () => { draws.push("pitch"); return 0.5; } });
  assert.deepEqual(draws, ["pitch", "seed"]);
});

test("ender pearl native use: Creative is a silent no-op; Survival consumes before sound/spawn", () => {
  assert.equal(useReference.semantics.creative, "return the same stack before decrement, sound, or projectile spawn");
  assert.deepEqual(useReference.cases.map(c => [c.case, c.count, c.events.length]), [["survival-server", 1, 2], ["survival-client", 1, 1], ["creative-server", 2, 0]]);
  const calls = [], draw = [], make = mode => {
    const survival = new Survival({ slots: [makeStack(ENDER_PEARL, 2)] }, mode), state = {
      survival, projectiles: new Projectiles(() => { calls.push("seed"); return 0.5; }), position: feet(), yaw: 0.2, pitch: -0.1,
    };
    return { state, survival };
  };
  const creative = make("creative"), creativeResult = throwHeldItem(creative.state, ENDER_PEARL, {
    random: () => { draw.push("pitch"); return 0.5; }, playSound: () => calls.push("sound"),
  });
  assert.deepEqual(creativeResult, { kind: "enderPearl", ball: null, consumed: false, blocked: true });
  assert.equal(creative.survival.count(ENDER_PEARL), 2);
  assert.equal(creative.state.projectiles.balls.length, 0);
  assert.deepEqual(draw, []); assert.deepEqual(calls, []);

  const survival = make("survival"), order = [], take = survival.survival.take.bind(survival.survival);
  survival.survival.take = id => { order.push("consume"); return take(id); };
  const result = throwHeldItem(survival.state, ENDER_PEARL, {
    random: () => { order.push("pitch"); return 0.5; },
    playSound: (name, options) => { order.push(["sound", name, options.volume, options.pitch, survival.survival.count(ENDER_PEARL)]); },
    resetEquipped: () => order.push("reset"), renderHotbar: () => order.push("hotbar"), markUnsaved: () => order.push("dirty"),
  });
  assert.equal(result.kind, "enderPearl");
  assert.equal(result.consumed, true);
  assert.equal(result.ball.kind, "enderPearl");
  assert.equal(result.ball.owner, "player");
  assert.equal(result.ball.random, result.ball.rand);
  assert.equal(survival.survival.count(ENDER_PEARL), 1);
  assert.deepEqual(order.map(x => Array.isArray(x) ? x[0] : x), ["consume", "pitch", "sound", "reset", "hotbar", "dirty"]);
  assert.equal(order[2][1], "random.bow");
  assert.equal(order[2][4], 1, "native stack decrement happens before sound");
  assert.deepEqual(survival.state.projectiles.balls, [result.ball]);
  assert.throws(() => throwHeldItem(survival.state, 333), /Unsupported thrown item id/);
});

function bowState({ mode = "survival", arrows = 3, ticks = 20, held = BOW, screen = "playing" } = {}) {
  const slots = [makeStack(held), arrows ? makeStack(ARROW, arrows) : null];
  return {
    screen, eating: { id: BOW, ticks, bow: true }, survival: new Survival({ slots }, mode),
    arrows: new Arrows(seeded(3)), position: feet(), yaw: 1, pitch: 0.1,
  };
}

test("bow release: power, crit, durability, arrow use and flush order; Creative keeps arrows", () => {
  const calls = [], hooks = { flushArrows: () => calls.push("flush"), renderHotbar: () => calls.push("hotbar"), markUnsaved: () => calls.push("dirty") };
  const full = bowState();
  const shot = releaseHeldBow(full, hooks);
  assert.equal(shot.branch, "release-arrow");
  assert.equal(full.eating, null);
  assert.equal(shot.arrow.crit, true);
  assert.equal(shot.arrow.pickup, 1);
  assert.equal(full.survival.count(ARROW), 2);
  assert.equal(full.survival.inventory.held.damage, 1);
  assert.equal(full.arrows.events[0].sound, "random.bow");
  assert.deepEqual(calls, ["flush", "hotbar", "dirty"]);

  const partial = bowState({ ticks: 8 }), result = releaseHeldBow(partial);
  assert.ok(releasePower(8) < 1);
  assert.equal(result.arrow.crit, false);
  const speed = Math.hypot(result.arrow.mx, result.arrow.my, result.arrow.mz);
  assert.ok(speed < Math.hypot(shot.arrow.mx, shot.arrow.my, shot.arrow.mz));

  const creative = bowState({ mode: "creative", arrows: 0 });
  const free = releaseHeldBow(creative);
  assert.equal(free.arrow.pickup, 2);
  assert.equal(creative.survival.count(ARROW), 0);
});

test("bow release always ends the draw; short, arrowless, off-screen or switched draws do not shoot", () => {
  for (const [options, branch] of [
    [{ ticks: 1 }, "no-shot"], [{ arrows: 0 }, "no-shot"], [{ screen: "inventory" }, "draw-cancelled"], [{ held: 3 }, "draw-cancelled"],
  ]) {
    const state = bowState(options), calls = [];
    const result = releaseHeldBow(state, { flushArrows: () => calls.push("flush") });
    assert.equal(result.branch, branch);
    assert.equal(state.eating, null);
    assert.equal(state.arrows.list.length, 0);
    assert.deepEqual(calls, []);
  }
  const food = bowState();
  food.eating = { id: 320, ticks: 20 };
  assert.equal(releaseHeldBow(food).branch, "not-drawing");
  assert.deepEqual(food.eating, { id: 320, ticks: 20 });

  // The captured release is plain data and dispatches immediately against live state.
  const action = JSON.parse(JSON.stringify(captureReleaseAction()));
  assert.deepEqual(action, { version: 2, type: "player-release-use" });
  const live = bowState();
  assert.equal(dispatchReleaseAction(live, action).branch, "release-arrow");
  assert.deepEqual(dispatchReleaseAction(bowState(), { version: 1, type: "player-release-use" }),
    { released: false, branch: "invalid-release-action", skipped: true });
});
