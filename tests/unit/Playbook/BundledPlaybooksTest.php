<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Playbook\Playbook;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
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
     * merchant on an empty gallery.
     *
     * **All five, as of #36.** Four were covered from the start and the cart
     * Goal was skipped here, because its Playbooks could not exist before the
     * [[Condition]]s that define it — nothing is written before its subject
     * (ADR 0029). They arrived with those Conditions, so the exemption goes
     * with them.
     */
    public function testEveryGoalHasSomethingToStartFrom(): void
    {
        $library = self::library();

        foreach (Goal::cases() as $goal) {
            $this->assertNotSame([], $library->servicing($goal), "{$goal->value} has no Playbook");
        }
    }

    /**
     * **Three cart Playbooks, split by INTRUSION and by nothing else.**
     *
     * They ride one Template, because what the cart [[Goal]] needs is *one
     * step, click-metered, CTA-bearing* — a shape it shares with the other
     * click Goal rather than a WooCommerce design (ADR 0025). So the only
     * axis worth three cards is how loudly the Optin asks, which is the
     * [[Trigger]]: on the way out, after a while, straight away.
     */
    public function testTheCartGoalShipsThreePlaybooksThatDifferOnlyInHowLoudlyTheyAsk(): void
    {
        $cart = self::library()->servicing(Goal::RecoverCart);
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        $this->assertCount(3, $cart);

        $triggers = [];

        foreach ($cart as $playbook) {
            $this->assertSame(
                'offer-panel',
                $playbook->templateId,
                'a cart Playbook named a Template of its own, and there are no WooCommerce designs (ADR 0025)'
            );

            foreach ($vocabulary->partition($playbook->rules)['triggers'] as $trigger) {
                $triggers[] = $trigger['type'];
            }
        }

        $this->assertSame(
            $triggers,
            array_unique($triggers),
            'two cart Playbooks ask at the same moment, so one of them is a duplicate card'
        );
    }

    /**
     * **`cart_value_min` is reachable only by hand**, so it appears in no
     * bundled entry: a currency threshold is site-local and a [[Playbook]] can
     * express nothing site-local. The manifest marks its `amount` `authored`,
     * which is what refuses a Playbook SUPPLYING one; this is the other half —
     * no bundled entry names the rule at all, since a card whose defining rule
     * the merchant must fill in by hand prefills an Optin that never holds.
     */
    public function testNoBundledPlaybookNamesTheCurrencyThreshold(): void
    {
        foreach (self::library()->all() as $id => $playbook) {
            foreach ($playbook->rules as $rule) {
                $this->assertNotSame('cart_value_min', $rule['type'] ?? '', "{$id} names a site-local threshold");
            }
        }
    }

    /**
     * **A cart Playbook captures nothing either**, which is the whole of
     * ADR 0025 read from the gallery: no form node in the design it names, no
     * [[Destination]] hint, no `consent_text` to snapshot a [[Consent Record]]
     * from.
     *
     * **It is a fact about the entries we ship, not a rule about the Goal**
     * (ADR 0059). The Template half used to be enforced at registration by the
     * converting-act check, and that check is gone: a third party may file a
     * capture design under this Goal, and a merchant may pick one. What is
     * asserted here is that OUR cart Playbooks do not — they are the
     * *"message on the page and a link back to the cart"* ADR 0025 describes.
     */
    public function testEveryCartPlaybookCapturesNothing(): void
    {
        foreach (self::library()->servicing(Goal::RecoverCart) as $playbook) {
            $this->assertSame([], $playbook->destinationHint, "{$playbook->id} pushes to a Destination");
            $this->assertArrayNotHasKey('consent_text', $playbook->copy, "{$playbook->id} holds a Consent Record");
        }
    }

    /**
     * **The CTA carries a label and no destination**, which is how a generic
     * entry asks the site for the one thing it cannot know. The way back to
     * the cart is resolved by the renderer from `wc_get_cart_url()`, with the
     * settings panel as the override (ADR 0025) — a Playbook naming an href
     * would be naming a page on one particular site.
     *
     * Asserted against the Template each cart entry actually names, because
     * that is what prefill snapshots.
     */
    public function testNoCartPlaybookNamesTheWayBackToTheCart(): void
    {
        $templates = TemplateLibrary::fromDirectory(TemplateVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR);

        foreach (self::library()->servicing(Goal::RecoverCart) as $playbook) {
            $tree = (array) ($templates->find($playbook->templateId)['tree'] ?? []);

            $this->assertNotSame([], $tree, "{$playbook->id} names no design");
            $this->assertSame([], self::hrefsIn($tree), "{$playbook->id}'s design names a site-local URL");
        }
    }

    /**
     * @param array<string, mixed> $tree
     * @return list<string>
     */
    private static function hrefsIn(array $tree): array
    {
        $found = [];

        array_walk_recursive($tree, static function ($value, $key) use (&$found): void {
            if ($key === 'href' && is_string($value) && $value !== '') {
                $found[] = $value;
            }
        });

        return $found;
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
     * ========================================================================
     * A PLAYBOOK MAY NAME A RULE THE INSTALL LACKS ONLY WHERE ITS GOAL
     * ALREADY DEMANDS THE SAME THING.
     * ========================================================================
     * This used to read *"no bundled entry names a premium rule"*, full stop,
     * and the reasoning it gave was: such an entry prefills a free install
     * with a rule free cannot evaluate. **That reasoning survives; the rule it
     * produced was too wide.** A gallery is only ever reached THROUGH a
     * [[Goal]] the merchant was able to choose ({@see \WConvert\Goal\GoalRegistry}),
     * so an entry under a `tier: pro` Goal cannot be prefilled onto a free
     * install at all — the goal screen hides it and the save route refuses it
     * (ADR 0026).
     *
     * So the question is not "is this rule premium" but **"can this Playbook
     * be reached on an install that cannot run it"**, and the Goal above it is
     * what answers. Both halves of [[Availability]] are checked, because both
     * can make a rule unrunnable and only one of them is buyable from us:
     *
     * - a `tier: pro` rule needs a `tier: pro` Goal over it;
     * - a rule declaring a [[SiteDependency]] needs a Goal declaring the SAME
     *   one, which is what stops a cart Condition being dropped into a
     *   [[Playbook]] for *Grow my email list* — a real and sensible pairing a
     *   merchant may build by hand (ADR 0025 routes them there), and one a
     *   bundled card must not make for them, since it would suspend the Optin
     *   on every store-less install that started from it.
     */
    public function testNoBundledPlaybookPrefillsARuleItsGoalCannotGuarantee(): void
    {
        $entries = array_merge(
            \WConvert\Rules\RuleManifest::axis('triggers', self::PLUGIN_DIR),
            \WConvert\Rules\RuleManifest::axis('conditions', self::PLUGIN_DIR)
        );

        foreach (self::library()->all() as $id => $playbook) {
            foreach ($playbook->rules as $rule) {
                $type = (string) ($rule['type'] ?? '');
                $entry = $entries[$type] ?? [];

                $ruleTier = Tier::tryFrom(is_string($entry['tier'] ?? null) ? $entry['tier'] : '') ?? Tier::Free;

                if ($ruleTier !== Tier::Free) {
                    // **The Goal's rung must reach the rule's**, which is the
                    // ladder's version of the sentence this test always made:
                    // an install that can choose the Goal must be able to
                    // evaluate the rule the Playbook prefills under it. Written
                    // as `includes()` rather than as equality, so a premium
                    // rule under a HIGHER Goal is fine and a free Goal
                    // prefilling one is not (ADR 0056).
                    $this->assertTrue(
                        $playbook->goal->tier()->includes($ruleTier),
                        "{$id} prefills the {$ruleTier->value} rule {$type} under a Goal a lower tier can reach"
                    );
                }

                $requires = SiteDependency::tryFrom(is_string($entry['requires'] ?? null) ? $entry['requires'] : '');

                if ($requires !== null) {
                    $this->assertSame(
                        $requires,
                        $playbook->goal->requires(),
                        "{$id} prefills {$type} under a Goal that does not need {$requires->value}"
                    );
                }
            }
        }
    }

    /**
     * Not a tautology: the assertion above is vacuous unless something in the
     * shipped library actually exercises it. The cart entries are what do —
     * they are the first bundled Playbooks to name a rule free cannot run.
     */
    public function testTheLibraryActuallyExercisesThatRule(): void
    {
        $entries = \WConvert\Rules\RuleManifest::axis('conditions', self::PLUGIN_DIR);
        $named = [];

        foreach (self::library()->all() as $playbook) {
            foreach ($playbook->rules as $rule) {
                $type = (string) ($rule['type'] ?? '');

                if (($entries[$type]['requires'] ?? null) !== null) {
                    $named[] = $type;
                }
            }
        }

        $this->assertNotSame([], $named, 'no bundled Playbook names a site-dependent rule');
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
     *
     * **The WHOLE sentence, spelled as one literal.** This asserted the first
     * forty characters and normalised the whitespace after `__(` away, which
     * made it pass on exactly the shape it exists to forbid: a long note
     * written as `__('first part ' . 'second part', 'wconvert')` starts at a
     * `__(` call and is still invisible to `make-pot`, which extracts a string
     * LITERAL and not an expression. Plugin Check found seven of them
     * ([#60](https://github.com/navidkashani/wconvert/issues/60)) in entries
     * this test had been passing since #27. Matching the closing `, 'wconvert')`
     * is what closes the gap — a concatenation cannot produce it.
     */
    public function testEveryShippedWordIsTranslatable(): void
    {
        foreach (self::library()->all() as $id => $playbook) {
            $source = (string) file_get_contents(self::PLUGIN_DIR . '/' . PlaybookLibrary::PATH . '/' . $id . '.php');

            foreach ([$playbook->name, $playbook->notes, ...self::wordsIn($playbook->copy)] as $words) {
                $this->assertStringContainsString(
                    self::asOneLiteral($words),
                    $source,
                    "{$id}: \"{$words}\" is a shipped string make-pot cannot see"
                );
            }
        }
    }

    /**
     * The call `make-pot` can read, spelled the way the file spells it.
     *
     * Single-quoted, because that is what every bundled entry uses and a
     * double-quoted string would interpolate a `$` a note may one day carry.
     */
    private static function asOneLiteral(string $words): string
    {
        return "__('" . str_replace(['\\', "'"], ['\\\\', "\\'"], $words) . "', 'wconvert')";
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
