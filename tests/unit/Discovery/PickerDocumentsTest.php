<?php

namespace WConvert\Tests\Unit\Discovery;

use PHPUnit\Framework\TestCase;
use WConvert\Discovery\PickerDocuments;

final class PickerDocumentsTest extends TestCase
{
    public function testPreferencesDeduplicateAndKeepCanonicalNamespace(): void
    {
        $input = PickerDocuments::preferences();
        $input['saved'] = ['pack:store:card', 'pack:store:card', 'registered:card'];
        $this->assertSame(['pack:store:card', 'registered:card'], PickerDocuments::validatePreferences($input)['saved']);
    }

    public function testBoundedListsRejectUnboundedWrites(): void
    {
        $input = PickerDocuments::preferences(); $input['saved'] = array_fill(0, 201, 'registered:card');
        $this->expectException(\InvalidArgumentException::class); PickerDocuments::validatePreferences($input);
    }

    public function testOccasionsAllowOneDayButRejectInvalidCalendarDates(): void
    {
        $item = ['id' => 'launch', 'name' => 'Launch', 'start' => '2026-10-01', 'end' => '2026-10-01'];
        $this->assertSame([$item], PickerDocuments::validateOccasions([$item]));
        $item['end'] = '2026-02-30'; $this->expectException(\InvalidArgumentException::class); PickerDocuments::validateOccasions([$item]);
    }

    public function testOccasionDoesNotAcceptCampaignScheduleOrUnsafeNames(): void
    {
        $item = ['id' => 'launch', 'name' => 'Launch', 'start' => '2026-10-01', 'end' => '2026-10-04', 'campaign_id' => 'private', 'schedule' => ['enabled' => true]];
        $this->assertArrayNotHasKey('schedule', PickerDocuments::validateOccasions([$item])[0]);
        $item['name'] = '<script>Launch</script>'; $this->expectException(\InvalidArgumentException::class); PickerDocuments::validateOccasions([$item]);
    }
}
