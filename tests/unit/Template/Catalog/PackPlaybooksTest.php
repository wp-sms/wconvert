<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\Catalog\InstalledPacks;
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
            'requires' => ['plugin' => '0.1.0', 'tree' => 1, 'capabilities' => ['template-tree:1', 'success-actions:1', 'campaign-starts:1']],
            'assets' => [],
            'templates' => [json_decode($source, true)],
            'playbooks' => [require WCONVERT_DIR . 'resources/playbooks/welcome-discount.php']];
    }

    public function testPackConsumersReuseOneReadAndARepairOrInstallRefreshesIt(): void
    {
        $directory = sys_get_temp_dir() . '/wconvert-pack-cache-' . bin2hex(random_bytes(8));
        $installed = new InstalledPacks($directory, PackValidator::shipping());

        try {
            $pack = $this->pack();
            $json = json_encode($pack, JSON_THROW_ON_ERROR);
            $saved = $installed->install($json);
            $this->assertCount(1, $installed->entries());

            file_put_contents($directory . '/' . $saved['digest'] . '.json', 'broken');
            $this->assertCount(1, $installed->playbooks(), 'a second consumer rescanned the same request-local archive');
            $this->assertSame(
                [],
                (new InstalledPacks($directory, PackValidator::shipping()))->playbooks(),
                'a corrupt archive must be ignored by the next request'
            );

            $installed->install($json);
            $pack['version'] = '1.1.0';
            $pack['playbooks'][0]['rules'][0]['seconds'] = 15;
            $installed->install(json_encode($pack, JSON_THROW_ON_ERROR));

            $this->assertSame(15, $installed->playbooks()[0]['rules'][0]['seconds']);

            $pack['version'] = '1.2.0';
            $pack['playbooks'][0]['rules'][0]['seconds'] = 20;
            (new InstalledPacks($directory, PackValidator::shipping()))
                ->install(json_encode($pack, JSON_THROW_ON_ERROR));

            $pack['version'] = '1.1.1';
            $pack['playbooks'][0]['rules'][0]['seconds'] = 18;
            try {
                $installed->install(json_encode($pack, JSON_THROW_ON_ERROR));
                $this->fail('A stale request-local snapshot replaced a newer install.');
            } catch (RuntimeException $error) {
                $this->assertStringContainsString('already installed', $error->getMessage());
            }

            $this->assertSame(20, $installed->playbooks()[0]['rules'][0]['seconds']);
        } finally {
            foreach (glob($directory . '/*.json') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testInstalledStartsUseTheSharedPrefillAndUpdatesDoNotChangeExistingSnapshots(): void
    {
        $directory = sys_get_temp_dir() . '/wconvert-starts-' . bin2hex(random_bytes(8));
        $installed = new InstalledPacks($directory, PackValidator::shipping());
        try {
            $pack = $this->pack();
            $installed->install(json_encode($pack, JSON_THROW_ON_ERROR));
            $entry = $installed->playbooks()[0];
            $this->assertNotSame('welcome-discount', $entry['id']);
            $this->assertNotSame('fieldwork', $entry['template_id']);
            $vocabulary = TemplateVocabulary::fromManifest();
            $templates = TemplateLibrary::from($vocabulary, $installed);
            $playbooks = PlaybookLibrary::fromEntries($installed->playbooks(), $templates, $vocabulary, RuleVocabulary::fromManifest());
            $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::withPro());
            $draft = $prefill->fromPlaybook($entry['id']);
            $this->assertSame([['type' => 'time_on_page', 'seconds' => 8]], $draft['config']['rules']);
            $this->assertSame('grow_email_list', $draft['goal']);
            $this->assertArrayNotHasKey('destination_ids', $draft['config']);
            $this->assertArrayNotHasKey('status', $draft);
            $this->assertSame('Store', $playbooks->find($entry['id'])->toArray()['collection']['name']);
            $before = json_encode($draft);
            $pack['version'] = '1.1.0';
            $pack['playbooks'][0]['rules'][0]['seconds'] = 15;
            $installed->install(json_encode($pack, JSON_THROW_ON_ERROR));
            $this->assertCount(1, $installed->playbooks());
            $this->assertNotSame($entry['id'], $installed->playbooks()[0]['id']);
            $this->assertSame(15, $installed->playbooks()[0]['rules'][0]['seconds']);
            $this->assertCount(2, $installed->entries(), 'Old design baselines stay addressable.');
            $this->assertSame($before, json_encode($draft), 'An existing campaign owns its snapshot.');
            // A newer design-only release cannot resurrect a removed old start.
            $pack['version'] = '1.2.0'; unset($pack['playbooks']);
            $installed->install(json_encode($pack, JSON_THROW_ON_ERROR));
            $this->assertSame([], $installed->playbooks());
        } finally {
            foreach (glob($directory . '/*.json') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testRemoteStartingPointsRejectUnsafeUnsupportedAndSilentlyDroppedContent(): void
    {
        $changes = [
            'missing capability' => static function (&$p) { $p['requires']['capabilities'] = ['template-tree:1', 'success-actions:1']; },
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
