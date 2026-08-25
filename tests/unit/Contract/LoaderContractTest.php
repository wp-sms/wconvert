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
     * @return array{status: int, output: string}
     */
    private function check(string $tree): array
    {
        $output = [];
        $status = 0;

        exec(sprintf('node %s %s 2>&1', escapeshellarg(self::SCRIPT), escapeshellarg($tree)), $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testPassesOnATreeWhoseBundlesAreSmallAndCarryNoPremiumIdentifier(): void
    {
        $result = $this->check($this->tree([
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => self::manifest([
                'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
                'triggers' => ['exit_intent' => ['kind' => 'trigger', 'tier' => 'pro']],
            ]),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * The leak this exists to catch: free's loader carrying a rule type the
     * manifest calls premium.
     */
    public function testFailsWhenFreesLoaderCarriesAPremiumIdentifier(): void
    {
        $result = $this->check($this->tree([
            'public/loader/loader.js' => 'var rules={exit_intent:1};',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => self::manifest([
                'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
                'triggers' => ['exit_intent' => ['kind' => 'trigger', 'tier' => 'pro']],
            ]),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('exit_intent', $result['output']);
    }

    /**
     * Pro's bundle is weighed and NOT scanned. It is supposed to contain
     * premium identifiers — that is what Pro is.
     */
    public function testPassesWhenProsLoaderCarriesAPremiumIdentifier(): void
    {
        $result = $this->check($this->tree([
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'var rules={exit_intent:1};',
            'resources/rules/manifest.json' => self::manifest([
                'targeting' => ['url' => ['kind' => 'page', 'tier' => 'free']],
                'triggers' => ['exit_intent' => ['kind' => 'trigger', 'tier' => 'pro']],
            ]),
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    public function testFailsWhenABundleExceedsTheByteBudget(): void
    {
        // Random bytes, because gzip -9 would flatten a repeated string to
        // nothing and the budget is measured after compression.
        $result = $this->check($this->tree([
            'public/loader/loader.js' => base64_encode(random_bytes(16384)),
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('8192', $result['output']);
    }

    /**
     * @return iterable<string, array{array<string, string|null>}>
     */
    public static function treesThatCannotBeInspected(): iterable
    {
        yield 'free bundle missing' => [[
            'public/loader/loader.js' => null,
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
        ]];

        yield 'pro bundle missing' => [[
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => null,
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
        ]];

        yield 'bundle present but empty' => [[
            'public/loader/loader.js' => '',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => self::manifest(self::freeOnlyManifest()),
        ]];

        yield 'manifest missing' => [[
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => null,
        ]];

        yield 'manifest unparseable' => [[
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => '{ not json',
        ]];

        yield 'manifest declares no axes' => [[
            'public/loader/loader.js' => 'console.log("free");',
            'pro/public/loader/loader.js' => 'console.log("pro");',
            'resources/rules/manifest.json' => '{}',
        ]];
    }

    /**
     * @param array<string, string|null> $files
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('treesThatCannotBeInspected')]
    public function testATreeItCannotInspectFails(array $files): void
    {
        $result = $this->check($this->tree($files));

        $this->assertSame(1, $result['status'], $result['output']);
    }
}
