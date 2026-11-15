// Batch 75 (entityaudit75): free flight of the projectile entities on the EntityListProbe World double, one record per scenario with one row per tick (EntityListProbe.scenario):
// a snowball, egg-less pearl, bottle o' enchanting and witch potion thrown by a mob (EntityThrowable.onUpdate: gravity 0.03 (0.05 for potions and bottles), drag 0.99, water drag 0.8),
// an arrow and a wither skull, in open air, through a pool of water and onto a stone floor. The point of each: the per-tick motion, drag and gravity, the water slow-down, and the
// impact tick, against the port's replay (src/entity-list-replay.js).
public class ThrowFlightProbe {
  static final String[] NAMES = {"snowball", "egg", "pearl", "potion", "expbottle"};
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for (int type : new int[] {0, 2, 3, 4}) {
      String n = NAMES[type];
      EntityListProbe.scenario("flight-air-" + n, 40, EntityListProbe.mthrow(0.5, 80.5, 0.5, 0.4, 0.3, 0.2, type));
      // a pool of still water (original id 9) four deep above a stone floor: x 0..9, z -2..2, water y 60..63, stone y 59; the ball starts above it
      java.util.List<String[]> pool = new java.util.ArrayList<>();
      for (int x = 0; x <= 9; x++) for (int z = -2; z <= 2; z++) { pool.add(EntityListProbe.setBlock(x, 59, z, 1, -1)); for (int y = 60; y <= 63; y++) pool.add(EntityListProbe.setBlock(x, y, z, 9, -1)); }
      pool.add(EntityListProbe.mthrow(0.5, 66.5, 0.5, 0.35, 0.05, 0.0, type));
      EntityListProbe.scenario("flight-water-" + n, 40, pool.toArray(new String[0][]));
      // thrown at a stone floor: the impact tick and the entity's last state
      java.util.List<String[]> floor = new java.util.ArrayList<>();
      for (int x = -2; x <= 12; x++) for (int z = -3; z <= 3; z++) floor.add(EntityListProbe.setBlock(x, 64, z, 1, -1));
      floor.add(EntityListProbe.mthrow(0.5, 68.5, 0.5, 0.3, 0.1, 0.0, type));
      EntityListProbe.scenario("flight-floor-" + n, 40, floor.toArray(new String[0][]));
    }
    EntityListProbe.scenario("flight-air-arrow", 40, EntityListProbe.arrow(0.5, 80.5, 0.5, 1.2, 0.6, 0.3, 0));
    java.util.List<String[]> apool = new java.util.ArrayList<>();
    for (int x = 0; x <= 40; x++) for (int z = -2; z <= 2; z++) { apool.add(EntityListProbe.setBlock(x, 59, z, 1, -1)); for (int y = 60; y <= 63; y++) apool.add(EntityListProbe.setBlock(x, y, z, 9, -1)); }
    apool.add(EntityListProbe.arrow(0.5, 66.5, 0.5, 0.3, -0.2, 0.0, 0));
    EntityListProbe.scenario("flight-water-arrow", 40, apool.toArray(new String[0][]));
    java.util.List<String[]> afloor = new java.util.ArrayList<>();
    for (int x = -2; x <= 20; x++) for (int z = -3; z <= 3; z++) afloor.add(EntityListProbe.setBlock(x, 64, z, 1, -1));
    afloor.add(EntityListProbe.arrow(0.5, 68.5, 0.5, 1.0, 0.1, 0.0, 0));
    EntityListProbe.scenario("flight-floor-arrow", 40, afloor.toArray(new String[0][]));
    EntityListProbe.scenario("flight-air-skull", 40, EntityListProbe.skull(0.5, 80.5, 0.5, 3.0, 1.0, 2.0, 0));
    java.util.List<String[]> spool = new java.util.ArrayList<>();
    for (int x = 0; x <= 60; x++) for (int z = -2; z <= 2; z++) { spool.add(EntityListProbe.setBlock(x, 59, z, 1, -1)); for (int y = 60; y <= 63; y++) spool.add(EntityListProbe.setBlock(x, y, z, 9, -1)); }
    spool.add(EntityListProbe.skull(0.5, 62.5, 0.5, 3.0, 0.0, 0.0, 0));
    EntityListProbe.scenario("flight-water-skull", 40, spool.toArray(new String[0][]));
  }
}
