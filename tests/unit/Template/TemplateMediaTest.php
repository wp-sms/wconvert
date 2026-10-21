<?php
namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateMedia;

#[CoversClass(TemplateMedia::class)]
final class TemplateMediaTest extends TestCase
{
    private string $directory;
    private string $name;
    private TemplateMedia $media;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-owned-media-' . bin2hex(random_bytes(6)) . '/';
        mkdir($this->directory);
        $this->name = hash('sha256', 'reviewed artwork') . '.webp';
        file_put_contents($this->directory . $this->name, 'reviewed artwork');
        $this->media = new TemplateMedia(['https://site.example/art/' => $this->directory]);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '*') ?: [] as $file) unlink($file);
        rmdir($this->directory);
    }

    public function testOnlyExactVerifiedArtworkCanBeAdopted(): void
    {
        self::assertSame(realpath($this->directory . $this->name), $this->media->source('https://site.example/art/' . $this->name)['path']);
        foreach ([
            'https://other.example/art/' . $this->name,
            'https://site.example/art/../' . $this->name,
            'https://site.example/art/%2e%2e/' . $this->name,
            'https://site.example/art/' . $this->name . '?file=secret',
            'https://site.example/art/photo.jpg',
            'data:image/svg+xml;base64,PHN2Zz4=',
            'linear-gradient(red, blue)',
        ] as $url) self::assertNull($this->media->source($url));
    }

    public function testTamperedArtworkIsRefusedBeforeAnyImport(): void
    {
        file_put_contents($this->directory . $this->name, 'changed');
        $config = ['template' => ['tokens' => ['bg-image' => 'url("https://site.example/art/' . $this->name . '")']]];
        $result = $this->media->adopt($config, 'Test');
        self::assertInstanceOf(\WP_Error::class, $result);
        self::assertSame('wconvert_template_media', $result->get_error_code());
    }

    public function testSymlinksCannotImportAnotherLocalFile(): void
    {
        rename($this->directory . $this->name, $this->directory . 'original');
        symlink($this->directory . 'original', $this->directory . $this->name);
        $this->expectException(\RuntimeException::class);
        $this->media->source('https://site.example/art/' . $this->name);
    }

    public function testMerchantImagesAndDecorationsPassThroughUnchanged(): void
    {
        $config = ['template' => ['tokens' => ['bg-image' => 'url("https://merchant.example/photo.jpg")'],
            'tree' => ['steps' => [['content' => ['type' => 'image', 'src' => 'https://site.example/uploads/photo.jpg',
                'narrow' => ['bg-image' => 'linear-gradient(red, blue)'], 'decorations' => ['bats' => true]]]]]]];
        self::assertSame($config, $this->media->adopt($config, 'Test'));
    }
}
