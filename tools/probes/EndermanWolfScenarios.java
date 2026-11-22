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
    // Batch 45 (mobfixes): the same sit task onto a free chest (EntityAIOcelotSit reads TileEntityChest.numPlayersUsing) and a lit furnace (block 62, no tile entity needed)
    EndermanWolfProbe.scenario("b45mf-ocelot-sit-chest-6361", 6361, 1500, "U", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 creative 1 on"}, new int[0][0], new int[][] {{72, 0, 64, 72, 0, 64, 54, 2}}, false, 15);
    EndermanWolfProbe.scenario("b45mf-ocelot-sit-furnace-6362", 6362, 1500, "U", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 creative 1 on"}, new int[0][0], new int[][] {{72, 0, 64, 72, 0, 64, 62, 2}}, false, 15);
    // iron golem against a zombie, a snow golem throwing at a zombie, a witch throwing at the player, a creeper with a survival player left at range
    sc("b44pd-golem-zombie-6351", 6351, 400, "GZ", new double[][] {{70.5, 64.5}, {76.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-snow-zombie-6352", 6352, 400, "NZ", new double[][] {{70.5, 64.5}, {78.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b44pd-witch-player-6353", 6353, 300, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b44pd-creeper-watch-6354", 6354, 300, "X", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 creative 1 on");
  }

  // Batch 47 (serverplayer): EW_SET=b47sp. The probe's player is the server copy, ticked by EntityPlayerMP.onUpdateEntity (mw.i) like b46mp, but its position follows the C03 rules: the client (a separate
  // position driven by the walk and move ops) sends a position when it moved over 0.03 or after 20 ticks, and the copy is put back to the position it had after each update (processPlayer). Row element 6
  // is the client's onGround flag (op "ground 1 off|on"), 7 the client's y, 8 the copy's position. Z zombie, C cow, P pig, X creeper.
  static void sc47(String name, long seed, int ticks, String types, double[][] pos, int[][] blocks, boolean water, String... script) throws Exception {
    EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script, new int[0][0], blocks, water, 15);
  }
  static void run47() throws Exception {
    int[][] none = new int[0][0];
    // a knockback into a wall: the zombie's hit throws the copy west into stone one block away (x, then the motion zeroed by the wall)
    sc47("b47sp-wall-9000", 9000, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{63, 0, 60, 63, 3, 68, 1, 0}}, false, "0 look 90 0", "3 hit 1 0 4");
    sc47("b47sp-wall-near-9001", 9001, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{63, 0, 60, 63, 3, 68, 1, 0}}, false, "0 look 90 0", "0 move 1 64.25 64.5", "3 hit 1 0 4");
    sc47("b47sp-cow-wall-9002", 9002, 60, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, new int[][] {{63, 0, 60, 63, 3, 68, 1, 0}}, false, "0 look 90 0");
    sc47("b47sp-ceiling-9003", 9003, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{60, 2, 60, 70, 2, 70, 1, 0}}, false, "0 look 90 0", "3 hit 1 0 4");
    sc47("b47sp-air-9004", 9004, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, none, false, "0 look 90 0", "0 ground 1 off", "3 hit 1 0 4", "0 move 1 64.5 64.5 3");
    // water and lava: the drag, buoyancy and flow of the copy's own motion
    sc47("b47sp-water-9005", 9005, 60, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, new int[][] {{60, 0, 60, 70, 1, 70, 9, 0}}, true, "0 look 90 0", "0 ground 1 off");
    sc47("b47sp-water-hit-9006", 9006, 60, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{60, 0, 60, 70, 1, 70, 9, 0}}, true, "0 look 90 0", "0 ground 1 off", "3 hit 1 0 4");
    sc47("b47sp-lava-9007", 9007, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{60, 0, 60, 70, 1, 70, 11, 0}}, true, "0 look 90 0", "0 ground 1 off", "0 effect 1 12 100000", "3 hit 1 0 4"); // fire resistance: the lava still drags the copy but does not hurt it (its damage is the client player's environment)
    sc47("b47sp-web-9008", 9008, 50, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{64, 0, 64, 64, 1, 64, 30, 0}}, false, "0 look 90 0", "3 hit 1 0 4");
    sc47("b47sp-ladder-9009", 9009, 50, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, new int[][] {{63, 0, 60, 63, 3, 68, 1, 0}, {64, 0, 64, 64, 3, 64, 65, 4}}, false, "0 look 90 0", "3 hit 1 0 4");
    // the sneak edge: a ledge east of the copy, the knockback throws it towards the drop
    sc47("b47sp-sneak-edge-9010", 9010, 40, "Z", new double[][] {{60.5, 64.5}, {63.9, 64.5}}, new int[][] {{64, -3, 60, 70, -1, 70, 0, 0}}, false, "0 look 90 0", "0 sneak 1 on", "3 hit 1 0 4");
    sc47("b47sp-ledge-9011", 9011, 40, "Z", new double[][] {{60.5, 64.5}, {63.9, 64.5}}, new int[][] {{64, -3, 60, 70, -1, 70, 0, 0}}, false, "0 look 90 0", "3 hit 1 0 4");
    // a creeper blast next to the copy, in the open and with obsidian behind it
    sc47("b47sp-blast-9012", 9012, 120, "X", new double[][] {{66.5, 64.5}, {64.5, 64.5}}, none, false, "0 look 90 0");
    sc47("b47sp-blast-wall-9013", 9013, 120, "X", new double[][] {{66.5, 64.5}, {64.5, 64.5}}, new int[][] {{62, 0, 60, 62, 4, 68, 49, 0}}, false, "0 look 90 0");
    // the position packets: a slow client (0.02 a tick), a nudge under the threshold (the copy follows after 20 ticks), a crowd with a moving client, a flying creative player
    sc47("b47sp-slow-walk-9014", 9014, 60, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, none, false, "0 look 90 0", "0 walk 1 0 0.02", "40 walk 1 0 0");
    sc47("b47sp-nudge-9015", 9015, 60, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, none, false, "0 look 90 0", "5 move 1 64.52 64.5");
    sc47("b47sp-walk-herd-9016", 9016, 100, "CPCP", new double[][] {{66.0, 64.4}, {66.8, 64.6}, {67.6, 64.5}, {68.4, 64.7}, {64.5, 64.5}}, none, false, "0 look 90 0", "0 walk 4 0.15 0", "30 walk 4 0.02 0", "60 walk 4 0 0");
    sc47("b47sp-flying-9017", 9017, 50, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, none, false, "0 look 90 0", "0 creative 1 on", "0 fly 1 on", "0 ground 1 off", "0 move 1 64.5 64.5 3");
    sc47("b47sp-stand-pushed-9018", 9018, 60, "CP", new double[][] {{65.0, 64.5}, {64.5, 65.0}, {64.5, 64.5}}, none, false, "0 look 90 0");
  }

  // Batch 46 (mobpush): EW_SET=b46mp. The probe player is also ticked by EntityPlayerMP.onUpdateEntity (mw.l) after the mobs each tick (the network tick), so mobs push it and it pushes them natively;
  // Z zombie, C cow, P pig, K witch.
  static void run46() throws Exception {
    double[][] P = {{64.5, 64.5}};
    sc("b46mp-far-8000", 8000, 12, "C", new double[][] {{90.5, 64.5}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-cow-touch-8001", 8001, 60, "C", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-cow-diagonal-8002", 8002, 60, "C", new double[][] {{64.9, 64.9}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-pig-touch-8003", 8003, 60, "P", new double[][] {{64.5, 65.0}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-crowd-8004", 8004, 80, "CPCP", new double[][] {{65.0, 64.5}, {64.0, 64.6}, {64.5, 65.0}, {64.6, 64.1}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-coincident-8005", 8005, 40, "C", new double[][] {{64.5, 64.5}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-near-threshold-8006", 8006, 40, "C", new double[][] {{64.505, 64.505}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-creative-8007", 8007, 60, "CP", new double[][] {{65.0, 64.5}, {64.5, 65.0}, {64.5, 64.5}}, "0 look 90 0", "0 creative 2 on");
    sc("b46mp-walk-into-cow-8008", 8008, 80, "C", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 walk 1 0.1 0", "20 walk 1 0 0");
    sc("b46mp-walk-through-herd-8009", 8009, 120, "CCPP", new double[][] {{66.0, 64.4}, {66.8, 64.6}, {67.6, 64.5}, {68.4, 64.7}, {64.5, 64.5}}, "0 look 90 0", "0 walk 4 0.15 0", "40 walk 4 0 0", "60 walk 4 -0.15 0");
    sc("b46mp-two-touch-8010", 8010, 60, "CP", new double[][] {{65.0, 64.5}, {64.5, 65.0}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-zombie-touch-8011", 8011, 40, "Z", new double[][] {{65.0, 64.5}, {64.5, 64.5}}, "0 look 90 0");
    sc("b46mp-zombie-hit-8012", 8012, 40, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "3 hit 1 0 4");
    sc("b46mp-witch-pushed-8013", 8013, 300, "KC", new double[][] {{70.5, 64.5}, {64.9, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b46mp-witch-walking-8014", 8014, 300, "K", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 walk 1 0 0.1", "100 walk 1 0 -0.1", "200 walk 1 0.1 0");
    sc("b46mp-witch-cow-8015", 8015, 300, "KC", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "2 hit 0 1 1");
    sc("b46mp-witch-knocked-8016", 8016, 300, "KC", new double[][] {{70.5, 64.5}, {64.0, 64.2}, {64.5, 64.5}}, "0 look 270 0", "58 hit 2 1 1", "117 hit 2 1 1", "178 hit 2 1 1");
    sc("b46mp-witch-cow-knocked-8017", 8017, 300, "KC", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "2 hit 0 1 1", "58 hit 1 0 1", "118 hit 1 0 1");
    sc("b46mp-witch-knocked-poison-8018", 8018, 300, "KC", new double[][] {{76.5, 64.5}, {64.0, 64.2}, {64.5, 64.5}}, "0 look 270 0", "58 hit 2 1 1", "117 hit 2 1 1", "178 hit 2 1 1");
  }

  // Batch 45 (creeperwitch): creeper swell, ignition, lightning, explosion and death drops, and the witch's potion throws, drinking and drops, with a survival player (health scaled by difficulty), on the real
  // EntityPlayerMP. Rows carry [explosions, spawned entities, changed cells, player motion] after the b44 row elements (EW_SET=b45cw). Ops added: difficulty n | grief on|off | power idx | bolt idx | fire idx seconds |
  // arrowkill idx dmg (a skeleton's arrow) | effect idx potionId ticks. Items: 259 flint and steel, 268 wooden sword. X creeper, K witch, Z zombie, C cow, P pig.
  // Batch 87 (mobrec87, b87wf): a witch fight against the probe player on the b45cw harness, with the thrown EntityPotion entities updated after the mobs (EndermanWolfProbe B87W):
  // the potions fly, hit the unticked player (its effects never run out, so the witch's next choice sees them: slowness from 8 blocks, then poison, then harming) and splash it.
  // fight: a witch 10 and 7 blocks away throwing; melee: the player's blows (the unticked player's attack attribute never takes the held sword's modifier: 1 damage) hurt it at
  // ticks 30 and 90 (it drinks healing while hurt), then a blow kills it at tick 141 (drops, orbs).
  static void run87() throws Exception {
    sc("b87wf-witch-fight-8801", 8801, 200, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b87wf-witch-fight-near-8803", 8803, 200, "K", new double[][] {{71.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    for (int sd : new int[] {8811, 8812}) sc("b87wf-witch-melee-" + sd, sd, 165, "K", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, "30 melee 0", "90 melee 0", "140 health 0 1", "141 melee 0");
  }
  // Batch 88 (mobrec88, b88mr): the b47 serverplayer harness (the probe player a ticked EntityPlayerMP: its potion effects and hurt window run) with snowballs flying (every EntityThrowable after the mobs)
  // and spiders' entityToAttack as their target. Cave spiders (J) bite the player at night (bright 0) on Normal, Hard and Easy; the player kills the spider (health 1, then a blow) so the poison runs out with
  // its damage ticks. Iron golems (G) fight a creeper (X), a spider (B) and a cave spider; snow golems (N) pelt a zombie (Z) and a creeper. The player stands over 40 blocks away from those fights.
  static void sc88(String name, long seed, int ticks, String types, double[][] pos, int bright, String... script) throws Exception { EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script, new int[0][0], new int[0][0], false, bright); }
  static void run88() throws Exception {
    double[][] cave = {{68.5, 64.5}, {64.5, 64.5}};
    for (int sd : new int[] {8801, 8802, 8803}) sc88("b88mr-cave-normal-" + sd, sd, 230, "J", cave, 0, "0 look 90 0", "60 health 0 1", "61 melee 0");
    for (int sd : new int[] {8811, 8812, 8813}) sc88("b88mr-cave-hard-" + sd, sd, 390, "J", cave, 0, "0 look 90 0", "0 difficulty 3", "60 health 0 1", "61 melee 0");
    sc88("b88mr-cave-easy-8821", 8821, 120, "J", cave, 0, "0 look 90 0", "0 difficulty 1", "60 health 0 1", "61 melee 0");
    sc88("b88mr-cave-creative-8822", 8822, 230, "J", cave, 0, "0 look 90 0", "60 health 0 1", "61 melee 0", "90 creative 1 on", "150 creative 1 off");
    // EntityLiving.canAttackClass (sw.a(Class)) refuses EntityCreeper and EntityGhast, so neither golem picks a creeper on its own (8831, 8861); in the others the creeper's hit (DamageSource.causeMobDamage, 1) comes first.
    sc88("b88mr-golem-creeper-8831", 8831, 200, "GX", new double[][] {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}}, 15);
    for (int sd : new int[] {8832, 8833}) sc88("b88mr-golem-creeper-" + sd, sd, 200, "GX", new double[][] {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}}, 15, "10 hit 0 1 1");
    for (int sd : new int[] {8841, 8842}) sc88("b88mr-golem-spider-" + sd, sd, 200, "GB", new double[][] {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}}, 0);
    for (int sd : new int[] {8843, 8844}) sc88("b88mr-golem-cave-" + sd, sd, 200, "GJ", new double[][] {{120.5, 64.5}, {125.5, 64.5}, {64.5, 64.5}}, 0);
    for (int sd : new int[] {8851, 8852, 8853}) sc88("b88mr-snow-zombie-" + sd, sd, 200, "NZ", new double[][] {{120.5, 64.5}, {128.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b88mr-snow-creeper-8861", 8861, 200, "NX", new double[][] {{120.5, 64.5}, {127.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b88mr-snow-creeper-8862", 8862, 200, "NX", new double[][] {{120.5, 64.5}, {127.5, 64.5}, {64.5, 64.5}}, 15, "10 hit 0 1 1");
  }
  // Batch 89 (mobrec89, b89mr): the b88mr harness (EndermanWolfProbe B89): a snow golem against a blaze (its fireballs fly), poison and regeneration on mobs (undead, spiders and the witch's
  // magic resistance), Poison II and IV on the player, and the player's real health with its food stats (op realhp: max health 20, no 1000 reset; op food: level, saturation).
  static void run89() throws Exception {
    double[][] far = {{120.5, 64.5}, {64.5, 64.5}};
    for (int sd : new int[] {8901, 8902, 8903}) sc88("b89mr-snow-blaze-" + sd, sd, 200, "Na", new double[][] {{120.5, 64.5}, {128.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b89mr-poison-pig-8911", 8911, 300, "P", far, 15, "0 effect 0 19 300");
    sc88("b89mr-poison2-pig-8912", 8912, 160, "P", far, 15, "0 effect 0 19 200 1");
    sc88("b89mr-poison-zombie-8913", 8913, 120, "Z", far, 15, "0 health 0 10", "0 effect 0 19 100", "0 effect 0 10 100", "0 effect 0 1 100");
    sc88("b89mr-poison-spider-8914", 8914, 160, "B", far, 15, "0 health 0 10", "0 effect 0 19 100", "0 effect 0 10 150");
    sc88("b89mr-poison-witch-8915", 8915, 300, "K", far, 15, "0 effect 0 19 300");
    sc88("b89mr-poison-snowgolem-8916", 8916, 120, "N", far, 15, "0 effect 0 19 120");
    sc88("b89mr-poison2-golem-8917", 8917, 160, "G", far, 15, "0 effect 0 19 150 1");
    sc88("b89mr-poison-pigman-8918", 8918, 120, "z", far, 15, "0 health 0 10", "0 effect 0 19 100", "0 effect 0 10 100");
    double[][] pig = {{120.5, 64.5}, {64.5, 64.5}};
    sc88("b89mr-player-poison2-8921", 8921, 220, "P", pig, 15, "0 effect 1 19 200 1");
    sc88("b89mr-player-poison4-8922", 8922, 120, "P", pig, 15, "0 effect 1 19 100 3");
    sc88("b89mr-player-poison2-cave-8923", 8923, 260, "J", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 0, "0 look 90 0", "0 effect 1 19 240 1", "60 health 0 1", "61 melee 0");
    sc88("b89mr-food-regen-8931", 8931, 400, "P", pig, 15, "0 realhp 10", "0 food 20 5");
    sc88("b89mr-food-poison-8932", 8932, 400, "P", pig, 15, "0 realhp 10", "0 food 20 5", "0 effect 1 19 300");
    sc88("b89mr-food-poison2-floor-8933", 8933, 200, "P", pig, 15, "0 realhp 4", "0 food 10 0", "0 effect 1 19 200 1");
    sc88("b89mr-food-starve-8934", 8934, 400, "P", pig, 15, "0 realhp 6", "0 food 0 0", "0 effect 1 19 200");
    sc88("b89mr-food-hunger-8935", 8935, 400, "P", pig, 15, "0 realhp 16", "0 food 20 0", "0 effect 1 17 400 2", "0 effect 1 19 100");
    sc88("b89mr-food-cave-8936", 8936, 300, "J", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 0, "0 look 90 0", "0 realhp 20", "0 food 20 0", "60 health 0 1", "61 melee 0");
  }
  // Batch 90 (mobrec90, b90mr): the b89mr harness with row element 11 [World.rand draws so far]. A blaze against the player: shots (World.playAuxSFXAtEntity 1009 draws nothing on the server), the player going
  // creative or dying mid-fight (EntityBlaze.onLivingUpdate, xx.e, reads entityToAttack before td.bq clears a dead or creative player target).
  static void run90() throws Exception {
    double[][] fight = {{70.5, 64.5, 4}, {64.5, 64.5}};
    for (int sd : new int[] {9001, 9002}) sc88("b90mr-blaze-shot-" + sd, sd, 200, "a", fight, 15);
    sc88("b90mr-blaze-creative-9011", 9011, 240, "a", fight, 15, "60 creative 1 on", "140 creative 1 off");
    sc88("b90mr-blaze-creative-9012", 9012, 200, "a", new double[][] {{70.5, 64.5, 0}, {64.5, 64.5}}, 15, "30 creative 1 on");
    sc88("b90mr-blaze-creative-start-9013", 9013, 120, "a", fight, 15, "0 creative 1 on");
    sc88("b90mr-blaze-dead-9021", 9021, 200, "a", fight, 15, "0 realhp 20", "60 health 1 0.0");
    sc88("b90mr-blaze-dead-9022", 9022, 200, "a", new double[][] {{70.5, 64.5, 10}, {64.5, 64.5}}, 15, "0 realhp 20", "45 health 1 0.0");
    sc88("b90mr-blaze-dead-9023", 9023, 160, "a", new double[][] {{70.5, 64.5, 6}, {64.5, 64.5}}, 15, "0 realhp 20", "20 health 1 0.0");
  }
  // Batch 91 (mobrec91, b91mr): the b90mr harness (EndermanWolfProbe B91). The dead probe player (health 0) keeps ticking in EntityPlayerMP.onUpdateEntity (nh.a(jd) never tests isDead), so a mob that
  // pushed it keeps pushing and it keeps falling; legacy (non-AI-task) mobs read it through World.getClosestPlayer (no alive test) and sw.bq's look target (isDead). Slimes and magma cubes fight the player;
  // an iron golem fights what the rest of the harness has not covered. Types: i slime 2, j slime 1, l magma cube 2, u magma cube 4.
  static void run91() throws Exception {
    double[][] six = {{70.5, 64.5}, {64.5, 64.5}};
    // the player is knocked into the air by a zombie (EntityLivingBase.knockBack) and dies in flight: the copy keeps its motion and falls
    sc88("b91mr-dead-flight-9101", 9101, 120, "Z", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, 15, "0 realhp 20", "10 hit 1 0 1", "12 health 1 0.0");
    sc88("b91mr-dead-flight-9102", 9102, 120, "Z", new double[][] {{66.5, 64.5, 0}, {64.5, 64.5}}, 15, "0 realhp 20", "5 hit 1 0 1", "6 health 1 0.0");
    sc88("b91mr-dead-spider-9111", 9111, 160, "B", six, 0, "0 realhp 20", "40 health 1 0.0");
    sc88("b91mr-dead-spider-9112", 9112, 160, "B", new double[][] {{66.5, 64.5}, {64.5, 64.5}}, 0, "0 realhp 20", "30 health 1 0.0");
    for (int sd : new int[] {9124, 9126}) sc88("b91mr-dead-silverfish-" + sd, sd, 160, "f", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 15, "0 realhp 20", "40 health 1 0.0");
    sc88("b91mr-dead-giant-9131", 9131, 160, "g", new double[][] {{72.5, 64.5}, {64.5, 64.5}}, 15, "0 realhp 20", "40 health 1 0.0");
    sc88("b91mr-dead-zombie-9151", 9151, 160, "Z", six, 15, "0 realhp 20", "40 health 1 0.0");
    // slimes and magma cubes against the player
    for (int sd : new int[] {9201, 9202}) sc88("b91mr-slime-fight-" + sd, sd, 240, "i", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b91mr-slime-small-9203", 9203, 200, "j", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, 15);
    for (int sd : new int[] {9211, 9212}) sc88("b91mr-magma-fight-" + sd, sd, 240, "l", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b91mr-magma-big-9213", 9213, 240, "u", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b91mr-magma-creative-9214", 9214, 200, "l", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, 15, "0 creative 1 on");
    // an iron golem against the mobs the earlier records left out (its target class is every IMob that is not a creeper or ghast); size 1 slime and magma cube, as the probe keeps a split child as a static, targetable entity
    double[][] gz = {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}};
    sc88("b91mr-golem-slime-9301", 9301, 240, "Gj", gz, 15);
    sc88("b91mr-golem-magma-9302", 9302, 240, "Gv", gz, 15);
    sc88("b91mr-golem-silverfish-9303", 9303, 200, "Gf", gz, 15);
    sc88("b91mr-golem-witch-9304", 9304, 240, "GK", gz, 15);
    sc88("b91mr-golem-pigman-9305", 9305, 200, "Gz", gz, 15, "10 hit 1 0 1");
    sc88("b91mr-golem-giant-9306", 9306, 200, "Gg", new double[][] {{120.5, 64.5}, {130.5, 64.5}, {64.5, 64.5}}, 15);
    // the golem is hurt by the player (EntityAIHurtByTarget retaliation)
    sc88("b91mr-golem-hurt-9307", 9307, 200, "G", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, 15, "20 melee 0");
  }
  // Batch 92 (mobrec92, b92mr): the b91mr harness whose loop also ticks the slimes and magma cubes a death spawns (EndermanWolfProbe B92, row element 12 and the `kids` input list).
  // Splits by an iron golem (size 2 and 4 of both kinds, the golem 6 blocks from the mob and 56 from the player) and by the player's melee (the mob's health set to 0.5, so the one hit kills it
  // and its children chase the player).
  static void run92() throws Exception {
    double[][] gz = {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}};
    for (int sd : new int[] {9401}) sc88("b92mr-golem-slime2-" + sd, sd, 160, "Gi", gz, 15);
    sc88("b92mr-golem-slime4-9403", 9403, 150, "GI", gz, 15);
    sc88("b92mr-golem-magma2-9404", 9404, 160, "Gl", gz, 15);
    sc88("b92mr-golem-magma4-9405", 9405, 150, "Gu", gz, 15);
    double[][] near = {{67.5, 64.5}, {64.5, 64.5}};
    sc88("b92mr-player-slime2-9411", 9411, 200, "i", near, 15, "10 health 0 0.5", "11 melee 0");
    sc88("b92mr-player-slime4-9412", 9412, 160, "I", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 15, "10 health 0 0.5", "11 melee 0");
    sc88("b92mr-player-magma2-9413", 9413, 200, "l", near, 15, "10 health 0 0.5", "11 melee 0");
    sc88("b92mr-player-magma4-9414", 9414, 160, "u", new double[][] {{68.5, 64.5}, {64.5, 64.5}}, 15, "10 health 0 0.5", "11 melee 0");
    // other kinds against the golems: a snow golem's snowballs (IMob targets other than the zombie and creeper of b88) and an iron golem against a blaze (fireballs hurt it)
    double[][] sn = {{120.5, 64.5}, {128.5, 64.5}, {64.5, 64.5}};
    sc88("b92mr-snow-spider-9421", 9421, 150, "NB", sn, 0);
    sc88("b92mr-snow-silverfish-9422", 9422, 150, "Nf", sn, 15);
    sc88("b92mr-snow-witch-9423", 9423, 150, "NK", sn, 15);
    sc88("b92mr-snow-slime2-9425", 9425, 150, "Ni", sn, 15);
    sc88("b92mr-snow-magma2-9426", 9426, 150, "Nl", sn, 15);
    sc88("b92mr-snow-cave-9427", 9427, 150, "NJ", sn, 0);
    sc88("b92mr-golem-blaze-9431", 9431, 150, "Ga", sn, 15);
  }
  // Batch 93 (mobrec93, b93mr): the b92mr harness with squid (s) and bat (b). Squids swim in a water cube (blocks of id 9 over y 0 to 12 and the probe's water flag) or lie on the floor; bats hang from a
  // stone ceiling plane at y 6 (the mob at y 5.1). Both are ticked by the real Entity.onUpdate, pushed by the player and hit by its real melee.
  static void sc93(String name, long seed, int ticks, String types, double[][] pos, boolean water, int[][] blocks, String... script) throws Exception { EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script, new int[0][0], blocks, water, 15); }
  static void run93() throws Exception {
    int[][] pool = {{40, 0, 40, 90, 12, 90, 9, 0}};
    int[][] ceil = {{40, 6, 40, 90, 6, 90, 1, 0}};
    for (int sd : new int[] {9501, 9502}) sc93("b93mr-squid-swim-" + sd, sd, 300, "s", new double[][] {{70.5, 64.5, 5.5}, {64.5, 64.5, 0}}, true, pool);
    sc93("b93mr-squid-push-9503", 9503, 160, "s", new double[][] {{65.0, 64.5, 0.5}, {64.5, 64.5, 0}}, true, pool);
    sc93("b93mr-squid-hit-9504", 9504, 200, "s", new double[][] {{66.5, 64.5, 1.5}, {64.5, 64.5, 0}}, true, pool, "20 melee 0", "21 melee 0", "60 health 0 0.5", "61 melee 0");
    sc93("b93mr-squid-dry-9505", 9505, 470, "s", new double[][] {{70.5, 64.5, 0}, {64.5, 64.5, 0}}, false, new int[0][0]);
    sc93("b93mr-squid-dry-hit-9506", 9506, 140, "s", new double[][] {{66.5, 64.5, 0}, {64.5, 64.5, 0}}, false, new int[0][0], "30 melee 0");
    int[][] room = {{40, 6, 40, 90, 6, 90, 1, 0}, {60, 0, 40, 60, 6, 90, 1, 0}, {80, 0, 40, 80, 6, 90, 1, 0}};
    sc93("b93mr-bat-hang-9511", 9511, 300, "b", new double[][] {{80.5, 64.5, 5.1}, {64.5, 64.5, 0}}, false, ceil);
    sc93("b93mr-bat-wake-9512", 9512, 400, "b", new double[][] {{70.5, 64.5, 5.1}, {67.5, 64.5, 4.0}}, false, ceil);
    sc93("b93mr-bat-wake-room-9516", 9516, 400, "b", new double[][] {{70.5, 64.5, 5.1}, {67.5, 64.5, 4.0}}, false, room);
    sc93("b93mr-bat-hit-9513", 9513, 300, "b", new double[][] {{70.5, 64.5, 5.1}, {64.5, 64.5, 0}}, false, room, "10 move 1 67.5 64.5 4.0", "20 melee 0", "21 melee 0");
    sc93("b93mr-bat-kill-9517", 9517, 200, "b", new double[][] {{70.5, 64.5, 5.1}, {67.5, 64.5, 4.0}}, false, room, "30 health 0 0.5", "31 melee 0");
    sc93("b93mr-bat-two-9514", 9514, 400, "bb", new double[][] {{70.5, 64.5, 5.1}, {72.5, 64.5, 5.1}, {67.5, 64.5, 4.0}}, false, room);
    sc93("b93mr-bat-open-9515", 9515, 300, "b", new double[][] {{70.5, 64.5, 5.1}, {64.5, 64.5, 0}}, false, new int[0][0]);
    sc93("b93mr-bat-squid-9518", 9518, 200, "bs", new double[][] {{70.5, 64.5, 5.1}, {70.5, 64.5, 3.5}, {64.5, 64.5, 0}}, true, new int[][] {{40, 0, 40, 90, 12, 90, 9, 0}, {40, 6, 40, 90, 6, 90, 1, 0}});
    // wither skeletons (EntitySkeleton type 1: melee task, wither effect, fire immunity, no sun burn)
    double[][] ws2 = {{71.5, 64.5}, {64.5, 64.5}};
    for (int sd : new int[] {9521, 9522}) sc88("b93mr-wskel-fight-" + sd, sd, 260, "k", ws2, 15, "0 look 90 0", "150 melee 0");
    sc88("b93mr-wskel-kill-9523", 9523, 200, "k", ws2, 15, "0 look 90 0", "40 health 0 0.5", "41 melee 0");
    sc88("b93mr-wskel-golem-9524", 9524, 200, "kG", new double[][] {{120.5, 64.5}, {126.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b93mr-wskel-day-9525", 9525, 150, "k", new double[][] {{90.5, 64.5}, {64.5, 64.5}}, 15, "0 day on");
    sc88("b93mr-wskel-two-9526", 9526, 260, "kk", new double[][] {{71.5, 64.5}, {73.5, 64.5}, {64.5, 64.5}}, 15, "0 look 90 0");
    sc88("b93mr-wskel-dark-9527", 9527, 200, "k", new double[][] {{80.5, 64.5}, {64.5, 64.5}}, 0, "0 look 90 0", "100 creative 1 on", "150 creative 1 off");
    sc88("b93mr-wskel-fire-9528", 9528, 120, "k", new double[][] {{75.5, 64.5}, {64.5, 64.5}}, 15, "5 fire 0 5");
    // the wither: spawn invulnerability (220 ticks, regeneration, the explosion and event 1013), then its first head pass
    sc88("b93mr-wither-spawn-9531", 9531, 235, "w", new double[][] {{78.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b93mr-wither-far-9532", 9532, 260, "w", new double[][] {{100.5, 64.5}, {64.5, 64.5}}, 15);
    sc88("b93mr-wither-fight-9533", 9533, 300, "w", new double[][] {{78.5, 64.5}, {64.5, 64.5}}, 15, "0 look 90 0");
    sc88("b93mr-wither-cow-9534", 9534, 306, "wC", new double[][] {{78.5, 64.5}, {60.5, 64.5}, {30.5, 64.5}}, 15); // stops before the cow's corpse leaves the port's list (the probe world never removes it)
    sc88("b93mr-wither-corpse-9536", 9536, 238, "wC", new double[][] {{78.5, 64.5}, {70.5, 70.5}, {40.5, 64.5}}, 15); // the blast kills the cow: a corpse is still a head candidate until the death animation ends (the probe never removes it, so the record stops before)
    sc88("b93mr-wither-wskel-9535", 9535, 320, "wk", new double[][] {{78.5, 64.5}, {70.5, 70.5}, {40.5, 64.5}}, 15);
    // pigman and giant fights (b93mr-pigman-*, b93mr-giant-*)
    sc88("b93mr-pigman-hit-9541", 9541, 260, "z", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, 15, "0 look 90 0", "20 melee 0", "21 melee 0");
    sc88("b93mr-pigman-two-9543", 9543, 260, "zz", new double[][] {{70.5, 64.5}, {72.5, 66.5}, {64.5, 64.5}}, 15, "0 look 90 0", "20 melee 0");
    sc88("b93mr-giant-golem-9542", 9542, 260, "gN", new double[][] {{80.5, 64.5}, {70.5, 64.5}, {20.5, 64.5}}, 15);
    sc88("b93mr-giant-fight-9544", 9544, 260, "g", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, 15, "0 look 90 0");
  }
  // Batch 94 (mobrec94, b94mr): the b93mr harness with the wither's later behaviours. Op `invul <idx> <n>` sets the Invul value (0: past the spawn phase) and `health` the health; skulls that fly are in the blast list
  // (EW.a adds them), so a blast pushes the other skulls in flight. Walls are boxes {x0, y0, z0, x1, y1, z1, id, meta}.
  static void sc94(String name, long seed, int ticks, String types, double[][] pos, int[][] blocks, String... script) throws Exception { EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script, new int[0][0], blocks, false, 15); }
  static int[][] box94(double cx, double cz, int r, int[] mats) {
    // four walls r blocks from the centre (cx, cz), y 0 to 5; the south wall is striped by x over the materials, the others use one each
    int x = (int) Math.floor(cx), z = (int) Math.floor(cz);
    java.util.ArrayList<int[]> out = new java.util.ArrayList<>();
    out.add(new int[] {x + r, 0, z - r, x + r, 5, z + r, mats[0], 0});
    out.add(new int[] {x - r, 0, z - r, x - r, 5, z + r, mats[1], 0});
    out.add(new int[] {x - r, 0, z - r, x + r, 5, z - r, mats[2], 0});
    for (int k = 3; k < mats.length; k++) out.add(new int[] {x - r + (k - 3) * 2, 0, z + r, x - r + (k - 3) * 2 + 1, 5, z + r, mats[k], 0});
    return out.toArray(new int[0][0]);
  }
  // Batch 95 (mobrec95, b95mr): the b94mr harness. Part 1: long pigman and giant melee fights (600 ticks). Part 2 (sheep, squid) follows below.
  static String[] repeat95(String op, int from, int to, int step) { java.util.ArrayList<String> o = new java.util.ArrayList<>(); for (int t = from; t < to; t += step) o.add(t + " " + op); return o.toArray(new String[0]); }
  static String[] cat95(String[]... parts) { java.util.ArrayList<String> o = new java.util.ArrayList<>(); for (String[] p : parts) o.addAll(java.util.Arrays.asList(p)); return o.toArray(new String[0]); }
  static void run95() throws Exception {
    int[][] none = new int[0][0];
    // pigman vs giant: the giant strikes the pigman every 40 ticks (pigman turns on it, its group joins), then the pigman is left alone
    sc94("b95mr-pigman-giant-9801", 9801, 600, "zg", new double[][] {{80.5, 64.5}, {84.5, 64.5}, {64.5, 64.5}}, none, cat95(new String[] {"10 hit 0 1 5"}, repeat95("hit 1 0 5", 30, 600, 90)));
    // the pigman strikes the giant (the legacy mob target switches on revenge), and a second pigman joins from far away
    sc94("b95mr-giant-pigmen-9802", 9802, 600, "gzz", new double[][] {{80.5, 64.5}, {84.5, 64.5}, {90.5, 70.5}, {64.5, 64.5}}, none, cat95(new String[] {"10 hit 0 1 5"}, repeat95("hit 0 2 5", 120, 600, 120)));
    // a pigman group against the player: the player strikes every 30 ticks for 600 ticks (anger timers, the group, the sounds, the hurt window)
    sc94("b95mr-pigman-group-player-9803", 9803, 600, "zzz", new double[][] {{70.5, 64.5}, {73.5, 66.5}, {78.5, 62.5}, {64.5, 64.5}}, none, cat95(new String[] {"0 look 90 0"}, repeat95("melee 0", 20, 600, 30)));
    // the same group, the player standing still after one blow (the anger runs out: becomeAngryAt sets 400 + nextInt(400))
    sc94("b95mr-pigman-calm-9804", 9804, 700, "zzz", new double[][] {{70.5, 64.5}, {73.5, 66.5}, {78.5, 62.5}, {64.5, 64.5}}, none, "0 look 90 0", "20 melee 0");
    // the player kills one pigman, the others stay angry and keep coming
    sc94("b95mr-pigman-kill-9805", 9805, 600, "zzz", new double[][] {{68.5, 64.5}, {73.5, 66.5}, {78.5, 62.5}, {64.5, 64.5}}, none, "0 look 90 0", "0 health 0 6", "20 melee 0", "21 melee 0", "22 melee 0", "40 melee 1");
    // giant against zombies: a zombie hits the giant every 60 ticks, a second zombie after 200
    sc94("b95mr-giant-zombie-9806", 9806, 600, "gZZ", new double[][] {{80.5, 64.5}, {83.5, 64.5}, {90.5, 68.5}, {64.5, 64.5}}, none, cat95(new String[] {"10 hit 0 1 5"}, repeat95("hit 0 1 5", 60, 600, 60), repeat95("hit 0 2 5", 200, 600, 100)));
    // zombie against giant: the giant hit by the zombie, and the zombie killed by the giant's blows (the giant's attack 50)
    sc94("b95mr-zombie-giant-9807", 9807, 600, "Zg", new double[][] {{80.5, 64.5}, {83.5, 64.5}, {64.5, 64.5}}, none, cat95(new String[] {"5 hit 1 0 5"}, repeat95("hit 0 1 5", 40, 600, 80)));
    // the player against a giant and a pigman together
    sc94("b95mr-giant-player-9808", 9808, 600, "gz", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 64.5}}, none, cat95(new String[] {"0 look 90 0"}, repeat95("melee 0", 20, 600, 50)));
    run95b();
  }
  static void run95b() throws Exception {
    int[][] none = new int[0][0];
    // Part 2: the two weakest families by executed records (sheep: 6, all as a wolf's prey; squid: 7). Sheep on a grass floor (y -1) with tall grass patches, the player 6 blocks away.
    double[][] sp = {{70.5, 64.5}, {64.5, 64.5}};
    int[][] grass = {{50, -1, 45, 95, -1, 85, 2, 0}};
    int[][] tall = {{50, -1, 45, 95, -1, 85, 2, 0}, {66, 0, 60, 76, 0, 70, 31, 1}};
    sc94("b95mr-sheep-idle-9811", 9811, 500, "H", sp, none);
    sc94("b95mr-sheep-lamb-eat-9812", 9812, 500, "e", sp, grass);
    sc94("b95mr-sheep-regrow-9813", 9813, 1200, "HH", new double[][] {{70.5, 64.5}, {72.5, 66.5}, {64.5, 64.5}}, tall, "0 shear 0 on", "0 shear 1 on");
    sc94("b95mr-sheep-wheat-9814", 9814, 300, "H", sp, none, "0 look 270 0", "0 holdn 296 64", "20 walk 1 -0.1 0", "80 walk 1 0 0", "120 walk 1 0 0.1", "180 walk 1 0 0");
    sc94("b95mr-sheep-breed-9815", 9815, 500, "HH", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, none, "0 color 0 4", "0 color 1 15", "0 holdn 296 64", "5 use 0", "6 use 1");
    sc94("b95mr-sheep-lamb-follow-9816", 9816, 300, "He", new double[][] {{70.5, 64.5}, {75.5, 64.5}, {64.5, 64.5}}, none, "0 color 0 6");
    sc94("b95mr-sheep-shear-9817", 9817, 200, "HHe", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {70.5, 67.5}, {64.5, 64.5}}, none, "0 color 0 5", "0 color 2 5", "0 holdn 359 1", "10 use 0", "20 use 0", "30 use 2", "40 shear 1 on", "50 use 1");
    sc94("b95mr-sheep-dye-9818", 9818, 160, "HH", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, none, "0 holdn 351 5", "10 use 0", "20 use 0", "30 shear 1 on", "40 use 1");
    sc94("b95mr-sheep-hit-9819", 9819, 300, "H", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, none, "0 look 270 0", "30 melee 0", "150 melee 0");
    sc94("b95mr-sheep-kill-9820", 9820, 120, "HH", new double[][] {{67.5, 64.5}, {70.5, 64.5}, {64.5, 64.5}}, none, "0 look 270 0", "0 color 0 14", "0 shear 1 on", "0 health 0 2", "0 health 1 2", "10 melee 0", "40 melee 1");
    sc94("b95mr-sheep-zombie-9821", 9821, 300, "HZ", new double[][] {{70.5, 64.5}, {72.5, 64.5}, {64.5, 64.5}}, none, "10 hit 0 1 3", "60 hit 0 1 3");
    sc94("b95mr-sheep-fire-9822", 9822, 300, "H", sp, none, "10 fire 0 5");
    sc94("b95mr-sheep-arrow-9823", 9823, 120, "H", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, none, "0 color 0 3", "10 arrowkill 0 100");
    // squid: kills in water with a sword, a mob's blow, an arrow, fire; two squids pushing; a squid against the surface and the floor; shallow water
    int[][] pool = {{40, 0, 40, 90, 12, 90, 9, 0}};
    int[][] shallow = {{40, 0, 40, 90, 1, 90, 9, 0}};
    sc93("b95mr-squid-kill-9831", 9831, 120, "s", new double[][] {{66.5, 64.5, 1.5}, {64.5, 64.5, 0}}, true, pool, "0 look 270 0", "0 health 0 3", "10 melee 0");
    sc93("b95mr-squid-zombie-9832", 9832, 300, "sZ", new double[][] {{70.5, 64.5, 2.5}, {70.5, 66.5, 5.0}, {64.5, 64.5, 0}}, true, pool, "10 hit 0 1 2", "40 hit 0 1 2", "90 hit 0 1 20");
    sc93("b95mr-squid-arrow-9833", 9833, 160, "s", new double[][] {{70.5, 64.5, 4.5}, {64.5, 64.5, 0}}, true, pool, "10 arrowkill 0 2", "30 arrowkill 0 100");
    sc93("b95mr-squid-fire-9834", 9834, 200, "s", new double[][] {{70.5, 64.5, 4.5}, {64.5, 64.5, 0}}, true, pool, "10 fire 0 10");
    sc93("b95mr-squid-two-9835", 9835, 300, "ss", new double[][] {{70.5, 64.5, 5.5}, {70.7, 64.7, 5.5}, {64.5, 64.5, 0}}, true, pool);
    sc93("b95mr-squid-shallow-9836", 9836, 300, "s", new double[][] {{70.5, 64.5, 0.5}, {64.5, 64.5, 0}}, true, shallow);
    sc93("b95mr-squid-surface-9837", 9837, 300, "s", new double[][] {{70.5, 64.5, 11.5}, {64.5, 64.5, 0}}, true, pool);
    sc93("b95mr-squid-wall-9838", 9838, 300, "s", new double[][] {{50.5, 64.5, 5.5}, {64.5, 64.5, 0}}, true, new int[][] {{40, 0, 40, 90, 12, 90, 9, 0}, {49, 0, 40, 49, 12, 90, 1, 0}});
    sc93("b95mr-squid-far-9839", 9839, 500, "s", new double[][] {{120.5, 64.5, 5.5}, {64.5, 64.5, 0}}, true, new int[][] {{100, 0, 40, 150, 12, 90, 9, 0}});
    sc93("b95mr-squid-dry-kill-9840", 9840, 200, "s", new double[][] {{67.5, 64.5, 0}, {64.5, 64.5, 0}}, false, new int[0][0], "0 look 270 0", "0 health 0 2", "30 melee 0");
  }
  static void run94() throws Exception {
    // blue skulls: the random shots at coordinates (the head pass, Normal difficulty, no candidate in range) are dangerous skulls; their blasts cap block resistance at 0.8 (obsidian, ender chest, enchanting table, anvil go; bedrock, frame, command block stay)
    int[][] walls = box94(100.5, 64.5, 5, new int[] {49, 7, 1, 20, 3, 130, 116, 145, 120, 137});
    for (int sd : new int[] {9601, 9602}) sc94("b94mr-wither-blue-" + sd, sd, 420, "w", new double[][] {{100.5, 64.5}, {64.5, 64.5}}, walls, "0 invul 0 0", "0 health 0 300");
    sc94("b94mr-wither-blue-zombie-9603", 9603, 420, "wZ", new double[][] {{100.5, 64.5}, {103.5, 66.5}, {64.5, 64.5}}, new int[0][0], "0 invul 0 0", "0 health 0 300");
    // armoured phase (health at or below 150): arrows bounce off, a player's blow lands, an undead attacker is refused, a cow's blow lands; the same arrow on an unarmoured wither lands
    double[][] near = {{74.5, 64.5}, {64.5, 64.5}};
    sc94("b94mr-wither-armor-arrow-9611", 9611, 160, "w", near, new int[0][0], "0 invul 0 0", "0 health 0 140", "0 look 90 0", "30 arrowkill 0 10", "50 melee 0", "60 arrowkill 0 10", "90 melee 0");
    sc94("b94mr-wither-plain-arrow-9612", 9612, 160, "w", near, new int[0][0], "0 invul 0 0", "0 health 0 200", "0 look 90 0", "30 arrowkill 0 10", "50 melee 0", "60 arrowkill 0 10", "90 melee 0");
    sc94("b94mr-wither-hit-9613", 9613, 160, "wZC", new double[][] {{74.5, 64.5}, {72.5, 64.5}, {74.5, 70.5}, {64.5, 64.5}}, new int[0][0], "0 invul 0 0", "0 health 0 200", "10 hit 0 1 5", "20 hit 0 2 5", "60 health 0 140", "70 hit 0 1 5", "80 hit 0 2 5");
    sc94("b94mr-wither-edge-9614", 9614, 120, "w", near, new int[0][0], "0 invul 0 0", "0 health 0 150.5", "0 look 90 0", "10 arrowkill 0 0.5", "30 arrowkill 0 0.5", "50 melee 0", "70 arrowkill 0 10");
    // block breaking: a hit starts the 20-tick counter; then every block within one block of the feet and three up goes (not bedrock, end portal frame, command block), with its drops and one level event
    int[][] cage = {{69, 0, 63, 71, 4, 63, 1, 0}, {69, 0, 65, 71, 4, 65, 3, 0}, {69, 0, 64, 69, 4, 64, 20, 0}, {71, 0, 64, 71, 4, 64, 5, 0}, {69, 1, 62, 71, 1, 62, 49, 0}, {69, 2, 66, 71, 2, 66, 7, 0}, {69, 3, 66, 71, 3, 66, 120, 0}, {69, 0, 66, 71, 0, 66, 137, 0}, {68, 0, 64, 68, 5, 64, 54, 2}, {72, 2, 64, 72, 2, 64, 61, 2}};
    sc94("b94mr-wither-break-9621", 9621, 120, "w", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, cage, "0 invul 0 0", "0 health 0 300", "10 melee 0");
    sc94("b94mr-wither-break-twice-9622", 9622, 160, "w", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, cage, "0 invul 0 0", "0 health 0 300", "10 melee 0", "12 melee 0", "50 melee 0");
    sc94("b94mr-wither-break-nogrief-9623", 9623, 100, "w", new double[][] {{70.5, 64.5}, {64.5, 64.5}}, cage, "0 invul 0 0", "0 health 0 300", "0 grief off", "10 melee 0");
    // regeneration: one health every 20 ticks of age, capped at 300; the half-health mark flips the armour (the climb above a target stops)
    sc94("b94mr-wither-regen-9631", 9631, 200, "w", new double[][] {{120.5, 64.5}, {64.5, 64.5}}, new int[0][0], "0 invul 0 0", "0 health 0 100");
    sc94("b94mr-wither-regen-top-9632", 9632, 90, "w", new double[][] {{120.5, 64.5}, {64.5, 64.5}}, new int[0][0], "0 invul 0 0", "0 health 0 299.5");
    sc94("b94mr-wither-cross-9633", 9633, 200, "wC", new double[][] {{78.5, 64.5}, {64.5, 70.5}, {30.5, 64.5}}, new int[0][0], "0 invul 0 0", "0 health 0 148.5");
    // pigman group anger (EntityPigZombie.becomeAngryAt: every pigman within 32 blocks of the hit one, an expanded box, turns on the attacker) and a pigman or giant hit by a mob attacker
    sc94("b94mr-pigman-group-9701", 9701, 240, "zzzzz", new double[][] {{70.5, 64.5}, {90.5, 64.5}, {100.5, 64.5}, {104.5, 64.5}, {70.5, 90.5}, {64.5, 64.5}}, new int[0][0], "0 look 90 0", "20 melee 0");
    sc94("b94mr-pigman-attacker-9702", 9702, 240, "zZ", new double[][] {{70.5, 64.5}, {72.5, 66.5}, {64.5, 64.5}}, new int[0][0], "10 hit 0 1 5", "40 hit 0 1 5");
    sc94("b94mr-pigman-attacker-group-9703", 9703, 240, "zzZ", new double[][] {{70.5, 64.5}, {85.5, 64.5}, {72.5, 66.5}, {64.5, 64.5}}, new int[0][0], "10 hit 0 2 5");
    sc94("b94mr-giant-attacker-9704", 9704, 240, "gZ", new double[][] {{80.5, 64.5}, {82.5, 66.5}, {64.5, 64.5}}, new int[0][0], "10 hit 0 1 5", "40 hit 0 1 50");
    sc94("b94mr-giant-pigman-9705", 9705, 240, "gzz", new double[][] {{80.5, 64.5}, {84.5, 64.5}, {96.5, 64.5}, {64.5, 64.5}}, new int[0][0], "10 hit 1 0 5", "60 hit 0 1 5");
  }
  static void runCW() throws Exception {
    double[][] six = {{70.5, 64.5}, {64.5, 64.5}};
    sc("b45cw-swell-approach-7001", 7001, 160, "X", six, "0 look 90 0");
    sc("b45cw-swell-approach-7002", 7002, 160, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0");
    EndermanWolfProbe.scenario("b45cw-swell-wall-7003", 7003, 120, "X", six, new String[] {"0 look 90 0"}, new int[0][0], new int[][] {{67, 0, 58, 67, 3, 70, 1, 0}}, false, 15);
    sc("b45cw-swell-release-7004", 7004, 120, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "10 walk 1 -0.2 0", "30 walk 1 0 0");
    sc("b45cw-swell-reapproach-7005", 7005, 200, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "6 walk 1 -0.25 0", "16 walk 1 0 0", "40 walk 1 0.25 0", "50 walk 1 0 0");
    sc("b45cw-difficulty-peaceful-7006", 7006, 60, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 difficulty 0");
    sc("b45cw-difficulty-easy-7007", 7007, 160, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 difficulty 1");
    sc("b45cw-difficulty-hard-7008", 7008, 160, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 difficulty 3");
    sc("b45cw-creative-7009", 7009, 160, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b45cw-ignite-7010", 7010, 90, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "3 use 0");
    sc("b45cw-ignite-near-7011", 7011, 90, "X", new double[][] {{66.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "3 use 0");
    sc("b45cw-ignite-creative-7012", 7012, 90, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 creative 1 on", "0 hold 259", "3 use 0");
    sc("b45cw-ignite-twice-7013", 7013, 90, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "3 use 0", "8 use 0");
    sc("b45cw-bolt-7014", 7014, 120, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "5 bolt 0");
    sc("b45cw-bolt-near-7015", 7015, 120, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "5 bolt 0");
    sc("b45cw-powered-ignite-7016", 7016, 90, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 power 0", "0 hold 259", "3 use 0");
    sc("b45cw-powered-near-7017", 7017, 160, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 power 0");
    // blasts into terrain: stone, dirt, gravel, glass, bookshelf, chest, furnace, TNT, ores, leaves, wool, plank rows at y 0 beside the creeper; an ignited creeper in the open and one in a room
    int[][] row = {{71, 0, 62, 71, 1, 62, 1, 0}, {72, 0, 62, 72, 1, 62, 3, 0}, {73, 0, 62, 73, 1, 62, 13, 0}, {74, 0, 62, 74, 1, 62, 20, 0}, {75, 0, 62, 75, 1, 62, 47, 0}, {76, 0, 62, 76, 1, 62, 54, 2},
      {77, 0, 62, 77, 1, 62, 61, 2}, {71, 0, 66, 71, 1, 66, 46, 0}, {72, 0, 66, 72, 1, 66, 16, 0}, {73, 0, 66, 73, 1, 66, 15, 0}, {74, 0, 66, 74, 1, 66, 18, 0}, {75, 0, 66, 75, 1, 66, 35, 14}, {76, 0, 66, 76, 1, 66, 5, 0}, {77, 0, 66, 77, 1, 66, 4, 0}};
    EndermanWolfProbe.scenario("b45cw-blocks-ignite-7018", 7018, 60, "X", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 hold 259", "2 use 0", "2 walk 1 -0.2 0"}, new int[0][0], row, false, 15);
    EndermanWolfProbe.scenario("b45cw-blocks-powered-7019", 7019, 60, "X", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 hold 259", "0 power 0", "2 use 0", "2 walk 1 -0.2 0"}, new int[0][0], row, false, 15);
    EndermanWolfProbe.scenario("b45cw-blocks-nogrief-7020", 7020, 60, "X", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 hold 259", "0 grief off", "2 use 0", "2 walk 1 -0.2 0"}, new int[0][0], row, false, 15);
    EndermanWolfProbe.scenario("b45cw-blocks-nogrief-powered-7021", 7021, 60, "X", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 hold 259", "0 grief off", "0 power 0", "2 use 0", "2 walk 1 -0.2 0"}, new int[0][0], row, false, 15);
    EndermanWolfProbe.scenario("b45cw-blocks-seed-7022", 7022, 60, "X", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 90 0", "0 hold 259", "2 use 0", "2 walk 1 -0.2 0"}, new int[0][0], row, false, 15);
    // bystanders: the blast hurts and pushes other mobs (zombie, cow, pig, a second creeper) and the player
    sc("b45cw-bystanders-7023", 7023, 60, "XZCP", new double[][] {{74.5, 64.5}, {76.5, 64.5}, {72.5, 62.5}, {74.5, 67.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "2 use 0", "2 walk 4 -0.2 0");
    sc("b45cw-bystanders-powered-7024", 7024, 60, "XZCP", new double[][] {{74.5, 64.5}, {76.5, 64.5}, {72.5, 62.5}, {74.5, 67.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "0 power 0", "2 use 0", "2 walk 4 -0.2 0");
    sc("b45cw-bystanders-creepers-7025", 7025, 60, "XXX", new double[][] {{74.5, 64.5}, {76.5, 64.5}, {72.5, 62.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "2 use 0", "2 walk 3 -0.2 0");
    sc("b45cw-player-adjacent-7026", 7026, 60, "X", new double[][] {{65.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 hold 259", "2 use 0");
    sc("b45cw-player-adjacent-hard-7027", 7027, 60, "X", new double[][] {{65.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 difficulty 3", "0 hold 259", "2 use 0");
    sc("b45cw-player-adjacent-easy-7028", 7028, 60, "X", new double[][] {{65.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 difficulty 1", "0 hold 259", "2 use 0");
    sc("b45cw-player-adjacent-powered-7029", 7029, 60, "X", new double[][] {{65.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "0 power 0", "0 hold 259", "2 use 0");
    // death drops: the player's sword (a player kill: gunpowder, then the record roll is skeleton-only), a skeleton's arrow (record), fire, a charged creeper
    for (int k = 0; k < 6; k++) sc("b45cw-kill-player-" + (7030 + k), 7030 + k, 40, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "1 health 0 1", "2 melee 0");
    for (int k = 0; k < 8; k++) sc("b45cw-kill-arrow-" + (7040 + k), 7040 + k, 40, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "1 arrowkill 0 100");
    sc("b45cw-kill-fire-7050", 7050, 120, "X", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 90 0", "1 fire 0 30", "2 health 0 1");
    sc("b45cw-kill-powered-7051", 7051, 40, "X", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 power 0", "0 hold 268", "1 health 0 1", "2 melee 0");
    sc("b45cw-kill-hit-7052", 7052, 40, "XZ", new double[][] {{76.5, 64.5}, {70.5, 76.5}, {64.5, 64.5}}, "0 look 270 0", "1 hit 0 1 100");
    // witch: ranged potion choice by distance and the target's effects, the throw's draws and aim, drinking (heal, fire resistance, water breathing, swiftness) and drops
    sc("b45cw-witch-far-7101", 7101, 400, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b45cw-witch-far-7102", 7102, 400, "K", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "100 effect 1 2 6000");
    sc("b45cw-witch-poison-7103", 7103, 400, "K", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 effect 1 2 6000");
    sc("b45cw-witch-harm-7104", 7104, 400, "K", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 effect 1 2 6000", "0 effect 1 19 6000");
    EndermanWolfProbe.scenario("b45cw-witch-near-weakness-7105", 7105, 500, "K", new double[][] {{67.2, 65.9}, {64.5, 64.5}}, new String[] {"0 look 270 0", "0 effect 1 2 6000", "0 effect 1 19 6000"}, new int[0][0], new int[][] {{67, 0, 65, 67, 1, 65, 30, 0}}, false, 15); // the witch stands in a cobweb so no mob-player push (the port never moves the player from a mob update) reaches the lead
    EndermanWolfProbe.scenario("b45cw-witch-near-weakness-7106", 7106, 125, "K", new double[][] {{66.9, 62.6}, {64.5, 64.5}}, new String[] {"0 look 270 0", "0 effect 1 2 6000", "0 effect 1 19 6000", "0 effect 1 18 6000"}, new int[0][0], new int[][] {{66, 0, 62, 66, 1, 62, 30, 0}}, false, 15); // the witch stands in a cobweb so no mob-player push (the port never moves the player from a mob update) reaches the lead
    sc("b45cw-witch-lead-7107", 7107, 400, "K", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "20 walk 1 0 0.1", "120 walk 1 0 0", "200 walk 1 0.1 0", "260 walk 1 0 0");
    sc("b45cw-witch-lead-7108", 7108, 400, "K", new double[][] {{76.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 effect 1 2 6000", "20 walk 1 -0.1 0.05", "100 walk 1 0 0");
    sc("b45cw-witch-high-7109", 7109, 300, "K", new double[][] {{74.5, 64.5, 5}, {64.5, 64.5}}, "0 look 270 0");
    EndermanWolfProbe.scenario("b45cw-witch-wall-7110", 7110, 300, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{69, 0, 58, 69, 3, 70, 1, 0}}, false, 15);
    sc("b45cw-witch-creative-7111", 7111, 300, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 creative 1 on");
    sc("b45cw-witch-hurt-7112", 7112, 800, "K", new double[][] {{80.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 health 0 10");
    sc("b45cw-witch-hurt-7113", 7113, 800, "K", new double[][] {{90.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 health 0 10", "0 fire 0 60");
    sc("b45cw-witch-hurt-7114", 7114, 800, "K", new double[][] {{80.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 health 0 5");
    sc("b45cw-witch-burning-7115", 7115, 800, "K", new double[][] {{90.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 fire 0 100");
    sc("b45cw-witch-burning-7116", 7116, 800, "K", new double[][] {{90.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 fire 0 100");
    sc("b45cw-witch-far-swift-7117", 7117, 800, "K", new double[][] {{84.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    sc("b45cw-witch-far-swift-7118", 7118, 800, "K", new double[][] {{88.5, 64.5}, {64.5, 64.5}}, "0 look 270 0");
    EndermanWolfProbe.scenario("b45cw-witch-water-7119", 7119, 800, "K", new double[][] {{84.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{82, 0, 62, 87, 2, 67, 9, 0}}, true, 15);
    EndermanWolfProbe.scenario("b45cw-witch-water-7120", 7120, 800, "K", new double[][] {{84.5, 64.5}, {64.5, 64.5}}, new String[] {"0 look 270 0"}, new int[0][0], new int[][] {{82, 0, 62, 87, 2, 67, 9, 0}}, true, 15);
    sc("b45cw-witch-peaceful-7121", 7121, 60, "K", new double[][] {{74.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 difficulty 0");
    for (int k = 0; k < 8; k++) sc("b45cw-witch-kill-" + (7130 + k), 7130 + k, 30, "K", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "1 health 0 1", "2 melee 0");
    sc("b45cw-witch-kill-arrow-7140", 7140, 30, "K", new double[][] {{67.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "1 arrowkill 0 100");
    sc("b45cw-witch-drink-kill-7141", 7141, 900, "K", new double[][] {{80.5, 64.5}, {64.5, 64.5}}, "0 look 270 0", "0 health 0 10", "0 hold 268");
  }

  // Batch 45 (horses): EntityHorse records through the real EntityPlayer.interactWith and EntityAIMate. Q, q tame horses (variants 258 and 773, max health 24 and 18, speed 0.25 and 0.3, jump 0.55 and 0.65), D a tame donkey,
  // R a wild horse, F a wild foal, Y a tame foal (all max health 20 or fixed as in EndermanWolfProbe.b45Horse), V a horse built by onSpawnWithEgg (its draws are in the record's `init`; a following V
  // passes the GroupData on). Items: 353 sugar, 296 wheat, 260 apple, 297 bread, 170 hay block, 396 golden carrot, 322 golden apple.
  static void run45() throws Exception {
    double[][] one = {{70.5, 64.5}, {64.5, 60.5}}, pair = {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}};
    // spawn-time rolls (onSpawnWithEgg: follow-range gaussian, type and colour or donkey, foal roll, health, speed, jump) over seeds, alone and as a herd
    for (int k = 0; k < 40; k++) sc("b45hs-spawn-" + (7001 + k), 7001 + k, 4, "V", one, "0 look 90 0", "0 creative 1 on");
    for (int k = 0; k < 6; k++) sc("b45hs-herd-" + (7101 + k), 7101 + k, 4, "VVVV", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {70.5, 67.5}, {73.5, 67.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    // feeding a hurt tame horse each food (heal, temper, golden food puts it in love), the foods on a tame and a wild foal, and on a wild adult (temper)
    int[] foods = {353, 296, 260, 297, 170, 396, 322};
    for (int k = 0; k < foods.length; k++) {
      int f = foods[k];
      sc("b45hs-feed-tame-" + f + "-" + (7201 + k), 7201 + k, 40, "Q", one, "0 holdn " + f + " 16", "4 health 0 5", "5 use 0", "14 health 0 5", "15 use 0", "24 health 0 5", "25 use 0", "0 look 90 0"); // hurt each time: a full-health tame adult is mounted, which the probe player cannot do
      sc("b45hs-feed-foal-" + f + "-" + (7211 + k), 7211 + k, 40, "YF", pair, "0 holdn " + f + " 16", "5 use 0", "5 use 1", "15 use 0", "15 use 1", "0 look 90 0");
      sc("b45hs-feed-wild-" + f + "-" + (7221 + k), 7221 + k, 40, "R", one, "0 holdn " + f + " 16", "0 health 0 10", "5 use 0", "10 use 0", "30 use 0", "0 look 90 0");
    }
    // taming temper by feeding a wild horse many times, and a foal grown by repeated feeding
    sc("b45hs-feed-wild-many-7231", 7231, 200, "R", one, "0 holdn 296 64", "0 health 0 5", "5 use 0", "25 use 0", "45 use 0", "65 use 0", "85 use 0", "105 use 0", "125 use 0", "145 use 0", "165 use 0", "0 look 90 0");
    sc("b45hs-foal-grow-7232", 7232, 300, "Y", one, "0 holdn 353 64", "5 use 0", "20 use 0", "40 use 0", "60 use 0", "80 use 0", "100 use 0", "0 look 90 0");
    sc("b45hs-foal-grow-7233", 7233, 300, "F", one, "0 holdn 297 64", "5 use 0", "20 use 0", "40 use 0", "60 use 0", "80 use 0", "100 use 0", "0 look 90 0");
    // foals follow an adult horse; a tame adult in love needs a partner (alone it just waits)
    sc("b45hs-follow-foal-7234", 7234, 400, "YQ", new double[][] {{78.5, 64.5}, {70.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    sc("b45hs-love-alone-7235", 7235, 300, "Q", one, "0 holdn 396 8", "5 use 0", "0 look 90 0");
    // breeding two tame adults fed golden carrots or apples: horse x horse (colour, marking, health, speed, jump from both and a fresh roll), horse x donkey (a mule), donkey x donkey
    for (int k = 0; k < 6; k++) sc("b45hs-breed-horse-" + (7301 + k), 7301 + k, 400, "Qq", pair, "0 holdn " + (k % 2 == 0 ? 396 : 322) + " 64", "2 use 0", "4 use 1", "0 look 90 0");
    for (int k = 0; k < 4; k++) sc("b45hs-breed-mule-" + (7311 + k), 7311 + k, 400, k % 2 == 0 ? "QD" : "DQ", pair, "0 holdn 396 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b45hs-breed-donkey-7321", 7321, 400, "DD", pair, "0 holdn 396 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b45hs-breed-donkey-7322", 7322, 400, "DD", pair, "0 holdn 322 64", "2 use 0", "4 use 1", "0 look 90 0");
    // breeding that must not happen: a hurt parent, a foal, a wild horse and a third horse in love between three
    sc("b45hs-breed-hurt-7331", 7331, 300, "Qq", pair, "0 holdn 396 64", "0 health 0 5", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b45hs-breed-wild-7332", 7332, 300, "QR", pair, "0 holdn 396 64", "2 use 0", "4 use 1", "0 look 90 0");
    sc("b45hs-breed-three-7333", 7333, 500, "Qqq", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {70.5, 67.5}, {64.5, 60.5}}, "0 holdn 396 64", "2 use 0", "4 use 1", "6 use 2", "0 look 90 0");
    // after a birth the parents are 5999 ticks from adult (growing age 6000) and cannot breed again; the run is long enough to see them age
    sc("b45hs-breed-again-7334", 7334, 700, "Qq", pair, "0 holdn 396 64", "2 use 0", "4 use 1", "0 look 90 0");
  }
  // Batch 47 (horses2): a player riding a wild horse (EntityAIRunAroundLikeCrazy), skeleton and zombie horses, the sounds a feed or a rear makes, and a foal growing against a wall.
  static void run47h() throws Exception {
    double[][] one = {{70.5, 64.5}, {64.5, 60.5}};
    // an untamed horse with the probe player on its back: the run-around task rolls nextInt(50) every tick it runs, then temper against nextInt(maxTemper), buck, rear sound
    for (int k = 0; k < 8; k++) sc("b47h-ride-wild-" + (8001 + k), 8001 + k, 500, "R", one, "1 mount 0", "0 look 90 0");
    for (int k = 0; k < 4; k++) sc("b47h-ride-temper-" + (8011 + k), 8011 + k, 400, "R", one, "0 temper 0 " + (k < 2 ? 60 : 95), "1 mount 0", "0 look 90 0");
    // after a buck the player gets on again (use with an empty hand mounts), and the temper has grown by 5
    for (int k = 0; k < 4; k++) sc("b47h-ride-again-" + (8021 + k), 8021 + k, 700, "R", one, "1 mount 0", "150 mount 0", "300 mount 0", "450 mount 0", "0 look 90 0");
    // the player mounts through the real interaction
    for (int k = 0; k < 3; k++) sc("b47h-ride-use-" + (8031 + k), 8031 + k, 400, "R", one, "1 use 0", "0 look 90 0");
    // skeleton and zombie horses (the types /summon and NBT make): idle, wander and talk
    for (int k = 0; k < 2; k++) {
      sc("b47h-undead-wild-" + (8041 + k), 8041 + k, 1500, "34", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
      sc("b47h-undead-tame-" + (8043 + k), 8043 + k, 1500, "56", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    }
    // feeding and rearing: the eating sound on a feed (tame and a hurt tame horse), the rear sound on a wild horse and an unused food
    int[] foods = {353, 296, 170, 322};
    String[] kinds = {"R", "Q", "D", "3", "5", "4", "6"};
    for (int j = 0; j < kinds.length; j++) for (int k = 0; k < foods.length; k++) {
      sc("b47h-sound-" + kinds[j] + "-" + foods[k] + "-" + (8101 + j * 10 + k), 8101 + j * 10 + k, 120, kinds[j], one, "0 holdn " + foods[k] + " 16", "0 health 0 5", "5 use 0", "20 use 0", "40 use 0", "60 use 0", "0 look 90 0");
    }
    // undead horses mounted by the player (a wild one bucks, a tame one does not)
    for (int k = 0; k < 3; k++) sc("b47h-undead-ride-" + (8201 + k), 8201 + k, 400, k == 0 ? "3" : k == 1 ? "4" : "5", one, "1 mount 0", "0 look 90 0");
    // long idle runs of a wild horse and a donkey on grass-less floor: the idle, eat-grass and tail rolls and every talk sound
    for (int k = 0; k < 3; k++) sc("b47h-idle-" + (8301 + k), 8301 + k, 2400, "RD", new double[][] {{70.5, 64.5}, {73.5, 64.5}, {64.5, 60.5}}, "0 look 90 0", "0 creative 1 on");
    // a foal growing up next to a wall: EntityAgeable.setScale (setSize) grows the box about the position and, as the width grows, calls moveEntity(oldWidth - width, 0, oldWidth - width), so a wall at the
    // negative x or z side stops the push flush; a gap lets it through; a wall inside the grown box was avoided by the layout (a foal inside a wall suffocates)
    int[][] none = new int[0][0];
    int[][] wallX = {{68, 0, 60, 68, 3, 70, 1, 0}}, wallZ = {{60, 0, 62, 80, 3, 62, 1, 0}};
    double[][][] at = {{{69.8, 64.5}, {64.5, 60.5}}, {{70.5, 63.4}, {64.5, 60.5}}, {{70.5, 64.5}, {64.5, 60.5}}, {{69.8, 64.5}, {64.5, 60.5}}};
    int[][][] walls = {wallX, wallZ, wallX, wallX};
    for (int k = 0; k < 4; k++)
      EndermanWolfProbe.scenario("b47h-foal-wall-" + (8401 + k), 8401 + k, 40, k < 3 ? "F" : "Y", at[k], new String[] {"0 look 90 0", "0 creative 1 on", "2 age 0 -3"}, none, walls[k], false, 15);
    EndermanWolfProbe.scenario("b47h-foal-corner-8405", 8405, 40, "F", new double[][] {{69.8, 63.4}, {64.5, 60.5}}, new String[] {"0 look 90 0", "0 creative 1 on", "2 age 0 -3"}, none, new int[][] {{68, 0, 60, 68, 3, 70, 1, 0}, {60, 0, 62, 80, 3, 62, 1, 0}}, false, 15);
  }

  // Batch 48 (pistonpush): EW_SET=b48pp. The b47sp harness (the probe player is the server copy under the C03 rules) plus real moving piston blocks: op "t piston x y z facing extending storedId storedMeta [renderHead]"
  // turns the cell into BlockPistonMoving (36) with a real TileEntityPiston (aps) that the probe updates after the mobs each tick (World.updateEntities' tile entity pass; aps.h pushes with Entity.moveEntity). Row
  // element 9 lists the moving tiles [x, y, z, progress, lastProgress]. Facing 0 down, 1 up, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x). C cow, P pig, Z zombie, R horse, c calf; the player is the last index.
  static void sc48(String name, long seed, int ticks, String types, double[][] pos, int[][] blocks, String... script) throws Exception {
    EndermanWolfProbe.scenario(name, seed, ticks, types, pos, script, new int[0][0], blocks, false, 15);
  }
  static void run48() throws Exception {
    int[][] none = new int[0][0];
    int[][] wall = {{72, 0, 60, 72, 3, 68, 1, 0}};
    double[][] one = {{70.5, 64.5}, {64.5, 64.5}};
    String east = "0 piston 70 0 64 5 1 1 0", look = "0 look 90 0";
    sc48("b48pp-cow-east-9500", 9500, 40, "C", one, none, look, east);
    sc48("b48pp-pig-north-9501", 9501, 40, "P", one, none, look, "0 piston 70 0 64 2 1 1 0");
    sc48("b48pp-zombie-9502", 9502, 80, "Z", one, none, look, east);
    sc48("b48pp-horse-9503", 9503, 60, "R", one, none, look, east);
    sc48("b48pp-cow-wall-9504", 9504, 40, "C", one, wall, look, east);
    sc48("b48pp-cow-lift-9505", 9505, 40, "C", new double[][] {{70.5, 64.5, 1.0}, {64.5, 64.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
    sc48("b48pp-cow-ceiling-9506", 9506, 40, "C", new double[][] {{70.5, 64.5, 1.0}, {64.5, 64.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}, {70, 3, 64, 70, 3, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
    sc48("b48pp-cow-retract-9507", 9507, 40, "C", one, none, look, "0 piston 70 0 64 5 0 1 0");
    sc48("b48pp-cow-head-9508", 9508, 40, "C", one, none, look, "0 piston 70 0 64 5 1 34 5");
    sc48("b48pp-calf-9509", 9509, 40, "c", one, none, look, east);
    sc48("b48pp-two-9510", 9510, 40, "CP", new double[][] {{70.3, 64.5}, {70.7, 64.5}, {64.5, 64.5}}, none, look, east);
    sc48("b48pp-cow-edge-9511", 9511, 40, "C", new double[][] {{71.0, 64.5}, {64.5, 64.5}}, none, look, east);
    sc48("b48pp-cow-two-tiles-9512", 9512, 40, "C", new double[][] {{70.9, 64.5}, {64.5, 64.5}}, none, look, east, "0 piston 71 0 64 5 1 1 0");
    sc48("b48pp-cow-down-9513", 9513, 40, "C", new double[][] {{70.5, 64.5, 1.0}, {64.5, 64.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}}, look, "0 piston 70 1 64 0 1 1 0");
    sc48("b48pp-zombie-wall-9514", 9514, 60, "Z", one, wall, look, east, "6 hit 1 0 4");
    // the server copy: the client stays where it is (no packet), follows the push, is pushed into a wall, thrown first, at a ledge, lifted, flying
    double[][] far = {{100.5, 100.5}, {70.5, 64.5}};
    sc48("b48pp-copy-stay-9520", 9520, 50, "C", far, none, look, east);
    sc48("b48pp-copy-follow-9521", 9521, 50, "C", far, none, look, east, "0 walk 1 0.5625 0", "2 walk 1 0.25 0", "3 walk 1 0 0");
    sc48("b48pp-copy-wall-9522", 9522, 50, "C", far, new int[][] {{71, 0, 60, 71, 3, 68, 1, 0}}, look, east);
    sc48("b48pp-copy-thrown-9523", 9523, 50, "Z", new double[][] {{67.5, 64.5}, {70.5, 64.5}}, new int[][] {{71, 0, 60, 71, 3, 68, 1, 0}}, look, "3 hit 1 0 4", "5 piston 70 0 64 5 1 1 0");
    sc48("b48pp-copy-ledge-9524", 9524, 50, "C", far, new int[][] {{71, -3, 60, 76, -1, 68, 0, 0}}, look, east, "0 sneak 1 on");
    sc48("b48pp-copy-ledge-walk-9525", 9525, 50, "C", far, new int[][] {{71, -3, 60, 76, -1, 68, 0, 0}}, look, east);
    sc48("b48pp-copy-lift-9526", 9526, 50, "C", new double[][] {{100.5, 100.5}, {70.5, 64.5, 1.0}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
    sc48("b48pp-copy-fly-9527", 9527, 50, "C", far, none, look, east, "0 creative 1 on", "0 fly 1 on", "0 ground 1 off", "0 move 1 70.5 64.5 3", "0 piston 70 3 64 5 1 1 0");
    sc48("b48pp-copy-retract-9528", 9528, 50, "C", far, none, look, "0 piston 70 0 64 5 0 1 0");
    sc48("b48pp-copy-herd-9529", 9529, 80, "CP", new double[][] {{70.3, 64.5}, {70.8, 64.9}, {70.5, 64.5}}, none, look, east);
  }

  // Batch 49 (pistonorder): EW_SET=b49po, the b48pp harness (the tile loop runs after every entity and before the server copy's update) with mobs standing ON a moved block and large mobs. B spider, I size 4 slime,
  // G iron golem. The player is the last index and far away (100.5, 100.5) so no target or push comes from it.
  static void run49() throws Exception {
    int[][] none = new int[0][0];
    int[][] wall = {{72, 0, 60, 72, 5, 68, 1, 0}};
    String look = "0 look 90 0", east = "0 piston 70 0 64 5 1 1 0";
    double[][] far = {{70.5, 64.5}, {100.5, 100.5}};
    double[][] onTop = {{70.5, 64.5, 1.0}, {100.5, 100.5}};
    sc48("b49po-cow-ride-east-9600", 9600, 40, "C", onTop, none, look, east);
    sc48("b49po-cow-ride-up-9601", 9601, 40, "C", new double[][] {{70.5, 64.5, 2.0}, {100.5, 100.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
    sc48("b49po-zombie-ride-east-9602", 9602, 60, "Z", onTop, none, look, east);
    sc48("b49po-cow-ride-retract-9603", 9603, 40, "C", onTop, none, look, "0 piston 70 0 64 5 0 1 0");
    sc48("b49po-spider-east-9604", 9604, 50, "B", far, none, look, east);
    sc48("b49po-spider-wall-9605", 9605, 50, "B", far, wall, look, east);
    sc48("b49po-slime-east-9606", 9606, 50, "I", far, none, look, east);
    sc48("b49po-slime-lift-9607", 9607, 50, "I", new double[][] {{70.5, 64.5, 1.0}, {100.5, 100.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
    sc48("b49po-golem-east-9608", 9608, 50, "G", far, none, look, east);
    sc48("b49po-golem-wall-9609", 9609, 50, "G", far, wall, look, east);
    sc48("b49po-golem-ride-east-9610", 9610, 50, "G", onTop, none, look, east);
    sc48("b49po-spider-ceiling-9611", 9611, 50, "B", new double[][] {{70.5, 64.5, 1.0}, {100.5, 100.5}}, new int[][] {{70, 0, 64, 70, 0, 64, 1, 0}, {70, 3, 64, 70, 3, 64, 1, 0}}, look, "0 piston 70 1 64 1 1 1 0");
  }

  // Batch 50 (legacybody): EW_SET=b50lb, the b49po harness (pistons push the mob; the player stands far away) with the mobs whose isAIEnabled (sw.bk) is false in the bytecode and no
  // earlier record: f silverfish, g giant, z zombie pigman, a blaze; K witch and X creeper are the AI-enabled controls (bk true). A push east moves the mob 1 block, so the
  // legacy turn (renderYawOffset eases toward the travel direction) and the body helper (renderYawOffset = rotationYaw) differ; a push into a wall and a retracting block (the pull the other way) add the stop cases.
  static void run50() throws Exception {
    int[][] none = new int[0][0];
    int[][] wall = {{72, 0, 60, 72, 5, 68, 1, 0}};
    String look = "0 look 90 0", east = "0 piston 70 0 64 5 1 1 0", north = "0 piston 70 0 64 2 1 1 0";
    double[][] far = {{70.5, 64.5}, {100.5, 100.5}};
    long seed = 9700;
    for (String t : new String[] {"f", "g", "z", "a", "K", "X"}) {
      String n = t.equals("f") ? "silverfish" : t.equals("g") ? "giant" : t.equals("z") ? "pigman" : t.equals("a") ? "blaze" : t.equals("K") ? "witch" : "creeper";
      int ticks = t.equals("g") ? 40 : 60;
      sc48("b50lb-" + n + "-east-" + seed, seed++, ticks, t, far, none, look, east);
      sc48("b50lb-" + n + "-north-" + seed, seed++, ticks, t, far, none, look, north);
      sc48("b50lb-" + n + "-wall-" + seed, seed++, ticks, t, far, wall, look, east);
      if (t.equals("f")) { seed++; continue; } // a silverfish (0.3 wide) pulled into the retracting block suffocates: not a body-turn case
      sc48("b50lb-" + n + "-retract-" + seed, seed++, ticks, t, far, none, look, "0 piston 70 0 64 4 0 1 0");
    }
  }

  // Batch 51 (flyturn): EW_SET=b51sf, the b50lb harness with the silverfish (f) pulled into a retracting block (0.3 wide: it ends up inside the moving block and suffocates)
  // by the two retract piston facings the harness uses and a retract with the player standing next to it; the rows carry health and death per tick.
  static void run51() throws Exception {
    int[][] none = new int[0][0];
    String look = "0 look 90 0";
    double[][] far = {{70.5, 64.5}, {100.5, 100.5}};
    sc48("b51sf-silverfish-retract4-9703", 9703, 60, "f", far, none, look, "0 piston 70 0 64 4 0 1 0");
    sc48("b51sf-silverfish-retract5-9801", 9801, 40, "f", far, none, look, "0 piston 70 0 64 5 0 1 0");
    sc48("b51sf-silverfish-retract2-9802", 9802, 40, "f", far, none, look, "0 piston 70 0 64 2 0 1 0");
  }
}
