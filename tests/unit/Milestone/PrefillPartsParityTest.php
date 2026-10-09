<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\EditedPart;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * ============================================================================
 * A PART IS ONE OF THE THINGS PREFILL WRITES. THIS IS WHAT HOLDS THAT TRUE.
 * ============================================================================
 * {@see EditedPart}'s whole definition is *"the things
 * {@see Prefill::fromPlaybook()} actually writes into a new Optin"* — because
 * an override is only evidence about the [[Goal]] catalogue where there was an
 * opinion to override. A definition like that goes stale the first time a
 * [[Playbook]] learns to supply something new: the key would arrive in every
 * prefilled config, merchants would start changing it, and the milestone would
 * silently never see it.
 *
 * ============================================================================
 * IT MUTATES AND OBSERVES RATHER THAN READING A LIST.
 * ============================================================================
 * The obvious version declares each part's config keys and compares that list
 * against prefill's. That is a **second list**, in the file whose entire job is
 * to stop there being one — and it would pass against a part that declared a
 * key and then failed to read it.
 *
 * So this changes each key of a really-prefilled config, for every bundled
 * Playbook, and asserts something noticed. Nothing is declared anywhere; the
 * only way to pass is for the extractor to actually read the key.
 */
#[CoversClass(EditedPart::class)]
final class PrefillPartsParityTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * The keys prefill writes that no part claims, and why each one is not a
     * suggestion a merchant can reject.
     *
     * Short and reasoned on purpose: a growing list here is this test being
     * argued with rather than answered.
     */
    private const NOT_A_SUGGESTION = [
        // Provenance, exactly as `template_id` is provenance for a design. It
        // names the Playbook this whole record is ABOUT, and nothing in the
        // builder can edit it (CONTEXT.md, Playbook).
        'playbook_id',
        // Authoring state. It names Destination TYPES and the [[Lead]] fields
        // the Playbook needs, and the builder's Destinations tab READS it and
        // never writes it — so a difference in it cannot be a merchant's act
        // (CONTEXT.md, Playbook; `PublishedProjection`).
        'destination_hint',
        // Authoring state too: which prefilled link addresses the merchant has
        // not looked at yet (ADR 0133). It is read against the button's own
        // href, so changing the link is the Design part's edit, not this key's.
        'unchecked_links',
    ];

    private TemplateVocabulary $templates;

    private Prefill $prefill;

    private PlaybookLibrary $playbooks;

    protected function setUp(): void
    {
        $this->templates = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);

        $rules = RuleVocabulary::fromManifest(self::PLUGIN_DIR);
        $designs = TemplateLibrary::fromDirectory($this->templates, self::PLUGIN_DIR);

        $this->playbooks = PlaybookLibrary::fromDirectory($designs, $this->templates, $rules, self::PLUGIN_DIR);
        $this->prefill = new Prefill($this->playbooks, $designs, $this->templates, InstalledRules::withPro($rules));
    }

    /**
     * Every bundled Playbook's draft, keyed by Playbook id.
     *
     * @return array<string, array{goal: string, config: array<string, mixed>}>
     */
    private function drafts(): array
    {
        $drafts = [];

        foreach ($this->playbooks->all() as $playbook) {
            $draft = $this->prefill->fromPlaybook($playbook->id);

            if ($draft !== null) {
                $drafts[$playbook->id] = ['goal' => $draft['goal'], 'config' => $draft['config']];
            }
        }

        $this->assertNotSame([], $drafts, 'an empty scan is a library this check cannot speak for');

        return $drafts;
    }

    /**
     * **The claim.** Change any key a Playbook wrote, and a part notices.
     */
    public function testEveryKeyAPlaybookWritesIsClaimedByExactlyOnePart(): void
    {
        $invisible = [];

        foreach ($this->drafts() as $id => $draft) {
            foreach (array_keys($draft['config']) as $key) {
                if (in_array($key, self::NOT_A_SUGGESTION, true)) {
                    continue;
                }

                $edited = $draft['config'];
                $edited[$key] = ['changed-by-the-merchant'];

                $noticed = EditedPart::firstChangedBetween(
                    $draft['config'],
                    $edited,
                    $draft['goal'],
                    $draft['goal'],
                    $this->templates
                );

                if ($noticed === null) {
                    $invisible[] = "{$id}.{$key}";
                }
            }
        }

        $this->assertSame(
            [],
            $invisible,
            'a Playbook writes these and no EditedPart reads them, so a merchant changing one is invisible to #94'
        );
    }

    /**
     * And the two exclusions are still exclusions — asserted, so that removing
     * a key from prefill without removing it from the list above is visible.
     */
    public function testTheExcludedKeysAreStillThingsAPlaybookWrites(): void
    {
        $written = [];

        foreach ($this->drafts() as $draft) {
            $written = array_merge($written, array_keys($draft['config']));
        }

        foreach (self::NOT_A_SUGGESTION as $key) {
            $this->assertContains($key, $written, "no bundled Playbook writes {$key} any more");
        }
    }

    /**
     * ========================================================================
     * {@see EditedPart::Targeting} IS NOW REACHABLE BY MUTATION, AND THAT DAY
     * WAS PLANNED FOR.
     * ========================================================================
     * This method used to assert the opposite — *no bundled Playbook
     * constrains where its Optin shows* — and said outright what should happen
     * when one did:
     *
     * > The day a bundled Playbook does ship targeting, this fails and the
     * > walk above gains a fourth part — which is the right way round.
     *
     * That day is now. `article-end-newsletter` and `content-upgrade` narrow
     * to `singular: post` because a content upgrade offered on the checkout
     * page is the commonest way this Goal is experienced as spam, and
     * `category-promotion` narrows to `archive: product` for the same reason.
     *
     * So the tripwire is replaced by the assertion it was protecting: the walk
     * above now genuinely reaches `Targeting`, and this holds that true from
     * the other side. Deleting it and trusting the walk would leave the
     * coverage silently dependent on a bundled Playbook happening to ship a
     * key — which is the state this file exists to end.
     */
    public function testTargetingIsReachedByTheWalkAndNoticedWhenChanged(): void
    {
        $shipped = [];

        foreach ($this->drafts() as $id => $draft) {
            if (!array_key_exists('targeting', $draft['config'])) {
                continue;
            }

            $shipped[] = $id;

            $edited = $draft['config'];
            $edited['targeting'] = ['include' => [['type' => 'url', 'value' => '/changed-by-the-merchant']]];

            $this->assertSame(
                EditedPart::Targeting,
                EditedPart::firstChangedBetween(
                    $draft['config'],
                    $edited,
                    $draft['goal'],
                    $draft['goal'],
                    $this->templates
                ),
                "{$id} ships targeting and changing it is not read as an override of where it shows"
            );
        }

        $this->assertNotSame(
            [],
            $shipped,
            'no bundled Playbook ships targeting, so the walk above cannot reach EditedPart::Targeting by mutation'
        );

        // And adding one is an override, which is the whole of the claim.
        $draft = $this->drafts()['welcome-discount'];
        $edited = $draft['config'];
        $edited['targeting'] = ['include' => [['type' => 'front_page']]];

        $this->assertSame(
            EditedPart::Targeting,
            EditedPart::firstChangedBetween(
                $draft['config'],
                $edited,
                $draft['goal'],
                $draft['goal'],
                $this->templates
            )
        );
    }
}
