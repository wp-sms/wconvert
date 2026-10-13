<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * A [[Destination]] type that forwards each submission whole —
 * {@see PushSubject::$details} and the campaign it came from — rather than
 * mapping fields into a vendor's.
 *
 * It is what lets a campaign editor's test carry that campaign's own questions
 * and name ({@see PushDispatcher::test()}). Every other type is tested with no
 * [[Optin]] behind it, because the WSMS push would write a test's campaign name
 * as `source_ref` (ADR 0023, ADR 0148).
 *
 * @since 0.1.0
 */
interface ForwardsWholeSubmission
{
}
