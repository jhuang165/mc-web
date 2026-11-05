// ContainerBeacon (zx): one payment slot (zy) over the tile's inventory, then the 36 player slots.
// Layout, validity and shift-click are replayed against public/research/beacon-reference.json by beacon.test.js.
import { Container, Slot, StackArray, copyStack } from './inventory.js';
import { isPaymentItem, applyBeaconPick, BEACON_PAYMENT_POS, BEACON_PLAYER_POS } from './beacon.js';

class PaymentSlot extends Slot {
  get limit() { return 1; } // zy.a(): stack limit 1
  valid(stack) { return !!stack && isPaymentItem(stack.id); } // zy.a(add): iron, gold, diamond, emerald
}

export class BeaconContainer extends Container {
  constructor({ inventory, tile, onConfirm = () => {} }) {
    super(inventory);
    this.tile = tile;
    this.onConfirm = onConfirm;
    this.pay = new StackArray([tile.payment ?? null], () => { tile.payment = this.pay.stacks[0] ?? null; });
    this.addSlot(new PaymentSlot(this.pay, 0, ...BEACON_PAYMENT_POS));
    this.addPlayerSlots(...BEACON_PLAYER_POS);
  }
  get payment() { return this.pay.getStack(0); }
  // ContainerBeacon.transferStackInSlot (zx.b), bytecode read.
  transfer(index) {
    return this.move(index, (stack) => {
      if (index === 0) return this.merge(stack, 1, 37, true);
      const payment = this.slots[0];
      if (!payment.has && payment.valid(stack) && stack.count === 1) return this.merge(stack, 0, 1, false);
      if (index >= 1 && index < 28) return this.merge(stack, 28, 37, false);
      if (index >= 28 && index < 37) return this.merge(stack, 1, 28, false);
      return this.merge(stack, 1, 37, false);
    });
  }
  // The MC|Beacon packet: consumes one payment item and sets the validated picks.
  confirm(primary, secondary) {
    const ok = applyBeaconPick(this.tile, primary, secondary);
    if (ok) { this.pay.stacks[0] = this.tile.payment; this.onConfirm(); }
    return ok;
  }
  // ContainerBeacon does not override onContainerClosed: the payment stays in the tile (in memory only).
  close() { super.close(); this.tile.payment = copyStack(this.pay.getStack(0)); }
}
