<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Playbook\FlagshipCollection;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

#[CoversClass(FlagshipCollection::class)]
#[CoversClass(Prefill::class)]
final class FlagshipCollectionTest extends TestCase
{
    public function testTheTwelveStartsProduceCompleteCopyWithoutInventingMerchantDetails(): void
    {
        $root = dirname(__DIR__, 3);
        $vocabulary = TemplateVocabulary::fromManifest($root);
        $templates = TemplateLibrary::fromDirectory($vocabulary, $root);
        $playbooks = PlaybookLibrary::fromDirectory($templates, $vocabulary, RuleVocabulary::fromManifest($root), $root);
        $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::withPro());
        $ids = array_merge(...array_values(FlagshipCollection::GROUPS));
        $this->assertCount(12, array_unique($ids));
        $designs = [];
        foreach (FlagshipCollection::GROUPS as $members) {
            $this->assertCount(4, $members);
            foreach ($members as $id) {
                $playbook = $playbooks->find($id);
                $this->assertNotNull($playbook, $id);
                $designs[] = $playbook->templateId;
                $draft = $prefill->fromPlaybook($id);
                $this->assertNotNull($draft, $id);
                $this->assertNotEmpty($playbook->notes);
                $this->assertNotNull(FlagshipCollection::recommendation($id));
                $nodes = $draft['config']['template']['tree']['steps'];
                while ($nodes !== []) {
                    $node = array_pop($nodes);
                    $role = $node['role'] ?? null;
                    if (in_array($role, $vocabulary->authoredRoles(), true)) {
                        $this->assertEmpty($node['text'] ?? '', $id . ': merchant-owned ' . $role);
                    } elseif ($role !== null) {
                        $this->assertNotSame('', trim($node['text'] ?? $node['label'] ?? ''), $id . ': blank ' . $role . ' at ' . $node['id']);
                        if (isset($node['link'])) {
                            $this->assertNotEmpty($node['link']['label']);
                            $this->assertArrayNotHasKey('href', $node['link']);
                        }
                    }
                    if ($node['type'] === 'field') {
                        $this->assertNotEmpty($node['label'], $id);
                        $this->assertNotEmpty($node['placeholder'], $id);
                        if ($node['name'] === 'interest') {
                            $this->assertNotEmpty($node['options'], $id);
                        }
                    }
                    if (in_array($node['type'], ['button', 'followup'], true)) {
                        $this->assertEmpty($node['href'] ?? '', $id . ': merchant-owned URL');
                    }
                    array_push($nodes, ...TemplateTree::childrenOf($node));
                }
                $this->assertArrayNotHasKey('destinations', $draft['config']);
            }
        }
        $this->assertCount(12, array_unique($designs), 'Each flagship demonstrates a distinct composition.');
    }
}
