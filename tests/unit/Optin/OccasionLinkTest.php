<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\InvalidOccasion;
use WConvert\Optin\OccasionLink;

#[CoversClass(OccasionLink::class)]
final class OccasionLinkTest extends TestCase
{
    public function testAnOccasionThatExistsIsKept(): void
    {
        self::assertSame('black-friday', OccasionLink::normalize('black-friday', ['launch', 'black-friday'], null));
    }

    public function testNothingIsNoLink(): void
    {
        self::assertNull(OccasionLink::normalize(null, ['black-friday'], 'black-friday'));
        self::assertNull(OccasionLink::normalize('', ['black-friday'], null));
    }

    /** ADR 0149 §5: the occasion was deleted since, so the next save detaches. */
    public function testTheStoredOccasionDeletedSinceIsDroppedSilently(): void
    {
        self::assertNull(OccasionLink::normalize('black-friday', [], 'black-friday'));
    }

    public function testAnyOtherUnknownOccasionIsRefused(): void
    {
        $this->expectException(InvalidOccasion::class);
        OccasionLink::normalize('cyber-monday', ['black-friday'], 'black-friday');
    }

    public function testANonStringIsRefused(): void
    {
        $this->expectException(InvalidOccasion::class);
        OccasionLink::normalize(['black-friday'], ['black-friday'], null);
    }

    public function testAStoredLinkReadsAsNoneOnceItsOccasionIsGone(): void
    {
        self::assertSame('launch', OccasionLink::read('launch', ['launch']));
        self::assertNull(OccasionLink::read('launch', []));
        self::assertNull(OccasionLink::read(null, ['launch']));
    }
}
