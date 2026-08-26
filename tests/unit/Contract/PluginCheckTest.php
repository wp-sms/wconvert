<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * Reading what wp.org's own checker wrote, and deciding what the pin is
 * holding back.
 *
 * bin/plugin-check.sh needs Docker and a real WordPress, so it is not what
 * these tests run. What they run is the half that DECIDES — the parse, the
 * error/warning split, and the drift comparison — because that half is where a
 * mistake is silent. A checker that will not start is a red run somebody
 * investigates; a parse that reads "no findings" out of a result full of them
 * is a green release.
 *
 * ============================================================================
 * THE FORMAT IS THE THING UNDER TEST.
 * ============================================================================
 * Plugin Check's `--format=json` does not emit JSON — it emits a `FILE: <name>`
 * line before each file's array, so a plugin with findings in two files
 * produces something no parser reads, and a clean plugin produces no brackets
 * at all. Both arrive at a naive reader as "unparseable", which for a gate that
 * blocks on failure means every release is blocked and every clean run looks
 * broken.
 *
 * That was the first version of this code, and it took a run against a real
 * staged tree to find. The test that would have caught it is
 * {@see self::testTheFormatThatGroupsByFileIsNotWhatIsAskedFor()}.
 */
#[CoversNothing]
final class PluginCheckTest extends TestCase
{
    private const BIN = __DIR__ . '/../../../bin';

    /** @var list<string> */
    private array $files = [];

    protected function tearDown(): void
    {
        foreach ($this->files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }

        $this->files = [];
    }

    private function resultFile(string $contents): string
    {
        $path = sys_get_temp_dir() . '/wconvert-plugin-check-' . bin2hex(random_bytes(6)) . '.json';
        file_put_contents($path, $contents);
        $this->files[] = $path;

        return $path;
    }

    /**
     * One finding, as `wp plugin check --format=strict-json --fields=…` emits it.
     */
    private static function finding(string $type, string $code, string $file = 'src/Thing.php'): string
    {
        return (string) json_encode([
            'file' => $file,
            'line' => 12,
            'column' => 4,
            'type' => $type,
            'code' => $code,
            'message' => 'Something to act on',
        ]);
    }

    /**
     * @return array{status: int, output: string}
     */
    private function readWith(string $php): array
    {
        $output = [];
        $status = 0;

        exec(
            sprintf(
                'php -r %s %s 2>&1',
                escapeshellarg($php),
                escapeshellarg(self::BIN . '/plugin-check-results.php')
            ),
            $output,
            $status
        );

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    /**
     * How many findings the shared reader sees in a file, or `null` when it
     * could not read it at all.
     */
    private function findingCount(string $path): ?int
    {
        $result = $this->readWith(sprintf(
            'require $argv[1]; $f = pluginCheckFindings(%s); echo $f === null ? "null" : count($f);',
            var_export($path, true)
        ));

        $this->assertSame(0, $result['status'], $result['output']);

        return $result['output'] === 'null' ? null : (int) $result['output'];
    }

    public function testItReadsAFlatArrayOfFindings(): void
    {
        $path = $this->resultFile('[' . self::finding('ERROR', 'a') . ',' . self::finding('WARNING', 'b') . ']');

        $this->assertSame(2, $this->findingCount($path));
    }

    /**
     * ========================================================================
     * AN EMPTY RESULT IS A CLEAN PLUGIN, NOT AN UNREADABLE ONE.
     * ========================================================================
     * `[]` and `null` are different answers and the whole gate turns on the
     * difference: `[]` is a plugin with nothing wrong, and `null` is a checker
     * whose output could not be read. Collapsing them makes a clean release
     * fail as "produced no readable result", which reads like a broken gate and
     * gets the gate turned off.
     */
    public function testAnEmptyResultIsNoFindingsRatherThanNoResult(): void
    {
        $this->assertSame(0, $this->findingCount($this->resultFile('[]')));
    }

    /**
     * wp-env wraps every command it runs in a preamble AND a trailing
     * "✔ Ran ..." line, so "everything from the first bracket onward" leaves
     * the postamble attached and never parses.
     */
    public function testItReadsThroughWpEnvsPreambleAndPostamble(): void
    {
        $path = $this->resultFile(
            "ℹ Starting 'wp plugin check wconvert' on the cli container.\n\n"
            . '[' . self::finding('ERROR', 'a') . "]\n"
            . "✔ Ran `wp plugin check wconvert` in 'cli'. (in 12s 269ms)\n"
        );

        $this->assertSame(1, $this->findingCount($path));
    }

    /**
     * ========================================================================
     * THE BUG THIS FILE EXISTS FOR.
     * ========================================================================
     * `--format=json` groups by file behind `FILE:` lines. Two files therefore
     * produce two arrays with prose between them, and the outermost `[ … ]`
     * span contains that prose. It must NOT parse — if it ever silently did,
     * the reader would be picking some arbitrary subset of the findings and
     * calling it the result.
     *
     * Asserting the failure is what keeps `strict-json` from being quietly
     * changed back to `json` by somebody who tries it on a plugin with findings
     * in exactly one file and sees it work.
     */
    public function testTheFormatThatGroupsByFileIsNotWhatIsAskedFor(): void
    {
        $path = $this->resultFile(
            "FILE: src/One.php\n[" . self::finding('ERROR', 'a', 'src/One.php') . "]\n\n"
            . "FILE: src/Two.php\n[" . self::finding('ERROR', 'b', 'src/Two.php') . "]\n"
        );

        $this->assertNull($this->findingCount($path), 'the grouped format must not be read as findings');
    }

    public function testAResultFileThatIsNotThereIsNotAnEmptyResult(): void
    {
        $this->assertNull($this->findingCount(sys_get_temp_dir() . '/wconvert-no-such-result.json'));
    }

    public function testATruncatedResultIsNotAnEmptyResult(): void
    {
        $this->assertNull($this->findingCount($this->resultFile('[{"file":"src/Thing.php","li')));
    }

    /**
     * ERROR blocks; everything else is reported and passes. Plugin Check also
     * emits an `OTHER` type below a severity threshold, and it belongs with the
     * warnings — a gate that blocks on everything is a gate somebody turns off.
     */
    public function testOnlyErrorsBlock(): void
    {
        $path = $this->resultFile('[' . implode(',', [
            self::finding('ERROR', 'a'),
            self::finding('WARNING', 'b'),
            self::finding('OTHER', 'c'),
        ]) . ']');

        $result = $this->readWith(sprintf(
            'require $argv[1]; $f = pluginCheckFindings(%s); '
            . 'echo count(array_filter($f, "pluginCheckIsError"));',
            var_export($path, true)
        ));

        $this->assertSame('1', $result['output']);
    }

    /**
     * A finding nobody can locate is a finding nobody can act on. `file` is in
     * Plugin Check's data but NOT in its default field list, so it only arrives
     * because `--fields=` asks for it.
     */
    public function testTheFieldsAskedForIncludeTheFileAFindingIsIn(): void
    {
        $result = $this->readWith('require $argv[1]; echo PLUGIN_CHECK_FIELDS;');

        $this->assertStringContainsString('file', $result['output']);
        $this->assertSame('strict-json', $this->readWith('require $argv[1]; echo PLUGIN_CHECK_FORMAT;')['output']);
    }

    // =========================================================================
    // THE DRIFT COMPARISON — what the pin is holding back.
    // =========================================================================

    /**
     * @return array{status: int, output: string}
     */
    private function drift(string $pinned, string $latest): array
    {
        $output = [];
        $status = 0;

        exec(
            sprintf(
                'php %s %s %s 2.1.0 2>&1',
                escapeshellarg(self::BIN . '/plugin-check-drift.php'),
                escapeshellarg($this->resultFile($pinned)),
                escapeshellarg($this->resultFile($latest))
            ),
            $output,
            $status
        );

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testNoDriftWhenBothCheckersFindTheSameCodes(): void
    {
        $findings = '[' . self::finding('WARNING', 'WordPress.Security.EscapeOutput') . ']';

        $result = $this->drift($findings, $findings);

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('still current enough', $result['output']);
    }

    /**
     * **The comparison is by CODE, not by whole finding.** Everything else in a
     * finding — file, line, column — moves when the source moves, so comparing
     * whole findings would report drift every week anybody edited a file, and a
     * weekly job that cries drift every week is one nobody opens.
     */
    public function testAFindingThatMovedIsNotDrift(): void
    {
        $pinned = '[' . self::finding('WARNING', 'same.code', 'src/One.php') . ']';
        $latest = '[' . self::finding('WARNING', 'same.code', 'src/Two.php') . ']';

        $result = $this->drift($pinned, $latest);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    public function testACodeOnlyTheLatestReportsIsDrift(): void
    {
        $result = $this->drift(
            '[' . self::finding('WARNING', 'old.code') . ']',
            '[' . self::finding('WARNING', 'old.code') . ',' . self::finding('ERROR', 'brand.new.code') . ']'
        );

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('brand.new.code', $result['output']);
    }

    /**
     * **A pinned error is news too, and it is not drift.** If the PINNED
     * checker fails `main`, the next release is already blocked and nobody has
     * been told — the release gate only runs on a release, so this weekly job
     * is the only thing that would find out.
     */
    public function testAnErrorFromThePinnedCheckerIsReportedEvenWithNoDrift(): void
    {
        $findings = '[' . self::finding('ERROR', 'already.failing') . ']';

        $result = $this->drift($findings, $findings);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('already.failing', $result['output']);
    }

    /**
     * A run that did not happen is not a clean week. The workflow lets both
     * checker runs fail on purpose, so a result file may be absent or
     * truncated — and reporting that as "no drift" is how this job would go
     * quiet for months without anybody noticing it had stopped working.
     */
    public function testAnUnreadableRunIsReportedRatherThanPassedOver(): void
    {
        $result = $this->drift('not json at all', '[' . self::finding('WARNING', 'x') . ']');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('no comparison was made', $result['output']);
    }
}
