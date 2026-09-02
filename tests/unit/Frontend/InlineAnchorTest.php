<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\InlineAnchor;
use WConvert\Frontend\InlineOptinBlock;
use WConvert\Frontend\InlineOptinShortcode;

/**
 * **The anchor is the whole contract**, and this is where the two authoring
 * surfaces are held to it.
 *
 * A block and a shortcode are two ways of writing down the same sentence —
 * *put this [[Optin]] here* — and the loader can only hear it one way:
 * `present.ts` queries the document for one attribute carrying one id. So the
 * thing worth testing is not that either surface renders; it is that they
 * render the SAME thing, because the way this breaks is a change to one that
 * misses the other. Nothing throws when they diverge. One of the two silently
 * stops placing Optins, on whichever pages happened to use it.
 *
 * The parity assertion is therefore first and the shape assertions are second,
 * and neither is enough alone: two surfaces that agree on the wrong element
 * are still one bug.
 */
#[CoversClass(InlineAnchor::class)]
#[CoversClass(InlineOptinBlock::class)]
#[CoversClass(InlineOptinShortcode::class)]
final class InlineAnchorTest extends TestCase
{
    private const OPTIN = '01JQ0000000000000000000001';

    public function testTheBlockAndTheShortcodeEmitTheIdenticalElement(): void
    {
        $this->assertSame(
            InlineOptinShortcode::render(['id' => self::OPTIN]),
            InlineOptinBlock::render(['optinId' => self::OPTIN]),
            'the two authoring surfaces have diverged — the loader can only hear one of them'
        );
    }

    public function testItIsOneEmptyElementCarryingTheIdAndNothingElse(): void
    {
        $this->assertSame(
            '<div data-wconvert-optin="' . self::OPTIN . '"></div>',
            InlineAnchor::html(self::OPTIN)
        );
    }

    /**
     * The attribute is spelled in TypeScript too, and a disagreement between
     * the two spellings throws nothing and looks like nothing — the anchor is
     * on the page, the loader queries for a name that is not on it, and every
     * inline Optin on the site quietly renders nothing.
     *
     * Read out of the loader's own source rather than restated here, so this
     * cannot pass by being edited to match.
     */
    public function testItIsTheAttributeTheLoaderQueriesFor(): void
    {
        $present = (string) file_get_contents(
            __DIR__ . '/../../../resources/loader/src/present.ts'
        );

        $matched = preg_match(
            "/INLINE_ANCHOR_ATTRIBUTE\s*=\s*'([^']+)'/",
            $present,
            $found
        );

        $this->assertSame(1, $matched, 'present.ts no longer declares INLINE_ANCHOR_ATTRIBUTE');
        $this->assertSame($found[1], InlineAnchor::ATTRIBUTE);
    }
}
