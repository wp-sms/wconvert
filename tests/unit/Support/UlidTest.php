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

    /**
     * The leading 48 bits ARE the minting time, and this is the claim the rest
     * of the codebase leans on when it treats `ORDER BY id` as `ORDER BY
     * created_at` — the lead log's grouping view reads a group's last
     * submission off it, and retention pruning turns a cutoff into a range
     * over the primary key (ADR 0002, ADR 0018).
     */
    public function testTheMintingMillisecondReadsBackOutOfTheId(): void
    {
        $before = (int) floor(microtime(true) * 1000);
        $id = Ulid::generate();
        $after = (int) floor(microtime(true) * 1000);

        $minted = Ulid::timeOf($id);

        $this->assertNotNull($minted);
        $this->assertGreaterThanOrEqual($before, $minted);
        $this->assertLessThanOrEqual($after, $minted);
    }

    /**
     * The expected value is hand-decoded rather than round-tripped: `01J` is
     * `0, 1, 18` in Crockford base 32, so the timestamp is
     * `((0 * 32 + 1) * 32 + 18) * 32 ** 7` milliseconds. A test that encoded
     * it first would agree with the encoder whatever the encoder did.
     */
    public function testItDecodesAKnownTimestampRatherThanWhateverItEncoded(): void
    {
        $this->assertSame(1717986918400, Ulid::timeOf('01J0000000ZZZZZZZZZZZZZZZZ'));
    }

    public function testSomethingThatIsNotAUlidHasNoTimeToRead(): void
    {
        $this->assertNull(Ulid::timeOf(''));
        $this->assertNull(Ulid::timeOf('short'));
        // `U` is one of the four letters Crockford leaves out.
        $this->assertNull(Ulid::timeOf('01JU000000ZZZZZZZZZZZZZZZZ'));
    }

    /**
     * A boundary is not an id. It is the smallest value a ULID minted in that
     * millisecond could take, so `id < boundary` names every row captured
     * strictly before it — and a Lead minted in the boundary millisecond
     * itself is kept.
     */
    public function testABoundaryIsTheSmallestUlidOfItsMillisecond(): void
    {
        $boundary = Ulid::floorAt(1717986918400);

        $this->assertSame(Ulid::LENGTH, strlen($boundary));
        $this->assertSame('01J0000000', substr($boundary, 0, 10));
        $this->assertSame(str_repeat('0', 16), substr($boundary, 10));
        $this->assertSame(1717986918400, Ulid::timeOf($boundary));
    }

    public function testEveryIdMintedInAMillisecondSortsAtOrAboveItsBoundary(): void
    {
        $before = (int) floor(microtime(true) * 1000);
        $id = Ulid::generate();

        $this->assertGreaterThanOrEqual(Ulid::floorAt($before), $id);
    }
}
