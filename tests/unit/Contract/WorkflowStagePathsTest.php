<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Every staged tree a workflow reads is one bin/build.sh actually writes.
 *
 * build.sh moved its stage under `dist/stage/plain/` and the workflows kept
 * naming `dist/stage/wconvert`. Nothing failed locally — the drift job reported
 * "unreadable" every week (#144), and release-free.yml would have failed its
 * upload on the first real release. A path in YAML is invisible to every other
 * test, so this one reads both files and holds them to each other.
 */
#[CoversNothing]
final class WorkflowStagePathsTest extends TestCase
{
    private const REPO = __DIR__ . '/../../..';

    public function testEveryWorkflowStagePathIsUnderTheDirectoryBuildShStagesTo(): void
    {
        $prefix = self::stagePrefix();
        $checked = 0;

        foreach (glob(self::REPO . '/.github/workflows/*.{yml,yaml}', GLOB_BRACE) ?: [] as $workflow) {
            $yaml = file_get_contents($workflow);
            self::assertIsString($yaml);
            preg_match_all('#dist/stage/[\w./*-]*#', $yaml, $found);
            foreach ($found[0] as $path) {
                $checked++;
                self::assertStringStartsWith(
                    $prefix,
                    $path,
                    basename($workflow) . " names $path, but bin/build.sh stages to $prefix<slug>",
                );
            }
        }

        // A rename that drops every path would otherwise pass with nothing checked.
        self::assertGreaterThan(0, $checked, 'No workflow names a dist/stage/ path any more');
    }

    /**
     * `dist/stage/plain/`, read out of build.sh rather than restated here.
     *
     * @return non-empty-string
     */
    private static function stagePrefix(): string
    {
        $script = file_get_contents(self::REPO . '/bin/build.sh');
        self::assertIsString($script);
        self::assertMatchesRegularExpression('#^STAGE_ROOT="\$DIST/stage"$#m', $script);
        if (preg_match('#local stage="\$STAGE_ROOT/([\w-]+)/\$slug"#', $script, $match) !== 1) {
            self::fail('bin/build.sh no longer names its stage as $STAGE_ROOT/<dir>/$slug');
        }

        return 'dist/stage/' . $match[1] . '/';
    }
}
