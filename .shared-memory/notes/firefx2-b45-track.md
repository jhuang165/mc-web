# firefx2 b45 track

## Summary
Re-audited the open fire-fx gaps against the 1.7.10 bytecode (javap, no new probe): water/in-wall/fire overlays (`bly.b/c/d`), punch-out fizz (`ahb.a(yz,IIII)Z`, `mx.a`, `bje.a`), flint and steel (`acw`, `xz.interact`), item and orb in lava (`xk`, `sq`), and `Render.renderEntityOnFire` (`bno.a`). Overlays, flint and steel, orb fizz and third-person fire matched. Two fixes: Creative punch-out now plays two fizzes (client `clickBlockCreative` plus the server's aux 1004 packet; Survival still one), and the item fizz sound position is posY (`e.y + 0.125`), not the box bottom. Details in `public/research/fire-fx.md` ("Batch 45 re-audit").

## Verification
`node --test src/player-edit-simulation.test.js src/fire-fx.test.js src/lava.test.js src/entity-fire-renderer.test.js src/xp-orbs.test.js`: 73 pass, 0 fail (includes a new Creative/Survival punch-out test). No browser check, no build (no shipping-visual change beyond one extra sound call).

## Follow-ups
- Water overlay tint is still not pixel-compared with a native frame.
- Item/orb lava fizz and flint and steel not driven by live browser input.
