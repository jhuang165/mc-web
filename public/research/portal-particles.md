# Portal particles (Java 1.7.10)

`portal-particles.js` implements the original `EntityPortalFX` (`bkt`) constructor, tick, render-size curve and packed-light override. `Fx.spawn('portal', ...)` routes it through the shared particle setting/distance filter, layer-zero pool and particles.png renderer. Pearl impact consumes its own Gaussian draws for the spawn arguments; particle construction uses separate client Math.random and Entity.rand streams.

The particle keeps its spawn origin and original motion. Each update sets its position directly along the native age curve, without collision. Its maximum-age value is 40–49, with the native post-increment death check. Render size grows with partial ticks; the packed-light override raises the sky component with the fourth power of age. The original float/double arithmetic is retained.

`tools/verify-portal-particles.mjs` runs `PortalParticleProbe.java` against the pinned, unchanged 1.7.10 JAR. Eight constructor/motion cases record every update through death, both random stream positions, and native render-size/light results at early, middle and final ages, three partial ticks and three light levels. The probe reuses the existing `FxProbe` world and Tessellator harness, without a GL draw. `portal-particles.test.js` replays these outputs and checks the setting/range filter and shared lifetime pool.

The native evidence covers particle state and the render-size/light methods. Full client/server packet timing and framebuffer equivalence remain outside this probe.
