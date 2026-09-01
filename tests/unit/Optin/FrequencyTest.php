<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\Frequency;

/**
 * The allowance, normalised.
 *
 * Everything asserted here is a fact about what `resources/loader/src/frequency.ts`
 * does with the result, which is the only reason any of it is a rule: the
 * payload is inlined verbatim into every matching page, so a key this writes
 * is a key every visitor pays for on every page view.
 */
#[CoversClass(Frequency::class)]
final class FrequencyTest extends TestCase
{
    /**
     * **Nothing set is nothing stored**, so the caller can drop the key.
     *
     * `frequency.ts` treats an absent block and a default one identically, and
     * an empty object is bytes on every matching page view that cannot change
     * an answer (ADR 0014's budget).
     */
    public function testAnUntouchedAllowanceStoresNothing(): void
    {
        $this->assertSame([], Frequency::fromArray([])->toArray());
        $this->assertTrue(Frequency::fromArray([])->isEmpty());
    }

    /**
     * **`true` never travels.** Both switches default on and `frequency.ts`
     * tests `!== false`, so storing the default costs bytes and decides
     * nothing.
     */
    public function testTheTwoSwitchesTravelOnlyWhenTurnedOff(): void
    {
        $on = Frequency::fromArray(['stopAfterDismiss' => true, 'stopAfterConversion' => true]);

        $this->assertSame([], $on->toArray());

        $off = Frequency::fromArray(['stopAfterDismiss' => false, 'stopAfterConversion' => false]);

        $this->assertSame(
            ['stopAfterDismiss' => false, 'stopAfterConversion' => false],
            $off->toArray()
        );
    }

    /** Absent reads as the engine's default, which is on. */
    public function testAnAbsentSwitchIsOn(): void
    {
        $frequency = Frequency::fromArray([]);

        $this->assertTrue($frequency->stopAfterDismiss);
        $this->assertTrue($frequency->stopAfterConversion);
    }

    public function testTheTwoCountsAreKeptWhenTheyAreCounts(): void
    {
        $this->assertSame(
            ['maxImpressions' => 3, 'cooldownDays' => 7],
            Frequency::fromArray(['maxImpressions' => 3, 'cooldownDays' => 7])->toArray()
        );
    }

    /**
     * **Zero is not a smaller cap, it is a state with no word.**
     *
     * A `maxImpressions` of 0 would publish an Optin that can never show, and
     * the merchant would have no way to read that off any screen. Dropped to
     * uncapped rather than refused, because the builder's own `min={1}` is
     * what keeps it out of range and a route that 400s over it would be
     * refusing a save the UI cannot produce.
     *
     * @param mixed $value
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('nonsenseCounts')]
    public function testACountThatIsNotACountIsDropped($value): void
    {
        $this->assertSame([], Frequency::fromArray(['maxImpressions' => $value])->toArray());
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function nonsenseCounts(): array
    {
        return [
            'zero' => [0],
            'negative' => [-4],
            'null' => [null],
            'a word' => ['often'],
            'an array' => [[3]],
            'a bool' => [true],
        ];
    }

    /** A numeric string is what a form posts, and it is a count. */
    public function testANumericStringIsACount(): void
    {
        $this->assertSame(['cooldownDays' => 7], Frequency::fromArray(['cooldownDays' => '7'])->toArray());
    }

    /** Storage → object → storage, unchanged. */
    public function testItRoundTrips(): void
    {
        $stored = ['maxImpressions' => 2, 'cooldownDays' => 30, 'stopAfterDismiss' => false];

        $this->assertSame($stored, Frequency::fromArray(Frequency::fromArray($stored)->toArray())->toArray());
    }
}
