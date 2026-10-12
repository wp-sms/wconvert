<?php

namespace WConvert\Pro\License;

defined('ABSPATH') || exit;

/**
 * Only somebody who may manage the licence can finish an account sign-in.
 *
 * The SDK completes a sign-in on `admin_init` for whoever arrives with the
 * return parameters, and `admin_init` also runs for a logged-out request to
 * admin-ajax.php or admin-post.php. A made-up return writes a failed sign-in
 * into the licence option, where it hides the reason for an administrator's own
 * next failed one (veronalabs/wp-premium-sdk#28). So the parameters are dropped
 * one priority earlier, for everybody else — a port of WSMS's
 * `ignoreSignInReturnFromOthers`.
 *
 * @since 0.1.0
 */
final class SignInGuard
{
    /** @param list<string> $returnParams The SDK's `oauth_callback_params`. */
    public function __construct(private readonly array $returnParams)
    {
    }

    public function hooks(): void
    {
        // 9: before the SDK's own handler at the default 10.
        add_action('admin_init', [$this, 'ignoreReturnFromOthers'], 9);
    }

    public function ignoreReturnFromOthers(): void
    {
        if (current_user_can('manage_options')) {
            return;
        }

        foreach ($this->returnParams as $param) {
            unset($_GET[$param], $_REQUEST[$param]);
        }
    }
}
