# Post shaders track (batch 14)

Owner: claude-b14-shaders, branch b14-shaders. Remaining-gaps item 13.

- Added src/post-shaders.js, shaders extracted to public/media/1.7.10/shaders (tools/import-shaders.mjs), reference JSON, post-shaders.md.
- F4 only deactivates; the Options button cycles 22 shaders + none and plays a random sound (volume 0.25, pitch 0.5).
- 3D Anaglyph is enabled and persisted (anaglyph3d); it is a final-pixel approximation of the native texture conversion.
- Hooks are small: scene.post.begin/endFrame, F4 in main.js, menuContext.superSecret.
- Not done: pixel comparison against the original, native texture-time anaglyph conversion.
