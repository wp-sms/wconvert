<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/** The enquiry bundle crosses the same copy and snapshot seams as every other starting point. */
#[CoversClass(Prefill::class)]
#[CoversClass(PlaybookLibrary::class)]
#[CoversClass(SlotRoles::class)]
#[CoversClass(TemplateLibrary::class)]
final class EnquiryPrefillTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private TemplateVocabulary $vocabulary;

    private TemplateLibrary $templates;

    protected function setUp(): void
    {
        $this->vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $this->templates = TemplateLibrary::fromDirectory($this->vocabulary, self::PLUGIN_DIR);
    }

    /** @return array{name: string, goal: string, config: array<string, mixed>} */
    private function draft(): array
    {
        $playbooks = PlaybookLibrary::fromDirectory(
            $this->templates,
            $this->vocabulary,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            self::PLUGIN_DIR
        );
        $draft = (new Prefill($playbooks, $this->templates, $this->vocabulary, InstalledRules::free()))
            ->fromPlaybook('request-a-quote');

        $this->assertNotNull($draft, 'the shipped enquiry Playbook registers and prefills on free');

        return $draft;
    }

    /**
     * @param array<string, mixed> $tree
     * @return array<string, array<string, mixed>>
     */
    private static function fieldsIn(array $tree): array
    {
        $fields = [];
        $stack = $tree['steps'] ?? [];

        while ($stack !== []) {
            $node = array_pop($stack);

            if (($node['type'] ?? null) === 'field') {
                $fields[$node['name']] = $node;
            }

            foreach (TemplateTree::childrenOf($node) as $child) {
                $stack[] = $child;
            }
        }

        return $fields;
    }

    /** @return list<array{value: string, label: string}> */
    private static function editedOptions(): array
    {
        return [
            ['value' => 'installation', 'label' => 'Nouvelle installation'],
            ['value' => 'repair', 'label' => 'Réparation'],
        ];
    }

    public function testTheStartingPointAsksOnlyForAReplyAddressAndAnOptionalService(): void
    {
        $draft = $this->draft();
        $config = $draft['config'];
        $fields = self::fieldsIn($config['template']['tree']);

        $this->assertSame(Goal::CollectEnquiries->value, $draft['goal']);
        $this->assertSame('Request a quote', $draft['name']);
        $this->assertSame('inline', $config['display_type']);
        $this->assertSame([['type' => 'page_load']], $config['rules']);
        $this->assertFalse($fields['name']['required']);
        $this->assertTrue($fields['email']['required']);
        $this->assertFalse($fields['interest']['required']);
        $this->assertCount(3, $fields);
        $this->assertSame('Which service do you need? (optional)', $fields['interest']['label']);
        $this->assertSame('Choose a service', $fields['interest']['placeholder']);
        $this->assertSame([
            ['value' => 'installation', 'label' => 'Installation'],
            ['value' => 'repair', 'label' => 'Repair'],
        ], $fields['interest']['options']);
        $this->assertSame(['types' => ['mailpoet'], 'fields' => ['email', 'interest']], $config['destination_hint']);
        $this->assertArrayNotHasKey('destinations', $config, 'the merchant chooses the shared route');
        $this->assertArrayNotHasKey('targeting', $config, 'placement does not invent a quote-page ID');

        $copy = SlotRoles::copyFrom($config['template']['tree'], $this->vocabulary);
        $this->assertSame('Request received', $copy['success_headline']);
        $this->assertSame('Thank you for getting in touch. We have received your quote request.', $copy['success_body']['text']);
        $this->assertSame(['label' => 'Privacy Policy'], $copy['fine_print']['link']);
        $this->assertSame(
            'We use these details to respond to your request. %s',
            $copy['fine_print']['text']
        );
    }

    public function testChoiceOptionsRoundTripAsOneStructuredRoleWithStableValuesAndTranslatedLabels(): void
    {
        $tree = $this->draft()['config']['template']['tree'];
        $bound = SlotRoles::bind($tree, ['interest_options' => ['options' => self::editedOptions()]], $this->vocabulary);
        $copy = SlotRoles::copyFrom($bound, $this->vocabulary);

        $this->assertSame(['options' => self::editedOptions()], $copy['interest_options']);
        $this->assertSame(
            self::editedOptions(),
            self::fieldsIn(SlotRoles::bind($this->vocabulary->withoutCopy($tree), $copy, $this->vocabulary))['interest']['options']
        );
    }

    public function testSavingTheSameDesignKeepsTheMerchantsChoiceLabelsAndAnswerValues(): void
    {
        $config = $this->draft()['config'];
        $config['template']['tree'] = SlotRoles::bind(
            $config['template']['tree'],
            ['interest_options' => ['options' => self::editedOptions()]],
            $this->vocabulary
        );

        $saved = $this->templates->snapshotInto($config, 'inline-choice');

        $this->assertSame(self::editedOptions(), self::fieldsIn($saved['template']['tree'])['interest']['options']);
        $this->assertSame($config, $saved, 'a save does not replace the existing snapshot with library samples');
    }

    public function testChoosingADifferentDesignCarriesChoiceContentIntoTheNewStructure(): void
    {
        $original = $this->templates->find('inline-choice');
        $this->assertNotNull($original);
        $alternative = $original;
        $alternative['id'] = 'other-choice';
        $alternative['tokens']['bg'] = '#ffffff';
        $alternative['tree']['steps'][0]['children'] = array_reverse($alternative['tree']['steps'][0]['children']);
        $source = new class ([$original, $alternative]) implements TemplateSource {
            /** @param list<array<string, mixed>> $candidates */
            public function __construct(private readonly array $candidates)
            {
            }

            public function entries(): array
            {
                return $this->candidates;
            }
        };
        $templates = TemplateLibrary::from($this->vocabulary, $source);
        $this->assertSame([], $templates->rejections());
        $config = $this->draft()['config'];
        $config['template']['tree'] = SlotRoles::bind(
            $config['template']['tree'],
            ['interest_options' => ['options' => self::editedOptions()]],
            $this->vocabulary
        );
        $config['template_id'] = 'other-choice';

        $switched = $templates->snapshotInto($config, 'inline-choice');
        $fields = self::fieldsIn($switched['template']['tree']);

        $this->assertSame(self::editedOptions(), $fields['interest']['options']);
        $this->assertSame('Which service do you need? (optional)', $fields['interest']['label']);
        $this->assertSame('Choose a service', $fields['interest']['placeholder']);
        $this->assertSame('#ffffff', $switched['template']['tokens']['bg']);
        $this->assertSame('fine_print', $switched['template']['tree']['steps'][0]['children'][0]['role']);
    }

    public function testChoosingADesignWithoutAChoiceDropsThatRoleWithoutChangingTheReplyAddress(): void
    {
        $config = $this->draft()['config'];
        $config['template_id'] = 'inline-rule';

        $switched = $this->templates->snapshotInto($config, 'inline-choice');
        $fields = self::fieldsIn($switched['template']['tree']);
        $copy = SlotRoles::copyFrom($switched['template']['tree'], $this->vocabulary);

        $this->assertArrayNotHasKey('interest', $fields);
        $this->assertArrayNotHasKey('interest_options', $copy);
        $this->assertSame('you@example.com', $fields['email']['placeholder']);
        $this->assertSame('Let us help with your next project', $copy['headline']);
    }
}
