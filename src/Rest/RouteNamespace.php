<?php

namespace WConvert\Rest;

defined('ABSPATH') || exit;

/**
 * Where `Routes::NAMESPACE` is declared, and it is a file of its own for PHP 8.6.
 *
 * PHP 8.6 deprecates DECLARING a class constant called `namespace`; reading one
 * is unaffected. The name cannot simply change: every published Pro reads
 * `Routes::NAMESPACE` from whichever free is installed, so renaming it would
 * fatal the REST API on a site that updates free before Pro. The notice is
 * raised when the file is compiled, so {@see Routes} includes this one file
 * silenced. Nothing else belongs here, or its errors are silenced too.
 *
 * Remove it once no supported Pro reads the old name.
 */
interface RouteNamespace
{
    public const NAMESPACE = 'wconvert/v1';
}
