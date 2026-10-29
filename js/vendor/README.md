# Reader module parser

`es-module-lexer-1.7.0.js` is the unmodified `dist/lexer.asm.js` JavaScript build from
npm `es-module-lexer@1.7.0` (MIT; see `es-module-lexer-LICENSE.txt`).
Source: https://github.com/guybedford/es-module-lexer/tree/1.7.0

The offline service worker uses its module parser to follow real static imports and
re-exports without treating import examples in strings/comments as dependencies.
The JavaScript build avoids adding a WebAssembly/eval permission requirement.
Keep the version pinned. If upgrading, rerun `reading-offline-dependencies.cjs`,
`reading-offline-update.mjs` and the real browser `reading-offline.cjs` test.
