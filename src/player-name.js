// The verified local profile name. Native/headless sessions keep their historical default until explicitly changed.
export let PLAYER_NAME = 'Player';
export function setPlayerName(name) { PLAYER_NAME = typeof name === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(name) ? name : 'Player'; }
