<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Frontend\InlineOptinBlock;
use WConvert\Frontend\InlineOptinShortcode;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\OptinDesign;

/**
 * The block's two halves that are not the anchor: **what it is filed under,
 * and what its picker offers.**
 *
 * The anchor itself is {@see InlineAnchorTest}'s subject. What is left here is
 * the machinery around it, and both halves fail the same way — silently, in
 * wp-admin, with a green suite. A block registered under a name the editor
 * bundle does not use is a block the inserter offers and the editor cannot
 * draw; a picker that offers the wrong Optins places the wrong thing.
 */
#[CoversClass(InlineOptinBlock::class)]
final class InlineOptinBlockTest extends TestCase
{
    private const METADATA = __DIR__ . '/../../../resources/blocks/inline-optin/block.json';

    private FakeConnection $db;

    private PublishedSet $publishedSet;

    private OptinRepository $optins;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestBlocks'] = [];
        $GLOBALS['wconvertTestShortcodes'] = [];
        $GLOBALS['wconvertTestInlineScripts'] = [];
        $GLOBALS['wconvertTestWordPressVersion'] = '7.1';

        $this->db = new FakeConnection();
        $this->publishedSet = new PublishedSet(new FakeOptionStore());
        $this->optins = new OptinRepository(
            $this->db,
            $this->publishedSet,
            RuleVocabulary::fromManifest(__DIR__ . '/../../..'),
            new MilestoneStore(new FakeOptionStore()
        ));
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestWordPressVersion']);
        $GLOBALS['wconvertTestCapabilities'] = [];
    }

    private function block(): InlineOptinBlock
    {
        return new InlineOptinBlock($this->publishedSet, $this->optins);
    }

    /**
     * @return array<string, mixed>
     */
    private function metadata(): array
    {
        $decoded = json_decode((string) file_get_contents(self::METADATA), true);

        $this->assertIsArray($decoded, 'block.json is not readable JSON');

        return $decoded;
    }

    /**
     * A published `inline` Optin, as the site would be serving it.
     */
    private function publishInline(string $name, string $displayType = 'inline'): string
    {
        $optin = $this->optins->create($name, 'promote_offer', [
            'display_type' => $displayType, 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(),
            'template' => OptinDesign::template(),
        ]);

        $this->optins->publish($optin->id);

        return $optin->id;
    }

    /**
     * **The name is declared once, in the file both sides read.**
     *
     * PHP points `register_block_type()` at the metadata directory and the
     * editor bundle imports the same file for `metadata.name`, so there is one
     * spelling by construction — and this is what says so, because the way it
     * would stop being true is somebody passing the string to
     * `register_block_type()` "to be explicit".
     */
    public function testItRegistersUnderTheNameItsMetadataDeclares(): void
    {
        $this->block()->register();

        $metadata = $this->metadata();

        $this->assertSame(InlineOptinBlock::NAME, $metadata['name']);
        $this->assertArrayHasKey(InlineOptinBlock::NAME, $GLOBALS['wconvertTestBlocks']);
    }

    /**
     * The editor script is named in `block.json` and registered in PHP, and
     * those genuinely ARE two spellings — a handle is not something metadata
     * can register when the bundle lives under `public/` and the metadata
     * under `resources/`.
     *
     * A disagreement is a block whose `editorScript` handle was never
     * registered: WordPress enqueues nothing, the editor never hears of the
     * block, and the inserter shows an entry that inserts an "unsupported"
     * placeholder.
     */
    public function testTheEditorScriptItRegistersIsTheHandleItsMetadataNames(): void
    {
        $this->block()->register();

        $this->assertSame(InlineOptinBlock::HANDLE, $this->metadata()['editorScript']);
        $this->assertTrue(wp_script_is(InlineOptinBlock::HANDLE, 'registered'));
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('wordpressApiVersions')]
    public function testItUsesTheBlockApiVersionSupportedByWordPress(string $wordpress, int $expected): void
    {
        $GLOBALS['wconvertTestWordPressVersion'] = $wordpress;
        $this->block()->register();

        $this->assertSame($expected, $GLOBALS['wconvertTestBlocks'][InlineOptinBlock::NAME]['api_version']);
    }

    /** @return iterable<string, array{string, int}> */
    public static function wordpressApiVersions(): iterable
    {
        yield 'declared minimum' => ['6.8', 3];
        yield 'current release' => ['7.1', 3];
    }

    /**
     * The one attribute, spelled in metadata and read in `render()`.
     *
     * An editor that saves `optinId` into a block whose server half reads
     * something else renders an empty string on every page — and looks
     * completely correct in the editor, which is the only place a merchant
     * would look.
     */
    public function testItRendersTheAttributeItsMetadataDeclares(): void
    {
        $attributes = $this->metadata()['attributes'];

        $this->assertArrayHasKey('optinId', $attributes);

        $id = '01JQ0000000000000000000001';

        $this->assertSame(
            InlineOptinShortcode::render(['id' => $id]),
            InlineOptinBlock::render(['optinId' => $id])
        );
    }

    /**
     * **The picker offers what the site is serving, by the merchant's own
     * name for it.**
     */
    public function testThePickerOffersPublishedInlineOptinsByName(): void
    {
        $id = $this->publishInline('Newsletter footer');

        $this->assertSame([['id' => $id, 'name' => 'Newsletter footer']], $this->offered());
        $this->assertSame('published', $this->payload()['campaigns'][0]['status']);
    }

    /**
     * **A draft is listed, as a draft.** It is not on any page, so the editor
     * refuses it — but a first-time owner who saved one and came to place it
     * is told "publish to place it" rather than "none". Published is still
     * answered by the published set, the same option the front end reads.
     */
    public function testItListsAnInlineDraftAsADraft(): void
    {
        $draft = $this->optins->create('Spring signup', 'grow_email_list', ['display_type' => 'inline', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate()]);

        $this->assertSame([], $this->offered());
        $this->assertSame(
            [['id' => $draft->id, 'name' => 'Spring signup', 'status' => 'draft']],
            array_map(static fn (array $c): array => ['id' => $c['id'], 'name' => $c['name'], 'status' => $c['status']], $this->payload()['campaigns'])
        );
    }

    /** A draft of an overlay has no anchor to place, and a deleted draft is gone. */
    public function testItListsNoOverlayDraftAndNoDeletedDraft(): void
    {
        $this->optins->create('Welcome popup', 'grow_email_list', ['display_type' => 'popup']);
        $deleted = $this->optins->create('Old inline', 'grow_email_list', ['display_type' => 'inline']);
        $this->optins->delete($deleted->id);

        $this->assertSame([], $this->payload()['campaigns']);
    }

    /**
     * **The doors out are a manager's only.** An Author can place the block
     * but cannot open WConvert, so a Create or Edit link would land on "Sorry,
     * you are not allowed"; null tells the editor to say who can help.
     */
    public function testOnlyAManagerIsGivenLinksIntoWConvert(): void
    {
        $id = $this->publishInline('Newsletter footer');

        $GLOBALS['wconvertTestCapabilities'] = ['edit_posts'];
        $author = $this->payload();

        $this->assertNull($author['manageUrl']);
        $this->assertNull($author['createUrl']);
        $this->assertNull($author['campaigns'][0]['editUrl']);

        $GLOBALS['wconvertTestCapabilities'] = ['manage_options', 'edit_posts'];
        $manager = $this->payload();

        $this->assertSame('https://example.test/wp-admin/admin.php?page=wconvert#optins', $manager['manageUrl']);
        $this->assertSame('https://example.test/wp-admin/admin.php?page=wconvert#optins?new=1', $manager['createUrl']);
        $this->assertSame('https://example.test/wp-admin/admin.php?page=wconvert#optins?edit=' . $id, $manager['campaigns'][0]['editUrl']);
    }

    /**
     * Refresh reads the same list fresh, and anyone who can open the post
     * editor may ask — the same capability as Pro's content lock picker.
     */
    public function testRefreshIsAnUncachedReadForWhoeverCanPlaceTheBlock(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $this->publishInline('Newsletter footer');
        $block = $this->block();
        $block->registerRoute();

        $route = $GLOBALS['wconvertTestRoutes'][0];

        $this->assertSame([\WConvert\Rest\Routes::NAMESPACE, InlineOptinBlock::ROUTE], [$route['namespace'], $route['route']]);
        $this->assertSame('GET', $route['args']['methods']);
        $this->assertSame([\WConvert\Rest\Routes::class, 'canPlaceCampaign'], $route['args']['permission_callback']);

        $response = ($route['args']['callback'])();

        $this->assertSame($block->choices(), $response->get_data());
        $this->assertSame('no-store', $response->get_headers()['Cache-Control']);

        foreach ([[], ['read'], ['edit_posts'], ['edit_pages']] as $caps) {
            $GLOBALS['wconvertTestCapabilities'] = $caps;
            $this->assertSame($caps === ['edit_posts'] || $caps === ['edit_pages'], \WConvert\Rest\Routes::canPlaceCampaign());
        }
    }

    /** The picker's stylesheet is registered under the handle `block.json` names as its `editorStyle`. */
    public function testItRegistersTheEditorStyleItsMetadataNames(): void
    {
        $this->block()->register();

        $this->assertSame(InlineOptinBlock::HANDLE, $this->metadata()['editorStyle']);
        $this->assertArrayHasKey(InlineOptinBlock::HANDLE, $GLOBALS['wconvertTestStyles']['registered']);
    }

    /**
     * **The three overlays mount themselves and have no anchor to place.**
     *
     * Offering one here would give a merchant a block that renders nothing,
     * for a reason nothing on the page could explain — the loader's
     * arbitration leaves `inline` alone precisely because it is the one type
     * that is not competing for the screen.
     */
    public function testItOffersNoOverlay(): void
    {
        $this->publishInline('Welcome popup', 'popup');

        $this->assertSame([], $this->offered());
    }

    /**
     * Absence is `popup` on both sides of the wire, so an entry with no
     * Display Type at all is an overlay and not an omission.
     */
    public function testAnOptinWithNoDisplayTypeIsAPopupAndNotOffered(): void
    {
        $optin = $this->optins->create('No type', 'grow_email_list', ['template' => OptinDesign::template()]);
        $this->optins->publish($optin->id);

        $this->assertSame([], $this->offered());
    }

    /**
     * Newest first — the id is a ULID, so ordering by it is ordering by the
     * moment it was created, which is the order the Optins list already shows.
     *
     * **The ids are written rather than minted, and that is not fussiness.**
     * Two ULIDs generated inside one millisecond share their whole timestamp
     * half and differ only in eighty bits of randomness, so a fixture that
     * calls `create()` twice orders by a coin toss — it passes about a third
     * of the time and says nothing either way. These two differ in the
     * timestamp, which is the thing the ordering claims to be about.
     */
    public function testItOffersTheNewestFirst(): void
    {
        $older = $this->publishInlineWithId('01JQ0000000000000000000001', 'Older');
        $newer = $this->publishInlineWithId('01JQ0000000000000000000002', 'Newer');

        $this->assertSame([$newer, $older], array_column($this->offered(), 'id'));
    }

    /**
     * An Optin with no name is still on the page, so a picker that omitted it
     * could not place something the site is serving. It goes out nameless and
     * the editor labels it "Unnamed campaign": no ID on screen (ADR 0131).
     */
    public function testAnUnnamedOptinIsOfferedWithoutAName(): void
    {
        $id = $this->publishInline('');

        $this->assertSame([['id' => $id, 'name' => '']], $this->offered());
    }

    /**
     * The list reaches the editor BEFORE the bundle that reads it. The bundle
     * is an IIFE that runs the moment it is parsed, so data attached `after`
     * it would arrive to a picker that had already rendered empty.
     */
    public function testTheListIsPrintedBeforeTheBundleThatReadsIt(): void
    {
        $this->publishInline('Newsletter footer');
        $this->block()->provideTheOptinList();

        $printed = $GLOBALS['wconvertTestInlineScripts'][InlineOptinBlock::HANDLE];

        $this->assertCount(1, $printed);
        $this->assertSame('before', $printed[0]['position']);
        $this->assertStringStartsWith('window.' . InlineOptinBlock::DATA . ' = ', $printed[0]['data']);
    }

    /**
     * A published `inline` Optin under an id this test chose.
     *
     * Written straight to the table and the set rebuilt from it, because
     * `create()` mints its own id and the two facts this needs to control —
     * WHICH id, and that it is published — are on opposite sides of that.
     */
    private function publishInlineWithId(string $id, string $name): string
    {
        $this->db->insert(Connection::TABLE_OPTINS, [
            'id' => $id,
            'name' => $name,
            'goal' => 'grow_email_list',
            'parent_id' => null,
            'config' => (string) wp_json_encode(['display_type' => 'inline', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate()]),
            'published_config' => (string) wp_json_encode(['display_type' => 'inline', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate()]),
            'published_at' => '2026-01-01 00:00:00',
            'deleted_at' => null,
        ]);

        $this->optins->rebuildForInstall();

        return $id;
    }

    /**
     * What `provideTheOptinList()` put on `window`, decoded.
     *
     * The list is reached through the public surface that publishes it: what
     * the editor gets is the JSON, and a shape that survives `wp_json_encode`
     * is the thing worth asserting.
     *
     * @return array{campaigns: list<array{id: string, name: string, status: string, editUrl: ?string}>, manageUrl: ?string, createUrl: ?string}
     */
    private function payload(): array
    {
        $GLOBALS['wconvertTestInlineScripts'] = [];

        $this->block()->provideTheOptinList();

        $printed = $GLOBALS['wconvertTestInlineScripts'][InlineOptinBlock::HANDLE][0]['data'];
        $json = substr($printed, strlen('window.' . InlineOptinBlock::DATA . ' = '), -1);

        return json_decode($json, true);
    }

    /**
     * The published campaigns the picker can place, as `{id, name}`.
     *
     * @return list<array{id: string, name: string}>
     */
    private function offered(): array
    {
        return array_values(array_map(
            static fn (array $campaign): array => ['id' => $campaign['id'], 'name' => $campaign['name']],
            array_filter($this->payload()['campaigns'], static fn (array $campaign): bool => $campaign['status'] === 'published')
        ));
    }
}
