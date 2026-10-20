<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\Catalog\DesignArchive;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

final class PackPlaybooksTest extends TestCase
{
    /** @return array<string, mixed> */
    private function pack(): array
    {
        $source = file_get_contents(WCONVERT_DIR . 'resources/templates/library/fieldwork.json');
        $this->assertIsString($source);
        return ['schema' => 1, 'id' => 'store', 'version' => '1.0.0', 'name' => 'Store', 'description' => 'Store starts',
            'requires' => ['plugin' => '0.1.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'capture-journey:1', 'success-actions:1', 'campaign-starts:1']],
            'assets' => [],
            'templates' => [json_decode($source, true)],
            'playbooks' => [require WCONVERT_DIR . 'resources/playbooks/welcome-discount.php']];
    }

    public function testPaidBasketConditionNeedsItsCapabilityAndEntitledInstall(): void
    {
        $pack = $this->pack();
        $pack['playbooks'][0]['rules'] = [['type' => 'cart_has_items'], ['type' => 'page_load']];
        $validator = new PackValidator(\WConvert\Template\TemplateManifest::load(), TemplateVocabulary::fromManifest(), \WConvert\Support\Tier::Pro);
        try {
            $validator->decode(json_encode($pack, JSON_THROW_ON_ERROR));
            self::fail('Undeclared paid rule was accepted');
        } catch (RuntimeException $error) {
            self::assertStringContainsString('paid rule requirements', $error->getMessage());
        }
        $pack['requires']['capabilities'][] = 'paid-campaign-rules:1';
        self::assertSame($pack['playbooks'][0]['rules'], $validator->decode(json_encode($pack, JSON_THROW_ON_ERROR))['playbooks'][0]['rules']);
        foreach ([\WConvert\Support\Tier::Free] as $tier) {
            try {
                (new PackValidator(\WConvert\Template\TemplateManifest::load(), TemplateVocabulary::fromManifest(), $tier))->decode(json_encode($pack, JSON_THROW_ON_ERROR));
                self::fail('Insufficient tier accepted basket targeting');
            } catch (RuntimeException $error) { self::assertStringContainsString('rules this install', $error->getMessage()); }
        }
        $pack['playbooks'][0]['rules'][0]['product_ids'] = [123];
        $this->expectException(RuntimeException::class);
        $validator->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    public function testScopedScreenCopyIsValidatedAndPreserved(): void
    {
        $pack = $this->pack();
        $setup = require WCONVERT_DIR . 'resources/playbooks/repair-advice-request.php';
        $json = file_get_contents(WCONVERT_DIR . 'resources/templates/library/' . $setup['template_id'] . '.json');
        self::assertIsString($json);
        $pack['templates'] = [json_decode($json, true)];
        $pack['playbooks'] = [$setup];
        $pack['requires']['capabilities'] = PackValidator::CAPABILITIES;
        $validated = PackValidator::shipping()->decode(json_encode($pack, JSON_THROW_ON_ERROR));
        $this->assertSame($setup['copy'], $validated['playbooks'][0]['copy']);
        $scope = array_key_first($setup['copy']['screens']);
        $pack['playbooks'][0]['copy']['screens'][$scope]['headline'] = '<script>bad</script>';
        $this->expectException(RuntimeException::class);
        PackValidator::shipping()->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    /**
     * Install a hosted setup and its pinned design into a fresh archive.
     *
     * @param \Closure(array<string, mixed>): array<string, mixed> $change edits the setup's Playbook
     */
    private function installSetup(string $directory, int $revision, ?\Closure $change = null): DesignArchive
    {
        $http = new FakeCatalogTransport();
        $service = new CatalogFixture($http);
        $design = $service->design('resources/templates/library/fieldwork.json', 'fieldwork');
        $playbook = require WCONVERT_DIR . 'resources/playbooks/welcome-discount.php';
        $service->setup('welcome-discount', $design, $change === null ? $playbook : $change($playbook), $revision);
        $service->publish();
        $options = new FakeOptionStore();
        $options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $GLOBALS['wconvertTestTransients'] = [];
        $archive = new DesignArchive($directory, PackValidator::shipping(), 'secret', null, 'free');
        $catalog = new TemplateCatalog($options, $http, PackValidator::shipping(), $archive);
        $catalog->refresh();
        $catalog->installSetup('welcome-discount', $service->setupSha('welcome-discount'));
        return new DesignArchive($directory, PackValidator::shipping(), 'secret', null, 'free');
    }

    private function remove(string $directory): void
    {
        if (!is_dir($directory)) return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($directory);
    }

    public function testACorruptArchivedSetupIsIgnoredAndANewerRevisionOffersTheNewWords(): void
    {
        $directory = sys_get_temp_dir() . '/wconvert-setup-cache-' . bin2hex(random_bytes(8));
        try {
            $archive = $this->installSetup($directory, 1);
            $this->assertCount(1, $archive->playbooks());
            $this->assertCount(1, $archive->playbooks(), 'a second consumer reuses the same request-local snapshot');
            foreach (glob($directory . '/setups/*.json') ?: [] as $file) file_put_contents($file, 'broken');
            $this->assertSame([], (new DesignArchive($directory, PackValidator::shipping(), 'secret', null, 'free'))->playbooks(), 'a corrupt archive is ignored by the next request');

            $archive = $this->installSetup($directory, 2, static function (array $playbook): array {
                $playbook['rules'][0]['seconds'] = 15;
                return $playbook;
            });
            $this->assertSame(15, $archive->playbooks()[0]['rules'][0]['seconds']);
            $this->assertSame('setup-2-welcome-discount', $archive->playbooks()[0]['id']);
        } finally {
            $this->remove($directory);
        }
    }

    public function testInstalledStartsUseTheSharedPrefillAndUpdatesDoNotChangeExistingSnapshots(): void
    {
        $directory = sys_get_temp_dir() . '/wconvert-starts-' . bin2hex(random_bytes(8));
        try {
            $installed = $this->installSetup($directory, 1);
            $entry = $installed->playbooks()[0];
            $this->assertSame('registered:fieldwork', $installed->entries()[0]['design_key'], 'A favourite follows the design across revisions');
            $this->assertSame('setup-1-welcome-discount', $entry['id']);
            $this->assertSame('design-1-fieldwork', $entry['template_id']);
            $vocabulary = TemplateVocabulary::fromManifest();
            $templates = TemplateLibrary::from($vocabulary, $installed);
            $playbooks = PlaybookLibrary::fromEntries($installed->playbooks(), $templates, $vocabulary, RuleVocabulary::fromManifest());
            $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::withPro());
            $draft = $prefill->fromPlaybook($entry['id']);
            $this->assertSame(\WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'time_on_page', 'seconds' => 8]]), $draft['config']['display_rules']);
            $this->assertSame('grow_email_list', $draft['goal']);
            $this->assertArrayNotHasKey('destination_ids', $draft['config']);
            $before = json_encode($draft);
            $installed = $this->installSetup($directory, 2, static function (array $playbook): array {
                $playbook['rules'][0]['seconds'] = 15;
                return $playbook;
            });
            $this->assertCount(1, $installed->playbooks(), 'Only the newest revision of a setup offers a new campaign');
            $this->assertSame(15, $installed->playbooks()[0]['rules'][0]['seconds']);
            $this->assertSame($before, json_encode($draft), 'An existing campaign owns its snapshot.');
        } finally {
            $this->remove($directory);
        }
    }

    public function testRemoteStartingPointsRejectUnsafeUnsupportedAndSilentlyDroppedContent(): void
    {
        $changes = [
            'missing capability' => static function (&$p) { $p['requires']['capabilities'] = ['template-tree:2', 'capture-journey:1', 'success-actions:1']; },
            'duplicate id' => static function (&$p) { $p['playbooks'][] = $p['playbooks'][0]; },
            'too many starts' => static function (&$p) { $p['playbooks'] = array_fill(0, 13, $p['playbooks'][0]); },
            'unknown goal' => static function (&$p) { $p['playbooks'][0]['goal'] = 'unknown'; },
            'external design' => static function (&$p) { $p['playbooks'][0]['template_id'] = 'reading-slip'; },
            'markup' => static function (&$p) { $p['playbooks'][0]['copy']['headline'] = '<script>bad</script>'; },
            'unknown role' => static function (&$p) { $p['playbooks'][0]['copy']['unrecognised'] = 'Dropped'; },
            'extra copy' => static function (&$p) { $p['playbooks'][0]['copy']['headline'] = array_fill(0, 20, 'Dropped'); },
            'unknown nested key' => static function (&$p) { $p['playbooks'][0]['copy']['body'] = ['onclick' => 'bad']; },
            'code supplied' => static function (&$p) { $p['playbooks'][0]['copy']['code_value'] = 'REALCODE'; },
            'policy URL' => static function (&$p) { $p['playbooks'][0]['copy']['consent_text']['link']['href'] = 'https://example.org'; },
            'repeated role URL' => static function (&$p) { $p['playbooks'][0]['copy']['fine_print'][0]['link']['href'] = 'https://example.org'; },
            'remote state' => static function (&$p) { $p['playbooks'][0]['status'] = 'published'; },
            'destination binding' => static function (&$p) { $p['playbooks'][0]['destination_hint']['ids'] = ['01JQZK8N3M4P5Q6R7S8T9V0W1X']; },
            'hidden destination id' => static function (&$p) { $p['playbooks'][0]['destination_hint']['types'] = ['01JQZK8N3M4P5Q6R7S8T9V0W1X']; },
            'unknown capture hint' => static function (&$p) { $p['playbooks'][0]['destination_hint']['fields'] = ['credit_card']; },
            'no trigger' => static function (&$p) { $p['playbooks'][0]['rules'] = []; },
            'wrong parameter type' => static function (&$p) { $p['playbooks'][0]['rules'][0]['seconds'] = '8'; },
            'negative delay' => static function (&$p) { $p['playbooks'][0]['rules'][0]['seconds'] = -8; },
            'unknown rule' => static function (&$p) { $p['playbooks'][0]['rules'][] = ['type' => 'unknown']; },
            'premium rule' => static function (&$p) { $p['playbooks'][0]['rules'][] = ['type' => 'exit_intent']; },
            'site page id' => static function (&$p) { $p['playbooks'][0]['targeting'] = ['include' => [['type' => 'post', 'value' => 123]]]; },
            'visitor rule in union' => static function (&$p) { $p['playbooks'][0]['targeting'] = ['include' => [['type' => 'logged_in', 'value' => true]]]; },
            'bad targeting list' => static function (&$p) { $p['playbooks'][0]['targeting'] = ['exclude' => null]; },
            'bad audience flag' => static function (&$p) { $p['playbooks'][0]['targeting'] = ['logged_in' => 'false']; },
        ];
        foreach ($changes as $name => $change) {
            $pack = $this->pack(); $change($pack);
            try {
                PackValidator::shipping()->decode(json_encode($pack, JSON_THROW_ON_ERROR));
                $this->fail($name . ' was accepted');
            } catch (RuntimeException $error) {
                $this->assertNotSame('', $error->getMessage(), $name);
            }
        }
    }
}
