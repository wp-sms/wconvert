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
            // Submit-metered, so two steps and exactly one converting act —
            // the shape TemplateLibrary registers (ADR 0020, ADR 0025).
            'tree' => ['steps' => [
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'headline', 'text' => $headline],
                    ['type' => 'field', 'name' => 'email', 'required' => true],
                    ['type' => 'button', 'role' => 'cta_label', 'label' => 'Join', 'action' => 'submit'],
                ]],
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'success_headline', 'text' => 'You are on the list'],
                ]],
            ]],
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

    /**
     * The copy is the entry's own placeholder and stays with the gallery: "the
     * words come from the Playbook that prefilled the Optin, or from the user"
     * (CONTEXT.md, Template). What the Optin takes is the design, and the Slot
     * Roles that say where the words will go.
     */
    public function testPickingATemplateCopiesItsDesignAndNotItsWords(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        [$heading, $field] = $config['template']['tree']['steps'][0]['children'];

        $this->assertArrayNotHasKey('text', $heading, 'placeholder copy is never copied into an Optin');
        $this->assertSame('headline', $heading['role'], 'but the Role it fills is');
        $this->assertSame('email', $field['name']);
        $this->assertSame(['bg' => '#ffffff'], $config['template']['tokens']);
        $this->assertSame('starter', $config['template_id'], 'the id stays, as provenance');
    }

    public function testEditingTheEntryAfterwardsChangesNothingOnTheOptin(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'starter']);

        $this->shipTemplate('COMPLETELY DIFFERENT');

        $this->assertSame($config, $this->library()->snapshotInto($config, 'starter'));
        $this->assertSame($config['template'], $this->payloadOf($config)['template']);
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

    /**
     * Repicking is not the case the snapshot rule protects.
     *
     * "Improving a Template never restyles an Optin already running on it" is
     * about editing the ENTRY. A merchant choosing a different design is
     * asking for a different design, and leaving the old copy in place would
     * make `template_id` say one thing while the payload rendered another.
     */
    public function testChoosingADifferentTemplateTakesAFreshCopy(): void
    {
        file_put_contents($this->tree . '/resources/templates/library/second.json', (string) json_encode([
            'id' => 'second',
            'display_type' => 'popup',
            'tokens' => ['bg' => '#000000'],
            // Click-metered, so ONE step: the click navigates the visitor
            // away and there is no success state left to render (ADR 0025).
            'tree' => ['steps' => [['type' => 'stack', 'children' => [
                ['type' => 'image', 'src' => '/x.png', 'alt' => ''],
                ['type' => 'button', 'role' => 'cta_label', 'label' => 'Shop', 'action' => 'link', 'href' => 'https://x.test'],
            ]]]],
        ]));

        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        $config['template_id'] = 'second';

        $repicked = $this->library()->snapshotInto($config, 'starter');

        $this->assertSame(['bg' => '#000000'], $repicked['template']['tokens']);
        $this->assertSame('image', $repicked['template']['tree']['steps'][0]['children'][0]['type']);
    }

    public function testATemplateIdNamingNothingThisInstallShipsLeavesTheOptinAlone(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'from-a-plugin-we-do-not-have']);

        $this->assertArrayNotHasKey('template', $config);
        $this->assertSame('from-a-plugin-we-do-not-have', $config['template_id']);
    }
}
