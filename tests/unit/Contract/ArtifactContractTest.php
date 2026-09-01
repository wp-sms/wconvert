<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

/**
 * bin/verify-artifact-contract.sh, against staged trees.
 *
 * The THIRD of ADR 0029's three programs, and the one whose subject is a build
 * rather than a source tree. It confirms at release what the source contract
 * already proved on every pull request:
 *
 *   (c) the free artifact contains no path under Pro's plugin directory;
 *   (d) the free artifact contains its un-minified source tree.
 *
 * ============================================================================
 * THE TREES HERE ARE MINIMAL, AND NONE OF THEM IS A REAL ARTIFACT.
 * ============================================================================
 * Every fixture below is built file by file, so each test poisons exactly one
 * property and the failure it asserts can only have come from that.
 *
 * Nothing here runs bin/build.sh, and that is not an omission: NO ZIP IS BUILT
 * ON A PULL REQUEST (ADR 0029), and a test suite that staged one would be
 * paying minutes per pull request for the confirmation that ADR declines. The
 * real artifact is checked where it exists — inside bin/build.sh, on every
 * release run, before the ZIP is written. What these tests prove is that the
 * check called there says no to the right things.
 *
 * ============================================================================
 * FAIL-CLOSED IS MOST OF WHAT IS TESTED.
 * ============================================================================
 * A check that cannot inspect what it was asked to inspect must FAIL. That is
 * the whole difference between this and WSMS's check 7, which prints a note
 * and skips when the React source is missing — and an incomplete build is
 * exactly the state this program exists to be pointed at, so the skip is not
 * a corner case here. It is the case.
 */
#[CoversNothing]
final class ArtifactContractTest extends TestCase
{
    private const SCRIPT = __DIR__ . '/../../../bin/verify-artifact-contract.sh';

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
     * @param array<string, string|null> $files Path relative to the tree => contents, null to omit.
     */
    private function tree(array $files): string
    {
        $tree = sys_get_temp_dir() . '/wconvert-artifact-' . bin2hex(random_bytes(6));
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
     * @return array{status: int, output: string}
     */
    private function verify(string $tree): array
    {
        $output = [];
        $status = 0;

        exec(sprintf('bash %s %s 2>&1', escapeshellarg(self::SCRIPT), escapeshellarg($tree)), $output, $status);

        return ['status' => $status, 'output' => implode("\n", $output)];
    }

    /**
     * A free artifact with everything the contract asks of one.
     *
     * @param array<string, string|null> $overrides
     */
    private function stagedFree(array $overrides = []): string
    {
        return $this->tree([
            'wconvert.php' => "<?php\n// the plugin\n",
            'readme.txt' => "=== WConvert ===\nStable tag: 1.0.0\n",
            'src/Bootstrap.php' => "<?php\nnamespace WConvert;\nfinal class Bootstrap {}\n",
            'vendor/autoload.php' => "<?php\n// composer\n",
            'vendor/composer/autoload_psr4.php' => "<?php\nreturn array('WConvert\\\\' => array('/src'));\n",
            'public/loader/loader.js' => "console.log('loader');\n",
            // Pro replaces this one on the same hook it replaces the loader
            // (ADR 0048), so a ZIP missing it on EITHER tier is a real
            // failure — and free's inspector on a Pro install would report
            // every exit-intent Optin as inert while it worked.
            'public/inspector/inspector.js' => "console.log('inspector');\n",
            'public/admin/main-abc12345.js' => "console.log('admin');\n",
            'public/admin/builder-def67890.js' => "console.log('builder');\n",
            'resources/loader/src/main.ts' => "export const boot = () => {};\n",
            'resources/admin/src/main.tsx' => "export const App = () => null;\n",
            'resources/renderer/src/render.ts' => "export const render = () => {};\n",
            'resources/rules/manifest.json' => "{\"targeting\":{}}\n",
            'resources/templates/manifest.json' => "{\"slots\":{}}\n",
            'resources/templates/library/centred-card.json' => "{\"tier\":\"free\"}\n",
            'resources/templates/locked.json' => "{\"designs\":[]}\n",
            'resources/playbooks/welcome.php' => "<?php\nreturn [];\n",
            ...$overrides,
        ]);
    }

    /**
     * @param array<string, string|null> $overrides
     */
    private function stagedPro(array $overrides = []): string
    {
        return $this->tree([
            'wconvert-pro.php' => "<?php\n// the plugin\n",
            'src/Bootstrap.php' => "<?php\nnamespace WConvert\\Pro;\nfinal class Bootstrap {}\n",
            'public/loader/loader.js' => "console.log('pro loader');\n",
            'public/inspector/inspector.js' => "console.log('pro inspector');\n",
            'resources/loader/src/main.ts' => "export const boot = () => {};\n",
            ...$overrides,
        ]);
    }

    // =========================================================================
    // The happy paths, which are here to make the failures below mean something
    // — not because either is interesting on its own.
    // =========================================================================

    public function testPassesOnAFreeTreeThatCarriesNoProPathAndAllOfItsSource(): void
    {
        $result = $this->verify($this->stagedFree());

        $this->assertSame(0, $result['status'], $result['output']);
    }

    public function testPassesOnAProTree(): void
    {
        $result = $this->verify($this->stagedPro());

        $this->assertSame(0, $result['status'], $result['output']);
    }

    // =========================================================================
    // (e) NO PREMIUM DESIGN IN THE FREE ZIP.
    //
    // Issue #7's rule, in the newest place it can be broken: "if the free ZIP
    // ships exit-intent code and refuses to run it, that is trialware". A
    // design is a JSON file, and a JSON file looks harmless in a diff.
    // =========================================================================

    public function testFailsWhenTheFreeTreeBundlesAPremiumDesign(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/templates/library/spin-to-win.json' => "{\"id\":\"spin\",\"tier\":\"pro\",\"tree\":{}}\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('premium design', $result['output']);
    }

    /**
     * `Tier::tryFrom()` reads an unrecognised word as free, so an entry
     * declaring one would ship as free without anybody deciding that. It is a
     * red build rather than a silent reclassification.
     */
    public function testFailsWhenABundledDesignDeclaresATierNobodyCanClassify(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/templates/library/agency.json' => "{\"id\":\"agency\",\"tier\":\"enterprise\"}\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **The trialware shape arriving through the file written to prevent it.**
     * `locked.json` carries the CARD — a name, its facets, a link to a live
     * preview on wconvert.com — and never the design. A tree in it is a premium
     * design in the free ZIP by another route.
     */
    public function testFailsWhenTheLockedMetadataCarriesADesign(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/templates/locked.json' =>
                "{\"designs\":[{\"id\":\"slide-in-card\",\"tree\":{\"steps\":[]}}]}\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('locked.json', $result['output']);
    }

    /** Fail-closed: a library that was not inspected is not a library that passed. */
    public function testFailsWhenTheDesignLibraryIsAbsentEntirely(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/templates/library/centred-card.json' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * Pro is where the premium designs ship, so (e) asserts nothing there — the
     * same asymmetry (c) and (d) already have, said out loud rather than left
     * as an omission.
     */
    public function testAProTreeMayCarryPremiumDesigns(): void
    {
        $result = $this->verify($this->stagedPro([
            'resources/templates/library/spin-to-win.json' => "{\"id\":\"spin\",\"tier\":\"pro\",\"tree\":{}}\n",
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    // =========================================================================
    // (c) NO PATH UNDER PRO'S PLUGIN DIRECTORY.
    // =========================================================================

    /**
     * The leak in its plainest form: the stage did not strip `pro/`.
     */
    public function testFailsWhenTheFreeTreeCarriesProsDirectory(): void
    {
        $result = $this->verify($this->stagedFree([
            'pro/wconvert-pro.php' => "<?php\n",
            'pro/src/Bootstrap.php' => "<?php\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('pro/', $result['output']);
    }

    /**
     * The same tree under the name an installed WordPress gives it. Somebody
     * copying a built Pro plugin into the stage produces this, and a check that
     * only knew the repo's own layout would pass it.
     */
    public function testFailsWhenTheFreeTreeCarriesProUnderItsInstalledDirectoryName(): void
    {
        $result = $this->verify($this->stagedFree([
            'wconvert-pro/src/Bootstrap.php' => "<?php\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * ========================================================================
     * THE LEAK THE SOURCE CONTRACT STRUCTURALLY CANNOT SEE.
     * ========================================================================
     * `vendor/` is GENERATED. Composer writes the autoload map at build time,
     * so an entry pointing at `pro/src` is a Pro path inside the free artifact
     * that no source file in this repository ever contained — and
     * bin/verify-source-contract.sh, which is a check about source text, will
     * never find it however hard it looks.
     *
     * pro/src/autoload.php names this exact risk as the FIRST of its two
     * reasons for existing: "a composer autoload entry pointing at a directory
     * the free ZIP does not contain is a premium reference inside the free
     * artifact". This is the check that makes that sentence enforceable.
     */
    public function testFailsWhenTheGeneratedComposerAutoloadMapNamesPro(): void
    {
        $result = $this->verify($this->stagedFree([
            'vendor/composer/autoload_psr4.php' =>
                "<?php\nreturn array('WConvert\\\\Pro\\\\' => array('/pro/src'), 'WConvert\\\\' => array('/src'));\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('autoload_psr4.php', $result['output']);
    }

    /**
     * ========================================================================
     * THE SAME LEAK, IN THE ARTIFACT.
     * ========================================================================
     * `resources/playbooks/*.php` ships in the free ZIP — PlaybookLibrary
     * reads it by path constant — so a Playbook reaching into Pro puts a Pro
     * path in the artifact. Scanning only `src/` and the root left it
     * unwatched at BOTH ends of the gate.
     */
    public function testFailsWhenAShippedPlaybookReferencesPro(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/playbooks/welcome.php' =>
                "<?php\nrequire_once WCONVERT_DIR . 'pro/src/Playbook/PremiumSteps.php';\nreturn [];\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('welcome.php', $result['output']);
    }

    /**
     * **A find(1) that could not look must not vote "clean".**
     *
     * The absence checks are spelled `find_matches`, not
     * `[ -n "$(find … 2>/dev/null)" ]`, and the difference is the whole
     * fail-closed property: the naive form throws find's exit status away, so
     * an unreadable subdirectory prints nothing, nothing reads as "no match",
     * and no match reads as "no Pro path here". An unreadable directory inside
     * the tree is exactly the case, and it must fail.
     */
    public function testFailsWhenPartOfTheTreeCannotBeSearched(): void
    {
        $tree = $this->stagedFree();
        $locked = $tree . '/resources/locked';
        mkdir($locked, 0777, true);
        file_put_contents($locked . '/thing.txt', 'x');
        chmod($locked, 0000);

        $result = $this->verify($tree);

        chmod($locked, 0755);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('cannot verify', $result['output']);
    }

    /**
     * No vendor/composer/ is not "the autoload map is clean". It is an
     * artifact whose autoload map was never inspected — and, separately, a
     * free plugin that cannot boot.
     */
    public function testFailsWhenThereIsNoComposerDirectoryToInspect(): void
    {
        $result = $this->verify($this->stagedFree([
            'vendor/composer/autoload_psr4.php' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * A tree holding both plugin main files is not an ambiguity to resolve —
     * it is one artifact with the other plugin inside it, which is the leak.
     */
    public function testFailsWhenOneTreeHoldsBothPlugins(): void
    {
        $result = $this->verify($this->stagedFree([
            'wconvert-pro.php' => "<?php\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('more than one plugin main file', $result['output']);
    }

    // =========================================================================
    // (d) THE UN-MINIFIED SOURCE TREE.
    // =========================================================================

    /**
     * ========================================================================
     * WSMS'S TRAP, WHICH ADR 0028 DELETES RATHER THAN INHERITS.
     * ========================================================================
     * WSMS's .distignore strips its /resources while its readme still says
     * sources ship there. That is a readme making a claim the artifact does not
     * keep, and nothing in WSMS's build notices. This is the test that makes
     * the same line in our readme.txt true by construction.
     */
    public function testFailsWhenTheLoaderSourceIsStrippedFromTheFreeTree(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/loader/src/main.ts' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('resources/loader/src', $result['output']);
    }

    public function testFailsWhenTheAdminSourceIsStrippedFromTheFreeTree(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/admin/src/main.tsx' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * **An empty source directory is not a source directory.** A stage that
     * created `resources/loader/src/` and copied nothing into it satisfies
     * every existence check and publishes nothing, which is the shape "couldn't
     * look" takes when a copy half-succeeds.
     */
    public function testFailsWhenTheSourceDirectoryExistsButHoldsNothing(): void
    {
        $tree = $this->stagedFree(['resources/loader/src/main.ts' => null]);
        mkdir($tree . '/resources/loader/src', 0777, true);

        $result = $this->verify($tree);

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('nothing was inspected', $result['output']);
    }

    /**
     * `resources/` is checked for BOTH of its jobs, which is what keeps the
     * list of things it must contain from being arbitrary: it is the
     * un-minified source Guideline 4 requires published AND the runtime data
     * src/ reads by a path constant. A ZIP missing the rule manifest is a
     * plugin that cannot evaluate a rule.
     */
    public function testFailsWhenTheRuntimeDataUnderResourcesIsStripped(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/rules/manifest.json' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('RuleManifest', $result['output']);
    }

    // =========================================================================
    // The floor: is it a plugin at all?
    // =========================================================================

    /**
     * **Pro's loader is not optional.** Pro dequeues free's loader and enqueues
     * its own (ADR 0014), so a Pro ZIP without this file leaves every page with
     * no loader at all — the same silent, total loss of function ADR 0004
     * exists to prevent, arriving through a missing file.
     */
    public function testFailsWhenAProTreeShipsNoBuiltLoader(): void
    {
        $result = $this->verify($this->stagedPro([
            'public/loader/loader.js' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('loader.js', $result['output']);
    }

    /**
     * A zero-byte bundle passes every existence check, ships nothing, and is
     * what a build that failed halfway leaves behind.
     */
    public function testFailsWhenABuiltBundleIsEmpty(): void
    {
        $result = $this->verify($this->stagedFree([
            'public/loader/loader.js' => '',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('empty', $result['output']);
    }

    /**
     * **The builder is a chunk the entry fetches**, so a ZIP carrying the entry
     * without it boots, renders four working screens, and fails only on the
     * fifth — in a browser, with a 404 in a console nobody has open (#73).
     */
    public function testFailsWhenTheAdminShipsNoBuilderChunk(): void
    {
        $result = $this->verify($this->stagedFree([
            'public/admin/builder-def67890.js' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('builder-*.js', $result['output']);
    }

    /**
     * The hashed names are matched by pattern, which is where a zero-byte file
     * is easiest to wave through — `find` reports a match and nothing looks at
     * the size. It is the same halfway-failed build the loader's own case names.
     */
    public function testFailsWhenTheAdminBundleIsEmpty(): void
    {
        $result = $this->verify($this->stagedFree([
            'public/admin/main-abc12345.js' => '',
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('main-*.js', $result['output']);
    }

    public function testFailsWhenFreeShipsNoComposerAutoloader(): void
    {
        $result = $this->verify($this->stagedFree([
            'vendor/autoload.php' => null,
            'vendor/composer/autoload_psr4.php' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testFailsWhenFreeShipsNoReadme(): void
    {
        $result = $this->verify($this->stagedFree(['readme.txt' => null]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('readme.txt', $result['output']);
    }

    public function testFailsWhenTheStageWasNeverStrippedOfNodeModules(): void
    {
        $result = $this->verify($this->stagedFree([
            'node_modules/react/index.js' => "module.exports = {};\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('node_modules', $result['output']);
    }

    public function testFailsWhenTheStageCarriesTheRepositorysGitDirectory(): void
    {
        $result = $this->verify($this->stagedFree(['.git/HEAD' => "ref: refs/heads/main\n"]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('.git', $result['output']);
    }

    // =========================================================================
    // Could not look.
    // =========================================================================

    public function testFailsOnATreeThatIsNotAPluginAtAll(): void
    {
        $result = $this->verify($this->tree(['notes.txt' => 'nothing here']));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    public function testFailsOnATreeThatDoesNotExist(): void
    {
        $result = $this->verify(sys_get_temp_dir() . '/wconvert-artifact-no-such-tree');

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * No tree at all. A release build whose invocation lost its argument must
     * not report a clean contract for the nothing it inspected.
     */
    public function testFailsWhenGivenNoTreeAtAll(): void
    {
        $output = [];
        $status = 0;

        exec(sprintf('bash %s 2>&1', escapeshellarg(self::SCRIPT)), $output, $status);

        $this->assertSame(1, $status, implode("\n", $output));
    }
}
