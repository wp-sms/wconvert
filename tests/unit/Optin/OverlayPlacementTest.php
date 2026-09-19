<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\DisplayType;
use WConvert\Optin\OverlayPlacement;

#[CoversClass(OverlayPlacement::class)]
final class OverlayPlacementTest extends TestCase
{
    /** @return iterable<string, array{DisplayType, mixed, string|null}> */
    public static function normalizedPlacements(): iterable
    {
        yield 'top bar is the only stored bar override' => [DisplayType::FloatingBar, 'block_start', 'block_start'];
        yield 'bottom bar is the absent default' => [DisplayType::FloatingBar, 'block_end', null];
        yield 'top-start slide-in' => [DisplayType::SlideIn, 'block_start_inline_start', 'block_start_inline_start'];
        yield 'top-end slide-in' => [DisplayType::SlideIn, 'block_start_inline_end', 'block_start_inline_end'];
        yield 'bottom-start slide-in' => [DisplayType::SlideIn, 'block_end_inline_start', 'block_end_inline_start'];
        yield 'bottom-end slide-in is the absent default' => [DisplayType::SlideIn, 'block_end_inline_end', null];
        yield 'a bar cannot retain a slide-in corner' => [DisplayType::FloatingBar, 'block_start_inline_start', null];
        yield 'a slide-in cannot retain a bar edge' => [DisplayType::SlideIn, 'block_start', null];
        yield 'popup has no placement' => [DisplayType::Popup, 'block_start', null];
        yield 'fullscreen has no placement' => [DisplayType::Fullscreen, 'block_start', null];
        yield 'inline has no placement' => [DisplayType::Inline, 'block_start_inline_end', null];
        yield 'unknown values are removed' => [DisplayType::SlideIn, 'centre', null];
        yield 'non-string values are removed' => [DisplayType::FloatingBar, ['block_start'], null];
    }

    #[DataProvider('normalizedPlacements')]
    public function testItKeepsOnlyNonDefaultPlacementsValidForTheDisplayType(
        DisplayType $displayType,
        mixed $placement,
        ?string $expected
    ): void {
        self::assertSame($expected, OverlayPlacement::normalize($displayType, $placement));
    }
}
