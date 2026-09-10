<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\GoalRegistry;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rest\PlaybookController;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\InstalledRules;
use WP_REST_Request;
use WP_REST_Response;

#[CoversClass(PlaybookController::class)]
final class PlaybookSetupTest extends TestCase
{
    public function testChooserFactsAreTheEffectivePrefillNotTheAuthoredPremiumRule(): void
    {
        $root = dirname(__DIR__, 3);
        $vocabulary = TemplateVocabulary::fromManifest($root);
        $templates = TemplateLibrary::fromDirectory($vocabulary, $root);
        $rules = RuleVocabulary::fromManifest($root);
        $playbooks = PlaybookLibrary::fromEntries([[
            'id' => 'third-party-start', 'name' => 'Third-party start',
            'goal' => 'grow_email_list', 'template_id' => 'centred-card',
            'rules' => [['type' => 'exit_intent']],
            'targeting' => ['logged_in' => false],
            'destination_hint' => ['types' => ['email_service_provider'], 'fields' => ['email']],
        ]], $templates, $vocabulary, $rules);
        $this->assertSame([], $playbooks->rejections());
        $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::free());
        $controller = new PlaybookController($playbooks,
            new GoalRegistry(new FakeProPresence(), new FakeSitePresence()), $prefill);
        $request = new WP_REST_Request('GET', '/wconvert/v1/playbooks');
        $request->set_param('goal', 'grow_email_list');
        $response = $controller->index($request);
        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $entry = $response->get_data()[0];
        $draft = $prefill->fromPlaybook('third-party-start');
        $this->assertNotNull($draft);
        $this->assertSame('exit_intent', $entry['rules'][0]['type'], 'Authoring provenance stays unchanged.');
        $this->assertSame('time_on_page', $entry['setup']['rules'][0]['type']);
        $this->assertSame(15, $entry['setup']['rules'][0]['seconds']);
        $this->assertSame($draft['config']['rules'], $entry['setup']['rules']);
        $this->assertSame($draft['config']['targeting'], $entry['setup']['targeting']);
        $this->assertSame($draft['config']['destination_hint'], $entry['setup']['destination_hint']);
        $this->assertSame($draft['config']['template'], $entry['template']);
        $this->assertSame('popup', $entry['setup']['display_type']);
        $this->assertArrayNotHasKey('template', $entry['setup']);
        $this->assertArrayNotHasKey('destinations', $entry['setup']);
        $this->assertArrayNotHasKey('copy', $entry['setup']);
    }
}
