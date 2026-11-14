// Batch 68 (projectiles3): balls thrown by a living mob (a witch's potion, a snow golem's snowball, a mob's egg or pearl; the Cow shell is the EntityLiving thrower: a witch or golem differ from it
// only in AI) at an item frame, empty or holding an item, and a real EntityPlayerMP's ender pearl at a frame. Same scenario machinery as EntityThrowFrameProbe (EntityListProbe.scenario);
// the new "mthrow" spec kind builds EntityThrowable(World, EntityLivingBase) with the mob. The mob's own throw is not part of the record: it starts at the listed point.
public class EntityThrowMobProbe {
  static final String[] NAMES = {"snowball", "egg", "pearl", "potion", "expbottle"};
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for (int type = 0; type < 5; type++) for (int held = 0; held < 2; held++) {
      String n = "mthrow-" + NAMES[type] + "-frame-" + (held == 1 ? "item" : "empty");
      EntityListProbe.scenario(n, 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, held), (type >= 3 ? EntityListProbe.mthrow(0.5, 3.75, 1.7, 0.0, 0.0, -0.4, type) : EntityListProbe.mthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, type)), EntityListProbe.setBlock(0, 3, 0, 0, 4));
    }
    // a real EntityPlayerMP's pearl: teleports the thrower to the impact (pre-move) and deals 5.0 fall damage; the frame outcome as for any thrower that is a player (Survival)
    for (int held = 0; held < 2; held++)
      EntityListProbe.scenario("pthrow-pearl-mp-frame-" + (held == 1 ? "item" : "empty"), 8, EntityListProbe.setBlock(0, 3, 0, 1, -1), EntityListProbe.frame(0, 3, 0, 0, 0, 0, held), EntityListProbe.pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 2, 2, 0), EntityListProbe.setBlock(0, 3, 0, 0, 4));
  }
}
