<?php
namespace WConvert\Tests\Unit\Template\Transfer;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Transfer\TransferDraft;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\TemplateManifest;
use WConvert\Support\Tier;
use WConvert\Template\{TemplateVocabulary, CaptureJourney, GraphCaptureContract};

final class TransferDraftTest extends TestCase
{
    public function testKeepContentPreservesImportedCopyAndPicturesWithoutCarryingSettings(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $incoming = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $incoming['display_type'] = 'popup';
        $incoming['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n800', 'src' => '/file.png', 'alt' => 'File picture'];
        $incoming = array_replace($incoming, $vocabulary->normalize($incoming));
        $mine = $incoming;
        $mine['tokens']['bg'] = '#123456';
        foreach ($mine['tree']['steps'][0]['content']['children'] as &$node) {
            if (($node['role'] ?? '') === 'headline') $node['text'] = 'My current words';
            if ($node['type'] === 'button') $node['href'] = '/my-offer';
            if ($node['type'] === 'image') { $node['src'] = '/mine.png'; $node['alt'] = 'My picture'; }
        }
        unset($node);
        $config = ['template' => $mine, 'display_type' => 'inline', 'content_lock' => ['enabled' => true], 'placement' => 'bottom', 'submission_settings' => ['old' => []], 'integration_mappings' => ['old' => 'field'], 'destinations' => ['keep-connection']];
        $prepared = TransferDraft::prepare($incoming, $config, true, null, $vocabulary);
        $patch = $prepared['patch'];
        $encoded = json_encode($patch['template'], JSON_THROW_ON_ERROR);
        self::assertStringContainsString('My current words', $encoded);
        self::assertStringContainsString('mine.png', $encoded);
        self::assertSame([['url' => '/my-offer', 'uses' => 1]], TransferDraft::links($patch['template']));
        self::assertSame($incoming['tokens'], $patch['template']['tokens']);
        self::assertNull($patch['template_id']);
        self::assertNull($patch['placement']);
        self::assertNull($patch['content_lock']);
        self::assertSame([], $patch['submission_settings']);
        self::assertSame([], $patch['integration_mappings']);
        self::assertArrayNotHasKey('destinations', $patch);
        $file = TransferDraft::prepare($incoming, $config, false, null, $vocabulary);
        self::assertStringNotContainsString('My current words', json_encode($file['patch'], JSON_THROW_ON_ERROR));
    }

    public function testFreshIdentitiesPreserveJourneyAndSubmissionReferences(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        $incoming = $vocabulary->normalize(['tree' => $tree]) + ['display_type' => 'popup'];
        $config = ['template' => ['tree' => ['steps' => [['content' => ['type' => 'heading', 'id' => 'n900']]]]]];
        $prepared = TransferDraft::prepare($incoming, $config, false, null, $vocabulary)['patch']['template']['tree'];
        self::assertNull(GraphCaptureContract::issue($prepared, 'collect_enquiries'));
        foreach ($prepared['steps'] as $step) foreach (CaptureJourney::nodes($step['content']) as $node) {
            if (isset($node['id'])) self::assertGreaterThan(900, (int) substr($node['id'], 1));
        }
        self::assertSame($tree['graph'], $prepared['graph']);
    }
    public function testKeepContentPreservesGraphConnectionsAndQuestionReferences(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        $incoming = ['name' => 'Enquiry', 'tree' => $tree, 'tokens' => [], 'display_type' => 'popup'];
        $config = ['template' => $incoming, 'display_type' => 'popup'];
        $prepared = TransferDraft::prepare($incoming, $config, true, null, $vocabulary)['patch']['template']['tree'];
        self::assertSame(3, $prepared['v']);
        self::assertSame($tree['graph'], $prepared['graph']);
        self::assertNull(GraphCaptureContract::issue($prepared, 'collect_enquiries'));
        TransferDraft::validate(['template' => ['tree' => $prepared, 'tokens' => []], 'display_type' => 'popup'], 'Enquiry', new PackValidator(TemplateManifest::load(), $vocabulary, Tier::Basic));
    }

    public function testCandidateValidationRejectsRoutingDamagedAfterReadingTheArchive(): void
    {
        $tree = json_decode((string) file_get_contents(WCONVERT_DIR . '/tests/fixtures/journey-graph-enquiry.json'), true);
        $tree['graph']['entry'] = 'missing';
        $validator = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), Tier::Basic);
        $this->expectException(\RuntimeException::class);
        TransferDraft::validate(['template' => ['tree' => $tree, 'tokens' => []], 'display_type' => 'popup'], 'Enquiry', $validator);
    }

}
