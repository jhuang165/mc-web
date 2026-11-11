// Batch 42 scenario list (see EndermanWolfProbe). Player yaw/pitch are Java degrees: yaw 0 looks toward +z, 90 toward -x, 180 toward -z, 270 toward +x.
public class EndermanWolfScenarios {
  static void sc(String name, long seed, int ticks, String types, double[][] pos, String... script) throws Exception { EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script); }
  static void run() throws Exception {
    double[][] east = {{72.5, 64.5}, {64.5, 64.5}};
    // --- enderman: the gaze test and the anger timeline (the player at x 64.5 looks east, yaw 270, at an enderman 8 blocks away)
    sc("b42-enderman-stare-4001", 4001, 60, "E", east, "0 look 270 0");
    sc("b42-enderman-look-away-4002", 4002, 60, "E", east, "0 look 90 0", "30 look 270 0");
    sc("b42-enderman-look-edge-4003", 4003, 60, "E", east, "0 look 266 0", "20 look 262 0", "40 look 258 0"); // a few degrees off the middle of the enderman
    sc("b42-enderman-pitch-4004", 4004, 60, "E", east, "0 look 270 -30", "20 look 270 -10", "40 look 270 5");
    sc("b42-enderman-pumpkin-4005", 4005, 90, "E", east, "0 look 270 0", "0 helmet 86", "40 helmet 0", "70 helmet 91");
    sc("b42-enderman-creative-4006", 4006, 120, "E", east, "0 look 270 0", "0 creative 1 on", "60 creative 1 off");
    sc("b42-enderman-adventure-4007", 4007, 60, "E", east, "0 look 270 0", "0 adventure 1 on");
    sc("b42-enderman-invisible-4008", 4008, 100, "E", new double[][] {{72.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 invisible 1 on", "50 invisible 1 off");
    sc("b42-enderman-sneak-range-4009", 4009, 100, "E", new double[][] {{120.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 sneak 1 on", "20 move 0 117.5 64.5", "50 sneak 1 off");
    sc("b42-enderman-range-63-4010", 4010, 40, "E", new double[][] {{127.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b42-enderman-range-65-4011", 4011, 90, "E", new double[][] {{129.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "40 move 0 127.5 64.5");
    EndermanWolfProbe.scenario("b42-enderman-wall-4013", 4013, 80, "E", east, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{67, 0, 60, 68, 3, 68, 1, 0}}, false, 15);
    EndermanWolfProbe.scenario("b42-enderman-glass-4014", 4014, 60, "E", east, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{67, 0, 60, 67, 3, 68, 20, 0}}, false, 15);
    sc("b42-enderman-platform-4015", 4015, 60, "E", new double[][] {{72.5, 64.5, 4}, {64.5, 64.5}}, "0 look 270 -20", "20 look 270 -30", "40 look 270 -10");
    sc("b42-enderman-behind-4016", 4016, 60, "E", new double[][] {{64.5, 56.5}, {64.5, 64.5}}, "0 look 270 0", "30 look 180 0");
    // day, open sky and under a roof
    sc("b42-enderman-day-4017", 4017, 120, "E", east, "0 look 270 0", "0 day on", "0 bright 15");
    EndermanWolfProbe.scenario("b42-enderman-day-roof-4018", 4018, 120, "E", east, new String[] {"0 look 270 0", "0 day on"}, new int[][] {{60, 55, 80, 75}}, new int[0][0], false, 15);
    sc("b42-enderman-dusk-4019", 4019, 120, "E", east, "0 look 270 0", "0 day on", "0 bright 7"); // daylight flag, dim light: brightness under the 0.5 roll
    sc("b42-enderman-rain-4020", 4020, 100, "E", east, "0 look 270 0", "10 rain on", "60 rain off");
    EndermanWolfProbe.scenario("b42-enderman-water-4021", 4021, 100, "E", east, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{70, -1, 60, 75, -1, 68, 9, 0}}, true, 15);
    // anger timeline: hit by the player, hit by a mob, projectile-less teleport on a stare, chase teleport
    sc("b42-enderman-hit-4022", 4022, 160, "E", east, "0 look 90 0", "10 melee 0", "20 melee 0", "50 look 270 0");
    sc("b42-enderman-hit-creative-4023", 4023, 120, "E", east, "0 look 90 0", "0 creative 1 on", "10 melee 0");
    sc("b42-enderman-chase-4024", 4024, 260, "E", east, "0 look 270 0", "20 look 90 0", "40 move 1 20.5 64.5");
    sc("b42-enderman-close-stare-4025", 4025, 160, "E", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "60 look 90 0", "100 look 270 0");
    sc("b42-enderman-mob-hit-4026", 4026, 100, "EZ", new double[][] {{72.5, 64.5}, {70.5, 62.5}, {64.5, 64.5}}, "0 look 90 0", "5 hit 0 1 3.0 mob");
    sc("b42-enderman-pair-4027", 4027, 120, "EE", new double[][] {{72.5, 64.5}, {64.5, 72.5}, {64.5, 64.5}}, "0 look 270 0", "40 look 0 0");
    sc("b42-enderman-pumpkin-aggro-4028", 4028, 140, "E", east, "0 look 270 0", "20 helmet 86", "60 helmet 0");
    sc("b42-enderman-pitch-edge-4029", 4029, 120, "E", east, "0 look 270 2", "20 look 270 3", "40 look 270 4", "60 look 270 -1", "80 look 270 -2", "100 look 270 -3");
    sc("b42-enderman-pitch-scan-4030", 4030, 50, "E", east, "0 look 270 0", "3 look 90 0", "4 look 270 1", "7 look 90 0", "8 look 270 2", "11 look 90 0", "12 look 270 3", "15 look 90 0", "16 look 270 4", "19 look 90 0", "20 look 270 5", "23 look 90 0", "24 look 270 6", "27 look 90 0", "28 look 270 -1", "31 look 90 0", "32 look 270 -2", "35 look 90 0", "36 look 270 -3", "39 look 90 0", "40 look 270 -4", "43 look 90 0", "44 look 270 -6", "47 look 90 0");
    // --- wolf
    double[][] wolfSheep = {{70.5, 64.5}, {75.5, 64.5}, {64.5, 60.5}};
    sc("b42-wolf-wild-sheep-4101", 4101, 500, "WH", wolfSheep);
    sc("b42-wolf-wild-sheep-4102", 4102, 500, "WH", wolfSheep);
    sc("b42-wolf-wild-sheep-4103", 4103, 500, "WHH", new double[][] {{70.5, 64.5}, {75.5, 64.5}, {80.5, 70.5}, {64.5, 60.5}});
    sc("b42-wolf-wild-sheep-far-4104", 4104, 500, "WH", new double[][] {{70.5, 64.5}, {95.5, 64.5}, {64.5, 60.5}});
    sc("b42-wolf-tamed-sheep-4105", 4105, 400, "TH", wolfSheep);
    sc("b42-wolf-wild-idle-4106", 4106, 300, "W", new double[][] {{70.5, 64.5}, {64.5, 60.5}}, "0 creative 1 on", "100 creative 1 off", "150 sneak 1 on", "220 invisible 1 on");
    sc("b42-wolf-hit-survival-4107", 4107, 200, "W", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-hit-creative-4108", 4108, 200, "W", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 creative 1 on", "5 melee 0");
    sc("b42-wolf-hit-invisible-4109", 4109, 200, "W", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 invisible 1 on", "5 melee 0");
    sc("b42-wolf-hit-sneak-4110", 4110, 200, "W", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 sneak 1 on", "5 melee 0");
    sc("b42-wolf-hit-adventure-4111", 4111, 200, "W", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 adventure 1 on", "5 melee 0");
    sc("b42-wolf-hit-far-4112", 4112, 220, "W", new double[][] {{66.5, 64.5}, {64.5, 64.5}}, "5 melee 0", "10 move 1 100.5 64.5");
    sc("b42-wolf-help-4113", 4113, 260, "WWWW", new double[][] {{67.5, 64.5}, {70.5, 66.5}, {72.5, 61.5}, {100.5, 64.5}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-help-height-4114", 4114, 220, "WW", new double[][] {{67.5, 64.5}, {70.5, 66.5, 12}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-help-angry-4115", 4115, 220, "WAW", new double[][] {{67.5, 64.5}, {70.5, 66.5}, {72.5, 61.5}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-owner-hit-wild-4116", 4116, 220, "TTW", new double[][] {{62.5, 64.5}, {60.5, 62.5}, {74.5, 64.5}, {64.5, 64.5}}, "10 melee 2");
    sc("b42-wolf-owner-hit-zombie-4117", 4117, 260, "TZ", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 melee 1");
    sc("b42-wolf-owner-hurt-zombie-4118", 4118, 260, "TZ", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 hit 2 1 2.0 mob");
    sc("b42-wolf-owner-hurt-wild-4119", 4119, 260, "TW", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 hit 2 1 2.0 mob");
    sc("b42-wolf-owner-hurt-sitting-4120", 4120, 260, "SZ", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 hit 2 1 2.0 mob", "120 sit 0 off");
    sc("b42-wolf-owner-hit-sitting-4121", 4121, 260, "SZ", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 melee 1", "120 sit 0 off");
    sc("b42-wolf-owner-hurt-far-4122", 4122, 260, "TZ", new double[][] {{62.5, 64.5}, {110.5, 64.5}, {64.5, 64.5}}, "10 hit 2 1 2.0 mob");
    sc("b42-wolf-owner-hurt-expire-4123", 4123, 340, "TZ", new double[][] {{62.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "10 hit 2 1 2.0 mob", "13 move 0 130.5 64.5", "200 move 0 70.5 64.5");
    sc("b42-wolf-hit-own-4124", 4124, 200, "T", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-hit-own-sitting-4125", 4125, 200, "S", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "5 melee 0");
    sc("b42-wolf-two-owners-4126", 4126, 260, "TOW", new double[][] {{62.5, 64.5}, {68.5, 64.5}, {74.5, 64.5}, {64.5, 64.5}}, "10 melee 1", "100 melee 2");
    sc("b42-wolf-angry-idle-4127", 4127, 200, "A", new double[][] {{70.5, 64.5}, {64.5, 64.5}});
    sc("b42-wolf-hit-by-zombie-4128", 4128, 260, "WZ", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "10 hit 0 1 1.0 mob");
    sc("b42-wolf-tamed-hit-by-zombie-4129", 4129, 260, "TZ", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "10 hit 0 1 1.0 mob");
    sc("b42-wolf-help-tamed-4130", 4130, 260, "WTW", new double[][] {{67.5, 64.5}, {62.5, 64.5}, {70.5, 66.5}, {64.5, 64.5}}, "5 melee 0");
  }
  // Batch 43 (wanderdraws): long runs that make the native wander, look and carry draws, wolves begging and following. The player looks away (yaw 90) so no stare starts; item 352 is a bone, 319 raw porkchop.
  static void run43() throws Exception {
    double[][] away = {{72.5, 64.5}, {64.5, 64.5}};
    for (int k = 0; k < 3; k++) sc("b43wd-enderman-idle-" + (5001 + k), 5001 + k, 1500, "E", away, "0 look 90 0");
    sc("b43wd-enderman-idle-pair-5004", 5004, 1200, "EE", new double[][] {{72.5, 64.5}, {64.5, 72.5}, {64.5, 64.5}}, "0 look 180 0");
    // a 7 x 7 patch of dirt (3) and grass (2) around the enderman: it picks one (nextInt(20) then a random cell) and sets it down again (nextInt(2000))
    int[][] patch = {{68, 0, 60, 76, 0, 68, 3, 0}, {70, 0, 62, 74, 0, 66, 2, 0}};
    // seeds picked so that the runs pick and set down blocks: 5011 picks once, 5021 picks and sets down, 5023 twice, 5031 picks, sets down and picks again
    for (int[] k : new int[][] {{5011, 4000}, {5021, 3500}, {5023, 3500}, {5031, 3000}}) EndermanWolfProbe.scenario("b43wd-enderman-carry-" + k[0], k[0], k[1], "E", away, new String[] {"0 look 90 0"}, new int[0][0], patch, false, 15);
    double[][] wolf = {{70.5, 64.5}, {64.5, 60.5}};
    sc("b43wd-wolf-idle-wild-5101", 5101, 1200, "W", wolf, "0 look 90 0");
    sc("b43wd-wolf-idle-tamed-5102", 5102, 1200, "T", wolf, "0 look 90 0");
    sc("b43wd-wolf-beg-wild-5103", 5103, 400, "W", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "0 hold 352", "120 hold 0", "180 hold 352", "260 hold 319", "300 hold 352");
    sc("b43wd-wolf-beg-tamed-5104", 5104, 400, "T", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "0 hold 319", "100 hold 352", "160 hold 319", "250 hold 0", "300 hold 319");
    sc("b43wd-wolf-beg-far-5105", 5105, 300, "WT", new double[][] {{76.5, 64.5}, {60.5, 64.5}, {64.5, 64.5}}, "0 hold 352", "100 move 2 70.5 64.5", "100 hold 319");
    // follow owner: the owner walks away (start at 10 blocks, stop at 2), then jumps beyond 12 blocks and the wolf teleports into the ring around it
    sc("b43wd-wolf-follow-5111", 5111, 500, "T", new double[][] {{62.5, 64.5}, {64.5, 64.5}}, "10 walk 1 0.12 0", "150 walk 1 0 0", "250 move 1 110.5 64.5", "300 walk 1 0 0.1", "400 walk 1 0 0");
    sc("b43wd-wolf-follow-sit-5112", 5112, 400, "S", new double[][] {{62.5, 64.5}, {64.5, 64.5}}, "10 walk 1 0.12 0", "100 sit 0 off", "250 move 1 110.5 64.5");
    sc("b43wd-wolf-follow-two-5113", 5113, 400, "TT", new double[][] {{62.5, 64.5}, {60.5, 62.5}, {64.5, 64.5}}, "10 walk 2 0.15 0", "120 walk 2 0 0", "200 move 2 40.5 64.5");
    sc("b43wd-wolf-follow-wild-5114", 5114, 300, "WT", new double[][] {{70.5, 64.5}, {62.5, 64.5}, {64.5, 64.5}}, "10 walk 2 0.1 0.05", "150 walk 2 0 0");
  }
  // Batch 44 (passivedraws): every other EntityAITasks mob on Entity.rand. C cow, M mooshroom, P pig, R horse, L wild ocelot, U tamed ocelot (owner: the player), G iron golem, N snow golem, K witch, X creeper
  // (lower case c, m, p, l: a baby, growing age -24000, after construction). Items: 296 wheat, 391 carrot, 349 raw fish, 352 bone, 319 raw porkchop, 26 bed block.
  static void run44() throws Exception {
    double[][] far = {{70.5, 64.5}, {94.5, 64.5}}, near = {{70.5, 64.5}, {66.5, 64.5}};
    String all = "CMPRLUGNKX";
    for (int k = 0; k < all.length(); k++) {
      String t = String.valueOf(all.charAt(k));
      sc("b44pd-idle-far-" + t + "-" + (6001 + k), 6001 + k, 700, t, far, "0 look 90 0", "0 creative 1 on");
      sc("b44pd-idle-near-" + t + "-" + (6101 + k), 6101 + k, 700, t, near, "0 look 90 0", "0 creative 1 on");
    }
    // panic: the player's melee hit makes cows, pigs, horses panic (EntityAIPanic draws findRandomTarget); wolf-free
    for (String t : new String[] {"C", "M", "P", "R", "L"}) sc("b44pd-panic-" + t + "-6201", 6201, 400, t, near, "0 look 90 0", "5 melee 0", "120 melee 0");
    // tempt: wheat for cows, carrots for pigs, raw fish for ocelots; the player walks away and back
    sc("b44pd-tempt-cow-6211", 6211, 500, "CM", new double[][] {{74.5, 64.5}, {70.5, 60.5}, {64.5, 64.5}}, "0 holdn 296 64", "0 look 270 0", "200 walk 2 0.1 0", "300 walk 2 0 0", "350 hold 0");
    sc("b44pd-tempt-pig-6212", 6212, 500, "P", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 holdn 391 64", "0 look 270 0", "150 walk 1 0.1 0", "250 walk 1 0 0", "350 hold 0");
    sc("b44pd-tempt-ocelot-6213", 6213, 500, "L", new double[][] {{72.5, 64.5}, {64.5, 64.5}}, "0 holdn 349 64", "0 look 270 0", "100 walk 1 0.1 0", "200 walk 1 0 0", "350 hold 0");
    // breeding: two animals fed wheat or carrots, walking together and a baby after 60 ticks (6 hearts of Entity.rand draws, the experience orb's nextInt(7))
    sc("b44pd-breed-cow-6221", 6221, 400, "CC", new double[][] {{70.5, 64.5}, {74.5, 64.5}, {64.5, 60.5}}, "0 holdn 296 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b44pd-breed-mooshroom-6222", 6222, 400, "MM", new double[][] {{70.5, 64.5}, {73.5, 66.5}, {64.5, 60.5}}, "0 holdn 296 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b44pd-breed-pig-6223", 6223, 400, "PP", new double[][] {{70.5, 64.5}, {74.5, 64.5}, {64.5, 60.5}}, "0 holdn 391 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b44pd-breed-pig-6224", 6224, 400, "PP", new double[][] {{70.5, 62.5}, {80.5, 68.5}, {64.5, 60.5}}, "0 holdn 391 64", "2 use 0", "6 use 1", "0 look 90 0");
    sc("b44pd-breed-cow-pig-6225", 6225, 300, "CP", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 60.5}}, "0 holdn 296 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b44pd-breed-ocelot-6226", 6226, 400, "UU", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "0 holdn 349 64", "2 use 0", "4 use 1", "0 look 90 0");
    // follow parent: a baby calf and piglet within 8 blocks of an adult
    sc("b44pd-follow-cow-6231", 6231, 500, "cC", new double[][] {{78.5, 64.5}, {70.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-follow-pig-6232", 6232, 500, "pPp", new double[][] {{78.5, 64.5}, {70.5, 64.5}, {72.5, 70.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-follow-mooshroom-6233", 6233, 400, "mM", new double[][] {{76.5, 64.5}, {70.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    // wolves: taming with bones (nextInt(3) per bone), healing a tamed wolf with meat, mating two tamed wolves with meat
    sc("b44pd-wolf-tame-6301", 6301, 300, "W", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "0 holdn 352 64", "5 use 0", "8 use 0", "11 use 0", "14 use 0", "17 use 0", "20 use 0", "23 use 0", "26 use 0", "29 use 0", "32 use 0", "0 look 90 0");
    sc("b44pd-wolf-tame-6302", 6302, 300, "WW", new double[][] {{68.5, 64.5}, {70.5, 62.5}, {64.5, 64.5}}, "0 holdn 352 64", "5 use 0", "8 use 0", "11 use 0", "14 use 0", "17 use 1", "20 use 1", "23 use 1", "26 use 1", "29 use 1", "32 use 0", "0 look 90 0");
    sc("b44pd-wolf-feed-6311", 6311, 300, "T", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "0 health 0 6", "0 holdn 319 16", "5 use 0", "15 use 0", "25 use 0", "35 use 0", "45 use 0", "0 look 90 0");
    sc("b44pd-wolf-feed-sit-6312", 6312, 300, "S", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "0 health 0 10", "0 holdn 319 16", "5 use 0", "15 use 0", "25 use 0", "0 look 90 0");
    sc("b44pd-wolf-breed-6321", 6321, 400, "TT", new double[][] {{68.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "0 holdn 319 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b44pd-wolf-breed-6322", 6322, 400, "TT", new double[][] {{68.5, 60.5}, {75.5, 66.5}, {64.5, 64.5}}, "0 holdn 319 64", "2 use 0", "6 use 1", "0 look 90 0");
    sc("b44pd-wolf-breed-sit-6323", 6323, 300, "ST", new double[][] {{68.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "0 holdn 319 64", "2 use 0", "4 use 1", "0 look 90 0", "100 sit 0 off");
    sc("b44pd-ocelot-tame-6331", 6331, 300, "L", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 holdn 349 64", "5 use 0", "9 use 0", "13 use 0", "17 use 0", "21 use 0", "25 use 0", "29 use 0", "33 use 0", "0 look 90 0", "0 sneak 1 on");
    // avoid entity: a creeper steps away from an ocelot (6 blocks); a wild ocelot keeps 16 blocks from the player. Ocelot sit: a tamed ocelot rolls nextDouble each tick and finds the bed
    sc("b44pd-creeper-avoid-6341", 6341, 400, "XL", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {94.5, 64.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-ocelot-avoid-6342", 6342, 400, "L", new double[][] {{70.5, 64.5}, {58.5, 64.5}}, "0 look 90 0");
    EndermanWolfProbe.scenario("b44pd-ocelot-sit-bed-6343", 6343, 1500, "U", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 creative 1 on"}, new int[0][0], new int[][] {{72, 0, 64, 72, 0, 64, 26, 0}}, false, 15);
    // iron golem against a zombie, a snow golem throwing at a zombie, a witch throwing at the player, a creeper with a survival player left at range
    sc("b44pd-golem-zombie-6351", 6351, 400, "GZ", new double[][] {{70.5, 64.5}, {76.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-snow-zombie-6352", 6352, 400, "NZ", new double[][] {{70.5, 64.5}, {78.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-witch-player-6353", 6353, 300, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b44pd-creeper-watch-6354", 6354, 300, "X", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 creative 1 on");
  }
}
