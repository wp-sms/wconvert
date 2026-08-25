<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Playbook\Playbook;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

/**
 * The shipped library.
 *
 * The assertion that matters is not "the files parse" — it is that a **shipped
 * entry gets no exemption**. Every one goes through exactly the registration
 * a third party's entry goes through, so the day a bundled Playbook names a
 * Slot Role its Template dropped, or pairs a click Goal with a submit design,
 * the build fails rather than the gallery quietly losing a card. It is the
 * same posture `TemplateLibraryTest` takes for the Template gallery
 * (ADR 0010).
 */
#[CoversClass(PlaybookLibrary::class)]
final class BundledPlaybooksTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private static function library(): PlaybookLibrary
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);

        return PlaybookLibrary::fromDirectory(
            TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR),
            $vocabulary,
            RuleVocabulary::fromManifest(self::PLUGIN_DIR),
            self::PLUGIN_DIR
        );
    }

    public function testEveryBundledPlaybookRegisters(): void
    {
        $this->assertSame([], array_map(
            static fn (\WConvert\Support\Rejection $r): array => $r->toArray(),
            self::library()->rejections()
        ));
        $this->assertNotSame([], self::library()->all());
    }

    /**
     * The gallery filters on **Goal only** (CONTEXT.md, Display Type), so a
     * Goal reachable on the goal screen with no Playbook under it lands the
     * merchant on an empty gallery. Four of five are covered here; the cart
     * Goal is `tier: pro` and its Playbooks arrive with the Conditions that
     * define it (ADR 0026).
     */
    public function testEveryGoalAFreeInstallCanReachHasSomethingToStartFrom(): void
    {
        $library = self::library();

        foreach (Goal::cases() as $goal) {
            if ($goal === Goal::RecoverCart) {
                continue;
            }

            $this->assertNotSame([], $library->servicing($goal), "{$goal->value} has no Playbook");
        }
    }

    /**
     * **Every Optin has at least one [[Trigger]].** "Shows immediately" is the
     * explicit `page_load` Trigger, never an empty list — an Optin with none
     * can never fire, which is a silent total loss of function with nothing in
     * any log (ADR 0012).
     */
    public function testEveryBundledPlaybookCarriesATriggerSoItsOptinCanFire(): void
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        foreach (self::library()->all() as $id => $playbook) {
            $this->assertNotSame(
                [],
                $vocabulary->partition($playbook->rules)['triggers'],
                "{$id} prefills an Optin that can never fire"
            );
        }
    }

    /**
     * A bundled entry naming a premium rule prefills a free install with a
     * rule free cannot evaluate, and the substitution resolver that would
     * repair it lands with its own ticket (ADR 0012). Until then, free's
     * bundled library stays inside free's own vocabulary.
     */
    public function testNoBundledPlaybookPrefillsARuleAFreeInstallCannotRun(): void
    {
        $premium = array_keys(array_filter(
            array_merge(
                \WConvert\Rules\RuleManifest::axis('triggers', self::PLUGIN_DIR),
                \WConvert\Rules\RuleManifest::axis('conditions', self::PLUGIN_DIR)
            ),
            static fn (array $entry): bool => ($entry['tier'] ?? 'free') !== 'free'
        ));

        foreach (self::library()->all() as $id => $playbook) {
            foreach ($playbook->rules as $rule) {
                $this->assertNotContains($rule['type'] ?? '', $premium, "{$id} prefills a premium rule");
            }
        }
    }

    /**
     * **A Playbook is nothing but words**, so every one of them has to be
     * reachable by `wp i18n make-pot` — which is the entire reason bundled
     * entries are PHP files rather than the JSON a Template ships as
     * (ADR 0013). A string that reached the array without going through
     * `__()` ships untranslatable.
     *
     * Driven by the PARSED entry rather than by a regex over the source. A
     * scan of the source text cannot tell a shipped sentence from a rule type
     * or an array key, so it would either miss words or flag `'wconvert'` —
     * and a check that cries wolf is a check that gets deleted. Every string a
     * merchant or a visitor actually reads is reached from here.
     */
    public function testEveryShippedWordIsTranslatable(): void
    {
        foreach (self::library()->all() as $id => $playbook) {
            $source = (string) file_get_contents(self::PLUGIN_DIR . '/' . PlaybookLibrary::PATH . '/' . $id . '.php');

            // A long note is written as concatenated literals across several
            // lines, so the opening quote is not always adjacent to the call.
            // Closing that gap here keeps the assertion one string comparison
            // rather than a regex nobody can read.
            $source = (string) preg_replace('/__\(\s+/', '__(', $source);

            foreach ([$playbook->name, $playbook->notes, ...self::wordsIn($playbook->copy)] as $words) {
                $this->assertStringContainsString(
                    "__('" . substr($words, 0, 40),
                    $source,
                    "{$id}: \"{$words}\" is a shipped string make-pot cannot see"
                );
            }
        }
    }

    /**
     * Every word inside a copy entry, whichever shape it takes — a plain
     * string, or the structured `{text, link: {label}}` a sentence with a link
     * inside it uses (ADR 0013).
     *
     * @param array<string, mixed> $copy
     * @return list<string>
     */
    private static function wordsIn(array $copy): array
    {
        $words = [];

        array_walk_recursive($copy, static function ($value) use (&$words): void {
            if (is_string($value) && $value !== '') {
                $words[] = $value;
            }
        });

        return $words;
    }

    /**
     * Notes are why it works, in the merchant's language — the half of a
     * Playbook that is advice rather than configuration (CONTEXT.md,
     * Playbook). An entry with none is a card with nothing to read.
     */
    public function testEveryBundledPlaybookExplainsItself(): void
    {
        foreach (self::library()->all() as $id => $playbook) {
            $this->assertNotSame('', $playbook->notes, "{$id} says nothing about why it works");
        }
    }

    public function testTheClickMeteredPlaybookCapturesNothing(): void
    {
        $sale = self::library()->find('sale-announcement');

        $this->assertInstanceOf(Playbook::class, $sale);
        $this->assertSame([], $sale->destinationHint, 'a click Optin pushes to no Destination (ADR 0025)');
        $this->assertArrayNotHasKey('consent_text', $sale->copy, 'and holds no Consent Record');
    }
}
