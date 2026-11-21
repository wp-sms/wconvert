<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * The Optin row was written, but the published set could not be (#424).
 *
 * The two are separate sources of truth: the editor reads the row, visitors
 * are served from the set. Without this the row said "live" while the site
 * kept serving the old set, and nothing reported it. A utf8mb3 `wp_options`
 * table refusing an emoji is the case that happened, which ADR 0192 removed;
 * this is what stays to report any refusal left.
 *
 * Thrown rather than returned because the four operations that rebuild on a
 * merchant's request already answer with the Optin or a bool, and the REST
 * layer is the only place with someone to tell.
 *
 * @since 0.1.0
 */
final class PublishedSetNotSaved extends \RuntimeException
{
}
