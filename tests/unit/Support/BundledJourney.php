<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Goal\Goal;
use WConvert\Privacy\PrivacyGuidance;

/**
 * A bundled journey design as a list-Goal campaign holds it. The library ships
 * every consent hidden, and Privacy Guidance reveals it at prefill (ADR 0099),
 * so a test about capturing consent starts from the revealed design.
 */
final class BundledJourney
{
    /** @return array<string, mixed> */
    public static function design(string $id): array
    {
        $design = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/' . $id . '.json'), true);
        $design['tree'] = self::revealed($design['tree']);
        return $design;
    }

    /** @return array<string, mixed> */
    public static function tree(string $id): array
    {
        return self::design($id)['tree'];
    }

    /**
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    public static function revealed(array $tree): array
    {
        return (new PrivacyGuidance(new FakeOptionStore()))->treeFor($tree, Goal::GrowEmailList);
    }
}
