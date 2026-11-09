# Frozen, passcode-protected Pages builds

The source branch stays separate from the Pages publishing branch. Build the chosen source revision with `BASE_PATH=/mc-web/ npm run build`, then run:

```sh
node tools/build-protected-pages.mjs --input dist --output /absolute/empty/output --base /mc-web/ --version SOURCE_COMMIT
```

Set `PAGES_PASSCODE` in the process environment before packaging. When republishing, add `--keep-salt-from <published>/resource-pack-sw.js` (the worker currently on the Pages branch): the same passcode then gives the same key, so browsers that unlocked the previous build stay unlocked, and a still-running old worker can open the new manifest. Never commit the passcode, a key, or a file containing either. The output directory must be empty and outside the input directory. Publish only that output as a dedicated Pages source branch, with `.nojekyll`; leave the main-branch Pages workflow disabled so ordinary source pushes do not replace the frozen build.

Every application file, including installed local packs, is compressed when useful and encrypted with AES-256-GCM, a fresh IV and its path as authenticated data. The encrypted manifest maps original paths to opaque ciphertext filenames. PBKDF2-SHA-256 uses a random salt (kept across republications with `--keep-salt-from`) and 600,000 iterations. Only the unlock page, service worker and ciphertext are public; the passcode and key are absent from the output. A short numeric passcode can still be guessed offline. This is a browser encryption gate, not server-side accounts or rate limiting.

The worker uses the game's existing `resource-pack-sw.js` URL and scope and preserves its IndexedDB override/refresh protocol. An unlocked browser stores a nonextractable CryptoKey for 12 hours, including across worker restarts. Decrypted app responses use `Cache-Control: no-store` and are not written to Cache API storage. The unlock page waits for a newly published worker to take over before it sends the passcode, and asks again if the worker it asked was replaced meanwhile (otherwise the first entry after a publication could hang or be refused). A page load re-reads the manifest, so an old worker serves the newest build. Visit `unlock.html?lock=1` to remove the stored key and relock. Files remain on the user's device once loaded, as with any browser application.

`src/protected-pages.test.js` checks encryption, wrong passcodes, tampering, path binding, passcode omission and output-directory guards. Browser QA should cover fresh lock, wrong/right passcodes, reload and worker restart, relock, resource-pack overrides, subpath mod assets and a world load before publication. The gate requires HTTPS (localhost also works), service workers, WebCrypto, IndexedDB and DecompressionStream in a current browser.
