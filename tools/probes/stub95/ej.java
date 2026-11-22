// Batch 95 console95: stand-in for NetworkManager (obfuscated `ej`) in the probe only. The 1.7.10 class cannot initialise on the newer netty the probe libraries ship (AttributeKey constructor),
// and the probe needs only where NetHandlerPlayServer.sendPacket (nh.a) hands a packet: ej.a(ft, listeners). Placed first on the class path, never shipped.
import io.netty.util.concurrent.GenericFutureListener;
public class ej {
  public final java.util.Queue<ft> sent = new java.util.concurrent.ConcurrentLinkedQueue<>();
  public void a(ft packet, GenericFutureListener... listeners) { sent.add(packet); }
}
