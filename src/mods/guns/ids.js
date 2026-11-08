// Guns mod (not 1.7.10): the item id of every gun and ammo type in the TaCZ default gun pack (version 1.2.0), by its TaCZ
// name. This table is this project's own and only ever grows: a saved stack keeps its id, so names never move or get reused.
// The P320, AKM (TaCZ "ak47") and M870 keep their hand-made ids from catalog.js; every other pack gun is 4100 and up, ammo 4200
// and up. The guns themselves come from the locally installed pack (pack.js); without it these ids hold placeholders.
export const TACZ_GUN_IDS = {
  aa12: 4100, ai_awp: 4101, ak12: 4102, ak47: 4001, ak74m: 4103, aug: 4104, b93r: 4105, cz75: 4106, db_long: 4107,
  db_short: 4108, deagle: 4109, deagle_golden: 4110, fn_evolys: 4111, fn_fal: 4112, g36k: 4113, glock_17: 4114,
  hcar: 4115, hk416d: 4116, hk_g3: 4117, hk_mk23: 4118, hk_mp5a5: 4119, hk_mp7a1: 4120, hm50b: 4121, kar98: 4122,
  lonetrail: 4123, m1014: 4124, m107: 4125, m16a1: 4126, m16a4: 4127, m1866: 4128, m1897: 4129, m1911: 4130,
  m249: 4131, m320: 4132, m4a1: 4133, m700: 4134, m870: 4002, m95: 4135, m9a4: 4136, mcx_spear_lt: 4137, minigun: 4138,
  mk14: 4139, mk18: 4140, mrad: 4141, p320: 4000, p90: 4142, pkm: 4143, qbz_191: 4144, qbz_95: 4145, qr_24: 4146,
  rhino357: 4147, rpg7: 4148, rpk: 4149, scar_h: 4150, scar_l: 4151, scar_mk20: 4152, sks_tactical: 4153,
  spas_12: 4154, spr15hb: 4155, springfield1873: 4156, svd: 4157, taurus500: 4158, taurus943: 4159, tec_9: 4160,
  timeless50: 4161, type_81: 4162, ump45: 4163, urgi: 4164, uzi: 4165, vector45: 4166,
};
export const TACZ_AMMO_IDS = {
  "308": 4202, "338": 4204, "12g": 4012, "22wmr": 4200, "300blk": 4201, "30_06": 4203, "357mag": 4205, "40mm": 4206,
  "45_70": 4207, "45acp": 4010, "46x30": 4208, "500mag": 4209, "50ae": 4210, "50bmg": 4211, "545x39": 4212,
  "556x45": 4213, "57x28": 4214, "58x42": 4215, "68x51fury": 4216, "762x25": 4217, "762x39": 4011, "762x54": 4218,
  "792x57": 4219, "9mm": 4220, rpg_rocket: 4221,
};
