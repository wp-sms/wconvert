<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * Everything a [[Destination]] type needs to push one [[Lead]] that is not the
 * Lead — its configuration, its credentials, and the [[Optin]]'s name.
 *
 * **This is what makes the type stateless.** WSMS's integration object *is*
 * the configured instance — `isConnected()` reads an option — and WConvert
 * cannot copy that, because two Mailchimp audiences are two Destinations over
 * one [[Connection]] and a stateful type could only ever be one of them. So
 * configuration is passed per call and the type holds none (#4).
 *
 * **`optinName` rides along rather than being looked up**, because the WSMS
 * push sets `source_ref` to the Optin's NAME at push time: WSMS can never
 * resolve a WConvert ULID — it never calls into WConvert — so an id there is
 * permanently unreadable text (ADR 0023). It is a snapshot in the same sense
 * `playbook_id` and the consent sentence are.
 *
 * It is **nullable**, and null is not the same as empty. An Optin is never
 * hard-deleted, so a missing name means a row was removed that nothing should
 * remove — and writing `source_ref = ''` there would assert provenance that
 * does not exist, where leaving the column unset says so honestly.
 *
 * `credentials` is empty for a Destination whose type has no Connection. The
 * WSMS push authenticates against nothing: it is an in-process PHP call.
 *
 * @since 0.1.0
 */
final class PushContext
{
    /**
     * @param array<string, mixed> $settings    The Destination's own configuration, including whatever selects the target.
     * @param array<string, mixed> $credentials The Connection underneath it, or `[]` where the type has none.
     */
    public function __construct(
        public readonly ?string $optinName,
        public readonly array $settings = [],
        public readonly array $credentials = [],
    ) {
    }
}
