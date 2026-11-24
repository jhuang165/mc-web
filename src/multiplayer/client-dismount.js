// b99 horse99: the client side of the server's `dismount` message (S08, S1B(0, player, -1), S08; net-packet-ids.js CLIENT_PACKETS.dismount).
// NetHandlerPlayClient.handlePlayerPosLook (bjb.a(fu), bytecode-read): ySize = 0, motion = 0, setPositionAndRotation(x, y, z) (the previous position becomes the new one), then the C06 reply.
// handleAttachEntity (S1B, mode 0, vehicle -1) clears ridingEntity. So a dismounted client has its position AND previous position at the spot, motion 0 and ySize 0 at once, instead of
// reading them off the next tick row (which made velocity = spot - seat for one tick). `state`: { position, previous, velocity (vectors with set/copy), motion, setRiding }.
export function applyDismount(message, state) {
  const { x, y, z } = message;
  if (![x, y, z].every(Number.isFinite)) return false;
  const s08 = () => {
    state.motion.ySize = 0;
    state.velocity.set(0, 0, 0);
    state.position.set(x, y, z);
    state.previous.set(x, y, z);
  };
  s08();
  state.setRiding(false); // S1B
  s08();
  return true;
}
