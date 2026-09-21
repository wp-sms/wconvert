<?php

namespace WConvert\Database;

defined('ABSPATH') || exit;

/** A database operation failed; details stay inside WordPress's database layer. */
final class DatabaseException extends \RuntimeException
{
}
