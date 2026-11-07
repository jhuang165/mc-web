# Super Secret Settings shaders and 3D Anaglyph

Target: Minecraft Java 1.7.10. Full parity is not claimed. Reference facts: [post-shaders-reference.json](post-shaders-reference.json) (jar sha1 e80d9b3bf5085002218d4be59e668bac718abbc6).

## Evidence

All of this is bytecode-read with `javap -c` from the pinned jar, not probed, because the GL calls cannot run headless.

- `EntityRenderer.shaderResourceLocations` has 22 entries (not 23): notch, fxaa, art, bumpy, blobs2, pencil, color_convolve, deconverge, flip, invert, ntsc, outline, phosphor, scan_pincushion, sobel, bits, desaturate, green, blur, wobble, blobs, antialias.
- F4 (Minecraft.runTick, key 62) only calls `deactivateShader`. It never turns a shader on.
- The Options "Super Secret Settings..." button calls `activateNextShader`, index = (index + 1) % 23, where 22 means no effect. It plays a random event from the animals, blocks, mobs, players and weather sound categories at volume 0.25, pitch 0.5, and no normal click.
- The shader choice is not saved. There are no entity or spectator shaders in 1.7.10.
- ShaderGroup/Shader: targets (name or name/width/height, `minecraft:main` is the game framebuffer), passes with intarget/outtarget/auxtargets/uniforms, program JSON (vertex, fragment, samplers, uniform defaults, blend add one/zero). Output is cleared to (0,0,0,0), depth mask off, colour mask (true,true,true,false). ProjMat is orthographic(0,w,h,0,0.1,1000); every shipped vertex shader replaces z with 0.2. Time is the accumulated partial ticks wrapped at 20, divided by 20.
- Anaglyph: pass 0 writes green and blue, pass 1 writes red. Projection shift -(pass*2-1)*0.07, eye shift (pass*2-1)*0.1. Texture and fog colour: r' = (30r+59g+11b)/100, g' = (30r+70g)/100, b' = (30r+70b)/100.
- The 22 post chains and 58 program files are extracted from the jar by `tools/import-shaders.mjs` into `public/media/1.7.10/shaders/`, with provenance entries.

## Implemented

- `src/post-shaders.js`: shader list and cycle, JSON parsing into a pass graph, GLSL 1.20 to GLSL ES 3.00 conversion (varying/attribute, texture2D, uniform initialisers moved to defaults, int/float literal fixes), the Time clock, ProjMat, three.js render targets (nearest filter) with one RawShaderMaterial per pass, and the anaglyph merge.
- Hooks: `scene.render` calls `post.begin` before the sky and `scene.endFrame()` runs after the first-person hand; F4 in `main.js`; the Options button cycles shaders with the random sound; 3D Anaglyph in Video Settings is enabled and persists as `anaglyph3d` in options.txt.
- Tests: `src/post-shaders.test.js` (chain parsing for all 22, program parsing, conversion checks for every program, cycle/F4, clock, projection, anaglyph constants and formulas, sound categories, options persistence).
- Browser check: a headless Chrome (SwiftShader) harness cycled all 22 shaders on a test scene with no shader compile errors or GL errors; outputs changed as expected (invert, green, sobel and others). Anaglyph output matched the colour formula on the test scene. This was a synthetic scene, not a full in-game session.

## Remaining differences

- Anaglyph colour conversion is applied to final rendered pixels, not to textures at upload and fog colours as 1.7.10 does, so results differ for blended and lit surfaces. The lightmap is not converted natively either, which this does not model.
- The camera shifts are applied per `renderer.render` call, so the hand and sky are shifted too; RenderBlocks/RenderGlobal anaglyph paths are not separately ported.
- Shader output was not compared pixel by pixel against the original. GLSL runs through ANGLE/WebGL2, so driver differences are possible.
- Antialiasing (MSAA) on the main canvas is bypassed while a shader or anaglyph is active.
- Shader and anaglyph GL state sequences were not probed.
