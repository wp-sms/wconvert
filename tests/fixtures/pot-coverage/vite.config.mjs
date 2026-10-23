// Names the fixture's entries the way the real vite.config.*.mjs files name
// theirs, so the checker knows src/index.ts and src/minified.js ship.
export default { build: { lib: { entry: ['src/index.ts', 'src/minified.js'] } } };
