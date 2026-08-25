<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\ThemeTokens;

/**
 * Theme inheritance, as an opt-in **value copy**.
 *
 * What this produces is a token map the merchant may copy into an [[Optin]]'s
 * own tokens. Nothing records where a token came from and nothing reads the
 * theme again — a stored "inherit" flag would restyle every running Optin the
 * day the merchant switches theme, which is the same surprise ADR 0010 keeps a
 * Template's snapshot away from.
 *
 * **Colours and type only, never shape**, and only what the theme actually
 * declares: offering a wrong colour is worse than offering none, because the
 * merchant sees a design that looks broken and cannot tell which of four
 * values went wrong.
 */
#[CoversClass(ThemeTokens::class)]
final class ThemeTokensTest extends TestCase
{
    public function testItReadsTheSlugsAThemeIsLikelyToUse(): void
    {
        $tokens = ThemeTokens::from(
            ['base' => '#ffffff', 'contrast' => '#111111', 'primary' => '#2563eb'],
            'Inter, sans-serif'
        );

        $this->assertSame('#ffffff', $tokens['bg']);
        $this->assertSame('#111111', $tokens['fg']);
        $this->assertSame('#2563eb', $tokens['accent']);
        $this->assertSame('Inter, sans-serif', $tokens['font']);
    }

    /**
     * WordPress does not standardise palette slugs, so this is a preference
     * order rather than a lookup — and a token with no match is simply not
     * offered.
     */
    public function testATokenNoSlugMatchesIsNotOffered(): void
    {
        $tokens = ThemeTokens::from(['brand-blue' => '#2563eb'], null);

        $this->assertSame([], $tokens);
    }

    public function testAFallbackSlugIsUsedWhereThePreferredOneIsAbsent(): void
    {
        $tokens = ThemeTokens::from(['background' => '#fafafa', 'foreground' => '#222222'], null);

        $this->assertSame('#fafafa', $tokens['bg']);
        $this->assertSame('#222222', $tokens['fg']);
    }

    /**
     * The one derived value. A theme declares no "text on the accent colour",
     * and an accent button whose label cannot be read is worse than a button
     * in the wrong colour — the merchant can see the second one.
     */
    public function testTextOnTheAccentIsWhicheverOfTheTwoCanBeReadOnIt(): void
    {
        $dark = ThemeTokens::from(['base' => '#ffffff', 'contrast' => '#111111', 'primary' => '#111827'], null);
        $light = ThemeTokens::from(['base' => '#ffffff', 'contrast' => '#111111', 'primary' => '#fde047'], null);

        $this->assertSame('#ffffff', $dark['accent-fg'], 'light text on a dark accent');
        $this->assertSame('#111111', $light['accent-fg'], 'dark text on a light accent');
    }

    /**
     * Luminance is computed on linearised channels, which is what makes yellow
     * read as light and blue as dark. A plain channel average calls `#0000ff`
     * and `#ffff00` the same brightness and puts white text on the yellow one.
     */
    public function testAVividYellowCountsAsLightAndAVividBlueAsDark(): void
    {
        $palette = ['base' => '#ffffff', 'contrast' => '#000000'];

        $this->assertSame('#000000', ThemeTokens::from($palette + ['primary' => '#ffff00'], null)['accent-fg']);
        $this->assertSame('#ffffff', ThemeTokens::from($palette + ['primary' => '#0000ff'], null)['accent-fg']);
    }

    /**
     * A palette entry may be `rgb()`, a gradient or a custom property, and
     * none of those can be measured without a CSS engine. The colour is still
     * copied — it is what the theme says — but no `accent-fg` is guessed, so
     * the [[Template]]'s own survives.
     */
    public function testAnUnmeasurableAccentIsCopiedButNotGuessedAgainst(): void
    {
        $tokens = ThemeTokens::from(
            ['base' => '#ffffff', 'contrast' => '#111111', 'primary' => 'rgb(37 99 235)'],
            null
        );

        $this->assertSame('rgb(37 99 235)', $tokens['accent']);
        $this->assertArrayNotHasKey('accent-fg', $tokens);
    }

    /**
     * A classic theme with no `theme.json` declares no palette at all, and an
     * empty map is the honest answer — the panel says there is nothing to copy
     * rather than offering a button that does nothing.
     */
    public function testAThemeThatDeclaresNothingOffersNothing(): void
    {
        $this->assertSame([], ThemeTokens::from([], null));
    }

    /** Three-digit hex is a colour like any other, and themes still write it. */
    public function testShorthandHexIsMeasuredLikeAnyOther(): void
    {
        $tokens = ThemeTokens::from(['base' => '#fff', 'contrast' => '#000', 'primary' => '#000'], null);

        $this->assertSame('#fff', $tokens['accent-fg']);
    }
}
