<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Availability;
use WConvert\Goal\Goal;

/**
 * The [[Goal]] layer across the two languages — **what is spelled twice, and
 * what is not.**
 *
 * This project has now refused a fifth cross-cutting registry, and the
 * standing rule is that anything spelled in TypeScript as well as PHP needs a
 * test asserting the two agree. There are four such tests already
 * (`manifest-parity`, `renderer-manifest-parity`, `renderer-consent-parity`
 * and {@see \WConvert\Tests\Unit\Stats\BeaconKindParityTest}), and the fourth
 * exists because #26 shipped a second spelling with nothing asserting it.
 *
 * So this file answers the question in both directions:
 *
 * - **[[Availability]] IS spelled twice** — a PHP enum and a TypeScript union
 *   — because the admin has to branch on it to decide whether a card is
 *   hidden, upsold or explained. There is no manifest between them to be the
 *   single source, since there is nothing else about a state to declare. Held
 *   to parity below.
 * - **A Goal is NOT.** The five live in one enum, their labels are
 *   translatable strings `wp i18n make-pot` can only see in PHP, and their
 *   Availability is resolved against the install on the server. The admin
 *   renders whatever `GET /wconvert/v1/goals` hands it and branches on none of
 *   them — so the honest guard is not a parity test but a test that the
 *   second spelling never appears.
 */
#[CoversNothing]
final class GoalParityTest extends TestCase
{
    private const AVAILABILITY = __DIR__ . '/../../../resources/admin/src/goals/availability.ts';

    private const ADMIN_TREE = __DIR__ . '/../../../resources/admin/src';

    /**
     * The union's members, read out of the declaration.
     *
     * Read as TEXT rather than imported, because PHPUnit cannot run TypeScript
     * and a copy of the list in a fixture would be a third spelling — the same
     * arrangement {@see \WConvert\Tests\Unit\Stats\BeaconKindParityTest} has.
     *
     * @return list<string>
     */
    private static function loaderStates(): array
    {
        $source = (string) file_get_contents(self::AVAILABILITY);

        self::assertNotSame('', $source, 'the admin source is readable');

        $matched = preg_match('/export type Availability =([^;]+);/', $source, $declaration);

        self::assertSame(1, $matched, 'availability.ts declares an Availability union');

        preg_match_all("/'([a-z_]+)'/", $declaration[1], $states);

        return $states[1];
    }

    public function testTheAdminNamesExactlyTheStatesTheRegistryCanProduce(): void
    {
        $this->assertSame(
            array_map(static fn (Availability $state): string => $state->value, Availability::cases()),
            self::loaderStates()
        );
    }

    /**
     * **And a Goal id never appears in the admin bundle.**
     *
     * The failure this catches is the cheap one: a screen that wants to say
     * something special about the cart Goal writes `'recover_cart'` into a
     * condition, and from then on the enum and the bundle are two lists. The
     * ids come out of the enum here, so this test cannot itself become the
     * second spelling it exists to prevent.
     *
     * A surface that genuinely needs to distinguish Goals has a field to do it
     * with — `converting_act` says whether the Optin captures a form or a
     * click, which is the distinction every screen so far has actually wanted.
     */
    public function testNoGoalIsSpelledInTheAdminBundle(): void
    {
        $files = new \RegexIterator(
            new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(self::ADMIN_TREE)),
            '/\.tsx?$/'
        );

        $scanned = 0;

        foreach ($files as $file) {
            $scanned++;
            $source = (string) file_get_contents((string) $file);

            foreach (Goal::cases() as $goal) {
                $this->assertStringNotContainsString(
                    $goal->value,
                    $source,
                    basename((string) $file) . " spells the {$goal->value} Goal, which the enum already holds"
                );
            }
        }

        // An empty scan is a tree this check cannot speak for, not a clean
        // one — the same fail-closed posture the source contract takes
        // (ADR 0029).
        $this->assertGreaterThan(0, $scanned, 'the admin tree has no TypeScript in it to scan');
    }
}
