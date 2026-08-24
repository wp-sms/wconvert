<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * bin/verify-source-contract.sh, against fixture trees.
 *
 * The script is the check that carries the free contract's guarantee: no file
 * in free's tree imports a `pro/` path or the Pro namespace, in TS and in PHP,
 * proven without a build and on every pull request (ADR 0029).
 *
 * Its fail-closed behaviour is the whole point and is exactly what a
 * happy-path test would miss — a check that cannot inspect what it was asked
 * to inspect must FAIL, because "couldn't look" reading as "clean" is how a
 * leak ships the one time a tree is incomplete.
 */
#[CoversNothing]
final class SourceContractTest extends TestCase
{
    private const SCRIPT = __DIR__ . '/../../../bin/verify-source-contract.sh';

    private const FIXTURES = __DIR__ . '/../../fixtures/source-contract';

    /**
     * @return array{status: int, output: string}
     */
    private function verify(string $tree): array
    {
        $output = [];
        $status = 0;

        exec(sprintf('bash %s %s 2>&1', escapeshellarg(self::SCRIPT), escapeshellarg($tree)), $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testPassesOnATreeThatReferencesNothingUnderPro(): void
    {
        $result = $this->verify(self::FIXTURES . '/clean');

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * The guarantee itself, on the tree it is about. Every fixture above
     * proves the check can tell clean from leaking; this one is the claim the
     * project actually makes, and it is the invocation CI runs.
     */
    public function testThisRepositorysOwnFreeTreeSatisfiesTheContract(): void
    {
        $result = $this->verify(dirname(__DIR__, 3));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * The leak this exists to catch: free's loader entry importing Pro's
     * modules. Under a mode flag that import would have been legitimate and
     * the guarantee would have lived in the bundler — which is why ADR 0028
     * killed the flag and made this checkable without a build.
     */
    public function testFailsWhenFreeTypeScriptImportsAProPath(): void
    {
        $result = $this->verify(self::FIXTURES . '/ts-imports-pro');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('main.ts', $result['output']);
    }

    /**
     * The same leak on the PHP side. ADR 0029 states the invariant for TS AND
     * PHP, and a check that only covered the bundler's half would leave free's
     * PHP free to `use WConvert\Pro\...` — a fatal on a free install, and a
     * premium reference inside the free artifact either way.
     */
    public function testFailsWhenFreePhpUsesTheProNamespace(): void
    {
        $result = $this->verify(self::FIXTURES . '/php-uses-pro-namespace');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('Thing.php', $result['output']);
    }

    /**
     * FAIL-CLOSED. An empty tree has nothing wrong in it and nothing right in
     * it either, and reporting it clean is a lie the release believes: the one
     * time a checkout or a stage is incomplete, "couldn't look" becomes
     * "verified" and the leak ships. ADR 0029 makes this a property of all
     * three programs of the gate.
     */
    public function testFailsOnATreeWithNothingInIt(): void
    {
        $tree = $this->makeTempTree();

        $result = $this->verify($tree);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * Present but empty is the same fail-closed case wearing a shape that
     * looks right. The scan roots exist, so a check that only asked "does
     * src/ exist?" would pass this — and pass it having read no files at all.
     */
    public function testFailsOnATreeWhoseScanRootsHoldNoFiles(): void
    {
        $tree = $this->makeTempTree();
        mkdir($tree . '/src', 0o755, true);
        mkdir($tree . '/resources', 0o755, true);

        $result = $this->verify($tree);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * The plugin bootstrap file sits at the tree ROOT, not under src/, and it
     * ships. A scan scoped to the subdirectories would leave the one file
     * every install executes first entirely unread.
     */
    public function testFailsWhenTheRootPluginFileReferencesPro(): void
    {
        $result = $this->verify(self::FIXTURES . '/root-file-uses-pro');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('wconvert.php', $result['output']);
    }

    /**
     * A Pro name in a STRING LITERAL is still a reference, because `new $class`
     * resolves it exactly as `new \WConvert\Pro\Boot\BootGuard` would. This
     * is the one place the tokenizer deliberately looks past "is it code?" —
     * ignoring string literals would leave the check trivially bypassable by
     * anyone who did not want to be caught, and accidentally bypassable by
     * anyone building a class name.
     */
    public function testFailsWhenAProClassNameAppearsInAStringLiteral(): void
    {
        $result = $this->verify(self::FIXTURES . '/php-pro-in-string');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('Thing.php', $result['output']);
    }

    /**
     * PRECISION. `repro/`, `improved/` and `promotions` all contain the
     * letters a substring match looks for, and a module literally named
     * `pro.ts` imports nothing under a pro tree. A prose mention of the Pro
     * namespace in a docblock is free DOCUMENTING the boundary, which is the
     * behaviour we want more of.
     *
     * Every one of these is why the two scanners parse rather than grep. A
     * check that cries wolf earns an exception list, and the exception list is
     * where the real leak eventually hides — WSMS paid for that lesson (#241).
     */
    public function testDoesNotFlagNamesThatMerelyResembleTheProTree(): void
    {
        $result = $this->verify(self::FIXTURES . '/near-misses');

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * FAIL-CLOSED, second form. A tree that exists but cannot be read is the
     * case where an exit status is most likely to be believed — the path is
     * right there, the script ran, and nothing looked wrong.
     */
    public function testFailsOnATreeItCannotRead(): void
    {
        $tree = $this->makeTempTree();
        chmod($tree, 0o000);

        if (is_readable($tree)) {
            // Running as root, where no permission bit denies anything. The
            // property still holds; this process simply cannot construct the
            // condition to observe it.
            $this->markTestSkipped('cannot make a directory unreadable as root');
        }

        $result = $this->verify($tree);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * FAIL-CLOSED, third form, and the one furthest inside: the tree is fine,
     * the scan roots are fine, and one FILE cannot be read. A scanner that
     * skipped it would report the other files' cleanliness as the tree's.
     */
    public function testFailsWhenAFileInsideTheTreeCannotBeRead(): void
    {
        $tree = $this->makeTempTree();
        mkdir($tree . '/src', 0o755, true);
        mkdir($tree . '/resources', 0o755, true);
        file_put_contents($tree . '/src/Thing.php', "<?php

namespace WConvert\Fixture;
");
        file_put_contents($tree . '/resources/main.ts', "export const x = 1;
");
        chmod($tree . '/resources/main.ts', 0o000);

        if (is_readable($tree . '/resources/main.ts')) {
            $this->markTestSkipped('cannot make a file unreadable as root');
        }

        $result = $this->verify($tree);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * @var list<string> Temp trees to remove after the test.
     */
    private array $tempTrees = [];

    private function makeTempTree(): string
    {
        $tree = sys_get_temp_dir() . '/wconvert-source-contract-' . bin2hex(random_bytes(6));

        mkdir($tree, 0o755, true);
        $this->tempTrees[] = $tree;

        return $tree;
    }

    protected function tearDown(): void
    {
        foreach ($this->tempTrees as $tree) {
            exec(sprintf('chmod -R u+rwX %s 2>/dev/null', escapeshellarg($tree)));
            exec(sprintf('rm -rf %s', escapeshellarg($tree)));
        }

        $this->tempTrees = [];

        parent::tearDown();
    }
}
