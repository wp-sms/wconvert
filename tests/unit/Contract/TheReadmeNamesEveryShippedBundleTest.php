<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\TestCase;

/**
 * ============================================================================
 * `readme.txt` NAMES EVERY BUNDLE THE FREE PLUGIN SHIPS, AND WHERE ITS SOURCE
 * IS.
 * ============================================================================
 * The claim is the one a wp.org reviewer can test and will:
 *
 * > Every piece of JavaScript this plugin ships is built from un-minified
 * > source included in the download, under `resources/`.
 *
 * {@see ArtifactContractTest} already proves the second half — that
 * `resources/loader/src` is really in the ZIP, which is the trap WSMS fell
 * into with a `.distignore` that stripped its own sources while its readme
 * still promised them. **What nothing checked was the enumeration**, and it
 * had gone wrong twice: `public/inspector/inspector.js` and the admin bundle's
 * `builder-*.js` chunk both ship and neither was named. A reader following the
 * list would find two files it does not account for, in the paragraph written
 * to reassure them.
 *
 * **It reads the Vite configs rather than `public/`**, and that is not a
 * convenience. `public/` is gitignored, so a clean CI checkout has none — a
 * test that read it would skip on the machine that matters, which is a check
 * that never runs (`bin/verify-source-contract.sh` makes the same argument
 * about failing closed). The configs are source, they are what changes when
 * somebody adds a bundle, and adding one is exactly the moment this paragraph
 * goes stale.
 *
 * **Pro's two configs are deliberately excluded.** `readme.txt` is free's
 * artifact and describes free's download; Pro ships its own loader and
 * inspector, and naming them here would be the free readme promising sources
 * for code the free ZIP has never contained (ADR 0015).
 */
final class TheReadmeNamesEveryShippedBundleTest extends TestCase
{
    /**
     * Free's four builds. Pro's `-pro` pair is not free's to describe.
     *
     * Listed rather than globbed for `vite.config.*.mjs`, because a glob would
     * silently start requiring Pro's two the moment somebody renamed a file —
     * and the point of the exclusion is that it is a decision.
     */
    private const FREE_CONFIGS = [
        'vite.config.loader.mjs',
        'vite.config.inspector.mjs',
        'vite.config.admin.mjs',
        'vite.config.block.mjs',
    ];

    public function testEveryFreeBundleHasItsOutputAndItsSourceNamedInTheReadme(): void
    {
        $root = dirname(__DIR__, 3);
        $readme = (string) file_get_contents($root . '/readme.txt');

        $missing = [];

        foreach (self::FREE_CONFIGS as $config) {
            $source = (string) file_get_contents($root . '/' . $config);

            [$outDir, $entry] = [$this->outDirIn($source), $this->entryIn($source)];

            self::assertNotSame('', $outDir, "$config declares no outDir this test can read");
            self::assertNotSame('', $entry, "$config declares no entry this test can read");

            if (!str_contains($readme, $outDir)) {
                $missing[] = "readme.txt does not name the output directory $outDir ($config)";
            }

            if (!str_contains($readme, $entry)) {
                $missing[] = "readme.txt does not name the source directory $entry ($config)";
            }
        }

        self::assertSame([], $missing, 'a shipped bundle the readme does not account for');
    }

    /**
     * `public/admin`, `public/loader`, … — with the trailing slash the readme
     * writes, so `public/loader/` does not satisfy a claim about
     * `public/loader-pro/`.
     */
    private function outDirIn(string $config): string
    {
        return preg_match("/outDir:\s*(?:resolve\([^,]+,\s*)?'([^']+)'/", $config, $found) === 1
            ? rtrim($found[1], '/') . '/'
            : '';
    }

    /**
     * The DIRECTORY the entry lives in, not the entry file.
     *
     * The readme names source roots — `resources/loader/src` — because that is
     * what a reader opens, and because the loader and the inspector are two
     * builds out of one tree.
     */
    private function entryIn(string $config): string
    {
        // `entry` in a lib build, `input` in an application one — the admin
        // bundle is the second, deliberately (see its own config's header), so
        // reading only one spelling would silently stop covering it.
        if (preg_match("/(?:entry|input):\s*(?:resolve\([^,]+,\s*)?'([^']+)'/", $config, $found) !== 1) {
            return '';
        }

        // `resources/loader/src/inspect/main.ts` → `resources/loader/src`, and
        // `resources/admin/src/main.tsx` → `resources/admin/src`. The readme
        // names the tree a reader opens rather than every subdirectory in it.
        $parts = explode('/', $found[1]);
        $upToSrc = [];

        foreach ($parts as $part) {
            $upToSrc[] = $part;

            if ($part === 'src') {
                break;
            }
        }

        return implode('/', $upToSrc);
    }
}
