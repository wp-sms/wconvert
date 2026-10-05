<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * The release guard's five conditions, against fixture trees and fixture tags.
 *
 * WSMS has four — the publisher is allowed, the tag looks like a version, the
 * tag is on the default branch, the tag matches the version header — and ADR
 * 0030 adds a fifth, because free and Pro release on INDEPENDENT TAGS with
 * independent version numbers and something has to bound the skew that makes
 * real.
 *
 * ============================================================================
 * THE NEGATIVE CASES ARE THE POINT.
 * ============================================================================
 * A guard is a program that says no. Its happy path is the one behaviour that
 * costs nothing to get right and proves nothing when it works, so every
 * condition here is tested by the release it must refuse — and by the release
 * it must refuse for the second reason, which is that it could not look. ADR
 * 0029: "couldn't look" reading as "clean" is how a leak ships the one time a
 * build is incomplete.
 *
 * ============================================================================
 * THE FIFTH CONDITION IS STUBBED, AND THAT IS THE TEST.
 * ============================================================================
 * `WCONVERT_MIN_CORE ≤ the highest free version actually PUBLISHED` is a
 * statement about wp.org, not about this repository. Anchored to the working
 * tree it passes the exact release it exists to catch — Pro 1.3 requiring core
 * 1.3 while free 1.3 sits in the wp.org review queue. So the published version
 * arrives as an argument and every test here supplies its own, which is only
 * possible because bin/check-min-core.php never reads one itself.
 */
#[CoversNothing]
final class ReleaseGuardTest extends TestCase
{
    /** Exercise the real build dispatcher without Composer, Vite or a real ZIP. */
    public function testAllBuildStopsBeforeZipWhenArtifactGateFails(): void
    {
        $script = file_get_contents(self::BIN . '/build.sh');
        self::assertIsString($script);
        $tree = $this->tree([
            'bin/build.sh' => $script,
            'bin/verify-artifact-contract.sh' => "#!/usr/bin/env bash\necho 'Fixture artifact rejection' >&2\nexit 41\n",
            '.distignore' => "/dist\n",
            'fake-bin/npm' => "#!/usr/bin/env bash\nexit 0\n",
            'fake-bin/zip' => "#!/usr/bin/env bash\ntouch zip-was-invoked\nexit 0\n",
            'fake-bin/php' => <<<'SH'
                #!/usr/bin/env bash
                case "$1" in
                    */plugin-identity.php) echo 'tier=free; slug=wconvert; main_file=wconvert.php' ;;
                    -r) echo '0.1.0' ;;
                    */tier-manifest.php) exit 0 ;;
                    *) exit 1 ;;
                esac
                SH,
        ]);
        foreach (['npm', 'zip', 'php'] as $command) chmod($tree . '/fake-bin/' . $command, 0755);
        $path = $tree . '/fake-bin:' . (getenv('PATH') ?: '/usr/bin:/bin');
        $result = $this->execute('env ' . escapeshellarg('PATH=' . $path) . ' bash', [$tree . '/bin/build.sh', 'all']);
        self::assertSame(41, $result['status'], $result['output']);
        self::assertStringContainsString('Fixture artifact rejection', $result['output']);
        self::assertFileDoesNotExist($tree . '/dist/stage/plain/zip-was-invoked');
    }

    private const BIN = __DIR__ . '/../../../bin';

    private const REPO = __DIR__ . '/../../..';

    /** @var list<string> */
    private array $trees = [];

    protected function tearDown(): void
    {
        foreach ($this->trees as $tree) {
            if (is_dir($tree)) {
                self::removeTree($tree);
            }
        }

        $this->trees = [];
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
        $tree = sys_get_temp_dir() . '/wconvert-release-guard-' . bin2hex(random_bytes(6));
        mkdir($tree, 0777, true);
        $this->trees[] = $tree;

        foreach ($files as $relative => $contents) {
            if ($contents === null) {
                continue;
            }

            $path = $tree . '/' . $relative;
            @mkdir(dirname($path), 0777, true);
            file_put_contents($path, $contents);
        }

        return $tree;
    }

    /**
     * @param list<string> $arguments
     * @return array{status: int, output: string}
     */
    private function execute(string $command, array $arguments): array
    {
        $output = [];
        $status = 0;

        $line = $command . ' ' . implode(' ', array_map('escapeshellarg', $arguments)) . ' 2>&1';

        exec($line, $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    /**
     * @param list<string> $arguments
     * @return array{status: int, output: string}
     */
    private function php(string $script, array $arguments): array
    {
        return $this->execute('php ' . escapeshellarg(self::BIN . '/' . $script), $arguments);
    }

    /**
     * @param list<string> $arguments
     * @return array{status: int, output: string}
     */
    private function bash(string $script, array $arguments): array
    {
        return $this->execute('bash ' . escapeshellarg(self::BIN . '/' . $script), $arguments);
    }

    // =========================================================================
    // CONDITION 1 — the publisher is allowed to release.
    // =========================================================================

    /**
     * The allowlist lives in ONE place, and this is why it had to.
     *
     * Two release workflows now exist (ADR 0030). Spelled in the YAML the way
     * WSMS spells it, the list would be spelled twice, and the day somebody is
     * added to one of them is the day free and Pro disagree about who may
     * ship.
     */
    public function testAPublisherOnTheAllowlistMayRelease(): void
    {
        $result = $this->bash('check-publisher.sh', ['navidkashani']);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    public function testAPublisherNotOnTheAllowlistMayNot(): void
    {
        $result = $this->bash('check-publisher.sh', ['a-drive-by-contributor']);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('a-drive-by-contributor', $result['output']);
    }

    /**
     * **A prefix of an allowed name is not an allowed name.** The obvious
     * implementation — `case "$ALLOWED" in *"$ACTOR"*)` — says yes to `navid`,
     * to `kashani`, and to the empty string, because every one of them is a
     * substring of an entry.
     */
    public function testAnActorWhoseNameIsMerelyASubstringOfAnAllowedOneMayNot(): void
    {
        $result = $this->bash('check-publisher.sh', ['navid']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * No actor at all is not "the empty actor is not on the list" — it is a
     * guard that was handed nothing, which is could-not-look.
     */
    public function testNoActorAtAllFailsRatherThanBeingTreatedAsAStranger(): void
    {
        $result = $this->bash('check-publisher.sh', []);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    // =========================================================================
    // CONDITION 3 — the tag is on the default branch.
    // =========================================================================

    /**
     * A throwaway repository with one commit on `main` and one on a side
     * branch, so both verdicts have a real commit behind them.
     *
     * @return array{dir: string, on_main: string, off_main: string}
     */
    private function repositoryWithASideBranch(): array
    {
        $dir = $this->tree(['seed.txt' => 'one']);

        $git = static function (string $arguments) use ($dir): string {
            return (string) shell_exec(sprintf('git -C %s %s 2>&1', escapeshellarg($dir), $arguments));
        };

        $git('init --quiet --initial-branch=main');
        $git('config user.email release-guard@example.test');
        $git('config user.name "Release Guard"');
        $git('add seed.txt');
        $git('commit --quiet -m "on main"');

        $onMain = trim($git('rev-parse HEAD'));

        $git('checkout --quiet -b side');
        file_put_contents($dir . '/seed.txt', 'two');
        $git('add seed.txt');
        $git('commit --quiet -m "not on main"');

        $offMain = trim($git('rev-parse HEAD'));

        $git('checkout --quiet main');

        return ['dir' => $dir, 'on_main' => $onMain, 'off_main' => $offMain];
    }

    public function testATagOnTheDefaultBranchMayRelease(): void
    {
        $repository = $this->repositoryWithASideBranch();

        $result = $this->bash('check-tag-on-branch.sh', [$repository['dir'], $repository['on_main'], 'main']);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * The mistake this exists to catch: tagging a branch that was never
     * merged, which ships code no pull request ever gated. CI runs on
     * `pull_request` only, so an un-merged commit has had no suite run against
     * the result of merging it — there is nothing to fall back on.
     */
    public function testATagOffTheDefaultBranchMayNot(): void
    {
        $repository = $this->repositoryWithASideBranch();

        $result = $this->bash('check-tag-on-branch.sh', [$repository['dir'], $repository['off_main'], 'main']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **A commit git has never heard of is not "off the branch".** It is a
     * question that could not be answered, and the naive `if git merge-base
     * --is-ancestor ...` spelling reports the two identically — which happens
     * to give the right verdict here, and gives a message that sends whoever
     * reads it to look for a merge that was never the problem.
     */
    public function testACommitThatDoesNotExistFailsAsCouldNotLook(): void
    {
        $repository = $this->repositoryWithASideBranch();

        $result = $this->bash('check-tag-on-branch.sh', [
            $repository['dir'],
            '0000000000000000000000000000000000000000',
            'main',
        ]);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('cannot', strtolower($result['output']));
    }

    /**
     * And a branch git has never heard of is the same failure from the other
     * side — the case where a repository's default branch is renamed and the
     * guard keeps checking against a name nothing points at, silently passing
     * or failing everything.
     */
    public function testABranchThatDoesNotExistFailsAsCouldNotLook(): void
    {
        $repository = $this->repositoryWithASideBranch();

        $result = $this->bash('check-tag-on-branch.sh', [$repository['dir'], $repository['on_main'], 'trunk']);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('cannot', strtolower($result['output']));
    }

    // =========================================================================
    // CONDITIONS 2 AND 4 — the tag names this plugin, and every statement of
    // its version agrees.
    // =========================================================================

    /**
     * The smallest tree bin/check-release-tag.php will speak about: a main
     * file with a header, a constants file with a define, and — for free — a
     * readme with a stable tag.
     *
     * @param array<string, string|null> $overrides
     */
    private function freeTree(string $header, string $constant, ?string $stable, array $overrides = []): string
    {
        return $this->tree([
            'wconvert.php' => " <?php\n/**\n * Plugin Name: WConvert\n * Version: {$header}\n */\n",
            'src/constants.php' => "<?php\ndefine('WCONVERT_VERSION', '{$constant}');\n",
            'readme.txt' => $stable === null ? null : "=== WConvert ===\nStable tag: {$stable}\n",
            ...$overrides,
        ]);
    }

    private function proTree(string $header, string $constant, string $minCore): string
    {
        return $this->tree([
            'wconvert-pro.php' => " <?php\n/**\n * Plugin Name: WConvert Pro\n * Version: {$header}\n */\n",
            'src/constants.php' => "<?php\ndefine('WCONVERT_PRO_VERSION', '{$constant}');\ndefine('WCONVERT_MIN_CORE', '{$minCore}');\n",
        ]);
    }

    public function testATagWhoseVersionEveryStatementAgreesWithMayRelease(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->freeTree('1.4.0', '1.4.0', '1.4.0')]);

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('1.4.0', $result['output']);
    }

    /**
     * **A Pro tag may not drive a free release.** The prefix is not decoration:
     * ADR 0030 gives the two plugins independent version numbers, so `pro-v1.4`
     * and `free-v1.4` are unrelated facts and a shared `v*` pattern would let
     * either tag start either run.
     */
    public function testATagForTheOtherPluginIsNotAReleaseTagForThisOne(): void
    {
        $result = $this->php('check-release-tag.php', ['pro-v1.4.0', $this->freeTree('1.4.0', '1.4.0', '1.4.0')]);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testATagThatIsNotShapedLikeAVersionMayNot(): void
    {
        $result = $this->php('check-release-tag.php', ['free-vlatest', $this->freeTree('1.4.0', '1.4.0', '1.4.0')]);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * WSMS's own condition 4, and the one everybody remembers: the tag was cut
     * without bumping the header.
     */
    public function testAHeaderThatDisagreesWithTheTagMayNot(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->freeTree('1.3.0', '1.4.0', '1.4.0')]);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('1.3.0', $result['output']);
    }

    /**
     * **The constant is what runs, and it is the one WSMS's version of this
     * check does not look at.** Pro's boot guard compares WCONVERT_MIN_CORE
     * against free's CONSTANT, so a header and a tag that agree while the
     * constant lags ships a free plugin that tells Pro it is older than it is —
     * and Pro then refuses to boot for a reason that is nowhere on screen.
     */
    public function testAVersionConstantThatDisagreesWithTheTagMayNot(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->freeTree('1.4.0', '1.3.0', '1.4.0')]);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('WCONVERT_VERSION', $result['output']);
    }

    /**
     * **The stable tag is the most dangerous of the three.** It is what wp.org
     * serves. A correct ZIP uploaded under a stale `Stable tag:` hands every
     * existing install the OLD version, and looks like a successful release
     * from every angle except the only one that counts.
     */
    public function testAStaleStableTagMayNot(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->freeTree('1.4.0', '1.4.0', '1.3.0')]);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('Stable tag', $result['output']);
    }

    /**
     * A missing readme.txt is not "no stable tag to disagree with". It is the
     * wp.org listing gone, and a version statement nobody read.
     */
    public function testAFreeTreeWithNoReadmeAtAllMayNot(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->freeTree('1.4.0', '1.4.0', null)]);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **Pro is not held to a readme.txt it must not have.** Pro is not
     * distributed on wp.org, so requiring the file would fail every Pro release
     * for the absence of something that has no reason to exist.
     */
    public function testAProTreeNeedsNoReadmeToRelease(): void
    {
        $result = $this->php('check-release-tag.php', ['pro-v2.0.0', $this->proTree('2.0.0', '2.0.0', '1.0.0')]);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * Two `Version:` headers is not "take the first". The file's version is
     * then whichever one its reader reaches first, and WordPress and this
     * program are two different readers.
     */
    public function testATreeStatingItsVersionTwiceFailsRatherThanPickingOne(): void
    {
        $tree = $this->tree([
            'wconvert.php' => " <?php\n/**\n * Version: 1.4.0\n * Version: 1.3.0\n */\n",
            'src/constants.php' => "<?php\ndefine('WCONVERT_VERSION', '1.4.0');\n",
            'readme.txt' => "=== WConvert ===\nStable tag: 1.4.0\n",
        ]);

        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $tree]);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testATreeThatIsNotAPluginAtAllFailsAsCouldNotLook(): void
    {
        $result = $this->php('check-release-tag.php', ['free-v1.4.0', $this->tree(['nothing.txt' => 'x'])]);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('cannot', strtolower($result['output']));
    }

    /**
     * The invocation the free release workflow actually makes, against the tree
     * it actually ships. Every fixture above proves the check can tell a good
     * tag from a bad one; this is the claim the repository makes about itself.
     */
    public function testThisRepositorysOwnTreesAgreeWithTheirOwnVersions(): void
    {
        $free = $this->php('check-release-tag.php', [
            'free-v' . self::versionOf(self::REPO, 'wconvert.php'),
            self::REPO,
        ]);
        $this->assertSame(0, $free['status'], $free['output']);

        $pro = $this->php('check-release-tag.php', [
            'pro-v' . self::versionOf(self::REPO . '/pro', 'wconvert-pro.php'),
            self::REPO . '/pro',
        ]);
        $this->assertSame(0, $pro['status'], $pro['output']);
    }

    /**
     * The version a tree states, read the one way this repository reads it —
     * wconvertHeaderVersion(), the function the guard and bin/build.sh share.
     */
    private static function versionOf(string $tree, string $mainFile): string
    {
        require_once self::BIN . '/plugin-identity.php';

        return wconvertHeaderVersion($tree . '/' . $mainFile, $mainFile);
    }

    // =========================================================================
    // CONDITION 5's DATA SOURCE — what wp.org said, read.
    //
    // The fetch cannot be asserted cheaply; the PARSE can, and the parse is the
    // half that can be wrong. bin/wporg-version.php exists as its own program
    // so that these can feed it wp.org's actual response bodies without a
    // network call — including the one that matters most, which is wp.org
    // saying it has never heard of the plugin.
    // =========================================================================

    /**
     * @return array{status: int, output: string}
     */
    private function wporgVersion(string $body): array
    {
        $output = [];
        $status = 0;

        exec(
            sprintf(
                'printf %s | php %s 2>&1',
                escapeshellarg($body),
                escapeshellarg(self::BIN . '/wporg-version.php')
            ),
            $output,
            $status
        );

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    public function testTheStableTagIsWhatIsReadOutOfAWpOrgResponse(): void
    {
        $result = $this->wporgVersion('{"name":"WConvert","slug":"wconvert","version":"1.4.2"}');

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertSame('1.4.2', $result['output']);
    }

    /**
     * ========================================================================
     * "PLUGIN NOT FOUND" IS A REFUSAL, NOT A VERSION OF ZERO.
     * ========================================================================
     * This is the branch ADR 0030's "free ships first, always" rests on, and
     * it is the one a reader is most likely to think is defensive padding. If
     * free has never been published there is no version any install can be
     * running, so no WCONVERT_MIN_CORE can be satisfied and no Pro release may
     * go out. A parse returning "0.0.0" here would turn that into a Pro
     * release that boots nowhere — the exact failure condition 5 exists for,
     * reached through the check meant to prevent it.
     */
    public function testAPluginWpOrgHasNeverHeardOfIsARefusal(): void
    {
        $result = $this->wporgVersion('{"error":"Plugin not found."}');

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('Plugin not found', $result['output']);
    }

    public function testAResponseWithNoVersionFieldIsARefusal(): void
    {
        $result = $this->wporgVersion('{"name":"WConvert","slug":"wconvert"}');

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testAResponseThatIsNotJsonIsARefusal(): void
    {
        $result = $this->wporgVersion('<html><body>502 Bad Gateway</body></html>');

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testAnEmptyResponseIsARefusal(): void
    {
        $result = $this->wporgVersion('');

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **Refused before it reaches a comparison, not after.**
     * `version_compare('trunk', '1.4.0', '>=')` is TRUE in PHP, so a version
     * that is not shaped like one has to be rejected here — the same rule
     * MinCoreCheck applies to its own inputs, for the same reason.
     */
    public function testAVersionThatIsNotShapedLikeOneIsARefusal(): void
    {
        $result = $this->wporgVersion('{"version":"trunk"}');

        $this->assertSame(1, $result['status'], $result['output']);
    }

    // =========================================================================
    // CONDITION 5 — WCONVERT_MIN_CORE ≤ the highest free version PUBLISHED.
    // =========================================================================

    /**
     * The best case: Pro asks for a core older than the one wp.org is serving.
     */
    public function testAProWhoseMinCoreIsBelowThePublishedFreeVersionMayRelease(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', '1.2.0'), '1.3.0']);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /** Equal satisfies it. `≤`, not `<`. */
    public function testAProWhoseMinCoreEqualsThePublishedFreeVersionMayRelease(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', '1.3.0'), '1.3.0']);

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * ============================================================================
     * THE RELEASE THIS CONDITION EXISTS FOR, AND THE REASON IT IS STUBBED.
     * ============================================================================
     * Pro asks for core 1.3 while free 1.3 sits in the wp.org review queue.
     * The repository already contains free 1.3 — its header, its constant and
     * its readme all say so — so a check anchored to the working tree passes
     * this release, and every merchant who installs the Pro update gets a
     * plugin that refuses to boot with premium features silently missing.
     *
     * The published version is therefore an ARGUMENT, and this test supplies
     * 1.2.0 while the tree says 1.3.0. That gap is not reachable by any test
     * that reads the repository.
     */
    public function testAProWhoseMinCoreExceedsThePublishedFreeVersionIsBlocked(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', '1.3.0'), '1.2.0']);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('1.3.0', $result['output']);
        $this->assertStringContainsString('1.2.0', $result['output']);
    }

    /**
     * **The comparison is the runtime guard's own.** `version_compare()` never
     * reports that it could not read its input — PHP ranks
     * `version_compare('99 bottles', '1.4.0', '>=')` as TRUE — so
     * `WConvert\Pro\Boot\MinCoreCheck` refuses to compare an unreadable
     * version rather than ranking it, and this condition inherits that
     * refusal by calling it rather than re-implementing it.
     */
    public function testAnUnreadablePublishedVersionIsARefusalRatherThanAComparison(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', '1.0.0'), '99 bottles']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testAnUnreadableMinCoreIsARefusalToo(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', 'whenever'), '1.3.0']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * A Pro tree with no WCONVERT_MIN_CORE in it has not satisfied the
     * condition; it has removed the thing the condition is about.
     */
    public function testAProTreeThatDeclaresNoMinCoreAtAllIsBlocked(): void
    {
        $tree = $this->tree([
            'wconvert-pro.php' => " <?php\n/**\n * Version: 2.0.0\n */\n",
            'src/constants.php' => "<?php\ndefine('WCONVERT_PRO_VERSION', '2.0.0');\n",
        ]);

        $result = $this->php('check-min-core.php', [$tree, '1.3.0']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **Pointed at free's tree it fails rather than passing.** Only the Pro run
     * evaluates this condition (ADR 0030), and a program that quietly returned
     * "clean" for a tree with no WCONVERT_MIN_CORE in it would report a tick
     * for a condition it never evaluated — which is the same failure as
     * "couldn't look" reading as "clean", reached by pointing the check at the
     * wrong thing.
     */
    public function testPointedAtFreesTreeItFailsRatherThanReportingATick(): void
    {
        $result = $this->php('check-min-core.php', [$this->freeTree('1.4.0', '1.4.0', '1.4.0'), '1.3.0']);

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * No published version at all is the case that matters most and reads as
     * an edge case: wp.org was unreachable, or free has never been published.
     * Either way nothing was read, and nothing read is not a satisfied
     * condition.
     */
    public function testNoPublishedVersionAtAllIsARefusal(): void
    {
        $result = $this->php('check-min-core.php', [$this->proTree('2.0.0', '2.0.0', '1.0.0'), '']);

        $this->assertSame(1, $result['status'], $result['output']);
    }
}
