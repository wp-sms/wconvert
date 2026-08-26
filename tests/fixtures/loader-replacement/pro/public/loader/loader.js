// Stands in for Pro's built loader.
//
// tests/unit/Pro/Frontend/LoaderReplacementTest.php points Pro's enqueue at
// this tree rather than at pro/public/, which is a build output and is
// gitignored — so a test depending on it would pass on a machine that had run
// `npm run build` and fail everywhere else. What the replacement needs from the
// bundle is that it EXISTS; what is in it is `npm run check:loader`'s business.
