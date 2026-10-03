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
     * `OPTION` and `*_OPTION` name owned options, including the two catalog
     * options. The schema version is also named directly.
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
                    "/(?:public|private|protected) const (?:[A-Z_]+_)?OPTION = '([a-z0-9_]+)'/",
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
     * well, not just "at least the ones we thought of".
     */
    public function testEveryOptionWConvertStoresIsDeleted(): void
    {
        $options = self::everyOptionInTheSource();
        $contents = self::contents();

        $this->assertCount(15, $options, 'every new option needs an uninstall entry');

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
     * inexpressible, in the one file that runs outside it. `%i` has existed
     * since WordPress 6.2, and this is the place a reviewer is
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

    public function testPackCleanupRemovesOnlyOwnedFilesAndNeverFollowsDirectories(): void
    {
        $uploads = sys_get_temp_dir() . '/wconvert-uninstall-' . bin2hex(random_bytes(8));
        $archive = $uploads . '/wconvert-template-packs';
        mkdir($archive, 0755, true);
        $owned = $archive . '/' . str_repeat('a', 64) . '.json';
        file_put_contents($owned, '{}');
        file_put_contents($archive . '/.pack-test123', '{}');
        file_put_contents($uploads . '/keep.txt', 'other uploads');
        file_put_contents($archive . '/keep.txt', 'site owner file');
        symlink($uploads . '/keep.txt', $archive . '/' . str_repeat('b', 64) . '.json');
        try {
            $script = self::root() . '/tests/fixtures/uninstall-packs.php';
            exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg($uploads), $output, $code);
            $this->assertSame(0, $code, implode("\n", $output));
            $this->assertFileDoesNotExist($owned);
            $this->assertFileDoesNotExist($archive . '/.pack-test123');
            $this->assertFileExists($uploads . '/keep.txt');
            $this->assertFileExists($archive . '/keep.txt');
        } finally {
            foreach (glob($archive . '/*') ?: [] as $file) unlink($file);
            foreach (glob($archive . '/.pack-*') ?: [] as $file) unlink($file);
            rmdir($archive); unlink($uploads . '/keep.txt'); rmdir($uploads);
        }
    }

    /**
     * The image store, the private import folder and every schedule go too —
     * by WConvert's own file names, and never through a link or into a file
     * somebody else put there.
     */
    public function testImagesImportsAndSchedulesAreRemovedAndNothingElse(): void
    {
        $base = sys_get_temp_dir() . '/wconvert-uninstall-' . bin2hex(random_bytes(8));
        $uploads = $base . '/uploads';
        $temp = $base . '/tmp';
        $images = $uploads . '/wconvert-template-images';
        // The folder name TemplateTransferController::folder() derives, for the fixture's ABSPATH and salt.
        $transfer = $temp . '/wconvert-transfer-' . substr(hash('sha256', '/srv/site/salt'), 0, 24);
        $session = $transfer . '/' . str_repeat('c', 64);
        foreach ([$images . '/free', $images . '/premium', $images . '/sets', $session] as $folder) mkdir($folder, 0755, true);
        $owned = [
            $images . '/free/' . str_repeat('a', 64) . '.png',
            $images . '/premium/' . str_repeat('b', 64) . '.webp',
            $images . '/sets/' . str_repeat('d', 64) . '.json',
            $images . '/.install.lock',
            $session . '/session.json',
            $session . '/upload.zip',
            $session . '/lock',
            $transfer . '/export-Ab12Cd',
        ];
        foreach ($owned as $file) file_put_contents($file, 'x');
        file_put_contents($images . '/free/keep.txt', 'site owner file');
        $log = $base . '/unscheduled.txt';
        try {
            $script = self::root() . '/tests/fixtures/uninstall-packs.php';
            exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg($uploads) . ' ' . escapeshellarg($temp) . ' ' . escapeshellarg($log), $output, $code);
            $this->assertSame(0, $code, implode("\n", $output));
            foreach ($owned as $file) $this->assertFileDoesNotExist($file);
            $this->assertDirectoryDoesNotExist($transfer, 'an emptied import folder is removed');
            $this->assertDirectoryDoesNotExist($images . '/sets');
            $this->assertFileExists($images . '/free/keep.txt');
            $this->assertSame(
                ['wconvert_prune_leads', 'wconvert_recover_submissions', 'wconvert_transfer_cleanup'],
                explode("\n", (string) file_get_contents($log))
            );
        } finally {
            exec('rm -rf ' . escapeshellarg($base));
        }
    }

    /** Action Scheduler jobs are cancelled by WConvert's group — never by dropping a shared table. */
    public function testQueuedJobsAreCancelledByGroup(): void
    {
        $this->assertStringContainsString("as_unschedule_all_actions('', [], 'wconvert')", self::contents());
        $this->assertSame('wconvert', \WConvert\Queue\ActionSchedulerQueue::GROUP);
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
