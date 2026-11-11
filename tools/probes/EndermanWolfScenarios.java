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
}
