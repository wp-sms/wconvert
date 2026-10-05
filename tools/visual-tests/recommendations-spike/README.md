# Disposable recommendation checks

These fixtures mutate sample products, campaigns, themes and baskets. Mount only
in this isolated Playground; never install them on a saved or production site.

Start `server.mjs` from the repository root with `WCONVERT_WOO_DIR` pointing to an
extracted official WooCommerce distribution. Optional `WCONVERT_TEST_WP` and
`WCONVERT_TEST_PHP` pin versions in the generated blueprint; CLI flags alone did
not reliably select the requested runtime. `WCONVERT_TEST_CORE` and
`WCONVERT_TEST_PRO` can point to extracted release packages. Port is 9445.

Run `check-products.mjs`, then `check-additions.mjs`, then `check-product-activity.mjs`. All use HTTP requests only. The activity check covers signed observations, report permissions, server-only additions, replay, paused history, journey isolation and scoped retention.
For the latter, set `WCONVERT_EXPECT_WP`, `WCONVERT_EXPECT_PHP` and
`WCONVERT_EXPECT_WOO` to assert the runtime instead of trusting a command banner.
Prefixes such as `6.8` or `8.1` allow patch releases.

After checks finish, the product fixture's `addition_demo=1` switches its sample
product template to the direct-add campaign for browser review. `theme=classic`
selects the minimal classic fixture; `theme=block` restores the original block
theme. This changes the fixture configuration, so restart before rerunning the
baseline integration checks.

`check-package-cycle.mjs` is a local release rehearsal. It expects the candidate
extracted at `/tmp/wconvert-rc-installed`, branch-base packages built under
`/tmp/wconvert-rc-baseline/dist/stage`, and current packages under this repo's
`dist/stage`. It changes only those temporary plugin copies and always restores
the candidate. Do not point a saved site at these directories. It compares actual
saved campaign/statistic records across rollback/re-upgrade and Basic/Elite changes.

See `docs/reviews/recommendations-rc-2026-10-05/` for the verified runtime matrix,
logs, visual evidence and exact artifact hashes. WordPress Playground patch
selection may differ from the requested series; trust the reported runtime.

`check-result-filters.mjs` checks category/attribute quiz sources against the
same disposable WooCommerce site. It creates separate catalog fixtures, checks
AND matching and fallback boundaries, then deletes one test-only term to prove
that missing filters never broaden a result. Use a fresh server for a repeat run.
