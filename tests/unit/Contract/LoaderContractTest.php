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
     * A rule vocabulary with one entry at each rung of the ladder.
     *
     * @return array<string, mixed>
     */
    private static function ladderManifest(): array
    {
        return [
            'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
            'triggers' => [
                'exit_intent' => ['kind' => 'trigger', 'tier' => 'pro'],
                'a_bar' => ['kind' => 'trigger', 'tier' => 'basic'],
            ],
            'conditions' => ['cart_has_items' => ['kind' => 'condition', 'tier' => 'elite']],
        ];
    }

    /** The tier ladder, as `tiers.json` declares it. */
    private static function tiers(): string
    {
        return (string) json_encode([
            'premium' => [
                'tiers' => [
                    ['slug' => 'basic', 'name' => 'Pro', 'modules' => ['display-types']],
                    ['slug' => 'pro', 'name' => 'Pro', 'modules' => ['display-types', 'premium-triggers']],
                    // Named rather than `'*'`, because there IS no wildcard:
                    // against one the artifact contract's completeness half
                    // asserts nothing, and the top rung — the one every
                    // customer buys — would be the only rung with no check
                    // (ADR 0056). A fixture that spelled a ladder the product
                    // forbids was a fixture asserting the wrong thing.
                    [
                        'slug' => 'elite',
                        'name' => 'Pro',
                        'modules' => ['display-types', 'premium-triggers', 'cart-recovery'],
                    ],
                ],
            ],
        ]);
    }

    /**
     * A tree with all four bundles and both manifests, each overridable.
     *
     * ========================================================================
     * FOUR BUNDLES, BECAUSE THERE ARE FOUR (ADR 0056).
     * ========================================================================
     * These fixtures named two while Pro was one build, and a fixture that is
     * missing a bundle the program checks is a fixture the program fails
     * closed on — which would have read as "the new check works" for every
     * test in this file at once. So the trees are complete by default and each
     * test poisons exactly the one thing it is about.
     *
     * @param array<string, string|null> $overrides
     */
    private function loaderTree(array $overrides = []): string
    {
        return $this->tree([
            'tiers.json' => self::tiers(),
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/tiers/basic/loader/loader.js' => 'console.log("basic");',
            'pro/public/tiers/pro/loader/loader.js' => 'console.log("pro");',
            'pro/public/loader/loader.js' => 'console.log("elite");',
            // ================================================================
            // AND THE MODULE MANIFESTS, BECAUSE A MODULE MAY DECLARE A MARKER.
            // ================================================================
            // The identifier scan reads its list out of the RULE manifest, so
            // it can only see a module whose contribution is a rule. A module
            // that ships loader code and declares no rule type — `ab-testing`
            // is the first — declares a token instead, in its own
            // `module.json`, and the same scan runs over that (ADR 0056).
            //
            // The tree carries them by default for the reason it carries four
            // bundles: a fixture missing what the program inspects is a
            // fixture the program fails CLOSED on, which would read as "the
            // check works" for every test in this file at once.
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

    public function testPassesOnATreeWhoseBundlesAreSmallAndCarryNoHigherRungsRules(): void
    {
        $result = $this->check($this->loaderTree([
            'resources/rules/manifest.json' => self::manifest(self::ladderManifest()),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * ========================================================================
     * THE SAME LEAK FOR A MODULE THAT SHIPS NO RULE TYPE AT ALL.
     * ========================================================================
     * The identifier scan reads its list out of the rule manifest, so a module
     * whose contribution is not a rule has nothing there to look for — and a
     * Basic bundle carrying that module's whole implementation would pass
     * every other check in this program. That is the byte-identical
     * JavaScript ADR 0056 measures WSMS by, reached through a gap in the scan
     * rather than through a flag, so the module declares a token of its own
     * and this is what proves the token is read.
     */
    public function testFailsWhenALowerRungsBundleCarriesAHigherRungsModuleMarker(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/public/tiers/basic/loader/loader.js' => 'var x=e.aTokenOnlyProShips;',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('.aTokenOnlyProShips', $result['output']);
    }

    /** And a bundle at or above the rung that ships it may carry it. */
    public function testARungMayCarryTheMarkerOfAModuleItShips(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/public/tiers/pro/loader/loader.js' => 'var x=e.aTokenOnlyProShips;',
            'pro/public/loader/loader.js' => 'var x=e.aTokenOnlyProShips;',
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
     * which is the failure this ADR is about. It is also what would hide the
     * next module to ship loader code and no rule type, exactly as
     * `ab-testing` was hidden until it was looked for.
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
     * manifest files at a paid rung.
     */
    public function testFailsWhenFreesLoaderCarriesAPremiumIdentifier(): void
    {
        $result = $this->check($this->loaderTree([
            'public/loader/loader.js' => 'var rules={exit_intent:1};',
            'resources/rules/manifest.json' => self::manifest(self::ladderManifest()),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('exit_intent', $result['output']);
    }

    /**
     * ========================================================================
     * AND FREE IS SCANNED FOR EVERY RUNG, NOT FOR ONE WORD.
     * ========================================================================
     * This program read `entry.tier === 'pro'`, which was right while `pro`
     * was the only paid word. Under the ladder (ADR 0056) it silently stopped
     * looking for anything filed at `basic` or `elite` — the check would have
     * gone on printing a tick while asserting less than it said, which is the
     * exact shape ADR 0029 exists to refuse.
     */
    public function testFailsForAnIdentifierAtEveryPaidRungAndNotJustTheMiddleOne(): void
    {
        foreach (['a_bar' => 'basic', 'cart_has_items' => 'elite'] as $identifier => $rung) {
            $result = $this->check($this->loaderTree([
                'public/loader/loader.js' => sprintf('var rules={%s:1};', $identifier),
                'resources/rules/manifest.json' => self::manifest(self::ladderManifest()),
            ]));

            $this->assertSame(1, $result['status'], sprintf('a %s rule went unscanned: %s', $rung, $result['output']));
            $this->assertStringContainsString($identifier, $result['output']);
        }
    }

    /**
     * ========================================================================
     * A RUNG MAY CARRY ITS OWN RULES AND NEVER A HIGHER RUNG'S.
     * ========================================================================
     * This is the JavaScript half of the per-tier artifact contract, and it is
     * the difference between a tier split and a decoration. WSMS ships a
     * byte-identical `main.js` at all three of its tiers, so a Basic customer
     * holds the Elite UI behind a client-readable flag — under
     * possession-gating that is not a weaker gate, it is no gate (ADR 0056).
     *
     * Both directions are asserted: the rung's OWN identifier is fine, and the
     * one above it is not. Without the first half a program that failed every
     * Pro bundle unconditionally would pass this test.
     */
    public function testAPaidBundleMayCarryItsOwnRungAndNotTheOneAbove(): void
    {
        $manifest = self::manifest(self::ladderManifest());

        $ownRung = $this->check($this->loaderTree([
            'pro/public/tiers/pro/loader/loader.js' => 'var rules={exit_intent:1};',
            'resources/rules/manifest.json' => $manifest,
        ]));

        $this->assertSame(0, $ownRung['status'], $ownRung['output']);

        foreach (['basic', 'pro'] as $rung) {
            $result = $this->check($this->loaderTree([
                "pro/public/tiers/{$rung}/loader/loader.js" => 'var rules={cart_has_items:1};',
                'resources/rules/manifest.json' => $manifest,
            ]));

            $this->assertSame(1, $result['status'], sprintf('%s shipped an elite rule: %s', $rung, $result['output']));
            $this->assertStringContainsString('cart_has_items', $result['output']);
        }
    }

    /**
     * The top rung is supposed to contain every premium identifier — that is
     * what elite is — so nothing is filed above it and the scan says so
     * rather than printing a tick it did not earn.
     */
    public function testTheTopRungCarriesEverythingAndIsToldSo(): void
    {
        $result = $this->check($this->loaderTree([
            'pro/public/loader/loader.js' => 'var rules={exit_intent:1,cart_has_items:1};',
            'resources/rules/manifest.json' => self::manifest(self::ladderManifest()),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('asserted nothing', $result['output']);
    }

    /**
     * A rung the ladder does not declare is a rung whose identifiers would
     * belong to no scan at all — dropped silently rather than looked for.
     */
    public function testFailsWhenTheManifestFilesARuleAtARungTheLadderDoesNotDeclare(): void
    {
        $result = $this->check($this->loaderTree([
            'resources/rules/manifest.json' => self::manifest([
                'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
                'triggers' => ['agency_rules' => ['kind' => 'trigger', 'tier' => 'enterprise']],
            ]),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('enterprise', $result['output']);
    }

    public function testFailsWhenABundleExceedsTheByteBudget(): void
    {
        // Random bytes, because gzip -9 would flatten a repeated string to
        // nothing and the budget is measured after compression.
        $result = $this->check($this->loaderTree([
            'public/loader/loader.js' => base64_encode(random_bytes(24576)),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('14592', $result['output']);
    }

    /**
     * @return iterable<string, array{array<string, string|null>}>
     */
    public static function treesThatCannotBeInspected(): iterable
    {
        yield 'free bundle missing' => [['public/loader/loader.js' => null]];

        // EVERY paid rung, not just the top one. A build that wrote two of the
        // three is the state a half-finished per-tier build leaves behind, and
        // a ZIP is cut from whichever one is there (ADR 0056).
        yield 'basic bundle missing' => [['pro/public/tiers/basic/loader/loader.js' => null]];

        yield 'pro bundle missing' => [['pro/public/tiers/pro/loader/loader.js' => null]];

        yield 'elite bundle missing' => [['pro/public/loader/loader.js' => null]];

        yield 'bundle present but empty' => [['public/loader/loader.js' => '']];

        yield 'manifest missing' => [['resources/rules/manifest.json' => null]];

        yield 'manifest unparseable' => [['resources/rules/manifest.json' => '{ not json']];

        yield 'manifest declares no axes' => [['resources/rules/manifest.json' => '{}']];

        yield 'tier ladder missing' => [['tiers.json' => null]];

        yield 'tier ladder unparseable' => [['tiers.json' => '{ not json']];

        yield 'tier ladder declares no tiers' => [['tiers.json' => '{"premium":{"tiers":[]}}']];

        yield 'a declared tier has no slug' => [['tiers.json' => '{"premium":{"tiers":[{"name":"Pro"}]}}']];
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
