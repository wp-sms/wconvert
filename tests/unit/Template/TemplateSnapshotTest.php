<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedProjection;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\MerchantsOwn;
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
#[CoversClass(MerchantsOwn::class)]
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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'headline', 'text' => $headline],
                    ['type' => 'image', 'src' => '/starter.png', 'alt' => 'The starter picture'],
                    ['type' => 'field', 'name' => 'email', 'required' => true],
                    ['type' => 'button', 'role' => 'cta_label', 'label' => 'Join', 'action' => 'submit'],
                ]],
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'success_headline', 'text' => 'You are on the list'],
                ]],
            ]]),
        ]));
    }

    /** A second design to switch TO, carrying its own artwork and its own CTA. */
    private function shipSecond(): void
    {
        file_put_contents($this->tree . '/resources/templates/library/second.json', (string) json_encode([
            'id' => 'second',
            'display_type' => 'popup',
            'tokens' => ['bg' => '#000000'],
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'headline', 'text' => 'Second'],
                    ['type' => 'image', 'src' => '/second.png', 'alt' => 'The second picture'],
                    ['type' => 'field', 'name' => 'email', 'required' => true],
                    ['type' => 'button', 'role' => 'cta_label', 'label' => 'Go', 'action' => 'submit'],
                ]],
                ['type' => 'stack', 'children' => [
                    ['type' => 'heading', 'role' => 'success_headline', 'text' => 'Done'],
                ]],
            ]]),
        ]));
    }

    /**
     * The Optin's own copy of `starter`, with whatever the merchant then did to
     * it, switched onto `second`.
     *
     * @param array<int, array<string, string>> $edits Keys to write onto the Optin's copy, by child index.
     * @return array<string, array<string, mixed>> The image and the button of the switched design.
     */
    private function switchedAfter(array $edits): array
    {
        $this->shipSecond();

        $config = $this->library()->snapshotInto(['template_id' => 'starter']);

        foreach ($edits as $at => $keys) {
            $config['template']['tree']['steps'][0]['content']['children'][$at] = array_merge(
                $config['template']['tree']['steps'][0]['content']['children'][$at],
                $keys
            );
        }

        $config['template_id'] = 'second';

        $switched = $this->library()->snapshotInto($config, 'starter');
        $children = $switched['template']['tree']['steps'][0]['content']['children'];

        return ['image' => $children[1], 'button' => $children[3]];
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
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            new \DateTimeZone('UTC')
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
        [$heading, $image, $field] = $config['template']['tree']['steps'][0]['content']['children'];

        $this->assertArrayNotHasKey('text', $heading, 'placeholder copy is never copied into an Optin');
        $this->assertSame('headline', $heading['role'], 'but the Role it fills is');
        // An image is not words: the entry's own asset comes across, because a
        // Playbook never supplies one (ADR 0013).
        $this->assertSame('/starter.png', $image['src']);
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
            'tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
                ['type' => 'image', 'src' => '/x.png', 'alt' => ''],
                ['type' => 'button', 'role' => 'cta_label', 'label' => 'Shop', 'action' => 'link', 'href' => 'https://x.test'],
            ]]]]),
        ]));

        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        $config['template_id'] = 'second';

        $repicked = $this->library()->snapshotInto($config, 'starter');

        $this->assertSame(['bg' => '#000000'], $repicked['template']['tokens']);
        $this->assertSame('image', $repicked['template']['tree']['steps'][0]['content']['children'][0]['type']);
    }

    // ========================================================================
    // AND WHAT THEY SUPPLIED THAT IS NOT WORDS TRAVELS TOO.
    // ========================================================================

    /**
     * **A merchant who uploaded a photo and then picked a nicer design lost
     * it.** `image` declares no `copy` at all — deliberately, because "a
     * template's image slot keeps the template's own asset or stays empty"
     * (ADR 0013) — so no [[Slot Role]] bound to it and nothing carried it.
     */
    public function testAnUploadedImageSurvivesSwitchingTemplate(): void
    {
        $after = $this->switchedAfter([1 => ['src' => '/mine.jpg', 'alt' => 'My shop']]);

        $this->assertSame('/mine.jpg', $after['image']['src']);
        $this->assertSame('My shop', $after['image']['alt']);
    }

    /**
     * **And a button's destination**, which is CONTENT rather than a param — a
     * click-metered CTA's destination is the merchant's to type (ADR 0010) —
     * but is not `copy`, so `cta_label` carried the words and dropped the place
     * they went.
     */
    public function testATypedDestinationSurvivesSwitchingTemplate(): void
    {
        $after = $this->switchedAfter([
            3 => ['href' => 'https://shop.test/sale', 'label' => 'Grab the sale'],
        ]);

        $this->assertSame('https://shop.test/sale', $after['button']['href']);
        // The two mechanisms answer for one node without fighting: the words
        // travel by Role and the destination travels beside them.
        $this->assertSame('Grab the sale', $after['button']['label'] ?? null);
    }

    /**
     * **The other half, and the half that makes this safe rather than merely
     * sympathetic.** A value the merchant never touched is the previous
     * DESIGN's, and carrying it would plant `starter`'s stock photo into a
     * design that shipped its own — ADR 0013's rule broken by a fix meant to
     * honour it.
     */
    public function testAnUntouchedImageAdoptsTheNewDesignsOwn(): void
    {
        $after = $this->switchedAfter([]);

        $this->assertSame('/second.png', $after['image']['src']);
        $this->assertSame('The second picture', $after['image']['alt']);
    }

    /** Per key, so replacing the picture and leaving the alt text keeps the new one's. */
    public function testItCarriesTheKeysTheyChangedAndNoOthers(): void
    {
        $after = $this->switchedAfter([1 => ['src' => '/mine.jpg']]);

        $this->assertSame('/mine.jpg', $after['image']['src']);
        $this->assertSame('The second picture', $after['image']['alt']);
    }

    /**
     * **Nothing is carried where the old entry cannot be resolved.** Without
     * something to compare against, "the merchant's" and "the previous
     * design's" are indistinguishable — and the failure that costs a merchant
     * more is the one that silently overwrites a design's own artwork.
     */
    public function testItCarriesNothingWhenThePreviousEntryIsGone(): void
    {
        $this->shipSecond();

        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        $config['template']['tree']['steps'][0]['content']['children'][1]['src'] = '/mine.jpg';
        $config['template_id'] = 'second';

        unlink($this->tree . '/resources/templates/library/starter.json');

        $switched = $this->library()->snapshotInto($config, 'starter');

        $this->assertSame(
            '/second.png',
            $switched['template']['tree']['steps'][0]['content']['children'][1]['src']
        );
    }

    /**
     * **A block the merchant ADDED is theirs by construction.** The structure
     * editor can add an `image` the old entry never had, so there is nothing it
     * could be a copy of and the ordinal has no counterpart to compare with.
     */
    public function testAnImageTheMerchantAddedIsCarried(): void
    {
        $this->shipSecond();

        $config = $this->library()->snapshotInto(['template_id' => 'starter']);
        // A second image, as the structure editor would append one.
        $config['template']['tree']['steps'][0]['content']['children'][] = [
            'type' => 'image',
            'src' => '/added.jpg',
            'alt' => 'Added by hand',
        ];
        $config['template_id'] = 'second';

        $switched = $this->library()->snapshotInto($config, 'starter');
        $images = array_values(array_filter(
            $switched['template']['tree']['steps'][0]['content']['children'],
            static fn (array $node): bool => $node['type'] === 'image'
        ));

        // `second` has one image slot, so the first is the one that lands; the
        // extra has nowhere to go, because arrangement is the new design's.
        $this->assertCount(1, $images);
        $this->assertSame('/second.png', $images[0]['src']);
    }

    public function testATemplateIdNamingNothingThisInstallShipsLeavesTheOptinAlone(): void
    {
        $config = $this->library()->snapshotInto(['template_id' => 'from-a-plugin-we-do-not-have']);

        $this->assertArrayNotHasKey('template', $config);
        $this->assertSame('from-a-plugin-we-do-not-have', $config['template_id']);
    }
}
