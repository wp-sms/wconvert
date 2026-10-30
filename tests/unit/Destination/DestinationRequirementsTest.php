<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\MailPoet\MailPoetDestinationType;
use WConvert\Tests\Unit\Support\FakeMailPoetSubscribers;

/**
 * An `ids` field that names a `max` is not ready with more ids than that.
 *
 * Mailchimp, Brevo and Mailtrap add a Contact to exactly one list. A
 * Destination saved with two used to read as ready and then fail every push
 * (#223). MailPoet's lists take several, so `ids` alone still
 * means "one or more".
 */
#[CoversClass(DestinationRequirements::class)]
final class DestinationRequirementsTest extends TestCase
{
    public function testMoreIdsThanMaxIsMissing(): void
    {
        $requirements = new DestinationRequirements([], ['lists' => ['label' => 'List', 'type' => 'ids', 'max' => 1]]);
        self::assertSame(['lists'], $requirements->missingSettings(['lists' => ['3', '4']]));
        self::assertSame([], $requirements->missingSettings(['lists' => ['4']]));
        self::assertSame(['lists'], $requirements->missingSettings(['lists' => []]));
        self::assertSame(1, $requirements->toArray()['settings']['lists']['max'], 'The admin reads the same cap.');
    }

    public function testIdsWithoutMaxTakeSeveral(): void
    {
        $requirements = (new MailPoetDestinationType(new FakeMailPoetSubscribers()))->requirements();
        self::assertSame([], $requirements->missingSettings(['lists' => ['3', '4', '5']]));
        self::assertArrayNotHasKey('max', $requirements->settings['lists']);
    }
}
