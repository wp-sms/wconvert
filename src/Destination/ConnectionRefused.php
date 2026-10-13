<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * A [[Connection]] refused for a reason the merchant can act on, **in words
 * written for them.**
 *
 * {@see DestinationType::testConnection()} throws, and the save route shows a
 * fixed sentence for any throw, because a vendor's own error text is not
 * written for a merchant and may quote their key back. A type that refuses
 * before reaching any vendor — a webhook URL on a private network — already
 * knows the one sentence that helps, so it throws this and the sentence is
 * shown as it is.
 *
 * @since 0.1.0
 */
final class ConnectionRefused extends \RuntimeException
{
}
