// Batch 64 stand-in for RenderManager (bnn): the first-person item branch only asks for the singleton's renderer of the player when it draws a bare arm, which only the map cases do (the probe's stand-in `arm` records an ["A"] marker for RenderPlayer.renderFirstPersonArm).
public class bnn {
  public static bnn a = new bnn();
  public bly f;
  public static bno arm;
  public bno a(sa entity) { return arm; }
}
