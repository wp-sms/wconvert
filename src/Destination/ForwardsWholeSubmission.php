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
 * [[Optin]] behind it: it maps fields into a vendor's and forwards neither the
 * campaign's questions nor its name, so a campaign has nothing of its own for
 * that test to carry (ADR 0148).
 *
 * @since 0.1.0
 */
interface ForwardsWholeSubmission
{
}
