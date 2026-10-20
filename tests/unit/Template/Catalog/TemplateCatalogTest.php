<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Support\Tier;
use WConvert\Template\BundledTemplates;
use WConvert\Template\Catalog\DesignArchive;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/** The v3 reader: one design per object, tolerant envelope, strict tree (ADR 0156). */
final class TemplateCatalogTest extends TestCase
{
    private const FREE_DESIGN = 'resources/templates/library/reading-slip.json';
    private const PRO_DESIGN = 'pro/modules/display-types/templates/availability-note.json';

    private string $directory;
    private FakeOptionStore $options;
    private FakeCatalogTransport $http;
    private CatalogFixture $service;
    private int $now = 1_800_000_000;
    /** @var list<string> */
    private array $referenced = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-catalog-' . bin2hex(random_bytes(8));
        $this->options = new FakeOptionStore();
        $this->options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $this->options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $this->http = new FakeCatalogTransport();
        $this->service = new CatalogFixture($this->http);
        $GLOBALS['wconvertTestTransients'] = [];
    }

    protected function tearDown(): void
    {
        if (is_dir($this->directory)) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($files as $file) $file->isDir() ? rmdir((string) $file) : unlink((string) $file);
            rmdir($this->directory);
        }
        unset($GLOBALS['wconvertTestFilters']['wconvert_template_catalog']);
    }

    private function validator(Tier $tier = Tier::Free): PackValidator
    {
        return new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), $tier);
    }

    private function archive(Tier $tier = Tier::Free, string $fingerprint = 'free'): DesignArchive
    {
        return new DesignArchive($this->directory, $this->validator($tier), 'site-secret', null, $fingerprint, [], fn (): array => $this->referenced);
    }

    /**
     * @param array<string, bool> $plugins
     * @param array<string, int> $local
     */
    private function catalog(Tier $tier = Tier::Free, ?FakeCatalogTransport $http = null, ?DesignArchive $archive = null, array $plugins = [], array $local = []): TemplateCatalog
    {
        return new TemplateCatalog($this->options, $http ?? $this->http, $this->validator($tier), $archive ?? $this->archive($tier, $tier->value), $tier,
            static fn (): array => $local, static fn (): array => $plugins, fn (): int => $this->now, TemplateVocabulary::fromManifest()->facets());
    }

    /** @return array<string, array<string, mixed>> */
    private function cards(TemplateCatalog $catalog): array
    {
        return array_column($catalog->status()['designs'], null, 'id');
    }

    public function testNothingIsFetchedWithoutConsentOrWhenTheLibraryIsSwitchedOff(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $this->options->set(TemplateCatalog::CONSENT_OPTION, '');
        $catalog = $this->catalog();
        self::assertSame('unanswered', $catalog->status()['consent']);
        self::assertSame([], $catalog->refresh(true)['designs'], 'Opening the picker before consent is a no-op');
        try { $catalog->refresh(); self::fail('Refreshed without consent'); } catch (RuntimeException $error) { self::assertStringContainsString('Allow online designs', $error->getMessage()); }
        self::assertSame([], $this->http->requests);

        $catalog->setConsent(true);
        $GLOBALS['wconvertTestFilters']['wconvert_template_catalog'] = [static fn (): bool => false];
        self::assertFalse(TemplateCatalog::enabled($this->options));
        try { $catalog->refresh(); self::fail('Refreshed while switched off'); } catch (RuntimeException $error) { self::assertStringContainsString('switched off', $error->getMessage()); }
        self::assertSame([], $this->http->requests);

        unset($GLOBALS['wconvertTestFilters']['wconvert_template_catalog']);
        $this->options->set(TemplateCatalog::SOURCE_OPTION, '');
        self::assertFalse(TemplateCatalog::enabled($this->options), 'An explicit empty address disables the library');
    }

    public function testTurningTheLibraryOffHidesTheCachedIndexAtOnce(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertCount(1, $catalog->status()['designs']);
        $catalog->setConsent(false);
        self::assertSame([], $catalog->status()['designs'], 'Answering no hides what was already read');
        $catalog->setConsent(true);
        $GLOBALS['wconvertTestFilters']['wconvert_template_catalog'] = [static fn (): bool => false];
        self::assertSame([], $this->catalog()->status()['designs'], 'Switching the library off hides it too');
        self::assertSame([], $this->catalog()->collections());
    }

    public function testTheHostedDefaultCarriesTheMajorVersionInItsAddress(): void
    {
        self::assertSame('https://templates.wconvert.io/v3/manifest.json', TemplateCatalog::DEFAULT_SOURCE);
        $this->options->set(TemplateCatalog::SOURCE_OPTION, 'https://catalog.example/manifest.json');
        $this->expectExceptionMessage('/v3/manifest.json');
        $this->catalog()->refresh();
    }

    public function testRefreshReadsTheIndexOnceAndStatusNeedsNoNetwork(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $release = $this->service->publish();
        $catalog = $this->catalog();
        $status = $catalog->refresh();
        self::assertSame($release, $status['release']);
        self::assertSame('install', $this->cards($catalog)['reading']['state']);
        self::assertSame([['id' => 'food', 'label' => 'Food & drink']], $status['taxonomy']['industry']);
        $this->http->requests = [];
        $this->http->responses = [];
        self::assertSame('install', $this->cards($this->catalog())['reading']['state'], 'A new request reads the local index');
        self::assertSame([], $this->http->requests);
        self::assertLessThan(4096, strlen((string) json_encode($this->options->get(TemplateCatalog::CACHE_OPTION))), 'Only a pointer lives in the option; pages are files');
    }

    public function testUnknownKeysInTheEnvelopeEntriesAndMetaAreDropped(): void
    {
        $this->service->extraPointer = ['schedule' => ['next' => 'tuesday']];
        $this->service->design(self::FREE_DESIGN, 'reading', 1, ['minor' => 4, 'hologram' => true, 'meta' => ['description' => 'A slip.', 'aura' => 'blue']], ['sparkle' => 11]);
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertArrayNotHasKey('sparkle', $this->cards($catalog)['reading']);
        $installed = $catalog->install('reading', $this->service->sha('reading'));
        self::assertSame('design-1-reading', $installed['template_id']);
        $design = $this->archive()->designs()[0];
        self::assertSame(['description' => 'A slip.'], $design['meta']);
    }

    public function testAnUnknownKeyInsideTheTreeIsStillRefused(): void
    {
        $design = $this->service->design(self::FREE_DESIGN, 'reading');
        $tree = $design['object']['tree'];
        $tree['steps'][0]['content']['onclick'] = 'alert(1)';
        $this->service->designs[0]['object']['tree'] = $tree;
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        $this->expectExceptionMessage('unsupported properties');
        $catalog->install('reading', $this->service->sha('reading'));
    }

    public function testAnUnknownPlanFormatOrVersionIsUnsupportedNeverFree(): void
    {
        $this->service->design(self::FREE_DESIGN, 'plan', 1, [], ['tier' => 'platinum']);
        $this->service->design(self::FREE_DESIGN, 'format', 1, [], ['format' => 'hologram']);
        $this->service->design(self::FREE_DESIGN, 'newer', 1, [], ['requires' => ['plugin' => '9.0.0', 'capabilities' => []]]);
        $this->service->design(self::FREE_DESIGN, 'ability', 1, [], ['requires' => ['plugin' => '1.0.0', 'capabilities' => ['teleport:1']]]);
        $this->service->design(self::FREE_DESIGN, 'fine');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        $cards = $this->cards($catalog);
        foreach (['plan', 'format', 'newer', 'ability'] as $id) self::assertSame('update_plugin', $cards[$id]['state'], $id);
        self::assertSame('install', $cards['fine']['state']);
        $this->expectExceptionMessage('cannot be used on this site');
        $catalog->install('plan', $this->service->sha('plan'));
    }

    public function testOneBadEntryOrDesignCostsOnlyThatDesign(): void
    {
        $this->service->design(self::FREE_DESIGN, 'broken', 1, ['tree' => ['v' => 2, 'steps' => 'nope']]);
        $this->service->design(self::FREE_DESIGN, 'fine');
        $this->service->publish();
        // An entry with no name, inside verified bytes, is dropped and counted.
        $release = json_decode($this->http->responses[CatalogFixture::BASE . 'releases/' . json_decode($this->http->responses[CatalogFixture::SOURCE], true)['release'] . '.json'], true);
        $pageUrl = CatalogFixture::BASE . 'index/' . $release['pages'][0] . '.json';
        $page = json_decode($this->http->responses[$pageUrl], true);
        $page['designs'][] = ['id' => 'nameless', 'revision' => 1];
        $json = json_encode($page, JSON_THROW_ON_ERROR);
        unset($this->http->responses[$pageUrl]);
        $this->http->responses[CatalogFixture::BASE . 'index/' . hash('sha256', $json) . '.json'] = $json;
        $release['pages'] = [hash('sha256', $json)];
        $releaseJson = json_encode($release, JSON_THROW_ON_ERROR);
        $this->http->responses[CatalogFixture::BASE . 'releases/' . hash('sha256', $releaseJson) . '.json'] = $releaseJson;
        $this->http->responses[CatalogFixture::SOURCE] = json_encode(['schema' => 3, 'minor' => 0, 'release' => hash('sha256', $releaseJson)], JSON_THROW_ON_ERROR);

        $catalog = $this->catalog();
        self::assertSame(1, $catalog->refresh()['skipped']);
        try { $catalog->install('broken', $this->service->sha('broken')); self::fail('Broken design installed'); } catch (RuntimeException) {}
        $catalog->install('fine', $this->service->sha('fine'));
        self::assertSame(['fine'], array_column($this->archive()->designs(), 'id'));
    }

    public function testAWithdrawnDesignLeavesThePickerAndCannotBeInstalled(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->design(self::FREE_DESIGN, 'kept');
        $this->service->withdrawn = [['id' => 'reading', 'reason' => 'rights'], ['id' => 'kept', 'revision' => 7, 'reason' => 'sideways']];
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertSame(['kept'], array_keys($this->cards($catalog)), 'A withdrawal pinned to another revision leaves this one');
        self::assertTrue($catalog->isWithdrawn('reading', 3));
        self::assertSame('other', $catalog->withdrawn()[1]['reason'], 'An unknown reason reads as other');
        $this->expectExceptionMessage('withdrawn');
        $catalog->install('reading', $this->service->sha('reading'));
    }

    public function testTheHighestRevisionWinsAcrossBundledInstalledAndRemoteCopies(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading-slip', 2, ['tokens' => ['bg' => '#ffeeaa'] + json_decode((string) file_get_contents(WCONVERT_DIR . self::FREE_DESIGN), true)['tokens']]);
        $this->service->publish();
        $catalog = $this->catalog(Tier::Free, null, null, [], ['reading-slip' => 1]);
        $catalog->refresh();
        $card = $this->cards($catalog)['reading-slip'];
        self::assertSame(['install', 1], [$card['state'], $card['local_revision']], 'A bundled revision 1 is older than hosted revision 2');
        $catalog->install('reading-slip', $card['sha256']);

        $library = TemplateLibrary::from(TemplateVocabulary::fromManifest(), new BundledTemplates(WCONVERT_DIR), $this->archive());
        self::assertFalse($library->find('reading-slip')['catalog_current'], 'The bundled copy stays resolvable but is no longer offered');
        self::assertTrue($library->find('design-2-reading-slip')['catalog_current']);
        self::assertSame('#ffeeaa', $library->find('design-2-reading-slip')['tokens']['bg']);
        self::assertSame('ready', $this->cards($this->catalog(Tier::Free, null, null, [], ['reading-slip' => 1]))['reading-slip']['state']);
    }

    public function testCleanupKeepsEveryRevisionAnOptinRowStillNames(): void
    {
        foreach ([1, 2, 3] as $revision) {
            $this->service->designs = [];
            $this->service->design(self::FREE_DESIGN, 'reading', $revision, ['name' => 'Reading r' . $revision]);
            $this->service->publish();
            $catalog = $this->catalog();
            $catalog->refresh();
            // Revision 1 is used by, say, a trashed A/B variant's published config.
            if ($revision === 1) $this->referenced = ['design-1-reading'];
            $catalog->install('reading', $this->service->sha('reading', $revision));
        }
        self::assertSame([3, 1], array_column($this->archive()->designs(), 'revision'), 'Revision 2 was unreferenced and superseded');
        self::assertCount(2, glob($this->directory . '/designs/*.json') ?: []);
    }

    public function testTheValidatedCacheIsKeyedOnWhatValidationDependsOn(): void
    {
        $this->service->design(self::PRO_DESIGN, 'bar', 1, [], []);
        $this->service->publish();
        $premium = new FakePremiumTransport();
        $premium->responses = $this->http->responses;
        $premium->etags = $this->http->etags;
        $catalog = $this->catalog(Tier::Pro, $premium);
        $catalog->refresh();
        $catalog->install('bar', $this->service->sha('bar'));
        self::assertCount(1, $this->archive(Tier::Pro, 'pro')->designs());
        self::assertCount(1, glob($this->directory . '/cache/*.json') ?: []);
        // Pro deactivated: a different fingerprint, so a fresh validation by
        // the free reader — which refuses the premium design — never the cache.
        self::assertSame([], $this->archive(Tier::Free, 'free')->designs());
        self::assertCount(1, $this->archive(Tier::Pro, 'pro')->designs(), 'Pro reactivated validates again and finds it');
    }

    public function testArchiveFilesAreNamedByAKeyedHashNotThePublicDigest(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        $sha = $this->service->sha('reading');
        $catalog->install('reading', $sha);
        $names = array_map('basename', glob($this->directory . '/designs/*.json') ?: []);
        self::assertSame([hash_hmac('sha256', $sha, 'site-secret') . '.json'], $names);
        foreach (glob($this->directory . '/*/*.json') ?: [] as $file) self::assertStringNotContainsString($sha, basename($file));

        // A rotated secret renames the file on the next read; nothing is orphaned.
        $rotated = new DesignArchive($this->directory, $this->validator(), 'new-secret', null, 'free', [], fn (): array => []);
        self::assertCount(1, $rotated->designs());
        self::assertSame([hash_hmac('sha256', $sha, 'new-secret') . '.json'], array_map('basename', glob($this->directory . '/designs/*.json') ?: []));
    }

    public function testFreeNeverRequestsPremiumJson(): void
    {
        $this->service->design(self::PRO_DESIGN, 'bar');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertSame('locked', $this->cards($catalog)['bar']['state']);
        try { $catalog->install('bar', $this->service->sha('bar')); self::fail('Free installed a premium design'); } catch (RuntimeException $error) {
            self::assertStringContainsString('WConvert Pro is needed', $error->getMessage());
        }
        try { $catalog->preview('bar'); self::fail('Free previewed a premium design'); } catch (RuntimeException) {}
        foreach ($this->http->requests as $url) self::assertStringNotContainsString('/premium/', $url);
    }

    public function testAMissingPluginOutranksPro(): void
    {
        $this->service->design(self::PRO_DESIGN, 'shop', 1, [], ['prerequisites' => ['woocommerce']]);
        $this->service->design(self::PRO_DESIGN, 'odd', 1, [], ['prerequisites' => ['some-future-plugin']]);
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertSame('unavailable', $this->cards($catalog)['shop']['state']);
        self::assertSame('locked', $this->cards($this->catalog(Tier::Free, null, null, ['woocommerce' => true]))['shop']['state']);
        self::assertSame('unavailable', $this->cards($catalog)['odd']['state'], 'An unknown plugin is missing, not ignored');
    }

    public function testProInstallsASetupAndItsPinnedDesignUnderOnePass(): void
    {
        $playbook = require WCONVERT_DIR . 'pro/modules/display-types/playbooks/accessible-visit-note.php';
        $file = 'pro/modules/display-types/templates/' . $playbook['template_id'] . '.json';
        $design = $this->service->design($file, $playbook['template_id']);
        $this->service->setup('start', $design, $playbook, 1, 'pro');
        $this->service->publish();
        $premium = new FakePremiumTransport();
        $premium->responses = $this->http->responses;
        $premium->etags = $this->http->etags;
        $catalog = $this->catalog(Tier::Pro, $premium);
        $catalog->refresh();
        $result = $catalog->installSetup('start', $this->service->setupSha('start'));
        self::assertSame(['playbook_id' => 'setup-1-start', 'template_id' => 'design-1-' . $playbook['template_id']], array_intersect_key($result, ['playbook_id' => 1, 'template_id' => 1]));
        self::assertCount(1, $premium->passes, 'One authorization covers the setup and its design');
        self::assertSame([[$this->service->sha($playbook['template_id'])], [$this->service->setupSha('start')]], [$premium->passes[0]['designs'], $premium->passes[0]['setups']]);
        $playbooks = $this->archive(Tier::Pro, 'pro')->playbooks();
        self::assertSame('design-1-' . $playbook['template_id'], $playbooks[0]['template_id']);
        self::assertSame('ready', $this->catalog(Tier::Pro, $premium, $this->archive(Tier::Pro, 'pro'))->status()['setups'][0]['state']);
    }

    public function testAChangedDigestCannotInstall(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        $this->expectExceptionMessage('changed after you previewed it');
        $catalog->install('reading', str_repeat('0', 64));
    }

    public function testRefreshIsConditionalAndRereadsNothingThatDidNotChange(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $catalog = $this->catalog();
        $catalog->refresh();
        $this->http->requests = [];
        $this->now += 3600;
        $catalog->refresh(true);
        self::assertSame([], $this->http->requests, 'Inside twelve hours, opening the picker fetches nothing');

        $this->now += TemplateCatalog::REFRESH_INTERVAL;
        $this->catalog()->refresh(true);
        self::assertSame([CatalogFixture::SOURCE . ' (If-None-Match)'], $this->http->requests, 'A 304 on the pointer reads no page');

        // A pointer that moved only its withdrawal list keeps every page.
        $this->service->withdrawn = [['id' => 'gone', 'reason' => 'quality']];
        $this->service->publish();
        $this->http->requests = [];
        $this->now += TemplateCatalog::REFRESH_INTERVAL;
        $this->catalog()->refresh(true);
        self::assertSame([CatalogFixture::SOURCE . ' (If-None-Match)'], $this->http->requests, 'Same release: no release or page fetch');
        self::assertTrue($this->catalog()->isWithdrawn('gone', 1));
    }

    public function testAFailedRefreshKeepsThePreviousIndexAndBacksOff(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->publish();
        $this->catalog()->refresh();
        $before = $this->options->get(TemplateCatalog::CACHE_OPTION);
        $this->service->design(self::FREE_DESIGN, 'second');
        $this->service->publish();
        $this->http->responses = [CatalogFixture::SOURCE => $this->http->responses[CatalogFixture::SOURCE]];
        $catalog = $this->catalog();
        try { $catalog->refresh(); self::fail('Partial release accepted'); } catch (RuntimeException) {}
        self::assertSame($before, $this->options->get(TemplateCatalog::CACHE_OPTION));
        self::assertSame(['reading'], array_keys($this->cards($this->catalog())));
        $this->http->requests = [];
        try { $catalog->refresh(); self::fail('No backoff'); } catch (RuntimeException $error) { self::assertStringContainsString('Try again in', $error->getMessage()); }
        self::assertSame([], $this->http->requests);
    }

    public function testAnIndexPastTheBudgetKeepsThePagesThatFit(): void
    {
        for ($i = 0; $i < 3; $i++) $this->service->design(self::FREE_DESIGN, 'page-' . $i, 1, [], ['name' => str_repeat('n', 100)]);
        $this->service->designsPerPage = 1;
        $this->service->publish();
        $release = json_decode($this->http->responses[CatalogFixture::BASE . 'releases/' . json_decode($this->http->responses[CatalogFixture::SOURCE], true)['release'] . '.json'], true);
        // Pad the last page past the reader's whole budget.
        $last = CatalogFixture::BASE . 'index/' . end($release['pages']) . '.json';
        $page = json_decode($this->http->responses[$last], true);
        $page['padding'] = str_repeat('x', \WConvert\Template\Catalog\CatalogIndex::MAX_INDEX_BYTES);
        unset($this->http->responses[$last]);
        $json = json_encode($page, JSON_THROW_ON_ERROR);
        $release['pages'][2] = hash('sha256', $json);
        $this->http->responses[CatalogFixture::BASE . 'index/' . $release['pages'][2] . '.json'] = $json;
        $releaseJson = json_encode($release, JSON_THROW_ON_ERROR);
        $this->http->responses[CatalogFixture::BASE . 'releases/' . hash('sha256', $releaseJson) . '.json'] = $releaseJson;
        $this->http->responses[CatalogFixture::SOURCE] = json_encode(['schema' => 3, 'minor' => 0, 'release' => hash('sha256', $releaseJson)], JSON_THROW_ON_ERROR);
        $transport = new class ($this->http->responses) extends FakeCatalogTransport {
            /** @param array<string, string> $responses */
            public function __construct(array $responses) { $this->responses = $responses; }
            public function get(string $url, int $limit = 262144): string { return parent::get($url, PHP_INT_MAX); }
        };
        $status = $this->catalog(Tier::Free, $transport)->refresh();
        self::assertSame(['page-0', 'page-1'], array_column($status['designs'], 'id'));
        self::assertTrue($status['update_required']);
    }

    public function testAHigherMajorSaysUpdateWithoutLosingTheCurrentLibrary(): void
    {
        $this->service->design(self::FREE_DESIGN, 'reading');
        $this->service->extraPointer = ['latest_major' => 4];
        $this->service->publish();
        $status = $this->catalog()->refresh();
        self::assertTrue($status['update_required']);
        self::assertSame(['reading'], array_column($status['designs'], 'id'));
    }

    /**
     * The reader that ships in free-v1 meets a release written later (ADR 0156):
     * minor 1, keys it has never heard of at every tolerant level, a design that
     * uses vocabulary it lacks, one that needs a newer plugin, and a new plan
     * word. It must keep every design it can read and say "update" about the
     * rest, one design at a time. Run this file against the free-v1 tag to
     * prove the shipped reader, not only today's.
     */
    public function testAReleaseFromALaterMinorDegradesOneDesignAtATime(): void
    {
        $this->service->extraPointer = ['minor' => 1, 'mirrors' => ['https://eu.example/v3/'], 'signature' => 'future'];
        $this->service->design(self::FREE_DESIGN, 'today', 1, ['minor' => 1, 'licence_note' => 'x', 'meta' => ['mood' => ['calm'], 'description' => 'A slip.']],
            ['badges' => ['new'], 'requires' => ['plugin' => '1.0.0', 'capabilities' => ['capture-journey:1', 'template-tree:2'], 'php' => '8.1']]);
        $future = $this->service->design(self::FREE_DESIGN, 'new-node', 1, [], ['requires' => ['plugin' => '1.3.0', 'capabilities' => ['template-tree:2', 'carousel:1']]]);
        $tree = $future['object']['tree'];
        $tree['steps'][0]['content']['children'][] = ['type' => 'carousel', 'id' => 'n90'];
        $this->service->designs[1]['object']['tree'] = $tree;
        $this->service->designs[1]['object']['requires'] = ['plugin' => '1.3.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'carousel:1']];
        $this->service->design(self::FREE_DESIGN, 'premium-plus', 1, [], ['tier' => 'elite']);
        $this->service->collections = [['id' => 'later', 'revision' => str_repeat('a', 64), 'name' => 'Later', 'description' => 'From a later minor.',
            'cover' => 'spring', 'priority' => 1, 'business_types' => ['stores', 'clinics'], 'markets' => [], 'layout' => 'carousel',
            'items' => [['design' => 'today', 'stage' => 'any', 'weight' => 3], ['playlist' => 'x']]]];
        $this->service->publish();
        $catalog = $this->catalog();
        $status = $catalog->refresh();
        $cards = array_column($status['designs'], null, 'id');
        self::assertSame('install', $cards['today']['state']);
        self::assertSame('update_plugin', $cards['new-node']['state'], 'New vocabulary says update, never drops the library');
        self::assertSame('update_plugin', $cards['premium-plus']['state'], 'An unknown plan is unsupported, never free');
        self::assertFalse($status['update_required'], 'A higher minor is read, not refused');
        $catalog->install('today', $this->service->sha('today'));
        self::assertSame(['description' => 'A slip.'], $this->archive()->designs()[0]['meta']);
        try { $catalog->install('new-node', $this->service->sha('new-node')); self::fail('Installed a design this reader cannot read'); }
        catch (\RuntimeException $error) { self::assertStringContainsString('cannot be used on this site', $error->getMessage()); }
    }

    public function testATwoThousandDesignIndexFitsTheBudgetAndReadsQuickly(): void
    {
        for ($i = 0; $i < 2000; $i++) {
            $this->service->designs[] = ['object' => ['tier' => 'free'], 'entry' => [
                'id' => 'design-' . $i, 'revision' => 1, 'sha256' => hash('sha256', (string) $i), 'bytes' => 9000, 'name' => 'Design number ' . $i,
                'format' => 'popup', 'tier' => 'free', 'requires' => ['plugin' => '1.0.0', 'capabilities' => ['capture-journey:1', 'template-tree:2']],
                'facets' => ['act' => 'submit', 'captures' => ['email'], 'shape' => 'stack'], 'tags' => ['industry:food', 'style:minimal'],
                'thumb' => hash('sha256', 'a' . $i), 'family' => 'family-' . intdiv($i, 5),
            ]];
        }
        $this->service->designsPerPage = 500;
        // Entries only: the objects behind them are never fetched by a refresh.
        $publish = (function (): string {
            $pages = [];
            foreach (array_chunk(array_column($this->designs, 'entry'), $this->designsPerPage) as $chunk) {
                $json = json_encode(['schema' => 3, 'designs' => $chunk, 'setups' => []], JSON_THROW_ON_ERROR);
                $this->http->responses[CatalogFixture::BASE . 'index/' . hash('sha256', $json) . '.json'] = $json;
                $pages[] = hash('sha256', $json);
            }
            $release = json_encode(['schema' => 3, 'minor' => 0, 'pages' => $pages], JSON_THROW_ON_ERROR);
            $this->http->responses[CatalogFixture::BASE . 'releases/' . hash('sha256', $release) . '.json'] = $release;
            $this->http->responses[CatalogFixture::SOURCE] = json_encode(['schema' => 3, 'minor' => 0, 'release' => hash('sha256', $release)], JSON_THROW_ON_ERROR);
            return array_sum(array_map(fn (string $sha): int => strlen($this->http->responses[CatalogFixture::BASE . 'index/' . $sha . '.json']), $pages)) . '';
        })->call($this->service);
        self::assertLessThanOrEqual(\WConvert\Template\Catalog\CatalogIndex::MAX_INDEX_BYTES, (int) $publish);
        $this->catalog()->refresh();
        $started = microtime(true);
        $count = count($this->catalog()->status()['designs']);
        self::assertSame(2000, $count);
        self::assertLessThan(1.5, microtime(true) - $started, 'A cold status read of 2,000 entries stays interactive');
    }
}
