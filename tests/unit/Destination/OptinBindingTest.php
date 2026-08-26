<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\OptinBinding;
use WConvert\Support\Ulid;

/**
 * **An [[Optin]] holds [[Destination]] ids and nothing more.**
 *
 * The rule is about the VALUES as much as the shape. A Destination is
 * configured once, site-wide, and includes whatever selects the target inside
 * the remote system — so an audience name, a tag list or a field map appearing
 * in this list is a second configuration surface arriving by the back door,
 * and the per-Optin field map is exactly what canonical field keys removed
 * (CONTEXT.md, Destination; #4).
 */
final class OptinBindingTest extends TestCase
{
    public function testItKeepsOnlyIdsAndDropsEverythingElse(): void
    {
        $id = Ulid::generate();

        self::assertSame([$id], OptinBinding::ids([
            'destinations' => [
                $id,
                // A type name rather than an id — the shape a Playbook's
                // `destination_hint` arrives in, and the one most likely to be
                // mistaken for a binding.
                'mailchimp',
                ['id' => $id, 'audience' => 'abc123'],
                '',
                42,
            ],
        ]));
    }

    public function testItDeduplicates(): void
    {
        $id = Ulid::generate();

        self::assertSame([$id], OptinBinding::ids(['destinations' => [$id, $id]]));
    }

    public function testAnOptinWithNoBindingBindsNothing(): void
    {
        self::assertSame([], OptinBinding::ids(null));
        self::assertSame([], OptinBinding::ids([]));
        self::assertSame([], OptinBinding::ids(['destinations' => 'wsms']));
        self::assertFalse(OptinBinding::binds(null, Ulid::generate()));
    }
}
