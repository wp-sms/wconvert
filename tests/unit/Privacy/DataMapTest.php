<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationStore;
use WConvert\Privacy\DataMap;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

#[CoversClass(DataMap::class)]
final class DataMapTest extends TestCase
{
    public function testAnUnconfiguredSiteStillReportsItsRealStorageBoundaries(): void
    {
        $options = new FakeOptionStore();
        $map = new DataMap(
            new RetentionPeriod($options),
            new DestinationStore($options),
            new DestinationRegistry(new FakeProPresence(), new FakeSitePresence())
        );

        $this->assertSame([
            'retention_days' => null,
            'destinations' => [],
            'browser' => [
                'key' => 'wcv1',
                'local_storage_expiry_days' => null,
                'cookie_fallback' => true,
                'cookie_fallback_days' => 365,
                'contains_contact_details' => false,
                'contains_visitor_identifier' => false,
            ],
            'beacon_rate_limit_seconds' => 60,
        ], $map->summary());
    }

    public function testConfiguredRoutesReportOnlyTheValuesTheyMayReceiveWithoutCredentials(): void
    {
        $options = new FakeOptionStore();
        $destinations = new DestinationStore($options);
        $types = new DestinationRegistry(new FakeProPresence(), new FakeSitePresence());
        $type = new FakeDestinationType('mailing');
        $type->declaredRequirements = new DestinationRequirements(
            fields: ['email', 'name'],
            mappedFields: ['interest' => [
                'setting' => 'interest_field',
                'label' => 'Interest',
                'scope' => 'New subscribers only.',
            ]]
        );
        $types->register($type);
        $known = $destinations->save(null, 'mailing', 'Newsletter subscribers', 'SECRET-CONNECTION', [
            'interest_field' => 'custom-field-id',
            'api_key' => 'SECRET-KEY',
        ]);
        $unknown = $destinations->save(null, 'removed-provider', 'Old automation', null, []);

        $summary = (new DataMap(new RetentionPeriod($options), $destinations, $types))->summary();

        $this->assertSame([
            [
                'id' => $known->id,
                'label' => 'Newsletter subscribers',
                'type' => 'mailing',
                'type_label' => 'Fake',
                'fields' => ['email', 'name', 'interest'],
            ],
            [
                'id' => $unknown->id,
                'label' => 'Old automation',
                'type' => 'removed-provider',
                'type_label' => 'removed-provider',
                'fields' => null,
            ],
        ], $summary['destinations']);
        $encoded = wp_json_encode($summary);
        if ($encoded === false) {
            self::fail('The privacy data map must be JSON encodable.');
        }

        $this->assertStringNotContainsString('SECRET', $encoded);
    }
}
