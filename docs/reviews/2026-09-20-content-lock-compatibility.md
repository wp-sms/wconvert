# Content lock supported WordPress compatibility

20 September 2026. This review investigates the WordPress version mismatch recorded
in ADR 0100. It tests the plugins as a site owner installs them. It does not use
an mu-plugin to require WConvert during the request.

## Result

The current WordPress 6.2 claim is false for the packaged dependency. Normal
activation fails before WConvert can become active. WordPress 6.8 is the lowest
version supported by the bundled Action Scheduler 4.1.0 metadata, and normal
activation, WConvert admin boot and a post-editor authoring smoke check passed on
6.8. Current WordPress 7.1.1 passed the same activation and admin checks.

The evidence supports WordPress 6.8 as the candidate floor for this package. It
does not support changing metadata as part of this review without the separate
release decision requested in the follow-up plan.

## Dependency provenance

`composer.json` requires `woocommerce/action-scheduler: ^4.1`. `composer.lock`
resolves it to Action Scheduler 4.1.0 from source commit
`40a3df93a251590c58717b91b1049a13410e2ac4`, released 5 August 2026. The bundled
entry file identifies itself as version 4.1.0 and declares `Requires at least:
6.8` and `Tested up to: 7.0`.

WConvert loads that entry file directly from `wconvert.php` before
`WConvert\Bootstrap::init()`. Action Scheduler is therefore runtime code in the
Free package even though WordPress does not list it as a separate plugin. Its own
nested plugin header does not block WConvert activation. Its code can still fail
on an older WordPress, which is what the 6.2 test showed.

## Normal activation evidence

Each run used a fresh disposable WordPress Playground, PHP 8.1, one worker and
the source Free and Pro directories mounted as separate plugins. Activation used
the **Plugins > Installed Plugins** screen in this order: WConvert, then WConvert
Pro. The admin and editor requests ran after activation in later browser requests.

| WordPress | Activation | Admin boot | Authoring smoke |
|---|---|---|---|
| 6.2 | Failed. WConvert remained inactive. WordPress reported `Call to undefined function wp_is_serving_rest_request()` from `ActionScheduler_RecurringActionScheduler.php:29`. | Not possible after the failed activation. | Not possible after the failed activation. |
| 6.8 | Free and Pro both became active. | `admin.php?page=wconvert` rendered the Campaigns UI. The Action Scheduler menu was present under Tools. | `post-new.php` loaded. The inserter contained **WConvert Lock from here** and **WConvert Content lock**. Inserting the divider selected it and exposed the Campaign picker and **Refresh Campaigns** in Block settings. |
| 7.1.1, Playground `latest` on 20 September 2026 | Free and Pro both became active. | `admin.php?page=wconvert` rendered the Campaigns UI. The Action Scheduler menu was present under Tools. | `post-new.php` loaded and exposed both Content lock blocks. Inserting the divider exposed its Campaign picker. |

The 6.2 fatal comes from this Action Scheduler branch:

```php
if (is_admin() && ! wp_doing_ajax() && ! wp_is_serving_rest_request()) {
```

The historical 6.5 note in ADR 0100 describes the version boundary for that
specific missing function. It is not the current dependency's supported floor.
Making that function available or adding a local guard would only remove the
observed fatal. It would not establish support for Action Scheduler 4.1.0 below
the 6.8 floor declared by its maintainers.

## Reproduction

From the repository root, start the 6.2 site on its own port:

```bash
npx @wp-playground/cli server --workers=1 --port=9425 \
  --php=8.1 --wp=6.2 --login \
  --mount "$PWD:/wordpress/wp-content/plugins/wconvert" \
  --mount "$PWD/pro:/wordpress/wp-content/plugins/wconvert-pro"
```

Open `http://127.0.0.1:9425/wp-admin/plugins.php`, sign in to the disposable
site with `admin` / `password`, and activate WConvert. WordPress displays the
fatal and leaves the plugin inactive.

Repeat on port 9426 with `--wp=6.8`, then with `--wp=latest`. Activate WConvert
and WConvert Pro from the plugin screen. Open `admin.php?page=wconvert` and
`post-new.php`. The 6.8 and current results above are visible without a bootstrap
harness or manual `require`.

## Resolution proposal

For the next release decision, align Free, Pro and WordPress.org metadata to a
minimum of WordPress 6.8, then keep the existing PHP 8.1 floor. Update the README
explanation and ADR 0100 at the same time so documentation no longer presents
6.2 or the historical 6.5 runtime boundary as supported.

Also add a packaging check that compares the bundled Action Scheduler `Requires
at least` header with WConvert's declared WordPress minimum. The open Composer
constraint can resolve to a later 4.x release with a newer WordPress floor, so
the check should inspect the locked, packaged dependency on every update.

Do not downgrade Action Scheduler or add a one-function compatibility shim only
to preserve the 6.2 label. A downgrade would need an explicit supported release,
queue and migration verification, and security review. A shim would contradict
the dependency's declared support and would leave other older-core behavior
unproven.

## Limits

This review established normal activation, WConvert admin boot and a small
block-editor smoke check. It did not repeat the full content-lock browser suite,
physical-phone checks, screen-reader testing or human author sessions. The
existing automated content-lock browser coverage and the separate browser QA
report cover deeper workflows on newer WordPress versions; neither broadens the
minimum-version claim by itself.
