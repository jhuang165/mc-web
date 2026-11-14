import java.lang.reflect.Method;

// Drives the unchanged 1.7.10 EntityPlayerSP (blk, as PlayerStepProbe) through EntityPlayer.onUpdate (yz.h), which holds the cape's
// chasing position (bu/bv/bw previous, bx/by/bz current; the end of onUpdate), and through the real Entity.moveEntity and
// onLivingUpdate for cameraYaw (br/bs) and distanceWalkedModified (O/P). Each tick the position is moved to a scripted target
// by writing posX/posY/posZ (a jump or a walk) with the player flying (no gravity), then onUpdate runs; the recorded rows give
// lastTickPos, posX..Z after the tick, the chasing positions, cameraYaw and the walked distance, so the browser's chase step can be
// replayed against them. tools/verify-cape.mjs writes public/research/cape-reference.json; src/cape-b70.test.js replays it.
public class CapeChaseProbe {
  static String n(double v) { return Double.toString(v); }

  static String row(blk e) throws Exception {
    return "{\"lx\":" + n(PlayerStepProbe.d(e, "p")) + ",\"ly\":" + n(PlayerStepProbe.d(e, "q")) + ",\"lz\":" + n(PlayerStepProbe.d(e, "r"))
      + ",\"x\":" + n(PlayerStepProbe.d(e, "s")) + ",\"y\":" + n(PlayerStepProbe.d(e, "t")) + ",\"z\":" + n(PlayerStepProbe.d(e, "u"))
      + ",\"pcx\":" + n(PlayerStepProbe.d(e, "bu")) + ",\"pcy\":" + n(PlayerStepProbe.d(e, "bv")) + ",\"pcz\":" + n(PlayerStepProbe.d(e, "bw"))
      + ",\"cx\":" + n(PlayerStepProbe.d(e, "bx")) + ",\"cy\":" + n(PlayerStepProbe.d(e, "by")) + ",\"cz\":" + n(PlayerStepProbe.d(e, "bz"))
      + ",\"pcam\":" + Float.toString(PlayerStepProbe.fl(e, "br")) + ",\"cam\":" + Float.toString(PlayerStepProbe.fl(e, "bs"))
      + ",\"pwalk\":" + Float.toString(PlayerStepProbe.fl(e, "O")) + ",\"walk\":" + Float.toString(PlayerStepProbe.fl(e, "P"))
      + ",\"ground\":" + PlayerStepProbe.b(e, "D") + ",\"vx\":" + n(PlayerStepProbe.d(e, "v")) + ",\"vy\":" + n(PlayerStepProbe.d(e, "w")) + ",\"vz\":" + n(PlayerStepProbe.d(e, "x")) + "}";
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    PlantProbe.unsafe = u;
    Method onUpdate = PlayerStepProbe.method(yz.class, "h"), setPos = PlayerStepProbe.method(sa.class, "b", double.class, double.class, double.class);
    // Targets per tick: x z y offsets from the start (0.5, 70.0, 0.5): a slow walk, a fast run, a big jump (beyond 10), a drop and a stop.
    double[][][] scripts = {
      {{0.2, 0, 0}, {0.4, 0, 0}, {0.6, 0, 0}, {0.8, 0, 0}, {1.0, 0, 0}, {1.0, 0, 0}, {1.0, 0, 0}, {1.0, 0, 0}},
      {{0.5, 0, 0.3}, {1.1, 0.2, 0.7}, {1.8, 0.1, 1.5}, {2.6, 0, 2.2}, {3.5, -0.3, 2.9}, {4.5, 0, 3.7}, {4.5, 0, 3.7}, {4.5, 0, 3.7}},
      {{0, 0, 0}, {12, 0, 0}, {12, 0, 0}, {12.5, 0, 0}, {12.5, 15, 0}, {12.5, 15, 0}, {-0.5, 15, 12}, {-0.5, 15, 12}, {-0.5, 0, -12}, {-0.5, 0, -12}, {-0.5, 0, -12}},
      {{0, 10.5, 0}, {0, 10.5, 0}, {0, 10.6, 0}, {0, -10.9, 0}, {0, -10.9, 0}, {0, -11, 0}},
    };
    for (int s = 0; s < scripts.length; s++) {
      PlantProbe.W w = PlantProbe.world((x, y, z) -> new int[] {0, 0});
      blk e = PlayerStepProbe.spawn(u, w, 0.5, 0.5, 0f, false, false, 0f);
      PlayerStepProbe.set(e, "bm", new yx(e));
      PlayerStepProbe.field(sv.class, "g").set(e, new add[5]); // EntityLivingBase.previousEquipment
      PlayerStepProbe.field(sv.class, "e").set(e, new rn(e)); // EntityLivingBase._combatTracker
      Object mc = u.allocateInstance(bao.class); // the Minecraft instance (no screen open)
      PlayerStepProbe.field(bao.class, "c").set(mc, u.allocateInstance(bje.class)); // its PlayerControllerMP
      PlayerStepProbe.field(blk.class, "d").set(e, mc);
      ((yw) PlayerStepProbe.field(yz.class, "bE").get(e)).b = true;
      setPos.invoke(e, 0.5, 70.0, 0.5);
      for (String f : new String[] {"bx", "bu"}) PlayerStepProbe.field(yz.class, f).setDouble(e, 0.5);
      for (String f : new String[] {"by", "bv"}) PlayerStepProbe.field(yz.class, f).setDouble(e, 70.0);
      for (String f : new String[] {"bz", "bw"}) PlayerStepProbe.field(yz.class, f).setDouble(e, 0.5);
      StringBuilder out = new StringBuilder();
      out.append("{\"start\":" + row(e) + ",\"ticks\":[");
      for (int i = 0; i < scripts[s].length; i++) {
        double[] t = scripts[s][i];
        setPos.invoke(e, 0.5 + t[0], 70.0 + t[1], 0.5 + t[2]); // Entity.setPosition also moves the bounding box (moveEntity rebuilds the position from it)
        String err = null;
        try { onUpdate.invoke(e); } catch (java.lang.reflect.InvocationTargetException ex) { err = String.valueOf(ex.getCause()); if (System.getenv("TRACE") != null) ex.getCause().printStackTrace(); }
        if (i > 0) out.append(",");
        out.append(err != null ? "{\"error\":\"" + err.replace("\"", "'") + "\"}" : row(e));
        if (err != null) break;
      }
      out.append("]}");
      System.out.println("{\"case\":\"chase\",\"script\":" + s + ",\"data\":" + out + "}");
    }

    // Walking on a stone floor (not flying): motionX/Z are set before each tick, moveEntity and the real friction run, so cameraYaw
    // (ground contact and speed) and distanceWalkedModified accumulate; then the player stops and a jump leaves the ground.
    double[][] walks = {{0.1, 0}, {0.1, 0}, {0.2, 0.1}, {0.05, 0.3}, {0.3, 0}, {0.3, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}};
    PlantProbe.W w2 = PlantProbe.world((x, y, z) -> new int[] {y < 70 ? 1 : 0, 0});
    blk p = PlayerStepProbe.spawn(u, w2, 0.5, 0.5, 0f, false, true, 0f);
    PlayerStepProbe.set(p, "bm", new yx(p));
    PlayerStepProbe.field(sv.class, "g").set(p, new add[5]);
    PlayerStepProbe.field(sv.class, "e").set(p, new rn(p));
    Object mc2 = u.allocateInstance(bao.class);
    PlayerStepProbe.field(bao.class, "c").set(mc2, u.allocateInstance(bje.class));
    PlayerStepProbe.field(blk.class, "d").set(p, mc2);
    setPos.invoke(p, 0.5, 70.0, 0.5);
    for (String f : new String[] {"bx", "bu", "bz", "bw"}) PlayerStepProbe.field(yz.class, f).setDouble(p, 0.5);
    for (String f : new String[] {"by", "bv"}) PlayerStepProbe.field(yz.class, f).setDouble(p, 70.0);
    StringBuilder wo = new StringBuilder("{\"start\":" + row(p) + ",\"ticks\":[");
    for (int i = 0; i < walks.length; i++) {
      PlayerStepProbe.set(p, "v", walks[i][0]); PlayerStepProbe.set(p, "x", walks[i][1]);
      onUpdate.invoke(p);
      if (i > 0) wo.append(",");
      wo.append(row(p));
    }
    wo.append("]}");
    System.out.println("{\"case\":\"walk\",\"script\":4,\"data\":" + wo + "}");
  }
}
