<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * `bin/check-admin.mjs`, pointed at trees built here (ADR 0147).
 *
 * Free's admin and inspector bundles carry no Pro module's admin code and
 * never say "upgrade". Each test poisons one thing in an otherwise clean tree,
 * and the last proves the program fails closed on a tree it cannot inspect.
 */
#[CoversNothing]
final class AdminContractTest extends TestCase
{
    private const SCRIPT = __DIR__ . '/../../../bin/check-admin.mjs';

    private string $tree = '';

    protected function tearDown(): void
    {
        if ($this->tree !== '' && is_dir($this->tree)) {
            $entries = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->tree, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );

            foreach ($entries as $entry) {
                /** @var \SplFileInfo $entry */
                $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            }

            rmdir($this->tree);
        }
    }

    /**
     * @param array<string, string|null> $overrides
     */
    private function adminTree(array $overrides = []): string
    {
        $files = [
            'public/admin/main-abc.js' => 'console.log("free admin");',
            'public/admin/builder-def.js' => 'var a={onUpgrade:1},b="__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";',
            'public/inspector/inspector.js' => 'console.log("inspector");',
            'pro/modules/journeys/module.json' => '{"slug":"journeys","admin_markers":["Where visitors go next"]}',
            'pro/modules/display-types/module.json' => '{"slug":"display-types"}',
            ...$overrides,
        ];

        $this->tree = sys_get_temp_dir() . '/wconvert-check-admin-' . bin2hex(random_bytes(6));

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
     * @return array{status: int, output: string}
     */
    private function check(string $tree): array
    {
        $output = [];
        $status = 0;

        exec(sprintf('node %s %s 2>&1', escapeshellarg(self::SCRIPT), escapeshellarg($tree)), $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    /** React's internal name and a prop called `onUpgrade` are code, not copy. */
    public function testPassesOnACleanTree(): void
    {
        $result = $this->check($this->adminTree());

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('display-types declare no admin markers', $result['output']);
    }

    public function testFailsWhenAFreeChunkCarriesAModulesAdminMarker(): void
    {
        $result = $this->check($this->adminTree([
            'public/admin/builder-def.js' => 'x(__("Where visitors go next","wconvert"));',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('journeys\'s admin code', $result['output']);
    }

    public function testFailsWhenTheInspectorCarriesOne(): void
    {
        $result = $this->check($this->adminTree([
            'public/inspector/inspector.js' => '"Where visitors go next"',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function upgradeCopy(): iterable
    {
        yield 'lower case' => ['"Remove them, or upgrade."'];

        yield 'sentence case' => ['"Upgrade to add them."'];
    }

    #[DataProvider('upgradeCopy')]
    public function testFailsOnUpgradeCopy(string $copy): void
    {
        $result = $this->check($this->adminTree(['public/admin/main-abc.js' => $copy]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('says "upgrade"', $result['output']);
    }

    /** Pro's own bundle is the admin code, so nothing under pro/public is read. */
    public function testIgnoresProsBundle(): void
    {
        $result = $this->check($this->adminTree([
            'pro/public/admin/main-xyz.js' => '"Where visitors go next","Upgrade"',
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * @return iterable<string, array{array<string, string|null>}>
     */
    public static function treesThatCannotBeInspected(): iterable
    {
        yield 'admin directory missing' => [['public/admin/main-abc.js' => null, 'public/admin/builder-def.js' => null]];

        yield 'inspector missing' => [['public/inspector/inspector.js' => null]];

        yield 'a chunk is empty' => [['public/admin/main-abc.js' => '']];

        yield 'module manifest unparseable' => [['pro/modules/journeys/module.json' => '{ not json']];

        yield 'admin markers malformed' => [['pro/modules/journeys/module.json' => '{"slug":"journeys","admin_markers":[""]}']];
    }

    /**
     * @param array<string, string|null> $files
     */
    #[DataProvider('treesThatCannotBeInspected')]
    public function testATreeItCannotInspectFails(array $files): void
    {
        $result = $this->check($this->adminTree($files));

        $this->assertSame(1, $result['status'], $result['output']);
    }
}
