<?php
namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use WConvert\Frontend\ContentRegion;
use WConvert\Pro\Module\ContentLock\ContentDivider;

/** @phpstan-import-type ParsedBlock from ContentDivider */
final class ContentDividerTest extends TestCase
{
    /**
     * @param list<array<string, mixed>> $children
     * @param array<string, mixed> $attrs
     * @return ParsedBlock */
    private static function block(string $name, string $html = '', array $children = [], array $attrs = []): array
    {
        return ['blockName' => $name, 'attrs' => $attrs, 'innerBlocks' => $children, 'innerHTML' => $html, 'innerContent' => [$html]];
    }

    public function testDividerWrapsOnlyFollowingBlocksWithoutChangingTheirContent(): void
    {
        $intro = self::block('core/paragraph', '<p>Public intro</p>');
        $marker = self::block('wconvert/content-lock-divider', '', [], ['optinId' => '01ARZ3NDEKTSV4RRFFQ69G5FAV']);
        $bonus = self::block('core/paragraph', '<p>Original <strong>bonus</strong></p>');
        $result = ContentDivider::wrap([$intro, $marker, $bonus]);
        self::assertSame($intro, $result[0]);
        self::assertCount(2, $result);
        self::assertSame(ContentRegion::BLOCK, $result[1]['blockName']);
        self::assertSame([$bonus], $result[1]['innerBlocks']);
        self::assertSame($marker['attrs'], $result[1]['attrs']);
    }

    public function testAmbiguousUnsupportedAndEmptyRemaindersStayUnchanged(): void
    {
        $marker = self::block(ContentDivider::BLOCK, '', [], ['optinId' => '01ARZ3NDEKTSV4RRFFQ69G5FAV']);
        $text = self::block('core/paragraph', '<p>Bonus</p>');
        foreach ([
            [self::block(ContentDivider::BLOCK), $text],
            [self::block(ContentDivider::BLOCK, '', [], ['optinId' => ['bad']]), $text],
            [self::block(ContentDivider::BLOCK, '<p>Unexpected saved content</p>', [], $marker['attrs']), $text],
            [$marker], [$marker, self::block('core/paragraph', '<p>&nbsp;</p>')],
            [$marker, self::block('core/spacer', '<div style="height:20px"></div>')],
            [$marker, $text, $marker], [self::block('core/group', '', [$marker]), $text],
            [$marker, self::block(ContentRegion::BLOCK, '', [$text])],
            [self::block(ContentRegion::BLOCK, '', [$text]), $marker, $text],
            [$marker, self::block('core/columns', '', [$text])],
            [$marker, self::block('core/embed', '<iframe src="https://example.com"></iframe>')],
            [$marker, self::block('core/paragraph', '<p>[other_form]</p>')],
            [$marker, self::block('core/paragraph', '<script>run()</script>')],
            [$marker, self::block('core/paragraph', '<p>Bound</p>', [], ['metadata' => ['bindings' => ['content' => []]]])],
            [self::block('core/nextpage'), $marker, $text],
            [self::block('core/more'), $marker, $text],
        ] as $blocks) self::assertSame($blocks, ContentDivider::wrap($blocks));
    }

    public function testNestedStaticContentAndLockedEditingControlsRemainSupported(): void
    {
        $marker = self::block(ContentDivider::BLOCK, '', [], ['optinId' => '01ARZ3NDEKTSV4RRFFQ69G5FAV']);
        $list = self::block('core/list', '<ul></ul>', [self::block('core/list-item', '<li>One</li>')]);
        $image = self::block('core/image', '<figure><img src="/public-image.jpg" alt="Diagram"></figure>', [], ['lock' => ['move' => true]]);
        $blocks = [$marker, $list, $image];
        $result = ContentDivider::wrap($blocks);
        self::assertSame([$list, $image], $result[0]['innerBlocks']);
        self::assertSame(ContentRegion::BLOCK, $result[0]['blockName']);
    }
}
