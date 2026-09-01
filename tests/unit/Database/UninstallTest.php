<?php

namespace WConvert\Tests\Unit\Database;

use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Database\Installer;

/**
 * ============================================================================
 * DELETING WCONVERT LEAVES NOTHING OF WCONVERT BEHIND.
 * ============================================================================
 * `uninstall.php` runs with the plugin **not loaded** — no autoloader, no
 * container, nothing in `src/` — which is the property that makes it the right
 * shape for the one operation that destroys a merchant's data, and the reason
 * it spells its table and option names out by hand instead of reading the
 * constants that own them.
 *
 * Two copies of a list is exactly how a list goes stale, and the failure is
 * silent in the worst direction: an option added in six months is an option
 * every uninstall leaves behind forever, on every site, with nothing on any
 * screen to say so. So this file is the thing keeping them in step. It reads
 * the constants out of both source trees and fails on one `uninstall.php` does
 * not name — the same shape as
 * {@see \WConvert\Tests\Unit\Database\SchemaTest::testEveryTableInTheDdlHasASignedOffIndexBudget()},
 * which makes a new table's index budget a question that has to be answered in
 * a diff rather than skipped by default.
 *
 * It asserts NAMING rather than behaviour, deliberately. Running the file
 * needs a `$wpdb`, `WP_UNINSTALL_PLUGIN` and a real database, and what can go
 * wrong here is not that `delete_option()` fails — it is that nobody
 * remembered to call it.
 */
final class UninstallTest extends TestCase
{
    private static function root(): string
    {
        return dirname(__DIR__, 3);
    }

    private static function uninstallFile(): string
    {
        return self::root() . '/uninstall.php';
    }

    private static function contents(): string
    {
        $contents = file_get_contents(self::uninstallFile());

        self::assertNotFalse($contents, 'uninstall.php is readable');

        return $contents;
    }

    /**
     * Every option name WConvert stores, read out of the source rather than
     * listed here — so a store added to either tree reaches this test without
     * anybody adding a line to it.
     *
     * `public const OPTION` is the house spelling for "the option this class
     * owns", used by all six stores; the schema version is the one that is not
     * a store and is named directly.
     *
     * @return list<string>
     */
    private static function everyOptionInTheSource(): array
    {
        $options = [Installer::VERSION_OPTION];

        foreach (['/src', '/pro/src'] as $tree) {
            $directory = new \RecursiveDirectoryIterator(self::root() . $tree);

            /** @var \SplFileInfo $file */
            foreach (new \RecursiveIteratorIterator($directory) as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }

                preg_match_all(
                    "/public const OPTION = '([a-z0-9_]+)'/",
                    (string) file_get_contents($file->getPathname()),
                    $matches
                );

                foreach ($matches[1] as $option) {
                    $options[] = $option;
                }
            }
        }

        return array_values(array_unique($options));
    }

    public function testTheFileExistsAndRefusesToRunOnItsOwn(): void
    {
        $this->assertFileExists(self::uninstallFile());

        // The only guard, and the whole of it. WordPress defines this
        // immediately before including the file, so its absence means
        // something other than an uninstall asked for this to run.
        $this->assertStringContainsString(
            "defined('WP_UNINSTALL_PLUGIN') || exit;",
            self::contents()
        );
    }

    /**
     * **Every option, and the test finds them itself.**
     *
     * The count is asserted too, so that a `const OPTION` deleted from the
     * source without its line being removed from `uninstall.php` is visible as
     * well — the seven are the seven, not "at least the ones we thought of".
     */
    public function testEveryOptionWConvertStoresIsDeleted(): void
    {
        $options = self::everyOptionInTheSource();
        $contents = self::contents();

        $this->assertCount(7, $options, 'seven options; an eighth is a line uninstall.php needs');

        foreach ($options as $option) {
            $this->assertStringContainsString(
                "'{$option}'",
                $contents,
                "uninstall.php never deletes {$option}, so removing the plugin would orphan it forever"
            );
        }
    }

    /**
     * Every table in the DDL, named off {@see Connection}'s own constants.
     *
     * Those three are what {@see \WConvert\Database\Schema} creates and what
     * `SchemaTest` holds the shape of, so a fourth table cannot be added
     * without this failing.
     */
    public function testEveryTableWConvertCreatesIsDropped(): void
    {
        $contents = self::contents();

        foreach ([Connection::TABLE_OPTINS, Connection::TABLE_LEADS, Connection::TABLE_STATS] as $table) {
            $this->assertStringContainsString(
                "'{$table}'",
                $contents,
                "uninstall.php never drops {$table}"
            );
        }

        $this->assertStringContainsString('DROP TABLE IF EXISTS %i', $contents);
    }

    /**
     * **The identifier is bound, not concatenated.**
     *
     * `$wpdb->prefix . $table` interpolated into the statement would be the
     * one thing `WConvert\Database\WpdbConnection` exists to make
     * inexpressible, in the one file that runs outside it. `%i` is why the
     * plugin's floor is WordPress 6.2, and this is the place a reviewer is
     * least likely to look.
     */
    public function testTheTableNameIsBoundAsAnIdentifierRatherThanInterpolated(): void
    {
        $contents = self::contents();

        $this->assertStringContainsString('$wpdb->prepare(', $contents);
        $this->assertStringNotContainsString('DROP TABLE IF EXISTS {$', $contents);
        $this->assertStringNotContainsString("DROP TABLE IF EXISTS \" . \$wpdb->prefix", $contents);
    }

    /**
     * **Action Scheduler's tables are somebody else's.**
     *
     * WConvert bundles it as a core dependency, and so do WooCommerce and
     * WSMS; the newest copy on the site wins the version negotiation whichever
     * plugin shipped it. Dropping `actionscheduler_*` on uninstall would
     * delete another plugin's queue, which is a failure nobody would attribute
     * to the plugin that was removed.
     */
    public function testAnotherPluginsQueueIsNeverDropped(): void
    {
        $this->assertStringNotContainsString("'actionscheduler", self::contents());
    }

    /**
     * The file ships. `.distignore` is a denylist applied to a staged copy, so
     * a root PHP file is included unless something excludes it — and an
     * uninstall routine that is not in the ZIP is an uninstall routine that
     * never runs on any install that matters.
     */
    public function testTheFileIsNotExcludedFromTheDistributedArtifact(): void
    {
        $distignore = file_get_contents(self::root() . '/.distignore');

        $this->assertNotFalse($distignore);
        $this->assertStringNotContainsString('uninstall.php', $distignore);
    }
}
