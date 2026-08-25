<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\StatKind;

/**
 * **The loader's `BeaconKind` and PHP's {@see StatKind} say the same three
 * words.**
 *
 * The kinds are spelled twice — once as a PHP enum, once as a TypeScript union
 * in `resources/loader/src/beacon.ts` — and there is no manifest between them
 * to be the single source, because there is nothing else about a kind to
 * declare. Two spellings with nothing asserting they agree is how a fifth case
 * gets added to the enum and the loader silently keeps sending four.
 *
 * This is the same guard `tests/js/manifest-parity.test.ts` and
 * `renderer-manifest-parity.test.ts` apply to the rule and template
 * vocabularies, pointed at the one cross-language list that has no file of its
 * own. It reads the TypeScript as TEXT rather than importing it, because PHPUnit
 * cannot run TypeScript and a copy of the list in a fixture would be a third
 * spelling.
 *
 * **Three, not four.** `lead_magnet_delivered` is PHP's alone: it records an
 * act a browser cannot have watched, so the loader must not be able to name it
 * (ADR 0020).
 */
#[CoversNothing]
final class BeaconKindParityTest extends TestCase
{
    private const LOADER = __DIR__ . '/../../../resources/loader/src/beacon.ts';

    /**
     * The union's members, read out of the declaration.
     *
     * @return list<string>
     */
    private static function loaderKinds(): array
    {
        $source = (string) file_get_contents(self::LOADER);

        self::assertNotSame('', $source, 'the loader source is readable');

        $matched = preg_match('/export type BeaconKind =([^;]+);/', $source, $declaration);

        self::assertSame(1, $matched, 'beacon.ts declares a BeaconKind union');

        preg_match_all("/'([a-z_]+)'/", $declaration[1], $kinds);

        return $kinds[1];
    }

    /**
     * @return list<string>
     */
    private static function phpKindsABrowserMayAssert(): array
    {
        return array_values(array_filter(
            array_map(static fn (StatKind $kind): string => $kind->value, StatKind::cases()),
            static fn (string $value): bool => StatKind::fromBeacon($value) !== null
        ));
    }

    public function testTheLoaderNamesExactlyTheKindsTheEndpointAccepts(): void
    {
        $this->assertSame(self::phpKindsABrowserMayAssert(), self::loaderKinds());
    }

    /**
     * The one the loader must not be able to name. Asserted separately from the
     * parity above, because "the lists match" would still pass on the day both
     * of them gained it.
     *
     * Against the parsed union rather than against the file's text. The file
     * legitimately DISCUSSES this kind in prose — it says why it never travels
     * here — and a check that flagged the explanation for the rule would be
     * crying wolf, which is the one thing `NoLeadIsEverUpdatedTest` gives at
     * length as the reason it tokenises rather than greps.
     */
    public function testTheLoaderCannotNameADeliveryItNeverSaw(): void
    {
        $this->assertNotContains(
            StatKind::LeadMagnetDelivered->value,
            self::loaderKinds(),
            'ADR 0020: the delivery kind is written by PHP, so the loader must not be able to assert it'
        );
    }
}
