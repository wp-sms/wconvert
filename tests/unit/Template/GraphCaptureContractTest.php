<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\CaptureContract;
use WConvert\Template\GraphCaptureContract;
use WConvert\Template\JourneyGraph;
use WConvert\Lead\QuestionCapture;
use WConvert\Template\TemplateVocabulary;

final class GraphCaptureContractTest extends TestCase
{
    public function testThreeIndependentInterestsAllJoinOneEnquiryWithOnlyVisitedAnswers(): void
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'collect_enquiries', ''));
        $saved = TemplateVocabulary::fromManifest()->normalize(['tree' => $tree])['tree'];
        self::assertSame($tree['graph'], $saved['graph']);
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $saved]], 'collect_enquiries', ''));
        $interests = ['garden' => ['garden', 'n2'], 'indoors' => ['indoors', 'n3'], 'balcony' => ['balcony', 'n4']];
        for ($mask = 1; $mask <= 7; $mask++) {
            $chosen = [];
            $visible = ['interests'];
            $questionIds = ['n1'];
            foreach (array_values($interests) as $bit => [$screen, $questionId]) {
                if (($mask & (1 << $bit)) === 0) { continue; }
                $chosen[] = array_keys($interests)[$bit];
                $visible[] = $screen;
                $questionIds[] = $questionId;
            }
            $visible[] = 'contact'; $visible[] = 'received';
            $posted = ['n1' => $chosen, 'n2' => 'small', 'n3' => 'bright', 'n4' => 'small'];
            $trace = JourneyGraph::trace($tree['steps'], $tree['graph'], $posted);
            self::assertSame($visible, array_map(static fn (int $index): string => $tree['steps'][$index]['id'], $trace['indices']));
            $snapshots = QuestionCapture::validate($tree, $posted, 'enquiry');
            self::assertIsArray($snapshots);
            self::assertSame($questionIds, array_column($snapshots, 'id'));
        }
    }

    private static function graphize(string $name): array
    {
        $path = WCONVERT_DIR . "/pro/modules/journeys/templates/$name.json";
        if (!file_exists($path)) $path = WCONVERT_DIR . "/resources/templates/library/$name.json";
        $tree = json_decode((string) file_get_contents($path), true)['tree'];
        $edges = [];
        foreach ($tree['steps'] as $index => &$screen) {
            if (!isset($tree['steps'][$index + 1])) { continue; }
            $next = $tree['steps'][$index + 1]['id'];
            $edges[] = ['id' => 'next_' . $screen['id'], 'from' => $screen['id'], 'to' => $next, 'kind' => 'default'];
            if (isset($screen['when'])) $edges[] = ['id' => 'hidden_' . $screen['id'], 'from' => $screen['id'], 'to' => $next, 'kind' => 'hidden'];
            unset($screen['paths']);
        }
        unset($screen);
        $tree['v'] = 3;
        $tree['graph'] = ['entry' => $tree['steps'][0]['id'], 'edges' => $edges];
        return $tree;
    }

    public function testCombinedEnquiryCanPublishWithUnorderedScreensAndOneRequiredSave(): void
    {
        $tree = self::graphize('journey-service-enquiry');
        $tree['steps'] = [$tree['steps'][2], $tree['steps'][3], $tree['steps'][1], $tree['steps'][0]];
        self::assertNull(GraphCaptureContract::issue($tree, 'collect_enquiries'));
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'collect_enquiries', ''));

        $bypass = $tree;
        $bypass['graph']['edges'][] = ['id' => 'skip_capture', 'from' => 'service', 'to' => 'received', 'kind' => 'answer', 'when' => [
            'match' => 'all', 'clauses' => [['question' => 'n2', 'operator' => 'is', 'values' => ['design']]],
        ]];
        self::assertSame('capture_paths', GraphCaptureContract::issue($bypass, 'collect_enquiries'));
    }

    public function testExistingSimpleSignupCanUpgradeWithoutChangingItsPublicationContract(): void
    {
        $tree = self::graphize('journey-email-only');
        self::assertNull(GraphCaptureContract::issue($tree, 'grow_email_list'));
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $tree]], 'grow_email_list', ''));
        $tree['steps'][] = ['id' => 'late', 'name' => 'Late question', 'kind' => 'input', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'question', 'id' => 'n90', 'label' => 'Later?', 'answer_type' => 'single', 'required' => false,
                'options' => [['value' => 'yes', 'label' => 'Yes'], ['value' => 'no', 'label' => 'No']]],
            ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        $tree['graph']['edges'][0]['to'] = 'late';
        $tree['graph']['edges'][] = ['id' => 'late_end', 'from' => 'late', 'to' => $tree['steps'][1]['id'], 'kind' => 'default'];
        self::assertSame('capture_paths', GraphCaptureContract::issue($tree, 'grow_email_list'));
    }

    public function testSubmissionCannotClaimAFieldFromAnOptionalBranch(): void
    {
        $tree = self::graphize('journey-service-enquiry');
        $field = $tree['steps'][2]['content']['children'][1];
        array_splice($tree['steps'][2]['content']['children'], 1, 1);
        $tree['steps'][1]['kind'] = 'input';
        $tree['steps'][1]['content']['children'][] = $field;
        self::assertSame('references', GraphCaptureContract::issue($tree, 'collect_enquiries'));
    }

    public function testCaptureCannotHideConsentRepeatAFieldOrPromiseAnUnearnedResource(): void
    {
        $tree = self::graphize('journey-service-enquiry');
        $duplicate = $tree;
        $duplicate['steps'][2]['content']['children'][] = ['type' => 'field', 'id' => 'n90', 'name' => 'email', 'required' => false];
        self::assertSame('fields', GraphCaptureContract::issue($duplicate, 'collect_enquiries'));
        $hiddenConsent = $tree;
        $hiddenConsent['steps'][2]['content']['children'][] = ['type' => 'consent', 'id' => 'n90', 'hidden' => true, 'text' => 'I agree'];
        $hiddenConsent['submissions'][0]['consents'] = ['n90'];
        self::assertSame('consent', GraphCaptureContract::issue($hiddenConsent, 'collect_enquiries'));
        $resource = $tree;
        $resource['steps'][1]['content']['children'][] = ['type' => 'followup', 'label' => 'Open guide', 'href' => 'https://example.com/guide'];
        self::assertSame('followup', GraphCaptureContract::issue($resource, 'collect_enquiries'));
    }

    public function testCombinedEnquiryRejectsAQuestionAfterItsOnlySave(): void
    {
        $tree = self::graphize('journey-service-enquiry');
        $tree['steps'][] = ['id' => 'late', 'name' => 'Late question', 'kind' => 'input', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'question', 'id' => 'n90', 'label' => 'Extra?', 'answer_type' => 'single', 'required' => false,
                'options' => [['value' => 'yes', 'label' => 'Yes'], ['value' => 'no', 'label' => 'No']]],
            ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        $tree['graph']['edges'][3]['to'] = 'late';
        $tree['graph']['edges'][] = ['id' => 'late_done', 'from' => 'late', 'to' => 'received', 'kind' => 'default'];
        self::assertSame('capture_paths', GraphCaptureContract::issue($tree, 'collect_enquiries'));
    }

    public function testAnonymousQuizAndOptionalResultFirstSignupHaveDifferentCaptureRules(): void
    {
        $anonymous = self::graphize('journey-product-finder');
        self::assertNull(GraphCaptureContract::issue($anonymous, 'find_match'));
        self::assertSame('products', CaptureContract::issue(['template' => ['tree' => $anonymous]], 'find_match', ''));
        $guide = self::graphize('journey-content-guide');
        foreach ($guide['steps'][1]['results'] as &$variant) $variant['href'] = 'https://example.com/guide';
        unset($variant);
        self::assertNull(GraphCaptureContract::issue($guide, 'find_match'));
        self::assertNull(CaptureContract::issue(['template' => ['tree' => $guide]], 'find_match', ''));
        $guide['submissions'][0]['required'] = true;
        $guide['steps'][2]['content']['children'] = array_values(array_filter($guide['steps'][2]['content']['children'],
            static fn (array $node): bool => ($node['action'] ?? '') !== 'skip'));
        self::assertSame('capture_paths', GraphCaptureContract::issue($guide, 'find_match'));

        $gate = $guide;
        $gate['steps'][1]['content']['children'] = array_values(array_filter($gate['steps'][1]['content']['children'],
            static fn (array $node): bool => ($node['action'] ?? '') !== 'next'));
        $gate['steps'] = [$gate['steps'][1], $gate['steps'][2], $gate['steps'][0]];
        $gate['graph'] = ['entry' => 'interests', 'edges' => [
            ['id' => 'to_signup', 'from' => 'interests', 'to' => 'signup', 'kind' => 'default'],
            ['id' => 'to_result', 'from' => 'signup', 'to' => 'guide', 'kind' => 'default'],
        ]];
        self::assertNull(GraphCaptureContract::issue($gate, 'find_match'));

        $withEnding = $gate;
        $withEnding['steps'][] = $guide['steps'][3];
        $withEnding['steps'][0]['content'] = $guide['steps'][1]['content'];
        $withEnding['graph']['edges'][] = ['id' => 'to_ending', 'from' => 'guide', 'to' => 'thanks', 'kind' => 'default'];
        self::assertNull(GraphCaptureContract::issue($withEnding, 'find_match'));
    }

    public function testOnlyThePrimaryAcceptedSubmissionCanLeadToAnOptionalSecondSignup(): void
    {
        $tree = self::graphize('journey-email-then-sms');
        self::assertNull(GraphCaptureContract::issue($tree, 'grow_email_list'));
        $tree['steps'][] = ['id' => 'intro', 'name' => 'Choose', 'kind' => 'input', 'content' => ['type' => 'stack', 'children' => [
            ['type' => 'question', 'id' => 'n90', 'label' => 'Which channel?', 'answer_type' => 'single', 'required' => true,
                'options' => [['value' => 'email', 'label' => 'Email'], ['value' => 'sms', 'label' => 'SMS']]],
            ['type' => 'button', 'action' => 'next', 'label' => 'Continue'],
        ]]];
        $tree['graph']['entry'] = 'intro';
        $tree['graph']['edges'][] = ['id' => 'intro_default', 'from' => 'intro', 'to' => 'email', 'kind' => 'default'];
        $tree['graph']['edges'][] = ['id' => 'intro_sms', 'from' => 'intro', 'to' => 'sms', 'kind' => 'answer', 'when' => [
            'match' => 'all', 'clauses' => [['question' => 'n90', 'operator' => 'is', 'values' => ['sms']]],
        ]];
        self::assertSame('capture_paths', GraphCaptureContract::issue($tree, 'grow_email_list'));
    }
}
