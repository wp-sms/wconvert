<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\CaptureJourney;

final class CaptureJourneyTest extends TestCase
{
    public function testEarnedResourceCanBeShownBeforeTheOptionalSignupIsCompleted(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-then-sms.json'), true);
        $link = ['type' => 'followup', 'label' => 'Open guide', 'href' => 'https://example.com/guide'];
        $template['tree']['steps'][1]['content']['children'][] = $link;
        self::assertNull(CaptureJourney::issue($template['tree']));
        $template['tree']['steps'][0]['content']['children'][] = $link;
        self::assertSame('followup', CaptureJourney::issue($template['tree']));
    }

    public function testContentAfterTheLastSignupMustStillReachAcknowledgement(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-only.json'), true);
        $offer = ['id' => 'offer', 'name' => 'Your offer', 'kind' => 'content', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'text', 'text' => 'Your signup is saved'],
            ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        array_splice($template['tree']['steps'], 1, 0, [$offer]);
        self::assertNull(CaptureJourney::issue($template['tree']));
        $template['tree']['steps'][1]['content']['children'][1]['hidden'] = true;
        self::assertSame('navigation', CaptureJourney::issue($template['tree']));
        $template['tree']['steps'][1]['content']['children'][1]['hidden'] = false;
        $template['tree']['steps'][1]['kind'] = 'input';
        self::assertSame('navigation', CaptureJourney::issue($template['tree']));
    }

    public function testNavigationActionsMatchTheProductionManifest(): void
    {
        $manifest = \WConvert\Template\TemplateManifest::load(dirname(__DIR__, 3));
        self::assertSame($manifest['nodes']['button']['choices']['action'], CaptureJourney::ACTIONS);
    }

    public function testAHiddenSubmitCannotMakeAnUnreachableJourneyPublishable(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-only.json'), true);
        $template['tree']['steps'][0]['content']['children'][3]['hidden'] = true;
        self::assertSame('submissions', CaptureJourney::issue($template['tree']));
    }

    public function testAnEnquiryCanCollectAnswersAcrossScreensBeforeOneSubmission(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/docs/plans/184-progressive-capture/enquiry.json'), true);
        self::assertNull(CaptureJourney::issue($template['tree']));
        $template['tree']['submissions'][0]['fields'][] = 'missing-field';
        self::assertSame('references', CaptureJourney::issue($template['tree']));
    }
    public function testOptionalSmsKeepsASeparateSubmissionAndRejectsBypassingEmail(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-then-sms.json'), true);
        $vocabulary = \WConvert\Template\TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $normalized = $vocabulary->normalize($template);
        self::assertNull(CaptureJourney::issue($normalized['tree']));
        self::assertSame($template['tree']['submissions'], $normalized['tree']['submissions']);
        $stripped = $vocabulary->withoutCopy($normalized['tree']);
        self::assertSame($normalized['tree']['submissions'], $stripped['submissions']);
        $normalized['tree']['steps'][0]['content']['children'][] = ['type' => 'button', 'id' => 'n999', 'action' => 'next'];
        self::assertSame('navigation', CaptureJourney::issue($normalized['tree']));
    }

    public function testTheServerCollectsAllDeclaredEnquiryFieldsButNoLaterSms(): void
    {
        $vocabulary = \WConvert\Template\TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-enquiry.json'), true);
        $form = \WConvert\Lead\CaptureForm::fromTemplate($template, $vocabulary, 'enquiry-request');
        $result = $form->validate(['fields' => ['email' => 'visitor@example.com', 'interest' => 'quote']]);
        self::assertInstanceOf(\WConvert\Lead\Submission::class, $result);
        self::assertSame('quote', $result->fields['interest']);
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/resources/templates/library/journey-email-then-sms.json'), true);
        $email = \WConvert\Lead\CaptureForm::fromTemplate($template, $vocabulary, 'email-signup')
            ->validate(['fields' => ['email' => 'visitor@example.com', 'phone' => '+12025551234'], 'consent' => true]);
        self::assertInstanceOf(\WConvert\Lead\Submission::class, $email);
        self::assertNull($email->phone);
        $sms = \WConvert\Lead\CaptureForm::fromTemplate($template, $vocabulary, 'sms-signup')
            ->validate(['fields' => ['phone' => '+12025551234']]);
        self::assertInstanceOf(\WConvert\Lead\Refusal::class, $sms);
    }
}
