// Guns mod (not 1.7.10): the item id of every gun, ammo type and attachment in the TaCZ default gun pack (version 1.2.0), by its TaCZ
// name. This table is this project's own and only ever grows: a saved stack keeps its id, so names never move or get reused.
// The P320, AKM (TaCZ "ak47") and M870 keep their hand-made ids from catalog.js; every other pack gun is 4100 and up, ammo 4200
// and up, attachments 4400 and up. The guns themselves come from the locally installed pack (pack.js); without it these ids
// hold placeholders.
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
// Every attachment in the pack: 4400 and up, in the pack's alphabetical order at version 1.2.0 (new ones go on the end).
export const TACZ_ATTACHMENT_IDS = {
  ammo_mod_fmj: 4400, ammo_mod_he: 4401, ammo_mod_hp: 4402, ammo_mod_i: 4403, ammo_mod_overpressure_recoil: 4404,
  ammo_mod_slug: 4405, bayonet_6h3: 4406, bayonet_m9: 4407, deagle_golden_long_barrel: 4408, extended_mag_1: 4409,
  extended_mag_2: 4410, extended_mag_3: 4411, grip_cobra: 4412, grip_cqr: 4413, grip_magpul_afg: 4414,
  grip_magpul_afg_2: 4415, grip_osovets_black: 4416, grip_rk0: 4417, grip_rk1_b25u: 4418, grip_rk6: 4419,
  grip_se_5: 4420, grip_td: 4421, grip_troy: 4422, grip_vertical_military: 4423, grip_vertical_ranger: 4424,
  grip_vertical_talon: 4425, laser_compact: 4426, laser_lopro: 4427, laser_ngal: 4428, laser_nightstick: 4429,
  laser_peq15: 4430, laser_peq6: 4431, light_extended_mag_1: 4432, light_extended_mag_2: 4433,
  light_extended_mag_3: 4434, muzzle_brake_cthulhu: 4435, muzzle_brake_cyclone_d2: 4436, muzzle_brake_mastiff_sg: 4437,
  muzzle_brake_pioneer: 4438, muzzle_brake_timeless50: 4439, muzzle_brake_trex: 4440, muzzle_choke_sg: 4441,
  muzzle_compensator_trident: 4442, muzzle_silencer_knight_qd: 4443, muzzle_silencer_mirage: 4444,
  muzzle_silencer_phantom_s1: 4445, muzzle_silencer_ptilopsis: 4446, muzzle_silencer_sg: 4447,
  muzzle_silencer_socom_rc1: 4448, muzzle_silencer_ursus: 4449, muzzle_silencer_vulture: 4450,
  muzzle_silencer_wraith: 4451, oem_barrel_cannon: 4452, oem_grip_cover: 4453, oem_m16a1_handguard_a2: 4454,
  oem_m1897_bayonet: 4455, oem_side_cover: 4456, oem_sight_1: 4457, oem_sight_2: 4458, oem_sight_aug: 4459,
  oem_sight_hk: 4460, oem_stock_heavy: 4461, oem_stock_light: 4462, oem_stock_removed: 4463, oem_stock_tactical: 4464,
  oem_stock_unfolded: 4465, scope_1866_4x: 4466, scope_1873_6x: 4467, scope_98k: 4468, scope_acog_ta31: 4469,
  scope_amg_10: 4470, scope_aug_default: 4471, scope_c79: 4472, scope_contender: 4473, scope_elcan_4x: 4474,
  scope_hamr: 4475, scope_lpvo_1_6: 4476, scope_mk4ert: 4477, scope_mk5hd: 4478, scope_pso_1: 4479, scope_qmk152: 4480,
  scope_reap_ir: 4481, scope_retro_2x: 4482, scope_standard_8x: 4483, scope_vudu: 4484, scope_xl50: 4485,
  scope_xm157: 4486, shotgun_extended_mag_1: 4487, shotgun_extended_mag_2: 4488, shotgun_extended_mag_3: 4489,
  sight_1p87: 4490, sight_552: 4491, sight_acro_pistol: 4492, sight_acro_rifle: 4493, sight_apm4s: 4494,
  sight_coyote: 4495, sight_deltapoint_pistol: 4496, sight_deltapoint_rifle: 4497, sight_exp3: 4498,
  sight_fastfire_pistol: 4499, sight_fastfire_rifle: 4500, sight_infitac_fmp13: 4501, sight_okp7: 4502, sight_p90: 4503,
  sight_pk06_pistol: 4504, sight_pk06_rifle: 4505, sight_rmr_dot: 4506, sight_sro_dot: 4507, sight_srs_02: 4508,
  sight_t1: 4509, sight_t2: 4510, sight_uh1: 4511, sniper_extended_mag_1: 4512, sniper_extended_mag_2: 4513,
  sniper_extended_mag_3: 4514, stock_ak12: 4515, stock_carbon_bone_c5: 4516, stock_heavy_ctr: 4517,
  stock_heavy_spas_12: 4518, stock_hk_slim_line: 4519, stock_m4ss: 4520, stock_militech_b5: 4521, stock_moe: 4522,
  stock_psg: 4523, stock_ripstock: 4524, stock_sba3: 4525, stock_tactical_ar: 4526, stock_tactical_spas_12: 4527,
};
// LR Tactical melee weapons (melee.js) by "<namespace>:<name>": 4600 and up. The CS2 Knifes Pack v1.0.1 (cs2_wt) in its
// alphabetical order; other packs' weapons get the next ids as they are added.
export const LRT_MELEE_IDS = {
  "cs2_wt:bayonet": 4600, "cs2_wt:butterfly": 4601, "cs2_wt:css": 4602, "cs2_wt:karambit": 4603, "cs2_wt:m9": 4604,
  "cs2_wt:push": 4605, "cs2_wt:skeleton": 4606, "cs2_wt:stiletto": 4607, "cs2_wt:tactical": 4608, "cs2_wt:talon": 4609,
};
// English names for a pack that ships only other languages (the CS2 pack has zh_cn only): the knives' CS2 names.
export const LRT_MELEE_NAMES = {
  "cs2_wt:bayonet": "Bayonet", "cs2_wt:butterfly": "Butterfly Knife", "cs2_wt:css": "Classic Knife", "cs2_wt:karambit": "Karambit",
  "cs2_wt:m9": "M9 Bayonet", "cs2_wt:push": "Shadow Daggers", "cs2_wt:skeleton": "Skeleton Knife", "cs2_wt:stiletto": "Stiletto Knife",
  "cs2_wt:tactical": "Huntsman Knife", "cs2_wt:talon": "Talon Knife",
};
