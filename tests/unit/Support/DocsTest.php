<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\Docs;
use WConvert\Template\Catalog\TemplateCatalog;

/**
 * The PHP twin of `shell/docs.ts` (ADR 0189). Its strings are pinned here and
 * in `tests/js/site-links.test.ts`, so the two cannot drift apart unnoticed.
 */
#[CoversClass(Docs::class)]
final class DocsTest extends TestCase
{
    public function testItAddsTheFourFixedTags(): void
    {
        self::assertSame('https://wconvert.io/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=footer', Docs::tagged('https://wconvert.io/', 'footer'));
        self::assertSame('https://wconvert.io/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-pro&utm_content=license', Docs::tagged('https://wconvert.io/', 'license', Docs::PRO));
    }

    public function testTheTagsGoBeforeASection(): void
    {
        self::assertSame(
            'https://wconvert.io/docs/update-wconvert/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=admin-notice#update-the-files',
            Docs::url(Docs::UPDATE, 'update-the-files', 'admin-notice')
        );
    }

    public function testItKeepsAQueryTheAddressAlreadyHas(): void
    {
        self::assertSame('https://a.test/?q=1&utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=guide#b', Docs::tagged('https://a.test/?q=1#b', 'guide'));
    }

    public function testALockedDesignCardLinksItsPageTagged(): void
    {
        self::assertSame(
            'https://wconvert.io/templates/a%20b/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=template-card',
            TemplateCatalog::previewUrl('a b')
        );
    }
}
