import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMenus, UNAVAILABLE } from './menus.js';

// Title screen buttons: which are enabled and which explain why not.
function titleButtons(ctx) {
  const buttons = {}, node = () => ({ setAttribute() {}, style: {}, append() {} });
  const g = {
    image: node, text: () => node(), languageButton() {},
    button: (r, label, action, opts = {}) => { buttons[label] = { enabled: (opts.enabled ?? true) && !opts.reason, reason: opts.reason ?? '', action }; },
  };
  const menus = createMenus({ show() {}, build() {} }, { splashes: ['Hi'], ...ctx });
  menus.mainMenu().init(g, 427, 240);
  return buttons;
}

test('Singleplayer is enabled when this tab owns local saves, Multiplayer is paused', () => {
  const b = titleButtons({ canSingleplayer: () => true, multiplayer() {} });
  assert.equal(b.Singleplayer.enabled, true, 'a reason string disables a button, so none is passed here');
  assert.equal(b.Multiplayer.enabled, false);
  assert.equal(b.Multiplayer.reason, UNAVAILABLE.multiplayer);
});

test('Singleplayer is disabled with a reason when another tab owns local saves', () => {
  const b = titleButtons({ canSingleplayer: () => false });
  assert.equal(b.Singleplayer.enabled, false);
  assert.match(b.Singleplayer.reason, /Another tab owns local saves/);
});
