<?php
/** PHP development server router, loopback only. */
$site = rtrim((string) getenv('WCONVERT_DEMO_SITE'), '/');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path !== '/' && is_file($site . $path)) return false;
require $site . '/index.php';
