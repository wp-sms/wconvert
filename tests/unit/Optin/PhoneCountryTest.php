<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PhoneCountry;

#[CoversClass(PhoneCountry::class)]
final class PhoneCountryTest extends TestCase
{
    /**
     * @param array<string, mixed> $field
     * @return array<string, mixed>
     */
    private static function config(array $field): array
    {
        return ['template' => ['tree' => ['steps' => [[
            'content' => ['type' => 'stack', 'children' => [['type' => 'field', 'name' => 'phone'] + $field]],
        ]]]]];
    }

    public function testSiteDefaultIsFrozenAtPublicationAndOverridesWin(): void
    {
        $draft = self::config([]);
        $published = PhoneCountry::resolved($draft, 'US');
        self::assertSame('US', $published['template']['tree']['steps'][0]['content']['children'][0]['phone_country']);
        self::assertArrayNotHasKey('phone_country', $draft['template']['tree']['steps'][0]['content']['children'][0]);
        self::assertSame('GB', PhoneCountry::resolved(self::config(['phone_country' => 'GB']), 'US')['template']['tree']['steps'][0]['content']['children'][0]['phone_country']);
    }

    public function testPhoneCannotPublishWithoutAValidStartingCountry(): void
    {
        self::assertNull(PhoneCountry::resolved(self::config([]), ''));
        self::assertNull(PhoneCountry::resolved(self::config(['phone_country' => 'ZZ']), 'US'));
        $emailOnly = ['template' => ['tree' => ['steps' => [['content' => ['type' => 'field', 'name' => 'email']]]]]];
        self::assertSame($emailOnly, PhoneCountry::resolved($emailOnly, ''));
    }

    public function testCountryListMatchesTheInstalledLibrary(): void
    {
        self::assertTrue(PhoneCountry::valid('US'));
        self::assertTrue(PhoneCountry::valid('OM'));
        self::assertFalse(PhoneCountry::valid('us'));
        self::assertFalse(PhoneCountry::valid('ZZ'));
    }
}
