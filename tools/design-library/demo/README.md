# Real campaign review site

This development-only harness creates the current 48 campaign examples in a
**disposable WordPress + MySQL + WooCommerce site**. It uses the normal Prefill,
create, publish and capture paths. There are no mocked REST responses. Nothing
under `tools/` ships in either plugin ZIP.

Do not mount this MU plugin in a saved customer/development site. It changes shop,
privacy and phone-country options, publishes sample pages/products/campaigns,
creates a coupon and shipping zone, and intercepts **all** WordPress email into a
local outbox. Use fictional visitor details. No payment gateway is needed.

## Setup

1. Create a fresh WordPress with a separate MySQL/InnoDB database named
   `wconvert_library_demo`. Use PHP 8.2+ with mysqli and the normal WordPress
   extensions. SQLite Playground is useful for UI smoke checks but cannot verify
   WConvert's InnoDB receipt/handoff transactions.
2. Install WordPress at `http://127.0.0.1:9421`. In its own `wp-config.php`, before
   loading WordPress, add `define('WCONVERT_LIBRARY_DEMO', true);` and
   `define('DISABLE_WP_CRON', true);`. Keep its generated credentials/salts local.
3. Build the repository (`composer install`, `npm ci`, `npm run build`). Link the
   repository into `wp-content/plugins/wconvert`, and its `pro/` directory into
   `wp-content/plugins/wconvert-pro`. Install and activate official WooCommerce.
   Use the Pro development build with journey/display modules for all 48 examples.
4. Symlink `demo/mu/library-demo.php` into `wp-content/mu-plugins/`. It loads the
   repository's Free and Pro entry points and installs WConvert through its normal
   installer. Keep the symlink: its sibling `resources.php` resolves in this source
   directory. Link `demo/theme/` as `wp-content/themes/wconvert-library-demo` and
   activate that theme. Use a dedicated site root with real `wp-admin` and
   `wp-includes` directories: symlinking core from another configured site can
   resolve that site's `wp-load.php`.
5. Start the loopback server from the repository root:

   ```bash
   WCONVERT_DEMO_SITE=/absolute/path/to/disposable-wordpress \
   WCONVERT_DEMO_PHP=/absolute/path/to/php \
   node tools/design-library/demo/server.mjs
   ```

6. Sign in as that disposable site's administrator, open
   <http://127.0.0.1:9421/?library-demo=1> and press **Create missing demos & process
   queued mail**. Each published campaign has its own page and an editor link.
   Inline examples use the real shortcode. Demo rules show immediately on their
   assigned page and can be retried after dismissal/conversion; audience conditions
   (including a non-empty cart) remain intact. Reusable source Playbooks retain
   their recommended timing and normal frequency defaults.
7. Run the database checks with the same PHP version and WP-CLI:

   ```bash
   php /path/to/wp-cli.phar eval-file tools/design-library/demo/verify.php \
     --path=/absolute/path/to/disposable-wordpress
   ```

The script adds one test Lead to each capture campaign, checks required fields,
canonical phones, choices, replay safety and shared Lead identity across optional
channels. It checks result/product URLs and processes the real Action Scheduler
queue. Every resource request must yield one local email containing an accessible
resource page. Results are written to `../out/demo-verification.json`.

## Review scope

- `DEMO10` supplies a real 10% coupon for new demo shoppers, limited to one use per
  user. Test the discount in the basket; no order or payment is necessary.
- Three sample products support recommendation and cart checks. Product pictures
  are WooCommerce placeholders. Sample UK delivery is £4, free over £40 after
  discounts; GBP is the demo currency.
- Six requested resources contain actual useful sample content. Article,
  membership, workshop and packaging buttons lead to matching information pages.
  Workshop/membership pages explain that no real registration is created.
- The outbox proves the WordPress mail handoff and correct resource link, **not**
  external provider acceptance or inbox delivery. Newsletter/SMS campaigns use
  local collection; they do not claim a subscription or send external messages.
- The PHP verifier complements browser review. Use the actual buttons to test
  navigation, skip/back paths, errors and mobile layouts; follow
  [the practical review gate](../pilot/PRACTICAL-REVIEW.md).

All demo state is disposable and outside the repository. Stop the server and its
private MySQL process when done. Removing this harness from a site does not undo
its created rows/options, which is why it must only run in a disposable site.

## Business walkthroughs

Open <http://127.0.0.1:9421/?library-scenarios=1> while signed in to the
disposable site. The store, service and publisher walkthroughs link to the
actual seeded campaigns and describe the whole task, useful outcomes and
limitations. Their source is `scenarios.json`; they are reviewer instructions,
not automatic passes or real-merchant research. The regular review hub links
to them.

The verifier now refuses missing seeded campaigns instead of reporting an empty
run as success. Unique fictional recipients per run make local mail checks
repeatable even after the 100-message outbox fills. The capacity regression was
verified against the real demo with temporary local fixture messages, removed
after the run. External delivery remains skipped.
