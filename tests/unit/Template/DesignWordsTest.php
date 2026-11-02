<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Template\DesignWords;
use WConvert\Template\TemplateManifest;

/**
 * Which keys are words, and which translations may stand in for their English.
 *
 * The two silent failures this exists for: a translation that loses `%s` and
 * takes a privacy link with it, and a walker that "translates" a value a rule or
 * a shop reads. Neither would show in a screenshot of the English library.
 */
#[CoversClass(DesignWords::class)]
final class DesignWordsTest extends TestCase
{
    private const LIST = [
        'A design' => 'Ein Design',
        'Details' => 'Angaben',
        'Headline' => 'Überschrift',
        'Link it. %s' => 'Verlink es. %s',
        'Privacy Policy' => 'Datenschutzerklärung',
        'email' => 'NEVER',
        'yes' => 'NEVER',
        'CODE10' => 'NEVER',
        'Maison' => 'NEVER',
        'https://example.com/' => 'NEVER',
        'A choice' => 'Eine Wahl',
        'A picture' => 'Ein Bild',
        'Sparkles' => 'Funken',
        'Result' => 'Ergebnis',
        'A note' => 'Ein Hinweis',
    ];

    private function words(): DesignWords
    {
        return new DesignWords(self::LIST, TemplateManifest::load());
    }

    /** @return array<string, mixed> */
    private function design(): array
    {
        return [
            'id' => 'keep-me',
            'name' => 'A design',
            'tree' => ['steps' => [[
                'id' => 'details',
                'name' => 'Details',
                'kind' => 'input',
                'details_note' => 'A note',
                'results' => [['id' => 'result', 'heading' => 'Result', 'body' => 'Unknown stays', 'href' => 'https://example.com/']],
                'content' => [
                    'type' => 'panel',
                    'decorations' => ['label' => 'Sparkles', 'items' => []],
                    'children' => [
                        ['type' => 'heading', 'id' => 'n1', 'role' => 'headline', 'text' => 'Headline'],
                        ['type' => 'eyebrow', 'id' => 'n2', 'role' => 'wordmark', 'text' => 'Maison'],
                        ['type' => 'code', 'id' => 'n3', 'role' => 'code_value', 'text' => 'CODE10'],
                        ['type' => 'text', 'id' => 'n4', 'text' => 'Link it. %s', 'link' => ['label' => 'Privacy Policy', 'href' => 'https://example.com/']],
                        ['type' => 'field', 'id' => 'n5', 'name' => 'email', 'label' => 'Details', 'options' => [['value' => 'yes', 'label' => 'A choice']]],
                        ['type' => 'image', 'id' => 'n6', 'src' => 'https://example.com/', 'alt' => 'A picture'],
                        ['type' => 'button', 'id' => 'n7', 'action' => 'submit', 'label' => 'Details', 'href' => 'https://example.com/'],
                        ['type' => 'text', 'id' => 'n8', 'text' => '%b'],
                    ],
                ],
            ]]],
        ];
    }

    public function testReplacesEveryKindOfWord(): void
    {
        $design = $this->words()->template($this->design());
        $step = $design['tree']['steps'][0];
        $children = $step['content']['children'];

        $this->assertSame('Ein Design', $design['name']);
        $this->assertSame('Angaben', $step['name']);
        $this->assertSame('Ein Hinweis', $step['details_note']);
        $this->assertSame('Ergebnis', $step['results'][0]['heading']);
        $this->assertSame('Funken', $step['content']['decorations']['label']);
        $this->assertSame('Überschrift', $children[0]['text']);
        $this->assertSame('Verlink es. %s', $children[3]['text']);
        $this->assertSame('Datenschutzerklärung', $children[3]['link']['label']);
        $this->assertSame('Angaben', $children[4]['label']);
        $this->assertSame('Eine Wahl', $children[4]['options'][0]['label']);
        $this->assertSame('Ein Bild', $children[5]['alt']);
    }

    public function testLeavesWhatARuleALeadOrAShopReadsAlone(): void
    {
        $design = $this->words()->template($this->design());
        $step = $design['tree']['steps'][0];
        $children = $step['content']['children'];

        $this->assertSame('keep-me', $design['id']);
        $this->assertSame('details', $step['id']);
        $this->assertSame('Maison', $children[1]['text'], 'a brand is the merchant\'s');
        $this->assertSame('CODE10', $children[2]['text'], 'a coupon is what the shop redeems');
        $this->assertSame('email', $children[4]['name']);
        $this->assertSame('yes', $children[4]['options'][0]['value']);
        $this->assertSame('https://example.com/', $children[3]['link']['href']);
        $this->assertSame('https://example.com/', $children[5]['src']);
        $this->assertSame('https://example.com/', $children[6]['href']);
        $this->assertSame('https://example.com/', $step['results'][0]['href']);
        $this->assertSame('Unknown stays', $step['results'][0]['body'], 'a word the list lacks stays English');
    }

    public function testASetupsNotesAreLeftForTheTextDomain(): void
    {
        $setup = $this->words()->playbook([
            'id' => 'setup',
            'name' => 'A design',
            'notes' => 'Details',
            'goal' => 'Details',
            'copy' => [
                'headline' => ['Headline', 'Unknown'],
                'consent_text' => ['text' => 'Link it. %s', 'link' => ['label' => 'Privacy Policy']],
                'interest_options' => ['options' => [['value' => 'yes', 'label' => 'A choice']]],
                'screens' => ['details' => ['headline' => 'Headline', 'success_action' => ['label' => 'Details', 'href' => 'https://example.com/']]],
                'code_value' => 'CODE10',
            ],
        ]);

        $this->assertSame('Ein Design', $setup['name']);
        $this->assertSame('Details', $setup['notes']);
        $this->assertSame('Details', $setup['goal']);
        $this->assertSame(['Überschrift', 'Unknown'], $setup['copy']['headline']);
        $this->assertSame('Verlink es. %s', $setup['copy']['consent_text']['text']);
        $this->assertSame('Datenschutzerklärung', $setup['copy']['consent_text']['link']['label']);
        $this->assertSame([['value' => 'yes', 'label' => 'Eine Wahl']], $setup['copy']['interest_options']['options']);
        $this->assertSame('Überschrift', $setup['copy']['screens']['details']['headline']);
        $this->assertSame(['label' => 'Angaben', 'href' => 'https://example.com/'], $setup['copy']['screens']['details']['success_action']);
        $this->assertSame('CODE10', $setup['copy']['code_value']);
    }

    public function testATranslationOverItsLimitKeepsTheEnglish(): void
    {
        $long = str_repeat('Ü', 61);
        $words = new DesignWords(['A design' => $long, 'Headline' => $long], TemplateManifest::load());
        $design = $words->template(['name' => 'A design', 'tree' => ['steps' => [['content' => ['type' => 'heading', 'id' => 'n1', 'text' => 'Headline']]]]]);

        $this->assertSame('A design', $design['name'], '122 bytes against a name\'s 120');
        $this->assertSame($long, $design['tree']['steps'][0]['content']['text']);
    }

    public function testAnEmptyListChangesNothingAndReadsNoManifest(): void
    {
        $design = $this->design();

        $this->assertSame($design, (new DesignWords([], ['nodes' => 'unread']))->template($design));
    }

    /** @return iterable<string, array{string, string, bool}> */
    public static function translations(): iterable
    {
        yield 'plain' => ['Hello', 'Hallo', true];
        yield 'a line break' => ["Take the\nscenic route.", "Nimm den\nschönen Weg.", true];
        yield 'empty' => ['Hello', '', false];
        yield 'stray space' => ['Hello', ' Hallo', false];
        yield 'markup' => ['Hello', '<b>Hallo</b>', false];
        yield 'a lost link' => ['Read our %s', 'Lies unsere Datenschutzerklärung', false];
        yield 'a doubled link' => ['Read our %s', 'Lies %s und %s', false];
        yield 'a lost bold' => ['Take %b off', 'Spare viel', false];
        yield 'a word that reads as a mark' => ['Fully yours', 'Dein 100%iger Favorit', false];
        yield 'too long for any word' => ['Hello', str_repeat('a', 2001), false];
    }

    #[DataProvider('translations')]
    public function testOnlyAFaithfulTranslationMayStandIn(string $english, string $translated, bool $accepted): void
    {
        $this->assertSame($accepted, DesignWords::acceptable($english, $translated));
    }

    public function testAListKeepsOnlyThePairsThatMayStandIn(): void
    {
        $this->assertSame(['Hello' => 'Hallo'], DesignWords::readList(['Hello' => 'Hallo', 'Read our %s' => 'Lies das', 'Number' => 7]));
        $this->assertSame([], DesignWords::readList('not a list'));
        $this->assertSame([], DesignWords::readList(null));
    }

    /** @return iterable<string, array{string, string|null}> */
    public static function locales(): iterable
    {
        yield 'exact' => ['de_DE', 'de_DE'];
        yield 'a variant' => ['de_DE_formal', 'de_DE'];
        yield 'the same language' => ['de_AT', 'de_DE'];
        yield 'a variant of the same language' => ['de_CH_informal', 'de_DE'];
        yield 'French in Canada' => ['fr_CA', 'fr_FR'];
        yield 'not listed' => ['es_ES', null];
        yield 'English' => ['en_US', null];
        yield 'Traditional is not Simplified' => ['zh_TW', null];
        yield 'Brazil is not Portugal' => ['pt_BR', null];
        yield 'Cyrillic is not Latin' => ['sr_RS', null];
    }

    #[DataProvider('locales')]
    public function testPicksAList(string $locale, ?string $expected): void
    {
        $this->assertSame($expected, DesignWords::pick($locale, ['de_DE', 'fr_FR', 'pt_PT', 'zh_CN', 'sr_Latn']));
    }

    public function testASiteInEnglishReadsNoList(): void
    {
        $this->assertSame([], (new \ReflectionProperty(DesignWords::class, 'words'))->getValue(DesignWords::bundled(WCONVERT_DIR, 'en_US')));
    }

    /**
     * A key added to the manifest is a word unless someone says otherwise, so
     * this names the whole answer: a new key fails here until it is decided.
     */
    public function testEveryContentKeyInTheManifestIsDecided(): void
    {
        $keys = DesignWords::wordKeys(TemplateManifest::load());
        $all = array_unique(array_merge(...array_values($keys)));
        sort($all);

        $this->assertSame([
            'alt', 'apply_label', 'copied_label', 'copy_failed_label', 'copy_label', 'days_label', 'emphasis', 'help',
            'hours_label', 'italic', 'label', 'link', 'minutes_label', 'options', 'placeholder', 'seconds_label', 'text',
        ], $all);
        $this->assertNotContains('text', $keys['code'], 'a code node\'s text is the coupon');
    }

    public function testNamesWordsAndTheirTightestLimit(): void
    {
        $words = DesignWords::wordsOfTemplate($this->design(), TemplateManifest::load());

        $this->assertArrayNotHasKey('CODE10', $words);
        $this->assertArrayNotHasKey('Maison', $words);
        $this->assertArrayNotHasKey('%b', $words);
        $this->assertArrayNotHasKey('yes', $words);
        $this->assertSame(['limit' => 120, 'kind' => 'design name'], $words['A design']);
        $this->assertSame(120, $words['Details']['limit'], 'a screen\'s name binds it, whatever else says it');
    }
}
