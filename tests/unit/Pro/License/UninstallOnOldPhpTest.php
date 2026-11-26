<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\RefreshCron;
use WConvert\Pro\License\SdkConfig;

/**
 * Deleting Pro below PHP 8.1 runs `pro/uninstall.php` on a PHP that cannot
 * parse the licence code, which used to stop the delete with a parse error.
 *
 * The suite cannot run on that PHP, so the file is run with its `PHP_VERSION`
 * replaced. A process each: the file needs `WP_UNINSTALL_PLUGIN`, and the old
 * path is only proven while no licence class has been loaded.
 */
#[CoversNothing]
#[RunTestsInSeparateProcesses]
final class UninstallOnOldPhpTest extends TestCase
{
    use FakesNexus;

    /** @return iterable<string, array{string}> */
    public static function oldVersions(): iterable
    {
        yield '7.4' => ['7.4.33'];
        yield '8.0' => ['8.0.30'];
    }

    #[DataProvider('oldVersions')]
    public function testBelowPhp81EverythingButTheLicenceGoes(string $version): void
    {
        $claim = 'wconvert_order_claim_' . str_repeat('a', 64);
        foreach ([SdkConfig::OPTION_KEY, SdkConfig::OPTION_KEY . '_cipher', 'wconvert_revenue', 'wconvert_analytics', 'wconvert_claims_mark', $claim] as $option) {
            update_option($option, 'kept until deleted');
        }
        $GLOBALS['wconvertTestSchedule'][RefreshCron::HOOK] = time();
        $GLOBALS['wconvertTestSchedule']['wconvert_claims_sweep'] = time();

        $this->deleteProOn($version, [$claim]);

        $this->assertFalse(class_exists('WConvert\Pro\License\Uninstall', false), 'licence code was read on a PHP that cannot parse it');
        // The key is what frees the seat, and nothing here can free it.
        $this->assertSame('kept until deleted', get_option(SdkConfig::OPTION_KEY));
        $this->assertSame('kept until deleted', get_option(SdkConfig::OPTION_KEY . '_cipher'));
        foreach (['wconvert_revenue', 'wconvert_analytics', 'wconvert_claims_mark', $claim] as $option) {
            $this->assertFalse(get_option($option), "{$option} outlived the delete");
        }
        $this->assertFalse(wp_next_scheduled(RefreshCron::HOOK));
        $this->assertFalse(wp_next_scheduled('wconvert_claims_sweep'));
    }

    public function testFromPhp81TheSeatIsReleasedAndTheLicenceGoes(): void
    {
        $this->fakeNexus();
        $this->activateLicenseHere();

        $this->deleteProOn('8.1.0', []);

        $this->assertCount(1, $this->nexusCallsTo('/api/v1/license/deactivate'));
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY));
    }

    /** @param list<string> $claims The claim rows the database answers with. */
    private function deleteProOn(string $version, array $claims): void
    {
        $GLOBALS['wpdb'] = new class ($claims) extends \wpdb {
            public string $options = 'wp_options';

            /** @param list<string> $claims */
            public function __construct(private readonly array $claims)
            {
            }

            public function get_col(string $sql): array
            {
                return $this->claims;
            }
        };
        define('WP_UNINSTALL_PLUGIN', 'wconvert-pro/wconvert-pro.php');

        $pro = dirname(__DIR__, 4) . '/pro';
        $source = str_replace(
            ['PHP_VERSION', '__DIR__'],
            [var_export($version, true), var_export($pro, true)],
            (string) file_get_contents($pro . '/uninstall.php')
        );
        $copy = (string) tempnam(sys_get_temp_dir(), 'wconvert-uninstall-');
        file_put_contents($copy, $source);

        try {
            (static function (string $file): void {
                require $file;
            })($copy);
        } finally {
            unlink($copy);
        }
    }
}
