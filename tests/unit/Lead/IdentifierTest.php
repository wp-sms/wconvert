<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\Identifier;

/**
 * Canonical form, and the refusal that makes it true rather than approximately
 * true.
 *
 * `GROUP BY email` is a lie the moment one row reads `Sarah@Example.com` and
 * the next reads `sarah@example.com`, so ADR 0021 stores both identity keys in
 * canonical form — email lowercased, phone in E.164 — and REFUSES an
 * identifier it cannot put in one.
 *
 * The refusal is total, and that is what this file is really pinning down. A
 * Lead has exactly one origin (ADR 0031): one visitor, one form, one request,
 * while they are still on the page. There is no import path, no admin entry
 * screen and no ingestion API, so there is no second branch where a value that
 * fails here gets in anyway.
 */
#[CoversClass(Identifier::class)]
final class IdentifierTest extends TestCase
{
    /**
     * @return array<string, array{string, string}>
     */
    public static function canonicalEmails(): array
    {
        return [
            'lowercased whole' => ['Sarah@Example.COM', 'sarah@example.com'],
            'already canonical' => ['sarah@example.com', 'sarah@example.com'],
            'surrounding whitespace' => ["  sarah@example.com\n", 'sarah@example.com'],
        ];
    }

    #[DataProvider('canonicalEmails')]
    public function testAnEmailIsStoredLowercased(string $raw, string $canonical): void
    {
        $this->assertSame($canonical, Identifier::email($raw));
    }

    /**
     * @return array<string, array{string}>
     */
    public static function uncanonicalisableEmails(): array
    {
        return [
            'no at sign' => ['sarah.example.com'],
            'no domain dot' => ['sarah@example'],
            'empty' => [''],
            'whitespace only' => ['   '],
            'an embedded space' => ['sa rah@example.com'],
            'a display name around it' => ['Sarah <sarah@example.com>'],
        ];
    }

    #[DataProvider('uncanonicalisableEmails')]
    public function testAnEmailThatCannotBeCanonicalisedIsRefused(string $raw): void
    {
        $this->assertNull(Identifier::email($raw));
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function canonicalPhones(): array
    {
        return [
            'already E.164' => ['+12025551234', '+12025551234'],
            'spaced' => ['+1 202 555 1234', '+12025551234'],
            'punctuated' => ['+1 (202) 555-1234', '+12025551234'],
            'dotted' => ['+44.7911.123456', '+447911123456'],
            // `00` is the international dialling prefix a visitor types where
            // their keypad has no `+`. It means exactly what `+` means, so
            // reading it is canonicalisation rather than a guess.
            'double-zero international prefix' => ['0044 7911 123456', '+447911123456'],
            'surrounding whitespace' => ["  +12025551234 ", '+12025551234'],
        ];
    }

    #[DataProvider('canonicalPhones')]
    public function testAPhoneIsStoredInE164(string $raw, string $canonical): void
    {
        $this->assertSame($canonical, Identifier::phone($raw));
    }

    /**
     * @return array<string, array{string}>
     */
    public static function uncanonicalisablePhones(): array
    {
        return [
            // The one that matters. A national number needs a country to
            // resolve against and WConvert has none — prepending `+` would
            // produce something that passes E.164 and cannot be dialled, which
            // is worse than refusing, because the visitor is standing right
            // there and can add their country code.
            'national, no country code' => ['07911 123456'],
            'bare digits' => ['2025551234'],
            'leading zero after the plus' => ['+0442025551234'],
            'letters' => ['+1 202 CALL NOW'],
            'too long for E.164' => ['+1234567890123456'],
            'too short' => ['+1'],
            'empty' => [''],
            'a plus and nothing else' => ['+'],
        ];
    }

    #[DataProvider('uncanonicalisablePhones')]
    public function testAPhoneThatCannotBeCanonicalisedIsRefused(string $raw): void
    {
        $this->assertNull(Identifier::phone($raw));
    }

    /**
     * WSMS's `ContactRepository::create()` runs `PhoneValidator::assertE164()`
     * on the way in, and that method THROWS. Every push is queued (#4), so a
     * phone WConvert accepted but could not canonicalise becomes an exception
     * inside an Action Scheduler job minutes later, with the visitor gone.
     *
     * Which is why this holds on a Standalone install too: it is a WConvert
     * rule that exists because WSMS has one (ADR 0021).
     */
    public function testWhateverThisAcceptsSatisfiesTheE164PatternWsmsAssertsOn(): void
    {
        foreach (self::canonicalPhones() as [$raw]) {
            $canonical = Identifier::phone($raw);

            $this->assertNotNull($canonical);
            $this->assertMatchesRegularExpression('/^\+[1-9]\d{1,14}$/', $canonical);
        }
    }
}
