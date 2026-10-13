<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\PushSubject;
use WConvert\Lead\Lead;

/**
 * What a push can say about a submission beyond the canonical values: the
 * whole journey so far, its answers, its consent and the page it came from.
 */
final class PushDetailsTest extends TestCase
{
    private static function twoStepLead(): Lead
    {
        $email = ['accepted_at' => '2026-10-13T09:12:44Z', 'purpose' => 'email_marketing',
            'values' => ['email' => 'sarah@example.com', 'name' => 'Sarah', 'consent_text' => 'Email me offers.'],
            'question_answers' => [['id' => 'budget', 'question' => 'Budget?', 'type' => 'single', 'values' => ['mid'], 'labels' => ['1k–5k']]]];
        $sms = ['accepted_at' => '2026-10-13T09:13:10Z', 'purpose' => 'sms_marketing',
            'values' => ['phone' => '+12025550123', 'consent_text' => 'Text me offers.'],
            'question_answers' => [['id' => 'topics', 'question' => 'Topics?', 'type' => 'multi', 'values' => ['a', 'b'], 'labels' => ['Garden', 'Home']]]];
        return new Lead('01LEAD000000000000000000AA', '01OPTIN', 'sarah@example.com', '+12025550123', [], '2026-10-13 09:12:44',
            ['submissions' => ['email-signup' => $email, 'sms-signup' => $sms],
             'source' => ['page_url' => '/pricing', 'utm' => ['source' => 'fb', 'medium' => null, 'campaign' => null, 'term' => null, 'content' => null]]]);
    }

    private static function subject(Lead $lead, string $submission, string $destination = '01ROUTE'): PushSubject
    {
        return PushSubject::of($lead->submission($submission), $destination, $submission, $lead);
    }

    public function testTheSecondStepCarriesTheWholeJourneySoFar(): void
    {
        $details = self::subject(self::twoStepLead(), 'sms-signup')->details;
        self::assertSame('01LEAD000000000000000000AA', $details['lead_id']);
        self::assertSame('sms-signup', $details['submission']);
        self::assertSame('2026-10-13T09:13:10Z', $details['accepted_at']);
        self::assertSame(['email' => 'sarah@example.com', 'phone' => '+12025550123', 'name' => 'Sarah'], $details['contact']);
        self::assertSame(['budget' => ['question' => 'Budget?', 'answer' => '1k–5k'], 'topics' => ['question' => 'Topics?', 'answer' => ['Garden', 'Home']]], $details['answers']);
        self::assertSame(['purpose' => 'sms_marketing',
            'email' => ['text' => 'Email me offers.', 'accepted_at' => '2026-10-13T09:12:44Z'],
            'sms' => ['text' => 'Text me offers.', 'accepted_at' => '2026-10-13T09:13:10Z']], $details['consent']);
        self::assertSame('/pricing', $details['source']['page_url']);
    }

    public function testTheFirstStepDoesNotKnowWhatCameAfterIt(): void
    {
        $details = self::subject(self::twoStepLead(), 'email-signup')->details;
        self::assertSame(['email' => 'sarah@example.com', 'phone' => null, 'name' => 'Sarah'], $details['contact']);
        self::assertSame(['budget'], array_keys($details['answers']));
        self::assertNull($details['consent']['sms']);
    }

    public function testTheDeliveryIdIsStablePerSubmissionAndRoute(): void
    {
        $lead = self::twoStepLead();
        $first = self::subject($lead, 'email-signup')->deliveryId;
        self::assertMatchesRegularExpression('/^msg_[A-Za-z0-9]{32}$/D', $first);
        self::assertSame($first, self::subject($lead, 'email-signup')->deliveryId, 'A retry is the same delivery.');
        self::assertNotSame($first, self::subject($lead, 'sms-signup')->deliveryId);
        self::assertNotSame($first, self::subject($lead, 'email-signup', '01OTHER')->deliveryId);
    }

    public function testATestSendIsAFullSampleWithAFreshId(): void
    {
        $one = PushSubject::test(['email' => 'me@shop.example']);
        self::assertTrue($one->isTest);
        self::assertStringStartsWith('msg_', $one->deliveryId);
        self::assertNotSame($one->deliveryId, PushSubject::test(['email' => 'me@shop.example'])->deliveryId);
        self::assertSame('me@shop.example', $one->details['contact']['email']);
        foreach (['phone', 'name'] as $key) self::assertIsString($one->details['contact'][$key], "{$key} is filled so a sample exposes it.");
        self::assertNotSame([], $one->details['answers']);
        self::assertIsArray($one->details['consent']['email']);
        self::assertIsArray($one->details['source']);
    }

    public function testATestSendCarriesTheCampaignsOwnQuestions(): void
    {
        $answers = ['service' => ['question' => 'Which service?', 'answer' => 'Repairs']];
        self::assertSame($answers, PushSubject::test(['email' => 'me@shop.example'], [], 'email_marketing', $answers)->details['answers']);
    }
}
