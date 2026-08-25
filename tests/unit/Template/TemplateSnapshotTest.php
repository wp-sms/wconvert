<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedProjection;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * The snapshot boundary.
 *
 * An Optin takes a COPY of its Template's tree and tokens; the renderer and
 * the vocabulary stay a live reference. So an accessibility or RTL fix reaches
 * every existing Optin and a restyle reaches none — which is what makes
 * `template_id` *provenance* rather than a link, and what makes an Optin
 * render identically after its entry is deleted (ADR 0010).
 *
 * This is the seam that cannot be proven by reading the code, because the
 * failure it guards against is the one where a later ticket adds a convenient
 * lookup by `template_id` on the render path.
 */
#[CoversClass(TemplateLibrary::class)]
final class TemplateSnapshotTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private string $tree = '';

    private function shipTemplate(string $headline): void
    {
        file_put_contents($this->tree . '/resources/templates/library/starter.json', (string) json_encode([
            'id' => 'starter',
            'name' => 'Starter',
            'display_type' => 'popup',
            'tokens' => ['bg' => '#ffffff'],
            'tree' => ['steps' => [['type' => 'stack', 'children' => [
                ['type' => 'heading', 'role' => 'headline', 'text' => $headline],
            ]]]],
        ]));
    }

    protected function setUp(): void
    {
        $this->tree = (string) tempnam(sys_get_temp_dir(), 'wconvert');

        unlink($this->tree);
        mkdir($this->tree . '/resources/templates/library', 0o777, true);
        $this->shipTemplate('Join the list');
    }

    protected function tearDown(): void
    {
        foreach ((array) glob($this->tree . '/resources/templates/library/*.json') as $file) {
            unlink((string) $file);
        }

        // rmdir walks back up the three directories setUp created, innermost first.
        foreach (['/resources/templates/library', '/resources/templates', '/resources', ''] as $suffix) {
            @rmdir($this->tree . $suffix);
        }
    }

    private function library(): TemplateLibrary
    {
        return TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), $this->tree);
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function payloadOf(array $config): array
    {
        $set = PublishedProjection::build(
            [[
                'id' => '01JQ00000000000000000000AA',
                'published_config' => (string) json_encode($config),
                'published_at' => '2026-08-25 09:00:00',
                'deleted_at' => null,
            ]],
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );

        return PublishedOptin::fromSet($set)[0]->toPayloadEntry();
    }

    public function testPickingATemplateCopiesItsTreeAndTokensIntoTheOptin(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'starter']);

        $this->assertSame('Join the list', $config['template']['tree']['steps'][0]['children'][0]['text']);
        $this->assertSame(['bg' => '#ffffff'], $config['template']['tokens']);
        $this->assertSame('starter', $config['template_id'], 'the id stays, as provenance');
    }

    public function testEditingTheEntryAfterwardsChangesNothingOnTheOptin(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'starter']);

        $this->shipTemplate('COMPLETELY DIFFERENT');

        $this->assertSame($config, $this->library()->snapshotInto($config));
        $this->assertSame('Join the list', $this->payloadOf($config)['template']['tree']['steps'][0]['children'][0]['text']);
    }

    public function testDeletingTheEntryLeavesTheOptinRenderingExactlyAsBefore(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        $before = $this->payloadOf($config);

        unlink($this->tree . '/resources/templates/library/starter.json');

        $this->assertNull($this->library()->find('starter'));
        $this->assertSame($before, $this->payloadOf($config));
        $this->assertNotSame([], $before['template']['tree']['steps']);
    }
}
