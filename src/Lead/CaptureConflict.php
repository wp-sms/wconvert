<?php
namespace WConvert\Lead;
defined('ABSPATH') || exit;
/** A request cannot alter an already accepted or erased capture. */
final class CaptureConflict extends \RuntimeException {}
