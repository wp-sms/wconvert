<?php
namespace WConvert\Tests\Unit\Template\Transfer;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Transfer\ImportSession;

final class ImportSessionTest extends TestCase
{
    public function testApplyRetryReturnsTheRecordedResultWithoutRunningAgain(): void
    {
        $root = sys_get_temp_dir() . '/wc-session-test-' . bin2hex(random_bytes(6));
        $store = new ImportSession($root, 'site1-user1');
        $source = tempnam(sys_get_temp_dir(), 'wc-source');
        file_put_contents($source, 'example zip');
        try {
            $id = $store->create($source);
            $calls = 0;
            $apply = function (array &$session, string $archive) use (&$calls): array {
                if (isset($session['result'])) return $session['result'];
                $calls++;
                return $session['result'] = ['media' => 42];
            };
            self::assertSame(['media' => 42], $store->with($id, $apply));
            self::assertSame(['media' => 42], $store->with($id, $apply));
            self::assertSame(1, $calls);
            $other = new ImportSession($root, 'site2-user1');
            try { $other->with($id, $apply); self::fail('Another site accessed this session'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('expired', $e->getMessage()); }
            self::assertSame('example zip', $store->view($id, fn (string $path): string => $store->view($id, fn (string $again): string => (string) file_get_contents($again))));
            $replacement = $store->create($source);
            try { $store->view($id, fn () => null); self::fail('Replaced preview was accessible'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('replaced', $e->getMessage()); }
            $store->with($replacement, static function (array &$session): void { $session['expires'] = time() - 1; });
            try { $store->view($replacement, fn () => null); self::fail('Expired preview was accessible'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('expired', $e->getMessage()); }
            $store->expire();
            self::assertSame([], glob($root . '/*/upload.zip'));
            $store->cancel($replacement);
        } finally {
            unlink($source);
            foreach (glob($root . '/*/*') ?: [] as $file) unlink($file);
            foreach (glob($root . '/*') ?: [] as $dir) rmdir($dir);
            rmdir($root);
        }
    }
}
