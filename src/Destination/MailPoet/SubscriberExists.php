<?php

namespace WConvert\Destination\MailPoet;

defined('ABSPATH') || exit;

/**
 * MailPoet already holds a subscriber with this address.
 *
 * **An ordinary outcome, not an error.** It is what a retry of a
 * partially-completed push walks into, and what a second writer landing the
 * row between our read and our write looks like — and both take the same
 * answer: the subscriber this Lead was going to become already exists, so the
 * push finishes by adding the list rather than by creating anything
 * ({@see MailPoetDestinationType::create()}).
 *
 * The sibling of {@see \WConvert\Destination\Wsms\ContactConflict}, and named
 * for MailPoet's own `APIException::SUBSCRIBER_EXISTS` rather than for the
 * word "conflict": MailPoet has one identifier and one index, so there is no
 * both-identifiers case here and nothing to call ambiguous.
 *
 * @since 0.1.0
 */
final class SubscriberExists extends \RuntimeException
{
}
