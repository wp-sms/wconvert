<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * =============================================================================
 * EVERY CLASS THAT SHIPS CAN BE LOADED ON THE OLDEST PHP THE PLUGIN CLAIMS.
 * =============================================================================
 * `wconvert.php` says `Requires PHP: 8.1` and `composer.json` says `>=8.1`, and
 * CI runs the suite on 8.1 and on the newest release. Neither of those catches
 * a class that **cannot be compiled** on 8.1 unless something loads it — and a
 * unit suite only loads the classes its tests name.
 *
 * `WpSitePresence` was exactly that. Its `private const CLASSES` keyed an array
 * by `SiteDependency::WooCommerce->value`, and a property fetch inside a
 * constant expression needs PHP 8.3. On 8.1 and 8.2 the file was
 * `Constant expression contains invalid operations` — a **fatal on every
 * front-end request**, because the loader's degradation resolver asks what the
 * site has. It sat in `main` behind a green suite and a green PHPStan: PHPStan
 * models types, not the compiler's rules about constant expressions, and no
 * test had ever named the class.
 *
 * So the assertion is the loading. Every PSR-4 class file in both trees is
 * autoloaded here, which on the 8.1 job is the compiler being asked whether it
 * can read what ships. A file that PHP cannot parse takes this test down with a
 * fatal that names it.
 *
 * **This is not a lint.** It is the only place in the suite where being on the
 * minimum supported PHP means anything, and it is cheap precisely because it
 * asserts nothing more than "this exists".
 */
#[CoversNothing]
final class EveryShippedClassCompilesTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../..';

    /**
     * Each tree, with the namespace its PSR-4 root maps to.
     *
     * Pro carries its own autoloader rather than riding on free's Composer map
     * (`pro/src/autoload.php`), so both prefixes are stated here rather than
     * read from one `composer.json` that only knows about half of it.
     */
    private const TREES = ['src' => 'WConvert\\', 'pro/src' => 'WConvert\\Pro\\'];

    public function testEveryShippedClassLoads(): void
    {
        $loaded = 0;

        foreach (self::TREES as $tree => $prefix) {
            $root = (string) realpath(self::ROOT . '/' . $tree) . '/';

            foreach (self::phpUnder($root) as $file) {
                $name = basename($file, '.php');

                // A file declaring no type of its own name is not a PSR-4 class
                // file — `src/constants.php` and `pro/src/autoload.php` are the
                // two — and autoloading it would mean RUNNING it. Read out of
                // the source with its comments stripped, so a docblock naming a
                // class cannot pass for a declaration.
                if (preg_match('/\b(class|interface|trait|enum)\s+' . preg_quote($name, '/') . '\b/', PhpSource::code($file)) !== 1) {
                    continue;
                }

                $class = $prefix . str_replace('/', '\\', substr($file, strlen($root), -4));

                // `class_exists()` autoloads, which is the whole point: on the
                // 8.1 job this is where PHP is asked to compile the file.
                $this->assertTrue(
                    class_exists($class) || interface_exists($class) || trait_exists($class) || enum_exists($class),
                    sprintf('%s does not load from %s', $class, $file)
                );

                $loaded++;
            }
        }

        $this->assertGreaterThan(
            100,
            $loaded,
            'far fewer classes loaded than either tree holds — the sweep found nothing, so nothing is proven'
        );
    }

    /**
     * Every `.php` file under a directory, sorted, as absolute paths.
     *
     * @return list<string>
     */
    private static function phpUnder(string $directory): array
    {
        $files = [];

        /** @var iterable<\SplFileInfo> $iterator */
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = (string) $file->getRealPath();
            }
        }

        sort($files);

        return $files;
    }
}
