<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * bin/check-loader.mjs, against fixture trees.
 *
 * The second of ADR 0029's three programs, and the one exception to "no build
 * on a pull request" — both of its assertions are about build output, which is
 * the premise that exception lacks.
 *
 * As with the source contract, the property worth testing is that it FAILS
 * CLOSED: a bundle it cannot read, an empty bundle and an unreadable manifest
 * each have to fail, because "couldn't look" reading as "clean" is how a leak
 * ships the one time a build is incomplete. A happy-path test misses every one
 * of them.
 */
#[CoversNothing]
final class LoaderContractTest extends TestCase
{
    private const SCRIPT = __DIR__ . '/../../../bin/check-loader.mjs';

    private string $tree = '';

    protected function tearDown(): void
    {
        if ($this->tree !== '' && is_dir($this->tree)) {
            self::removeTree($this->tree);
        }
    }

    private static function removeTree(string $directory): void
    {
        $entries = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($entries as $entry) {
            /** @var \SplFileInfo $entry */
            $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        }

        rmdir($directory);
    }

    /**
     * @param array<string, string|null> $files Path relative to the tree => contents, or null to omit.
     */
    private function tree(array $files): string
    {
        $this->tree = sys_get_temp_dir() . '/wconvert-check-loader-' . bin2hex(random_bytes(6));

        foreach ($files as $relative => $contents) {
            if ($contents === null) {
                continue;
            }

            $path = $this->tree . '/' . $relative;
            @mkdir(dirname($path), 0777, true);
            file_put_contents($path, $contents);
        }

        return $this->tree;
    }

    /**
     * @param array<string, mixed> $manifest
     */
    private static function manifest(array $manifest): string
    {
        return (string) json_encode($manifest);
    }

    /**
     * @return array<string, mixed>
     */
    private static function freeOnlyManifest(): array
    {
        return ['targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']]];
    }

    /**
     * A rule vocabulary with a free entry and two premium ones.
     *
     * @return array<string, mixed>
     */
    private static function premiumManifest(): array
    {
        return [
            'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
            'triggers' => ['exit_intent' => ['kind' => 'trigger', 'tier' => 'pro']],
            'conditions' => ['cart_has_items' => ['kind' => 'condition', 'tier' => 'pro']],
        ];
    }

    /**
     * A tree with both bundles, the rule manifest and the module manifests,
     * each overridable.
     *
     * The trees are complete by default and each test poisons exactly the one
     * thing it is about: a fixture missing something the program inspects is
     * a fixture the program fails CLOSED on, which would read as "the check
     * works" for every test in this file at once.
     *
     * @param array<string, string|null> $overrides
     */
    private function loaderTree(array $overrides = []): string
    {
        return $this->tree([
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            // A module may declare a marker — a token its built JavaScript
            // carries — for when its contribution is not a rule type the
            // identifier scan could look for. `ab-testing` is the first.
            'pro/modules/display-types/module.json' => '{"slug":"display-types"}',
            'pro/modules/premium-triggers/module.json' =>
                '{"slug":"premium-triggers","bundle_marker":".aTokenOnlyProShips"}',
            'pro/modules/cart-recovery/module.json' => '{"slug":"cart-recovery"}',
            ...$overrides,
        ]);
    }

    /**
     * @return array{status: int, output: string}
     */
    private function check(string $tree): array
    {
        $output = [];
        $status = 0;

        exec(sprintf('node %s %s 2>&1', escapeshellarg(self::SCRIPT), escapeshellarg($tree)), $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testPassesOnATreeWhoseBundlesAreSmallAndWhoseFreeLoaderCarriesNoPremiumRule(): void
    {
        $result = $this->check($this->loaderTree([
            'resources/rules/manifest.json' => self::manifest(self::premiumManifest()),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * ========================================================================
     * THE SAME LEAK FOR A MODULE THAT SHIPS NO RULE TYPE AT ALL.
     * ========================================================================
     * The identifier scan reads its list out of the rule manifest, so a module
     * whose contribution is not a rule has nothing there to look for — and
     * free's bundle carrying that module's whole implementation would pass
     * every other check in this program. So the module declares a token of its
     * own and this is what proves the token is read.
     */
    public function testFailsWhenFreesLoaderCarriesAModuleMarker(): void
    {
        $result = $this->check($this->loaderTree([
            'public/loader/loader.js' => 'var x=e.aTokenOnlyProShips;',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('.aTokenOnlyProShips', $result['output']);
    }

    /**
     * Pro's loader IS the premium code, so it may carry every marker and every
     * premium identifier. Without this half a program that failed every Pro
     * bundle unconditionally would pass the tests above.
     */
    public function testProsLoaderMayCarryEveryPremiumIdentifierAndMarker(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/public/loader/loader.js' => 'var rules={exit_intent:1,cart_has_items:1},x=e.aTokenOnlyProShips;',
            'resources/rules/manifest.json' => self::manifest(self::premiumManifest()),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * ========================================================================
     * A MODULE NOTHING LOOKED FOR IS NAMED, NOT PASSED OVER.
     * ========================================================================
     * The marker list is what a module DECLARES, so a module that declares
     * none is one this scan cannot see — and a tick printed beside a scan that
     * skipped three of them reports "clean" while asserting less than it says,
     * which is the failure ADR 0029 is about.
     */
    public function testItNamesTheModulesItDidNotScanFor(): void
    {
        $result = $this->check($this->loaderTree());

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString(
            'declare no marker and were not scanned for',
            $result['output']
        );
        $this->assertStringContainsString('display-types', $result['output']);
    }

    /**
     * And it fails CLOSED on a tree whose module manifests it cannot read —
     * "couldn't look" reading as "clean" is how a leak ships the one time a
     * build is incomplete (ADR 0029).
     */
    public function testFailsWhenTheModuleManifestsCannotBeRead(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/modules/display-types/module.json' => null,
            'pro/modules/premium-triggers/module.json' => null,
            'pro/modules/cart-recovery/module.json' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('marker scan inspected nothing', $result['output']);
    }

    /**
     * The leak this exists to catch: free's loader carrying a rule type the
     * manifest files as premium — every premium entry, not just one.
     */
    public function testFailsWhenFreesLoaderCarriesAPremiumIdentifier(): void
    {
        foreach (['exit_intent', 'cart_has_items'] as $identifier) {
            $result = $this->check($this->loaderTree([
                'public/loader/loader.js' => sprintf('var rules={%s:1};', $identifier),
                'resources/rules/manifest.json' => self::manifest(self::premiumManifest()),
            ]));

            $this->assertSame(1, $result['status'], $result['output']);
            $this->assertStringContainsString($identifier, $result['output']);
        }
    }

    /**
     * An empty premium list scans for nothing, and the program says so rather
     * than printing a tick it did not earn.
     */
    public function testAManifestWithNothingPremiumIsToldSo(): void
    {
        $result = $this->check($this->loaderTree());

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('asserted nothing', $result['output']);
    }

    public function testFailsWhenABundleExceedsTheByteBudget(): void
    {
        // Random bytes, because gzip -9 would flatten a repeated string to
        // nothing and the budget is measured after compression.
        $result = $this->check($this->loaderTree([
            'public/loader/loader.js' => base64_encode(random_bytes(24576)),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('14896', $result['output']);
    }

    public function testFailsWhenProsBundleExceedsItsByteBudget(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/public/loader/loader.js' => base64_encode(random_bytes(40960)),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('28160', $result['output']);
    }

    /**
     * @return iterable<string, array{array<string, string|null>}>
     */
    public static function treesThatCannotBeInspected(): iterable
    {
        yield 'free bundle missing' => [['public/loader/loader.js' => null]];

        yield 'pro bundle missing' => [['pro/public/loader/loader.js' => null]];

        yield 'bundle present but empty' => [['public/loader/loader.js' => '']];

        yield 'manifest missing' => [['resources/rules/manifest.json' => null]];

        yield 'manifest unparseable' => [['resources/rules/manifest.json' => '{ not json']];

        yield 'manifest declares no axes' => [['resources/rules/manifest.json' => '{}']];
    }

    /**
     * @param array<string, string|null> $files
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('treesThatCannotBeInspected')]
    public function testATreeItCannotInspectFails(array $files): void
    {
        $result = $this->check($this->loaderTree($files));

        $this->assertSame(1, $result['status'], $result['output']);
    }
}
