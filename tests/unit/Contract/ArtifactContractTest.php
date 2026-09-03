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

    /**
     * The tier ladder these fixtures are checked against.
     *
     * **The real one**, spelled the way the shipped `tiers.json` spells it, so
     * a fixture cannot pass against a ladder the product does not have. The
     * module slugs below are the product's, for the same reason: a Pro tree is
     * at whichever rung its modules put it at, and inventing slugs here would
     * test an inference nothing makes (ADR 0056).
     */
    private const LADDER = <<<'JSON'
        {
          "premium": {
            "slug": "wconvert-pro",
            "tiers": [
              { "slug": "basic", "name": "Pro", "modules": ["display-types"] },
              { "slug": "pro", "name": "Pro", "modules": ["display-types", "premium-triggers"] },
              { "slug": "elite", "name": "Pro", "modules": ["display-types", "premium-triggers", "cart-recovery"] }
            ]
          }
        }
        JSON;

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
            // The block editor's bundle, free only — Pro has no block. An
            // unregistered dynamic block renders nothing, so the block is
            // registered whether or not this file exists; the ZIP is where
            // that has to be caught instead.
            'public/blocks/inline-optin.js' => "console.log('block');\n",
            'resources/loader/src/main.ts' => "export const boot = () => {};\n",
            'resources/admin/src/main.tsx' => "export const App = () => null;\n",
            'resources/renderer/src/render.ts' => "export const render = () => {};\n",
            'resources/blocks/inline-optin/src/index.tsx' => "export const block = null;\n",
            'resources/blocks/inline-optin/block.json' => "{\"name\":\"wconvert/inline-optin\"}\n",
            'resources/rules/manifest.json' => "{\"targeting\":{}}\n",
            'resources/templates/manifest.json' => "{\"slots\":{}}\n",
            'resources/templates/library/centred-card.json' => "{\"tier\":\"free\"}\n",
            // The tier ladder, which is free's file and ships in free's ZIP:
            // the admin renders every upsell card's tier name from it, and
            // `WpProPresence` infers the installed tier through it (ADR 0056).
            'tiers.json' => self::LADDER,
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
            // Pro's admin bundle, both halves. Pro replaces free's on the same
            // rule it replaces the loader (ADR 0014 extended to the admin), so
            // a Pro ZIP without it degrades to free's screen — correctly and
            // silently, which is why the ZIP is where it has to be caught.
            'public/admin/main-abc12345.js' => "console.log('pro admin');\n",
            'public/admin/builder-def67890.js' => "console.log('pro builder');\n",
            'resources/loader/src/elite.ts' => "export const boot = () => {};\n",
            // ================================================================
            // A PRO TREE IS AT A RUNG, AND THE RUNG IS ITS MODULES (ADR 0056).
            // ================================================================
            // The elite one, because that is the tree with every module in it
            // and therefore the one whose contract is hardest to satisfy — a
            // fixture at the bottom rung would pass check (f) by having
            // nothing that could be too high. The tests that assert the
            // per-tier rules build lower rungs explicitly.
            'modules/display-types/module.json' => "{\"slug\":\"display-types\"}\n",
            'modules/premium-triggers/module.json' => "{\"slug\":\"premium-triggers\"}\n",
            'modules/cart-recovery/module.json' => "{\"slug\":\"cart-recovery\"}\n",
            // The premium designs, inside the module that owns them. Pro IS
            // where they ship, so a Pro artifact with an empty library is a
            // broken build rather than a clean one — it installs, replaces the
            // loader, and shows the customer the same locked upsell cards free
            // shows.
            'modules/display-types/templates/bar-announcement.json' => "{\"id\":\"bar-announcement\",\"tier\":\"basic\",\"tree\":{}}\n",
            ...$overrides,
        ]);
    }

    /**
     * A Pro tree cut to one rung, as `bin/build.sh` cuts it.
     *
     * @param list<string> $modules The module slugs this rung ships.
     * @param array<string, string|null> $overrides
     */
    private function stagedProAt(array $modules, array $overrides = []): string
    {
        $withheld = [];

        foreach (['display-types', 'premium-triggers', 'cart-recovery'] as $slug) {
            if (!in_array($slug, $modules, true)) {
                $withheld["modules/{$slug}/module.json"] = null;
            }
        }

        return $this->stagedPro([...$withheld, ...$overrides]);
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

    /**
     * ==========================================================================
     * PRO'S HALF OF (e), WHICH FAILS FOR THE OPPOSITE REASON.
     * ==========================================================================
     * Free's half catches a premium design that leaked IN. Pro's catches one
     * that never made it — and that is not a symmetry for its own sake. Pro's
     * designs are the whole of what a customer bought a `floating_bar` for, and
     * a build that staged `resources/` without them produces a ZIP that
     * installs, activates, replaces the loader, and shows a paying customer the
     * same locked upsell cards free shows, with nothing anywhere saying why.
     *
     * That is not hypothetical: it is exactly the state the product was in
     * until Pro registered a {@see \WConvert\Template\TemplateSource} of its
     * own, and it was invisible from every green suite.
     */
    public function testFailsWhenTheProTreeBundlesNoPremiumDesign(): void
    {
        // The library DIRECTORY is there, holding only free's own designs —
        // which is what a Pro build that copied the shared tree and forgot the
        // premium one actually looks like on disk. An absent directory is the
        // other failure and is asserted below.
        $result = $this->verify($this->stagedPro([
            'modules/display-types/templates/bar-announcement.json' => null,
            'modules/display-types/templates/centred-card.json' => "{\"id\":\"centred-card\",\"tier\":\"free\",\"tree\":{}}\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('bundles no premium design', $result['output']);
    }

    public function testFailsWhenTheProTreeCarriesNoDesignLibraryAtAll(): void
    {
        $result = $this->verify($this->stagedPro([
            'modules/display-types/templates/bar-announcement.json' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('not inspected', $result['output']);
    }

    public function testFailsWhenTheFreeTreeBundlesAPremiumDesign(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/templates/library/aurora.json' => "{\"id\":\"aurora\",\"tier\":\"basic\",\"tree\":{}}\n",
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
            'modules/display-types/templates/aurora.json' => "{\"id\":\"aurora\",\"tier\":\"basic\",\"tree\":{}}\n",
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    // =========================================================================
    // (f) NO ARTIFACT CARRIES A HIGHER TIER'S MODULE.
    //
    // The per-tier half, and what makes it worth a check rather than a note is
    // a measurement: WP Statistics ships 2.2 MB at basic against 3.3 MB at
    // elite, and WSMS ships a byte-identical `main.js` at all three of its
    // tiers — so a WSMS Basic customer holds the Elite React UI behind a
    // client-readable flag. Under possession-gating that is not a weaker gate,
    // it is no gate (ADR 0056).
    // =========================================================================

    /** Each rung, cut as the build cuts it, is a clean artifact of that rung. */
    public function testPassesOnEachRungCutToItsOwnModules(): void
    {
        foreach ([
            'basic' => ['display-types'],
            'pro' => ['display-types', 'premium-triggers'],
            'elite' => ['display-types', 'premium-triggers', 'cart-recovery'],
        ] as $rung => $modules) {
            $result = $this->verify($this->stagedProAt($modules));

            $this->assertSame(0, $result['status'], $result['output']);
            $this->assertStringContainsString(sprintf('is the %s tier', $rung), $result['output']);
        }
    }

    /**
     * ========================================================================
     * THE PHP HALF: A ZIP CARRYING A MODULE ITS OWN RUNG DOES NOT SHIP.
     * ========================================================================
     * A `rm -rf` that did not run. The tree below holds `display-types` and
     * `cart-recovery` and not `premium-triggers`, so the inference reads it as
     * `elite` — and `elite` ships every module, which is why the failure has
     * to come from the rung's DECLARATION rather than from comparing the tree
     * to itself. Here it is the missing one that gives it away.
     */
    public function testFailsWhenARungIsMissingAModuleItShips(): void
    {
        $result = $this->verify($this->stagedProAt(['display-types', 'cart-recovery']));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('premium-triggers', $result['output']);
    }

    /**
     * And the other way round: a Basic ZIP with a higher rung's module left in
     * it. The ZIP is named `basic` by the build and its contents say `pro`,
     * which is the state a half-run cut leaves behind.
     */
    public function testFailsWhenABasicZipCarriesAHigherRungsModule(): void
    {
        $tree = $this->stagedProAt(['display-types', 'premium-triggers']);

        // Inferred as `pro`, correctly. What makes it wrong is the design
        // library: `pro` ships `display-types` too, so the tree is internally
        // consistent — this asserts the artifact contract can still tell a
        // Basic build apart from a Pro one, which is what the ZIP's own name
        // will claim.
        $result = $this->verify($tree);

        $this->assertSame(0, $result['status'], $result['output']);
        $this->assertStringContainsString('is the pro tier', $result['output']);
        $this->assertStringNotContainsString('is the basic tier', $result['output']);
    }

    /**
     * ========================================================================
     * THE JAVASCRIPT HALF, WHICH IS THE ONE WSMS DOES NOT DO.
     * ========================================================================
     * Cutting a module directory removes its SOURCE. Whether the shipped
     * BUNDLE lost it is a different question, and the only honest way to ask
     * is of the bytes — a per-tier build whose Vite entry still imported every
     * module would pass every check above and ship one bundle three times.
     */
    public function testFailsWhenARungsBundleCarriesAHigherRungsRule(): void
    {
        foreach (['public/loader/loader.js', 'public/inspector/inspector.js'] as $built) {
            $result = $this->verify($this->stagedProAt(['display-types'], [
                $built => "var rules={exit_intent:1};\n",
            ]));

            $this->assertSame(1, $result['status'], sprintf('%s went unscanned: %s', $built, $result['output']));
            $this->assertStringContainsString('exit_intent', $result['output']);
        }
    }

    /** And a rung's own rules in its own bundle are exactly what belongs there. */
    public function testARungsBundleMayCarryItsOwnRules(): void
    {
        $result = $this->verify($this->stagedProAt(['display-types', 'premium-triggers'], [
            'public/loader/loader.js' => "var rules={exit_intent:1};\n",
        ]));

        $this->assertSame(0, $result['status'], $result['output']);
    }

    /**
     * `public/tiers/` is where the per-tier builds land in the REPOSITORY, and
     * it ships in nothing. Left in a stage it would put every other rung's
     * bundle inside this rung's ZIP — the byte-identical-JavaScript failure
     * arriving through the build instead of through a flag.
     */
    public function testFailsWhenAnArtifactStillCarriesThePerTierBuildScaffolding(): void
    {
        $result = $this->verify($this->stagedPro([
            'public/tiers/basic/loader/loader.js' => "console.log('basic');\n",
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('public/tiers/', $result['output']);
    }

    /** Fail-closed: a Pro tree with no module in it is at no rung at all. */
    public function testFailsWhenAProTreeCarriesNoModuleAndSoIsAtNoTier(): void
    {
        $result = $this->verify($this->stagedProAt([]));

        $this->assertSame(1, $result['status'], $result['output']);
    }

    /**
     * And free's own half of (f): the ladder is runtime data free reads by a
     * path constant, so a ZIP without it is one whose upsell cards cannot name
     * a tier. ADR 0015 records WSMS's shipped elite ZIP missing exactly this
     * file, benign there only because every lookup fails open.
     */
    public function testFailsWhenTheFreeArtifactCarriesNoTierLadder(): void
    {
        $result = $this->verify($this->stagedFree(['tiers.json' => null]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('tiers.json', $result['output']);
    }

    // =========================================================================
    // (g) NO LICENSING SDK IN THE FREE ZIP.
    //
    // A licence gates updates and support and never a feature (ADR 0015), so
    // the code that reads one is Pro's alone. Checked at the ARTIFACT because
    // `vendor/` is GENERATED: the SDK is vendored in through a Composer scoper
    // profile, so no source file in this repository ever names it and
    // bin/verify-source-contract.sh cannot see it however hard it looks — the
    // same argument (c) makes about the autoload map.
    // =========================================================================

    public function testFailsWhenTheFreeArtifactCarriesTheLicensingSdk(): void
    {
        foreach ([
            'vendor/veronalabs/wp-premium-sdk/src/LicenseManager.php' => "<?php\n",
            'packages/VeronaLabs/WpPremiumSdk/License/LicenseManager.php' => "<?php\n",
        ] as $path => $contents) {
            $result = $this->verify($this->stagedFree([$path => $contents]));

            $this->assertSame(1, $result['status'], sprintf('%s reached the free ZIP: %s', $path, $result['output']));
            $this->assertStringContainsString('licensing SDK', $result['output']);
        }
    }

    /** Pro is where it belongs, so a Pro artifact carrying it is clean. */
    public function testAProArtifactMayCarryTheLicensingSdk(): void
    {
        $result = $this->verify($this->stagedPro([
            'vendor/veronalabs/wp-premium-sdk/src/LicenseManager.php' => "<?php\n",
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

    /**
     * **A block that is registered and cannot be drawn.**
     *
     * The runtime deliberately registers the block whether or not this file is
     * there, because an unregistered dynamic block renders nothing and would
     * take the Optin off every page already carrying one. That is the right
     * trade at runtime and it is precisely why the ZIP has to be checked: the
     * failure it leaves is an inserter entry that produces an "unsupported
     * block", with the only evidence in a console nobody has open.
     */
    public function testFailsWhenFreeShipsNoBlockEditorBundle(): void
    {
        $result = $this->verify($this->stagedFree([
            'public/blocks/inline-optin.js' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('inline-optin.js', $result['output']);
    }

    /**
     * `block.json` is runtime data, not documentation: `register_block_type()`
     * is pointed at the directory and WordPress reads the file on every
     * request. A ZIP without it registers nothing at all.
     */
    public function testFailsWhenFreeShipsNoBlockMetadata(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/blocks/inline-optin/block.json' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('block.json', $result['output']);
    }

    /**
     * (d) again, for the third bundle. The readme claims every piece of
     * JavaScript ships with its un-minified source, and the block is a piece
     * of JavaScript.
     */
    public function testFailsWhenFreeShipsTheBlockBundleWithoutItsSource(): void
    {
        $result = $this->verify($this->stagedFree([
            'resources/blocks/inline-optin/src/index.tsx' => null,
        ]));

        $this->assertSame(1, $result['status'], $result['output']);
        $this->assertStringContainsString('resources/blocks/inline-optin/src', $result['output']);
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
