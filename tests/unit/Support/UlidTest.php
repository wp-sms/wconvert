<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\Ulid;

/**
 * An Optin's id is public: it is inlined into the JSON payload of a publicly
 * cached page and echoed in every analytics beacon (ADR 0001). Each property
 * below is one of the reasons it is a ULID and not an auto-increment.
 */
#[CoversClass(Ulid::class)]
final class UlidTest extends TestCase
{
    public function testItIsTwentySixCrockfordBase32Characters(): void
    {
        $ulid = Ulid::generate();

        $this->assertSame(26, strlen($ulid));
        $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/', $ulid);
    }

    /**
     * No I, L, O or U. The alphabet excludes them so a transcribed id cannot
     * be misread as a digit, and the route constraint in the REST controller
     * is written to the same alphabet.
     */
    public function testItNeverUsesTheAmbiguousLetters(): void
    {
        $ids = implode('', array_map(static fn (): string => Ulid::generate(), range(1, 200)));

        foreach (['I', 'L', 'O', 'U'] as $ambiguous) {
            $this->assertStringNotContainsString($ambiguous, $ids);
        }
    }

    /**
     * The table has no `created_at` column, so `ORDER BY id` is what stands in
     * for one. That only works if the leading timestamp really does lead.
     */
    public function testIdsMintedLaterSortAfterIdsMintedEarlier(): void
    {
        $earlier = Ulid::generate();
        usleep(2000);
        $later = Ulid::generate();

        $this->assertGreaterThan(substr($earlier, 0, 10), substr($later, 0, 10));
        $this->assertGreaterThan($earlier, $later);
    }

    public function testTwoThousandIdsAreAllDistinct(): void
    {
        $ids = array_map(static fn (): string => Ulid::generate(), range(1, 2000));

        $this->assertCount(2000, array_unique($ids));
    }
}
