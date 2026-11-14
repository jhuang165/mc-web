// Batch 67 (entityprobes2): thrown snowballs, eggs, ender pearls, potions and experience bottles hitting an item frame, empty or holding an item (the unchanged EntityItemFrame
// attackEntityFrom: an item is dropped and the frame stays; an empty one breaks), thrown by a Survival player shell, a Creative one, and by no one (a dispenser's ball). It reuses
// EntityListProbe.scenario (World.updateEntities order on XpOrbProbe.XW) and its pthrow builder; the frame is the new "frame" spec kind.
public class EntityThrowFrameProbe {
  static final String[] NAMES = {"snowball", "egg", "pearl", "potion", "expbottle"};
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    String[][] none = {};
    for (int type = 0; type < 5; type++) {
      for (int held = 0; held < 2; held++) for (int creative = 0; creative < 2; creative++) {
        if (type == 3 && creative == 1) continue; // a potion thrown by a player is the owner "player" either way: one Survival record per frame state is enough
        String n = "pthrow-" + NAMES[type] + "-frame-" + (held == 1 ? "item" : "empty") + (creative == 1 ? "-creative" : "");
        EntityListProbe.scenario(n, 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, held), (type >= 3 ? EntityListProbe.pthrow(0.5, 3.75, 1.7, 0.0, 0.0, -0.4, type, creative, 0) : EntityListProbe.pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, type, creative, 0)), EntityListProbe.setBlock(0, 3, 0, 0, 4));
      }
    }
    // an egg with the hatch roll true, and a thrower-less snowball and potion (a dispenser's): the source entity is null, so even a held item drops
    EntityListProbe.scenario("pthrow-egg-frame-hatch", 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, 0), EntityListProbe.pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 1, 0, 0, 4096), EntityListProbe.setBlock(0, 3, 0, 0, 4));
    EntityListProbe.scenario("dispensed-snowball-frame-item", 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, 1), EntityListProbe.snowball(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 0), EntityListProbe.setBlock(0, 3, 0, 0, 4));
    EntityListProbe.scenario("dispensed-snowball-frame-empty", 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, 0), EntityListProbe.snowball(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 0), EntityListProbe.setBlock(0, 3, 0, 0, 4));
    EntityListProbe.scenario("dispensed-potion-frame-item", 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, 1), EntityListProbe.potion(0.5, 3.75, 1.7, 0.0, 0.0, -0.4, 32732, 0), EntityListProbe.setBlock(0, 3, 0, 0, 4));
  }
}
