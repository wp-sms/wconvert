<?php

namespace WConvert\Exception;

use RuntimeException;

defined('ABSPATH') || exit;

/**
 * Thrown when the container is asked for a service nothing registered.
 *
 * @since 0.1.0
 */
final class ServiceNotFoundException extends RuntimeException
{
}
