<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Support\DiagnosticSanitizer;

#[CoversClass(DiagnosticSanitizer::class)]
final class DiagnosticSanitizerTest extends TestCase
{
    public function testItKeepsTheActionableReasonAndRemovesPersonalValuesAndSecrets(): void
    {
        $message = "MailPoet rejected Sarah at sarah@example.com (+968 9912 3456): invalid subscriber; api_key=top-secret-key\nretryable";
        $clean = DiagnosticSanitizer::message(
            $message,
            ['name' => 'Sarah', 'email' => 'sarah@example.com', 'phone' => '+96899123456'],
            ['api_key' => 'top-secret-key']
        );

        $this->assertStringContainsString('MailPoet rejected', $clean);
        $this->assertStringContainsString('invalid subscriber', $clean);
        $this->assertStringNotContainsString('Sarah', $clean);
        $this->assertStringNotContainsString('sarah@example.com', $clean);
        $this->assertStringNotContainsString('9912 3456', $clean);
        $this->assertStringNotContainsString('top-secret-key', $clean);
        $this->assertStringNotContainsString("\n", $clean);
    }

    public function testAShortNameDoesNotDamageWordsThatOnlyContainThoseLetters(): void
    {
        $clean = DiagnosticSanitizer::message('Connection failed for Al.', ['name' => 'Al']);

        $this->assertSame('Connection failed for [personal data].', $clean);
    }
}
