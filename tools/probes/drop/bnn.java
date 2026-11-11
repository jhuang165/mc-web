// Batch 44 stand-in for RenderManager (bnn), shadowing the game class on the probe classpath only: its static initialiser would build every renderer and start Minecraft's
// class initialisation. RenderItem's sprite path reads three fields: the texture manager e, the game settings l (fancy graphics) and the player's view yaw j.
public class bnn {
  public bqf e;
  public bbj l;
  public float j;
}
