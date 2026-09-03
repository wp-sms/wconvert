// Stands in for Pro's built admin entry.
//
// tests/unit/Pro/Admin/AdminReplacementTest.php points Pro's enqueue at this
// tree rather than at pro/public/, which is a build output and is gitignored —
// so a test depending on it would pass on a machine that had run
// `npm run build` and fail everywhere else.
//
// The HASH in the name is load-bearing: `WConvert\Assets\ViteHelper` globs for
// `main-*.js` because the entry carries no `?ver` query, and a fixture named
// `main.js` would pass a check the shipped bundle has to pass differently.
