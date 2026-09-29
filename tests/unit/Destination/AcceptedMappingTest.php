<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\Destination;
use WConvert\Destination\PushSubject;
use WConvert\Destination\RouteIdentity;
use WConvert\Lead\Lead;
use WConvert\Template\CaptureContract;

final class AcceptedMappingTest extends TestCase
{
    public function testOnlyTheAcceptedSubmissionAnswerIsMapped(): void
    {
        $lead = new Lead('lead', 'campaign', 'a@example.com', null, [], '2026-09-29 12:00:00', [
            'submissions' => ['email' => [
                'values' => ['email' => 'a@example.com', 'message' => 'Please call'],
                'purpose' => 'request',
                'question_answers' => [
                    ['id' => 'service', 'type' => 'single', 'values' => ['repair'], 'labels' => ['Repairs']],
                ],
                'field_mappings' => ['route' => ['service' => 'SERVICE', 'field:message' => 'ENQUIRY', 'other' => 'OTHER']],
            ]],
        ]);
        $snapshot = $lead->submission('email');
        self::assertNotNull($snapshot);
        self::assertSame(['SERVICE' => 'Repairs', 'ENQUIRY' => 'Please call'], PushSubject::of($snapshot, 'route')->mapped);
        self::assertSame('request', PushSubject::of($snapshot, 'route')->purpose);
        self::assertSame([], PushSubject::of($snapshot, 'different-route')->mapped);
    }

    public function testRouteIdentityIgnoresNameButDetectsTargetAndPolicyChanges(): void
    {
        $first = new Destination('route', 'mailchimp', 'Newsletter', 'account', ['audiences' => ['a'], 'existing_contact' => 'keep']);
        $renamed = new Destination('route', 'mailchimp', 'Renamed', 'account', ['existing_contact' => 'keep', 'audiences' => ['a']]);
        $changed = new Destination('route', 'mailchimp', 'Newsletter', 'account', ['audiences' => ['b'], 'existing_contact' => 'keep']);
        self::assertSame(RouteIdentity::of($first), RouteIdentity::of($renamed));
        self::assertNotSame(RouteIdentity::of($first), RouteIdentity::of($changed));
    }

    public function testMultipleChoiceUsesAcceptedReadableLabels(): void
    {
        $lead = new Lead('lead', 'campaign', 'a@example.com', null, [], '2026-09-29 12:00:00', [
            'submissions' => ['signup' => [
                'values' => ['email' => 'a@example.com'],
                'question_answers' => [['id' => 'topics', 'type' => 'multi', 'values' => ['a', 'b'], 'labels' => ['Garden', 'Home']]],
                'field_mappings' => ['route' => ['topics' => 'TOPICS']],
            ]],
        ]);
        $snapshot = $lead->submission('signup');
        self::assertNotNull($snapshot);
        self::assertSame(['TOPICS' => 'Garden; Home'], PushSubject::of($snapshot, 'route')->mapped);
    }

    public function testAFirstSignupCannotMapAQuestionFromTheLaterSignup(): void
    {
        $contents = file_get_contents(WCONVERT_DIR . '/resources/templates/library/journey-email-then-sms.json');
        self::assertNotFalse($contents);
        $tree = json_decode($contents, true, 512, JSON_THROW_ON_ERROR)['tree'];
        $tree['steps'][1]['content']['children'][] = [
            'type' => 'question', 'id' => 'later', 'label' => 'Later answer', 'answer_type' => 'text', 'required' => false,
        ];
        $config = ['template' => ['tree' => $tree], 'destinations' => ['route'],
            'integration_mappings' => ['email-signup' => ['route' => ['later' => 'SERVICE']]]];
        $settings = CaptureContract::settings($config, 'grow_email_list');
        self::assertTrue((new \ReflectionMethod(CaptureContract::class, 'mappingIssue'))->invoke(null, $settings, $tree));
    }
}
