import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTaczPack, packUrl, taczGun, taczRecipes } from './mods/guns/pack.js';
import { loadCS2Pack, mergeGunPacks } from './mods/guns/cs2.js';
import { CS2_GUN_IDS, CS2_ATTACHMENT_IDS, LRT_MELEE_IDS, TACZ_AMMO_IDS } from './mods/guns/ids.js';
import { setGunPack, setMeleePacks, gunPack, meleePacks, gunSmithRecipes, setGunsEnabled } from './mods/guns/install.js';
import { meleeUrl } from './mods/guns/melee.js';
import { resolveAllowed } from './mods/guns/fit.js';
import { smithCraft, canSmith } from './mods/guns/smith-screen.js';
import { installGunSounds } from './mods/guns/sounds.js';

const root = '/mods/cs2/';
function files() {
  return {
    [root + 'index.json']: { guns: ['cs_ak', 'ct_knife', 'cs_m320'], ammo: [], attachments: [], attachmentTags: ['allow_attachments/cs_ak'], melee: ['karambit'], recipes: ['melee/karambit', 'melee_gun_smith/karambit', 'gun/cs_ak'] },
    [root + 'pack/assets/cs2/lang/en_us.json']: { 'ak.name': 'Synthetic CS rifle', 'knife.name': 'Synthetic knife' },
    [root + 'pack/data/cs2/index/guns/cs_ak.json']: { name: 'ak.name', data: 'cs2:test_data', display: 'cs2:test_display' },
    [root + 'pack/data/cs2/data/guns/test_data.json']: { ammo: 'tacz:762x39', ammo_amount: 12, rpm: 123, bolt: 'closed_bolt', allow_attachment_types: ['muzzle'] },
    [root + 'pack/assets/cs2/display/guns/test_display.json']: { model: 'cs2:gun/test', texture: 'cs2:gun/test' },
    [root + 'pack/data/cs2/index/guns/cs_m320.json']: { data: 'tacz:shared_data', display: 'tacz:shared_display' },
    '/mods/tacz/pack/data/tacz/data/guns/shared_data.json': { ammo: 'tacz:40mm', ammo_amount: 1 },
    '/mods/tacz/pack/assets/tacz/display/guns/shared_display.json': { model: 'tacz:gun/shared' },
    [root + 'pack/data/cs2/index/guns/ct_knife.json']: { name: 'knife.name', data: 'cs2:knife_data', display: 'cs2:knife_display' },
    [root + 'pack/data/cs2/data/guns/knife_data.json']: { draw_time: 0.5, melee: { distance: 2, cooldown: 0.5, default: { damage: 9, range_angle: 60 } } },
    [root + 'pack/assets/cs2/display/guns/knife_display.json']: { model: 'cs2:gun/knife', texture: 'cs2:gun/knife', slot: 'cs2:slot/knife' },
    [root + 'pack/data/cs2/index/melee/karambit.json']: { name: 'knife.name', base_item: 'lrtactical:melee', data: { attributes: { 'generic.attack_damage': 5 }, attack: {} } },
    [root + 'pack/assets/cs2/display/melee/karambit.json']: { model: 'cs2:melee/test', texture: 'cs2:melee/test' },
    [root + 'pack/data/cs2/tacz_tags/attachments/allow_attachments/cs_ak.json']: ['cs2:usp_silencer', '#tacz:muzzle'],
    ...Object.fromEntries(['melee/karambit', 'melee_gun_smith/karambit'].map(name => [root + 'pack/data/cs2/recipes/' + name + '.json', { materials: [{ item: { tag: 'forge:ingots/iron' }, count: 2 }], result: { type: 'custom', item: { item: 'lrtactical:melee', nbt: { MeleeWeaponId: 'cs2:karambit' } } } }])),
    [root + 'pack/data/cs2/recipes/gun/cs_ak.json']: { materials: [{ item: { item: 'minecraft:quartz' }, count: 2 }], result: { type: 'gun', id: 'cs2:cs_ak', attachments: { muzzle: 'cs2:usp_silencer' } } },
  };
}
const fetcher = data => async url => data[url] == null ? null : JSON.stringify(data[url]);

test('unified pack resolves its namespace and shared TaCZ references without overwriting existing weapons', async () => {
  const cs2 = await loadCS2Pack(fetcher(files()));
  assert.equal(cs2.raw.guns['cs2:ct_knife'], undefined, 'gun-format knives become close-range melee weapons');
  const rifle = taczGun('cs2:cs_ak', cs2.raw.guns['cs2:cs_ak'], cs2.raw.lang);
  assert.equal(rifle.id, CS2_GUN_IDS['cs2:cs_ak']); assert.equal(rifle.ammo, TACZ_AMMO_IDS['762x39']);
  assert.equal(cs2.raw.guns['cs2:cs_m320'].display.model, 'tacz:gun/shared');
  assert.equal(packUrl.geo('cs2:gun/test'), '/mods/cs2/pack/assets/cs2/geo_models/gun/test.json');
  assert.equal(meleeUrl.texture('cs2:melee/test', 'cs2'), '/mods/cs2/pack/assets/cs2/textures/melee/test.png');
  const allowed = resolveAllowed(cs2.raw.tags['cs2:allow_attachments/cs_ak'], { muzzle: ['tacz:muzzle_silencer_knight_qd'] });
  assert.ok(allowed.has('cs2:usp_silencer')); assert.ok(allowed.has('muzzle_silencer_knight_qd'));
  const combined = mergeGunPacks({ guns: { p320: { sentinel: true } }, recipes: [] }, cs2.raw);
  assert.deepEqual(combined.guns.p320, { sentinel: true }); assert.ok(combined.guns['cs2:cs_ak']);
});

test('unified knives preserve old save ids and smithing recipes consume real costs and retain factory parts', async () => {
  const cs2 = await loadCS2Pack(fetcher(files()));
  assert.equal(LRT_MELEE_IDS['cs2:karambit'], LRT_MELEE_IDS['cs2_wt:karambit']);
  setGunPack(cs2.raw); setMeleePacks([cs2.melee]);
  try {
    assert.equal(meleePacks().weapons.find(w => w.key === 'cs2:ct_knife').damage, 8);
    assert.equal(meleePacks().weapons.filter(w => w.id === 4603).length, 1);
    const recipes = gunSmithRecipes(), knife = recipes.filter(r => r.output === 4603);
    assert.equal(knife.length, 1, 'duplicate category recipe is removed');
    assert.equal(knife[0].kind, 'melee');
    const inventory = [{ id: 302, count: 2, damage: 0 }];
    assert.equal(smithCraft(inventory, knife[0]).id, 4603); assert.deepEqual(inventory, [null]); assert.equal(canSmith(inventory, knife[0]), false);
    const rifle = recipes.find(r => r.output === CS2_GUN_IDS['cs2:cs_ak']);
    const crafted = smithCraft([{ id: 382, count: 2 }], rifle);
    assert.equal(crafted.damage, 12); assert.equal(crafted.modTag.attachments.muzzle, CS2_ATTACHMENT_IDS['cs2:usp_silencer']);
  } finally { setGunPack(null); setMeleePacks(null); }
});

test('CS2 sound files and weighted aliases remain namespaced alongside default-pack sounds', async () => {
  const bank = { ready: Promise.resolve(), base: { files: {}, events: {} }, manifest: { files: {}, events: {} } };
  await installGunSounds(bank, async url => url === root + 'index.json' ? { sounds: ['test/one', 'test/two'] }
    : url === root + 'pack/assets/cs2/sounds.json' ? { test_alias: { sounds: [{ name: 'cs2:test/one', weight: 2 }, 'cs2:test/two'] } } : null);
  assert.equal(bank.base.files['mods/cs2/test/one'].url, root + 'pack/assets/cs2/tacz_sounds/test/one.ogg');
  assert.deepEqual(bank.base.events['guns.cs2:test_alias'].sounds, [{ name: 'mods/cs2/test/one', weight: 2 }, { name: 'mods/cs2/test/two' }]);
});
