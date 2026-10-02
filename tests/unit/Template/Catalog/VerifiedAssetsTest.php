<?php
namespace WConvert\Tests\Unit\Template\Catalog;
use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\VerifiedAssets;
final class VerifiedAssetsTest extends TestCase
{
    private string $directory;
    private string $image;
    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-assets-' . bin2hex(random_bytes(8));
        $this->image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=');
    }
    protected function tearDown(): void
    {
        if (!is_dir($this->directory)) return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($this->directory);
    }
    /** @return array<string, mixed> */
    private function asset(string $id = 'artwork'): array
    {
        return ['id' => $id, 'sha256' => hash('sha256', $this->image), 'mime' => 'image/png', 'bytes' => strlen($this->image), 'width' => 1, 'height' => 1, 'access' => 'free'];
    }
    public function testVerifiedImagesGetStableLocalReferencesAndAreReused(): void
    {
        $store = new VerifiedAssets($this->directory, 'https://local.example/uploads/template-assets');
        $calls = 0;
        $read = function (array $asset) use (&$calls): string { $calls++; return $this->image; };
        $result = $store->install(str_repeat('a', 64), [$this->asset()], $read);
        self::assertStringStartsWith('https://local.example/uploads/template-assets/free/', $result['artwork']);
        self::assertFileExists($this->directory . '/sets/' . str_repeat('a', 64) . '.json');
        self::assertSame($result, $store->install(str_repeat('b', 64), [$this->asset()], $read));
        self::assertSame(1, $calls);
    }
    public function testPartialFailureAndTamperingLeaveExistingImagesIntactAndAllowRetry(): void
    {
        $store = new VerifiedAssets($this->directory, 'https://local.example/assets');
        $old = $store->install(str_repeat('a', 64), [$this->asset()], fn (array $asset): string => $this->image);
        $premium = array_merge($this->asset(), ['access' => 'premium']);
        $second = array_merge($premium, ['id' => 'second']);
        $calls = 0;
        try {
            $store->install(str_repeat('b', 64), [$premium, $second], function (array $asset) use (&$calls): string {
                if (++$calls === 2) throw new \RuntimeException('Network interrupted');
                return $this->image;
            });
            self::fail('Partial package accepted');
        } catch (\RuntimeException $error) { self::assertSame('Network interrupted', $error->getMessage()); }
        self::assertFileDoesNotExist($this->directory . '/sets/' . str_repeat('b', 64) . '.json');
        self::assertSame([], glob($this->directory . '/.image-*'));
        $new = $store->install(str_repeat('b', 64), [$premium, $second], fn (array $asset): string => $this->image);
        self::assertNotSame($old['artwork'], $new['artwork'], 'Access scopes must not share a public object key');
        self::assertSame($new['artwork'], $new['second']);
        $path = $this->directory . '/premium/' . $premium['sha256'] . '.png';
        file_put_contents($path, 'corrupt');
        $store->install(str_repeat('b', 64), [$premium, $second], fn (array $asset): string => $this->image);
        self::assertSame($premium['sha256'], hash_file('sha256', $path));
        self::assertFileExists($this->directory . '/sets/' . str_repeat('a', 64) . '.json');
    }
    public function testInvalidImagesNeverCommitAManifest(): void
    {
        $store = new VerifiedAssets($this->directory, 'https://local.example/assets');
        foreach ([['mime' => 'image/svg+xml'], ['width' => 2], ['bytes' => 5242881], ['url' => 'https://remote.example/image.png']] as $change) {
            try {
                $store->install(str_repeat('c', 64), [array_merge($this->asset(), $change)], fn (array $asset): string => $this->image);
                self::fail('Unsupported or mismatched image accepted');
            } catch (\RuntimeException $error) { self::assertNotSame('', $error->getMessage()); }
            self::assertFileDoesNotExist($this->directory . '/sets/' . str_repeat('c', 64) . '.json');
        }
    }
}
