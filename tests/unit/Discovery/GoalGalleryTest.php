<?php

namespace WConvert\Tests\Unit\Discovery;

use PHPUnit\Framework\TestCase;
use WConvert\Discovery\GoalGallery;
use WConvert\Discovery\SetupIndex;
use WConvert\Goal\Goal;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Tier;
use WConvert\Template\Catalog\DesignArchive;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Template\Catalog\CatalogFixture;
use WConvert\Tests\Unit\Template\Catalog\FakeCatalogTransport;

/** Step 2's one answer: local setups, online ones it could add, and the library's state (ADR 0171). */
final class GoalGalleryTest extends TestCase
{
    private string $directory;
    private FakeOptionStore $options;
    private FakeCatalogTransport $http;
    private CatalogFixture $service;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-gallery-' . bin2hex(random_bytes(8));
        $this->options = new FakeOptionStore();
        $this->options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $this->http = new FakeCatalogTransport();
        $this->service = new CatalogFixture($this->http);
        $GLOBALS['wconvertTestTransients'] = [];
        $GLOBALS['wconvertTestCapabilities'] = ['install_plugins'];

        $free = require WCONVERT_DIR . 'resources/playbooks/reading-recommendation.php';
        $pro = require WCONVERT_DIR . 'pro/modules/display-types/playbooks/accessible-visit-note.php';
        $reading = $this->service->design('resources/templates/library/reading-slip.json', $free['template_id']);
        $note = $this->service->design('pro/modules/display-types/templates/availability-note.json', $pro['template_id']);
        $this->service->setup('online-reading', $reading, $free);
        $this->service->setup('online-note', $note, $pro, 1, 'pro');
        $this->service->setup('elsewhere', $reading, ['goal' => 'grow_email_list'] + $free);
        $this->service->publish();
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [];
        if (!is_dir($this->directory)) return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir((string) $file) : unlink((string) $file);
        rmdir($this->directory);
    }

    private function catalog(Tier $tier = Tier::Free): TemplateCatalog
    {
        $validator = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), $tier);
        $archive = new DesignArchive($this->directory, $validator, 'site-secret', null, $tier->value, [], static fn (): array => []);
        return new TemplateCatalog($this->options, $this->http, $validator, $archive, $tier,
            static fn (): array => [], static fn (): array => [], static fn (): int => 1_800_000_000, TemplateVocabulary::fromManifest()->facets());
    }

    /** @return array<string, mixed> */
    private function gallery(Tier $tier = Tier::Free, ?TemplateCatalog $catalog = null): array
    {
        $vocabulary = TemplateVocabulary::fromManifest();
        $templates = TemplateLibrary::fromDirectory($vocabulary);
        $playbooks = PlaybookLibrary::fromEntries([require WCONVERT_DIR . 'resources/playbooks/reading-recommendation.php'], $templates, $vocabulary, RuleVocabulary::fromManifest());
        $pro = new FakeProPresence($tier);
        return (new GoalGallery($playbooks, new SetupIndex($templates, $pro), $pro, $catalog ?? $this->catalog($tier)))->of(Goal::PromoteOffer);
    }

    public function testSendsNothingOnlineUntilTheLibraryIsAllowed(): void
    {
        $gallery = $this->gallery();
        self::assertSame(['reading-recommendation'], array_column($gallery['setups'], 'id'));
        self::assertSame([], $gallery['online']);
        self::assertSame(['configured' => true, 'consent' => 'unanswered'], $gallery['library']);
    }

    public function testALocalSetupCarriesItsDesignsFacets(): void
    {
        $setup = $this->gallery()['setups'][0];
        self::assertSame('click', $setup['facets']['act']);
        self::assertArrayHasKey('captures', $setup['facets']);
        self::assertSame('free', $setup['tier']);
    }

    public function testOffersTheGoalsOnlineSetupsWithTheirPicturesAndALockedOneAsAHint(): void
    {
        $this->options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $catalog = $this->catalog();
        $catalog->refresh();
        $online = array_column($this->gallery(catalog: $catalog)['online'], null, 'id');
        self::assertSame(['online-reading', 'online-note'], array_keys($online), 'Only this Goal');
        self::assertSame('install', $online['online-reading']['state']);
        self::assertSame('locked', $online['online-note']['state']);
        self::assertSame('slide_in', $online['online-note']['display_type']);
        self::assertSame([['id' => 'services', 'label' => 'Service businesses']], $online['online-note']['business_types']);
        self::assertArrayHasKey('act', $online['online-note']['facets']);
        self::assertStringStartsWith('https://wconvert.io/templates/', $online['online-note']['preview_url']);
        self::assertArrayHasKey('thumbnail', $online['online-reading']);
    }

    public function testALockedSetupIsNotOfferedWhereProHintsAreOff(): void
    {
        $this->options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $GLOBALS['wconvertTestCapabilities'] = [];
        $catalog = $this->catalog();
        $catalog->refresh();
        self::assertSame(['online-reading'], array_column($this->gallery(catalog: $catalog)['online'], 'id'));
    }

    public function testAPaidSetupAMissingPluginBlocksIsStillAHintOnFree(): void
    {
        $pro = require WCONVERT_DIR . 'pro/modules/display-types/playbooks/accessible-visit-note.php';
        $store = $this->service->design('pro/modules/display-types/templates/availability-note.json', 'store-note', 1, [], ['prerequisites' => ['woocommerce']]);
        $this->service->setup('store-only', $store, $pro, 1, 'pro');
        $this->service->publish();
        $this->options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $catalog = $this->catalog();
        $catalog->refresh();
        $online = array_column($this->gallery(catalog: $catalog)['online'], null, 'id');
        self::assertSame('unavailable', $online['store-only']['state'], 'Shown with its reason where hints are wanted');

        $GLOBALS['wconvertTestCapabilities'] = [];
        self::assertArrayNotHasKey('store-only', array_column($this->gallery(catalog: $catalog)['online'], null, 'id'));
    }

    public function testAnInstalledSetupIsDrawnAsTheLocalOneItBecame(): void
    {
        $this->options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $catalog = $this->catalog();
        $catalog->refresh();
        $catalog->installSetup('online-reading', $this->service->setupSha('online-reading'));
        self::assertNotContains('online-reading', array_column($this->gallery(catalog: $this->catalog())['online'], 'id'));
    }
}
