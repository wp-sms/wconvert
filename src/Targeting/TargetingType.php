<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * The closed vocabulary of page-set targeting rules.
 *
 * This enum is the hand-written duplicate of the rule manifest's `targeting`
 * section that ADR 0005 allows itself — "the evaluator switch is the only
 * hand-written duplicate, and a test asserts parity". That test is
 * {@see \WConvert\Tests\Unit\Targeting\RuleManifestParityTest}.
 *
 * @since 0.1.0
 */
enum TargetingType: string
{
    case Post = 'post';
    case Singular = 'singular';
    case Archive = 'archive';
    case Term = 'term';
    case Url = 'url';
}
