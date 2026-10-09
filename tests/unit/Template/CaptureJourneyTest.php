<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\CaptureContract;
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

    public function testForwardBranchesRejoinBeforeTheRequiredCapture(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-service-enquiry.json'), true);
        $tree = $template['tree'];
        $design = ['id' => 'design', 'name' => 'Design details', 'kind' => 'content', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'heading', 'text' => 'Design details'], ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        array_splice($tree['steps'], 2, 0, [$design]);
        $condition = static fn (string $value): array => ['match' => 'all', 'clauses' => [
            ['question' => 'n2', 'operator' => 'is', 'values' => [$value]],
        ]];
        $tree['steps'][0]['paths'] = [['to' => 'repair', 'when' => $condition('repair')], ['to' => 'design', 'when' => $condition('design')], ['to' => 'contact']];
        $tree['steps'][1]['paths'] = [['to' => 'contact']];
        self::assertNull(CaptureJourney::issue($tree));
        $vocabulary = \WConvert\Template\TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $normalized = $vocabulary->normalize(['tree' => $tree, 'tokens' => []])['tree'];
        self::assertSame($tree['steps'][0]['paths'], $normalized['steps'][0]['paths']);
        self::assertSame($tree['steps'][0]['paths'], $vocabulary->withoutCopy($normalized)['steps'][0]['paths']);
        $steps = array_values(array_map(static fn (array $screen): array => $screen, $tree['steps']));
        self::assertSame(['service', 'design', 'contact', 'received'], array_map(
            static fn (int $at): string => $tree['steps'][$at]['id'],
            \WConvert\Template\JourneyRules::path($steps, ['n2' => 'design'])['indices']
        ));
        $hiddenBranch = $tree;
        $hiddenBranch['steps'][0]['paths'] = [['to' => 'repair']];
        $hiddenBranch['steps'][1]['paths'] = [['to' => 'contact']];
        self::assertNull(CaptureJourney::issue($hiddenBranch));
        $hiddenSteps = array_values(array_map(static fn (array $screen): array => $screen, $hiddenBranch['steps']));
        self::assertSame(['service', 'design', 'contact', 'received'], array_map(
            static fn (int $at): string => $hiddenBranch['steps'][$at]['id'],
            \WConvert\Template\JourneyRules::path($hiddenSteps, ['n2' => 'design'])['indices']
        ));
        $tree['steps'][0]['paths'][0]['when']['clauses'][0]['values'] = [''];
        self::assertSame('conditions', CaptureJourney::issue($tree));
        $tree['steps'][0]['paths'][0]['when']['clauses'][0]['values'] = ['repair'];
        $tree['steps'][0]['paths'][0]['to'] = 'received';
        self::assertSame('routes', CaptureJourney::issue($tree));
        $tree['steps'][0]['paths'][0]['to'] = 'repair';
        $tree['steps'][1]['paths'] = [['to' => 'service']];
        self::assertSame('routes', CaptureJourney::issue($tree));
        $tree['steps'][1]['paths'] = [['to' => 'contact']];
        $tree['steps'][0]['paths'] = [['to' => 'contact']];
        self::assertSame('routes', CaptureJourney::issue($tree));
    }

    public function testMultiChoiceConditionValidatesEveryReferencedAnswer(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-service-enquiry.json'), true);
        $tree = $template['tree'];
        $tree['steps'][0]['content']['children'][1]['answer_type'] = 'multi';
        $tree['steps'][1]['when'] = ['match' => 'all', 'clauses' => [[
            'question' => 'n2', 'operator' => 'includes_any', 'values' => ['design', 'repair'],
        ]]];
        self::assertNull(CaptureJourney::issue($tree));
        $vocabulary = \WConvert\Template\TemplateVocabulary::fromManifest(dirname(__DIR__, 3));
        $normalized = $vocabulary->normalize(['tree' => $tree, 'tokens' => []])['tree'];
        self::assertSame(['design', 'repair'], $normalized['steps'][1]['when']['clauses'][0]['values']);
        $tree['steps'][1]['when']['clauses'][0]['values'][] = 'missing';
        self::assertSame('conditions', CaptureJourney::issue($tree));
    }

    public function testAQuizCanRequireCaptureBeforeItsTerminalResult(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-content-guide.json'), true);
        $tree = $template['tree'];
        $signup = $tree['steps'][2];
        $signup['content']['children'] = array_values(array_filter($signup['content']['children'],
            static fn (array $node): bool => ($node['action'] ?? '') !== 'skip'));
        $result = $tree['steps'][1];
        $result['content']['children'] = array_values(array_filter($result['content']['children'],
            static fn (array $node): bool => ($node['action'] ?? '') !== 'next'));
        $tree['steps'] = [$tree['steps'][0], $signup, $result];
        $tree['submissions'][0]['required'] = true;

        self::assertNull(CaptureJourney::issue($tree));
        self::assertSame([\WConvert\Template\ConvertingAct::Match], \WConvert\Template\ConvertingAct::offeredIn($tree));
        self::assertSame('request', \WConvert\Template\CaptureContract::settings(['template' => ['tree' => $tree]], 'find_match')['email-signup']['purpose']);
        self::assertSame('email_marketing', \WConvert\Template\CaptureContract::settings(['template' => $template], 'find_match')['email-signup']['purpose']);
    }

    public function testGraphResultFirstPurposeUsesConnectionsRatherThanStorageOrder(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-content-guide.json'), true);
        $tree = $template['tree'];
        $tree['v'] = 3;
        $tree['steps'] = [$tree['steps'][2], $tree['steps'][3], $tree['steps'][0], $tree['steps'][1]];
        $tree['graph'] = ['entry' => 'interests', 'edges' => [
            ['id' => 'a', 'from' => 'interests', 'to' => 'guide', 'kind' => 'default'],
            ['id' => 'b', 'from' => 'guide', 'to' => 'signup', 'kind' => 'default'],
            ['id' => 'c', 'from' => 'signup', 'to' => 'thanks', 'kind' => 'default'],
        ]];
        $settings = \WConvert\Template\CaptureContract::settings(['template' => ['tree' => $tree]], 'find_match');
        self::assertSame('email_marketing', $settings['email-signup']['purpose']);
    }

    /** A result's link is optional (ADR 0133): no address, no button. An address needs words for its button. */
    public function testAResultLinkIsOptionalButAnAddressNeedsItsWords(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-content-guide.json'), true);
        $config = ['template' => $template];
        self::assertNull(\WConvert\Template\CaptureContract::issue($config, 'find_match', ''));
        foreach ($config['template']['tree']['steps'][1]['results'] as &$variant) { $variant['href'] = 'https://example.com/guide'; $variant['link_label'] = ''; }
        unset($variant);
        self::assertSame('result_link', \WConvert\Template\CaptureContract::issue($config, 'find_match', ''));
    }
    /**
     * A link in body text with no address is unfinished (ADR 0133): only
     * consent wording and fine print take the site's privacy policy, so
     * nothing will ever fill this one, and it blocks until it has an address.
     */
    public function testABodyTextLinkWithNoAddressBlocks(): void
    {
        $config = static fn (array $text): array => ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
            ['type' => 'stack', 'children' => [$text, ['type' => 'button', 'action' => 'link', 'href' => 'https://example.test/', 'label' => 'Go']]],
        ]])]];
        $body = ['type' => 'text', 'role' => 'body', 'text' => 'Read %s.', 'link' => ['label' => 'the guide']];

        self::assertSame('link', CaptureContract::issue($config($body), 'promote_offer', 'https://example.test/privacy/'));
        self::assertNull(CaptureContract::issue($config(['link' => ['label' => 'the guide', 'href' => 'https://example.test/guide']] + $body), 'promote_offer', ''));
        self::assertNull(CaptureContract::issue($config(['hidden' => true] + $body), 'promote_offer', ''));
        self::assertNull(CaptureContract::issue($config(['role' => 'fine_print'] + $body), 'promote_offer', ''));
    }

    public function testSelectedProductsNeedNoFallbackLink(): void
    {
        $template = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/pro/modules/journeys/templates/journey-product-finder.json'), true);
        $result = count($template['tree']['steps']) - 1;
        unset($template['tree']['steps'][$result]['products_required']);
        $template['tree']['steps'][$result]['results'][0]['product_ids'] = [12];
        $config = ['template' => $template];
        self::assertNull(\WConvert\Template\CaptureContract::issue($config, 'find_match', ''));
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
